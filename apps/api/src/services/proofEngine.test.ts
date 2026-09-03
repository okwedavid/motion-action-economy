import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext } from '../test/helpers.js';
import type { AppServices } from './app.js';
import { BadRequestError, ConflictError, ForbiddenError } from '../lib/errors.js';

async function register(services: AppServices, email: string) {
  const { user } = await services.auth.register({ email, password: 'password123', firstName: 'A', lastName: 'B' });
  return user.id;
}

function quizAnswers(count: number): Array<{ questionIndex: number; answerIndex: number }> {
  return Array.from({ length: count }, (_, i) => ({ questionIndex: i, answerIndex: 0 }));
}

test('quiz: all-correct answers pass and credit points', async () => {
  const ctx = await createTestContext();
  const userId = await register(ctx.services, 'q1@test.dev');
  const quiz = (await ctx.services.missions.list()).find((m) => m.verification === 'QUIZ')!;
  assert.equal(quiz.quiz!.questions.length, 5);

  const result = await ctx.services.proofs.completeQuiz(userId, quiz.id, quizAnswers(5), { ip: 'x' });
  assert.equal(result.ok, true);
  assert.equal(result.points, quiz.rewardPoints);
  assert.equal(await ctx.repos.ledger.getBalance(userId), quiz.rewardPoints);
});

test('quiz: insufficient correct answers fail without reward', async () => {
  const ctx = await createTestContext();
  const userId = await register(ctx.services, 'q2@test.dev');
  const quiz = (await ctx.services.missions.list()).find((m) => m.verification === 'QUIZ')!;

  // Only 1 correct (needs 3) -> fail
  const wrong = [{ questionIndex: 0, answerIndex: 1 }, { questionIndex: 1, answerIndex: 2 }];
  await assert.rejects(() => ctx.services.proofs.completeQuiz(userId, quiz.id, wrong, { ip: 'x' }), BadRequestError);
  assert.equal(await ctx.repos.ledger.getBalance(userId), 0, 'no points on failure');
});

test('quiz: duplicate completion is rejected (replay protection)', async () => {
  const ctx = await createTestContext();
  const userId = await register(ctx.services, 'q3@test.dev');
  const quiz = (await ctx.services.missions.list()).find((m) => m.verification === 'QUIZ')!;
  await ctx.services.proofs.completeQuiz(userId, quiz.id, quizAnswers(5), { ip: 'x' });
  await assert.rejects(() => ctx.services.proofs.completeQuiz(userId, quiz.id, quizAnswers(5), { ip: 'x' }), ConflictError);
});

test('qr: valid token completes the mission', async () => {
  const ctx = await createTestContext();
  const userId = await register(ctx.services, 'qr1@test.dev');
  const qr = (await ctx.services.missions.list()).find((m) => m.verification === 'QR')!;
  const token = 'abc123token';
  await ctx.repos.qrTokens.create(qr.id, token, new Date(Date.now() + 60_000));

  const result = await ctx.services.proofs.completeQr(userId, qr.id, token, { ip: 'x' });
  assert.equal(result.ok, true);
  assert.equal(result.points, qr.rewardPoints);
});

test('qr: invalid or expired token is rejected', async () => {
  const ctx = await createTestContext();
  const userId = await register(ctx.services, 'qr2@test.dev');
  const qr = (await ctx.services.missions.list()).find((m) => m.verification === 'QR')!;

  await ctx.repos.qrTokens.create(qr.id, 'good-token', new Date(Date.now() - 60_000)); // expired
  await assert.rejects(() => ctx.services.proofs.completeQr(userId, qr.id, 'good-token', { ip: 'x' }), BadRequestError);
  await assert.rejects(() => ctx.services.proofs.completeQr(userId, qr.id, 'does-not-exist', { ip: 'x' }), BadRequestError);
});

test('qr: single-use token cannot be replayed by another user', async () => {
  const ctx = await createTestContext();
  const userA = await register(ctx.services, 'qrA@test.dev');
  const userB = await register(ctx.services, 'qrB@test.dev');

  const { repos, services } = ctx;
  // Make the mission single-use.
  await repos.missions.create({
    slug: 'qr-single-use',
    title: 'One time',
    description: 'x',
    type: 'DISCOVER',
    verificationMethod: 'QR',
    rewardPoints: 10,
    requirements: { singleUse: true },
    payload: { qrToken: 'su-token' },
  });
  const singleQr = (await services.missions.list()).find((m) => m.slug === 'qr-single-use')!;
  await repos.qrTokens.create(singleQr.id, 'su-token', new Date(Date.now() + 60_000));

  await services.proofs.completeQr(userA, singleQr.id, 'su-token', { ip: 'x' });
  await assert.rejects(() => services.proofs.completeQr(userB, singleQr.id, 'su-token', { ip: 'x' }), BadRequestError);
});

test('location: inside radius completes and credits points', async () => {
  const ctx = await createTestContext();
  const userId = await register(ctx.services, 'loc1@test.dev');
  const loc = (await ctx.services.missions.list()).find((m) => m.verification === 'LOCATION')!;
  const center = loc.location!.center;
  const now = Date.now();

  const result = await ctx.services.proofs.completeLocation(
    userId, loc.id,
    { lat: center.lat, lng: center.lng, clientTimestamp: new Date(now).toISOString() },
    { serverNow: now },
  );
  assert.equal(result.ok, true);
  assert.equal(result.points, loc.rewardPoints);
});

test('location: outside radius is rejected', async () => {
  const ctx = await createTestContext();
  const userId = await register(ctx.services, 'loc2@test.dev');
  const loc = (await ctx.services.missions.list()).find((m) => m.verification === 'LOCATION')!;
  const now = Date.now();

  // ~ 50km from the Lagos center.
  await assert.rejects(
    () => ctx.services.proofs.completeLocation(
      userId, loc.id,
      { lat: 6.8, lng: 3.5, clientTimestamp: new Date(now).toISOString() },
      { serverNow: now },
    ),
    ForbiddenError,
  );
});

test('location: stale timestamp is rejected', async () => {
  const ctx = await createTestContext();
  const userId = await register(ctx.services, 'loc3@test.dev');
  const loc = (await ctx.services.missions.list()).find((m) => m.verification === 'LOCATION')!;
  const center = loc.location!.center;
  const now = Date.now();

  await assert.rejects(
    () => ctx.services.proofs.completeLocation(
      userId, loc.id,
      { lat: center.lat, lng: center.lng, clientTimestamp: new Date(now - 10 * 60_000).toISOString() },
      { serverNow: now },
    ),
    BadRequestError,
  );
});

test('location: future timestamp is rejected', async () => {
  const ctx = await createTestContext();
  const userId = await register(ctx.services, 'loc4@test.dev');
  const loc = (await ctx.services.missions.list()).find((m) => m.verification === 'LOCATION')!;
  const center = loc.location!.center;
  const now = Date.now();

  await assert.rejects(
    () => ctx.services.proofs.completeLocation(
      userId, loc.id,
      { lat: center.lat, lng: center.lng, clientTimestamp: new Date(now + 5 * 60_000).toISOString() },
      { serverNow: now },
    ),
    BadRequestError,
  );
});
