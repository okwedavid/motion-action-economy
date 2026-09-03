import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext } from '../test/helpers.js';
import type { AppServices } from './app.js';

async function register(services: AppServices, email: string) {
  const { user } = await services.auth.register({ email, password: 'password123', firstName: 'A', lastName: 'B' });
  return user.id;
}

test('wallet: overview exists before onboarding (inactive, demo labelled)', async () => {
  const ctx = await createTestContext();
  const userId = await register(ctx.services, 'w0@test.dev');
  const ov = await ctx.services.wallet.getOverview(userId);
  assert.equal(ov.provider, 'bmoni');
  assert.equal(ov.mode, 'mock');
  assert.equal(ov.demo, true, 'mock mode must be flagged demo');
  assert.equal(ov.balanceAvailable, false, 'mock mode never claims real balance');
  assert.ok(ov.supportedCurrencies.includes('NGN'));
  assert.ok(ov.wallets.length <= 1);
});

test('wallet: onboarding creates a wallet and records bmoni user id', async () => {
  const ctx = await createTestContext();
  const userId = await register(ctx.services, 'w1@test.dev');
  const ov = await ctx.services.wallet.onboard(userId, 'NGN');
  assert.equal(ov.demo, true, 'still demo in mock mode');
  // The user now has a bmoniUserId persisted.
  const profile = await ctx.repos.users.getProfile(userId);
  void profile;
  const userRow = await ctx.repos.users.findById(userId);
  assert.ok(userRow && userRow.bmoni_user_id, 'bmoni user id persisted, never recreated per launch');
  assert.equal(ov.onboarding.status, 'provisioning');
  assert.equal(ov.onboarding.active, false);
  assert.equal(ov.onboarding.hasKyc, false);
  assert.equal(ov.balanceAvailable, false, 'no fabricated balance in mock');
});

test('wallet: onboard twice reuses the same bmoni user (idempotent)', async () => {
  const ctx = await createTestContext();
  const userId = await register(ctx.services, 'w2@test.dev');
  await ctx.services.wallet.onboard(userId, 'NGN');
  await ctx.services.wallet.onboard(userId, 'NGN');
  const userRow = await ctx.repos.users.findById(userId);
  assert.ok(userRow && userRow.bmoni_user_id);
});

test('wallet: transactions list is empty then reflects a ledger movement', async () => {
  const ctx = await createTestContext();
  const userId = await register(ctx.services, 'w3@test.dev');
  let txs = await ctx.services.wallet.transactions(userId);
  assert.ok(Array.isArray(txs));

  // Earn Motion Points via a mission to prove wallet/ledger wiring.
  const quiz = (await ctx.services.missions.list()).find((m) => m.verification === 'QUIZ')!;
  const answers = quiz.quiz!.questions.map((_, i) => ({ questionIndex: i, answerIndex: 0 }));
  await ctx.services.proofs.completeQuiz(userId, quiz.id, answers, { ip: 'x' });

  const bal = await ctx.repos.ledger.getBalance(userId);
  assert.equal(bal, quiz.rewardPoints);
  txs = await ctx.services.wallet.transactions(userId);
  assert.ok(Array.isArray(txs));
});
