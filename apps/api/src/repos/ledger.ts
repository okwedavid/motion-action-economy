import type { DbExec, TxExec } from '../db/types.js';

export interface LedgerRow {
  id: string;
  user_id: string;
  delta: number;
  reason: string;
  reference_id: string | null;
  balance_after: number;
  created_at: string;
}

export class LedgerRepo {
  constructor(private db: DbExec | TxExec) {}

  private get client(): DbExec {
    return this.db;
  }

  async getBalance(userId: string): Promise<number> {
    const { rows } = await this.client.query<{ balance: number }>(
      `SELECT COALESCE(balance, 0) AS balance FROM motion_balances WHERE user_id = $1`,
      [userId],
    );
    return rows[0]?.balance ?? 0;
  }

  /**
   * Atomically credit ledger entry + balance within a transaction.
   * Returns the new balance.
   */
  async credit(
    userId: string,
    delta: number,
    reason: string,
    referenceId: string | null,
    force?: { balance: number; version: number },
  ): Promise<number> {
    if ((this.db as TxExec).isTx) {
      return this.creditTx(userId, delta, reason, referenceId);
    }
    // standalone (no surrounding tx): still safe via single-row optimistic update
    return this.creditStandalone(userId, delta, reason, referenceId, force);
  }

  protected async creditTx(userId: string, delta: number, reason: string, referenceId: string | null) {
    const { rows } = await this.client.query<{ balance: number }>(
      `INSERT INTO motion_balances (user_id, balance, version)
       VALUES ($1, $2, 1)
       ON CONFLICT (user_id) DO UPDATE SET
         balance = motion_balances.balance + $2,
         version = motion_balances.version + 1,
         updated_at = now()
       RETURNING balance`,
      [userId, delta],
    );
    const balance = rows[0].balance;
    await this.client.query(
      `INSERT INTO motion_ledger (user_id, delta, reason, reference_id, balance_after)
       VALUES ($1,$2,$3,$4,$5)`,
      [userId, delta, reason, referenceId, balance],
    );
    return balance;
  }

  protected async creditStandalone(
    userId: string,
    delta: number,
    reason: string,
    referenceId: string | null,
    force?: { balance: number; version: number },
  ) {
    if (force) {
      const { rows } = await this.client.query<{ balance: number }>(
        `INSERT INTO motion_balances (user_id, balance, version)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO NOTHING
         RETURNING balance`,
        [userId, force.balance, force.version],
      );
      let balance = rows[0]?.balance;
      if (!balance) {
        const upd = await this.client.query<{ balance: number }>(
          `UPDATE motion_balances SET balance = $2, version = version + 1, updated_at = now()
           WHERE user_id = $1 RETURNING balance`,
          [userId, force.balance],
        );
        balance = upd.rows[0].balance;
      }
      await this.client.query(
        `INSERT INTO motion_ledger (user_id, delta, reason, reference_id, balance_after) VALUES ($1,$2,$3,$4,$5)`,
        [userId, delta, reason, referenceId, balance],
      );
      return balance;
    }
    return this.creditTx(userId, delta, reason, referenceId);
  }

  async listForUser(userId: string, limit = 50): Promise<LedgerRow[]> {
    const { rows } = await this.client.query<LedgerRow>(
      `SELECT * FROM motion_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit],
    );
    return rows;
  }
}
