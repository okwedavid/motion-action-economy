import type { DbExec } from '../db/types.js';

export interface AllocationRow {
  id: string;
  user_id: string;
  attempt_id: string | null;
  pool_id: string | null;
  provider: string;
  amount: number;
  currency: string;
  status: string;
  idempotency_key: string;
  external_ref: string | null;
  issued_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PoolRow {
  id: string;
  sponsor_name: string;
  pool_type: string;
  status: string;
  total_allocated: number;
  remaining: number;
  external_ref: string | null;
  created_at: string;
  updated_at: string;
}

export class RewardsRepo {
  constructor(private db: DbExec) {}

  async createPool(input: {
    sponsorName?: string;
    poolType: string;
    total: number;
    externalRef?: string;
  }): Promise<PoolRow> {
    const { rows } = await this.db.query<PoolRow>(
      `INSERT INTO reward_pools (sponsor_name, pool_type, total_allocated, remaining, external_ref)
       VALUES ($1,$2,$3,$3,$4) RETURNING *`,
      [
        input.sponsorName ?? 'MOTION',
        input.poolType,
        input.total,
        input.externalRef ?? null,
      ],
    );
    return rows[0];
  }

  async findPoolByType(poolType: string): Promise<PoolRow | null> {
    const { rows } = await this.db.query<PoolRow>(
      `SELECT * FROM reward_pools WHERE pool_type = $1 AND status = 'active' ORDER BY created_at LIMIT 1`,
      [poolType],
    );
    return rows[0] ?? null;
  }

  async hasAllocationForAttempt(userId: string, attemptId: string): Promise<boolean> {
    const { rows } = await this.db.query(
      `SELECT 1 FROM reward_allocations WHERE user_id = $1 AND attempt_id = $2`,
      [userId, attemptId],
    );
    return rows.length > 0;
  }

  /**
   * Idempotent: creates a reward allocation. If the idempotency key already exists,
   * returns the existing allocation. If the (user, attempt) already has an allocation,
   * throws ConflictError (prevents double reward).
   */
  async createAllocation(input: {
    userId: string;
    attemptId: string;
    poolId: string | null;
    provider: string;
    amount: number;
    currency?: string;
    idempotencyKey: string;
  }): Promise<AllocationRow> {
    const { rows } = await this.db.query<AllocationRow>(
      `INSERT INTO reward_allocations
         (user_id, attempt_id, pool_id, provider, amount, currency, idempotency_key, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'issued')
       RETURNING *`,
      [
        input.userId,
        input.attemptId,
        input.poolId,
        input.provider,
        input.amount,
        input.currency ?? 'POINTS',
        input.idempotencyKey,
      ],
    );
    return rows[0];
  }

  async findByIdempotencyKey(key: string): Promise<AllocationRow | null> {
    const { rows } = await this.db.query<AllocationRow>(
      `SELECT * FROM reward_allocations WHERE idempotency_key = $1`,
      [key],
    );
    return rows[0] ?? null;
  }

  async listForUser(userId: string): Promise<AllocationRow[]> {
    const { rows } = await this.db.query<AllocationRow>(
      `SELECT * FROM reward_allocations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [userId],
    );
    return rows;
  }

  async setExternalRef(allocationId: string, externalRef: string): Promise<void> {
    await this.db.query(
      `UPDATE reward_allocations SET external_ref = $2, status = 'issued', issued_at = now(), updated_at = now() WHERE id = $1`,
      [allocationId, externalRef],
    );
  }
}

export class ReputationRepo {
  constructor(private db: DbExec) {}

  async addEvent(userId: string, delta: number, reason: string, label: string, referenceId?: string | null): Promise<void> {
    await this.db.query(
      `INSERT INTO reputation_events (user_id, delta, reason, label, reference_id) VALUES ($1,$2,$3,$4,$5)`,
      [userId, delta, reason, label, referenceId ?? null],
    );
  }

  async scoreFor(userId: string): Promise<number> {
    const { rows } = await this.db.query<{ total: string | number }>(
      `SELECT COALESCE(SUM(delta), 0) AS total FROM reputation_events WHERE user_id = $1`,
      [userId],
    );
    return Number(rows[0]?.total ?? 0);
  }

  async eventsFor(userId: string): Promise<Array<{ delta: number; reason: string; label: string; created_at: string }>> {
    const { rows } = await this.db.query(
      `SELECT delta, reason, label, created_at FROM reputation_events
       WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );
    return rows as Array<{ delta: number; reason: string; label: string; created_at: string }>;
  }
}
