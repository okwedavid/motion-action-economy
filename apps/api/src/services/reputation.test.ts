import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext } from '../test/helpers.js';
import type { AppServices } from './app.js';
import { levelFromScore } from './reputation.js';

async function register(services: AppServices, email: string) {
  const { user } = await services.auth.register({ email, password: 'password123', firstName: 'A', lastName: 'B' });
  return user.id;
}

test('reputation: score is zero for a fresh user', async () => {
  const ctx = await createTestContext();
  const userId = await register(ctx.services, 'rep0@test.dev');
  const rep = await ctx.services.reputation.get(userId);
  assert.equal(rep.score, 0);
  assert.equal(rep.reasons.length, 0);
  assert.equal(rep.level.level, 1);
  assert.equal(rep.level.name, 'First Steps');
});

test('reputation: completing a mission adds a reason and raises the score', async () => {
  const ctx = await createTestContext();
  const userId = await register(ctx.services, 'rep1@test.dev');
  const quiz = (await ctx.services.missions.list()).find((m) => m.verification === 'QUIZ')!;
  const answers = quiz.quiz!.questions.map((_, i) => ({ questionIndex: i, answerIndex: 0 }));

  await ctx.services.proofs.completeQuiz(userId, quiz.id, answers, { ip: 'x' });
  const rep = await ctx.services.reputation.get(userId);
  assert.equal(rep.score, 10);
  assert.ok(rep.reasons.length >= 1);
  assert.equal(rep.level.level, 1, '10 points is still level 1');
});

test('reputation: level thresholds map correctly', () => {
  assert.equal(levelFromScore(0).level, 1);
  assert.equal(levelFromScore(25).level, 2);
  assert.equal(levelFromScore(25).name, 'Consistent');
  assert.equal(levelFromScore(140).level, 5);
  assert.equal(levelFromScore(140).name, 'Trailblazer');
  assert.equal(levelFromScore(1000).level, 8);
  assert.equal(levelFromScore(1000).name, 'Proof Pioneer');
});
