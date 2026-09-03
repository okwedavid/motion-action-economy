import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext, type TestContext } from '../test/helpers.js';
import { RewardEngine, PointsRewardProvider } from './rewardEngine.js';
import type { AppServices } from './app.js';

async function register(services: AppServices, email: string) {
  const { user } = await services.auth.register({ email, password: 'password123', firstName: 'A', lastName: 'B' });
  return user.id;
}

function makeEngine(ctx: TestContext): RewardEngine {
  return new RewardEngine(
    ctx.repos.rewards,
    ctx.repos.reputation,
    ctx.repos.ledger,
    [new PointsRewardProvider(ctx.repos.ledger)],
  );
}

/** Creates a real mission + attempt so reward allocations satisfy FKs. */
async function realAttempt(ctx: TestContext, userId: string): Promise<{ attemptId: string; missionId: string }> {
  const mission = (await ctx.services.missions.list())[0];
  const attempt = await ctx.repos.attempts.getOrCreate(userId, mission.id);
  return { attemptId: attempt.id, missionId: mission.id };
}

const grant = (userId: string, attemptId: string, missionId: string) => ({
  points: 100,
  reputationDelta: 10,
  reputationReason: 'verified_learning',
  reputationLabel: '+verified learning',
  referenceId: attemptId,
  attemptId,
  missionId,
  userId,
});

test('rewards: grant allocates points and reputation once', async () => {
  const ctx = await createTestContext();
  const userId = await register(ctx.services, 'r1@test.dev');
  const engine = makeEngine(ctx);
  const { attemptId, missionId } = await realAttempt(ctx, userId);

  const out = await engine.grant(grant(userId, attemptId, missionId));
  assert.equal(out.granted, true);
  assert.ok(out.allocationId);
  assert.equal(await ctx.repos.ledger.getBalance(userId), 100);
  assert.equal(await ctx.repos.reputation.scoreFor(userId), 10);
});

test('rewards: duplicate grant for same attempt is idempotent (no double reward)', async () => {
  const ctx = await createTestContext();
  const userId = await register(ctx.services, 'r2@test.dev');
  const engine = makeEngine(ctx);
  const { attemptId, missionId } = await realAttempt(ctx, userId);

  const first = await engine.grant(grant(userId, attemptId, missionId));
  assert.equal(first.granted, true);
  const second = await engine.grant(grant(userId, attemptId, missionId));
  assert.equal(second.granted, false, 'second grant for the same attempt must be a no-op');

  assert.equal(await ctx.repos.ledger.getBalance(userId), 100, 'points granted exactly once');
  assert.equal(await ctx.repos.reputation.scoreFor(userId), 10, 'reputation granted exactly once');
});

test('rewards: reusing an explicit idempotency key returns the existing allocation', async () => {
  const ctx = await createTestContext();
  const userId = await register(ctx.services, 'r3@test.dev');
  const engine = makeEngine(ctx);

  const missions = await ctx.services.missions.list();
  const a1 = await ctx.repos.attempts.getOrCreate(userId, missions[0].id);
  const a2 = await ctx.repos.attempts.getOrCreate(userId, missions[1].id);

  const key = 'fixed-idem-key';
  const first = await engine.grant(grant(userId, a1.id, missions[0].id), key);
  assert.equal(first.granted, true);
  const second = await engine.grant(grant(userId, a2.id, missions[1].id), key);
  assert.equal(second.granted, false);
  assert.equal(second.allocationId, first.allocationId);
});

test('rewards: allocation is recorded against the attempt (no duplicate attempts)', async () => {
  const ctx = await createTestContext();
  const userId = await register(ctx.services, 'r4@test.dev');
  const engine = makeEngine(ctx);
  const { attemptId, missionId } = await realAttempt(ctx, userId);

  await engine.grant(grant(userId, attemptId, missionId));
  const has = await ctx.repos.rewards.hasAllocationForAttempt(userId, attemptId);
  assert.equal(has, true);
});
