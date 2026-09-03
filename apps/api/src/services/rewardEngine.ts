import crypto from 'node:crypto';
import { RewardsRepo, ReputationRepo } from '../repos/rewards.js';
import { LedgerRepo } from '../repos/ledger.js';

export interface RewardGrant {
  points: number;
  reputationDelta: number;
  reputationReason: string;
  reputationLabel: string;
  referenceId: string;
  attemptId: string;
  missionId: string;
  userId: string;
}

/**
 * RewardProvider interface — future reward sources implement this.
 */
export interface RewardProvider {
  name: 'POINTS' | 'BMONI' | 'SPONSOR';
  /** Execute the reward. Returns an external reference (e.g. bmoni transfer id) or null. */
  issue(grant: RewardGrant): Promise<{ externalRef?: string; status: 'issued' | 'pending' | 'failed' }>;
}

/**
 * PointsRewardProvider — always available; issues Motion Points on the ledger.
 */
export class PointsRewardProvider implements RewardProvider {
  name = 'POINTS' as const;

  constructor(private ledger: LedgerRepo) {}

  async issue(grant: RewardGrant) {
    await this.ledger.credit(grant.userId, grant.points, 'MISSION_COMPLETED', grant.referenceId);
    return { status: 'issued' as const };
  }
}

/**
 * RewardEngine — coordinates providers, guarantees idempotency.
 */
export class RewardEngine {
  constructor(
    private rewards: RewardsRepo,
    private reputation: ReputationRepo,
    private ledger: LedgerRepo,
    private providers: RewardProvider[],
  ) {}

  /** Grant the full reward set for a verified completion, safely and idempotently. */
  async grant(grant: RewardGrant, idempotencyKey?: string): Promise<{ granted: boolean; allocationId?: string }> {
    const key = idempotencyKey ?? this.idemKey(grant.userId, grant.attemptId, grant.missionId);

    // No double rewards per (user, attempt).
    if (await this.rewards.hasAllocationForAttempt(grant.userId, grant.attemptId)) {
      return { granted: false };
    }

    // Idempotency key reuse returns the existing allocation without re-awarding.
    const existing = await this.rewards.findByIdempotencyKey(key);
    if (existing) return { granted: false, allocationId: existing.id };

    const provider = this.providers.find((p) => p.name === 'POINTS');
    const pool = await this.rewards.findPoolByType('POINTS');
    const allocation = await this.rewards.createAllocation({
      userId: grant.userId,
      attemptId: grant.attemptId,
      poolId: pool?.id ?? null,
      provider: 'POINTS',
      amount: grant.points,
      idempotencyKey: key,
    });

    let providerResult: { externalRef?: string; status: 'issued' | 'pending' | 'failed' } = { status: 'issued' };
    if (provider) {
      providerResult = await provider.issue(grant);
    }

    // Reputation
    await this.reputation.addEvent(
      grant.userId,
      grant.reputationDelta,
      grant.reputationReason,
      grant.reputationLabel,
      grant.referenceId,
    );

    if (providerResult.externalRef) {
      await this.rewards.setExternalRef(allocation.id, providerResult.externalRef);
    }
    return { granted: true, allocationId: allocation.id };
  }

  private idemKey(userId: string, attemptId: string, missionId: string): string {
    return crypto
      .createHash('sha256')
      .update(`reward:${userId}:${attemptId}:${missionId}`)
      .digest('hex');
  }
}
