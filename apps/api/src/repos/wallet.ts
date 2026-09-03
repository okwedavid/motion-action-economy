import type { DbExec } from '../db/types.js';

export interface WalletRow {
  id: string;
  user_id: string;
  currency: string;
  status: string;
  address: string | null;
  smart_wallet_id: string | null;
  onboarded: boolean;
  has_kyc: boolean;
  rail_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WalletTxRow {
  id: string;
  wallet_id: string;
  user_id: string;
  type: string;
  state: string;
  currency: string;
  amount: string;
  status_message: string;
  internal_ref: string | null;
  bmoni_ref: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export class WalletRepo {
  constructor(private db: DbExec) {}

  async getOrCreate(userId: string, currency = 'NGN'): Promise<WalletRow> {
    const existing = await this.findForUser(userId, currency);
    if (existing) return existing;
    const { rows } = await this.db.query<WalletRow>(
      `INSERT INTO wallets (user_id, currency, status) VALUES ($1,$2,'not_created')
       ON CONFLICT (user_id, currency) DO NOTHING RETURNING *`,
      [userId, currency],
    );
    if (rows[0]) return rows[0];
    const again = await this.findForUser(userId, currency);
    return again as WalletRow;
  }

  async findForUser(userId: string, currency: string): Promise<WalletRow | null> {
    const { rows } = await this.db.query<WalletRow>(
      `SELECT * FROM wallets WHERE user_id = $1 AND currency = $2`,
      [userId, currency],
    );
    return rows[0] ?? null;
  }

  async listForUser(userId: string): Promise<WalletRow[]> {
    const { rows } = await this.db.query<WalletRow>(
      `SELECT * FROM wallets WHERE user_id = $1 ORDER BY created_at ASC`,
      [userId],
    );
    return rows;
  }

  async update(walletId: string, patch: Partial<WalletRow>): Promise<WalletRow> {
    const { rows } = await this.db.query<WalletRow>(
      `UPDATE wallets SET
         status = COALESCE($2, status),
         address = COALESCE($3, address),
         smart_wallet_id = COALESCE($4, smart_wallet_id),
         onboarded = COALESCE($5, onboarded),
         has_kyc = COALESCE($6, has_kyc),
         rail_active = COALESCE($7, rail_active),
         updated_at = now()
       WHERE id = $1 RETURNING *`,
      [
        walletId,
        patch.status ?? null,
        patch.address ?? null,
        patch.smart_wallet_id ?? null,
        patch.onboarded ?? null,
        patch.has_kyc ?? null,
        patch.rail_active ?? null,
      ],
    );
    return rows[0];
  }

  async createTx(input: {
    walletId: string;
    userId: string;
    type: string;
    state: string;
    currency: string;
    amount: string;
    statusMessage?: string;
    internalRef?: string;
    bmoniRef?: string;
    metadata?: Record<string, unknown>;
  }): Promise<WalletTxRow> {
    const { rows } = await this.db.query<WalletTxRow>(
      `INSERT INTO wallet_transactions
         (wallet_id, user_id, type, state, currency, amount, status_message, internal_ref, bmoni_ref, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        input.walletId,
        input.userId,
        input.type,
        input.state,
        input.currency,
        input.amount,
        input.statusMessage ?? '',
        input.internalRef ?? null,
        input.bmoniRef ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return rows[0];
  }

  async updateTxState(txId: string, state: string, message?: string, bmoniRef?: string | null): Promise<void> {
    await this.db.query(
      `UPDATE wallet_transactions SET state = $2,
         status_message = COALESCE($3, status_message),
         bmoni_ref = COALESCE($4, bmoni_ref),
         updated_at = now()
       WHERE id = $1`,
      [txId, state, message ?? null, bmoniRef ?? null],
    );
  }

  async txsForUser(userId: string, limit = 50): Promise<WalletTxRow[]> {
    const { rows } = await this.db.query<WalletTxRow>(
      `SELECT * FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit],
    );
    return rows;
  }

  async findTxByInternalRef(ref: string): Promise<WalletTxRow | null> {
    const { rows } = await this.db.query<WalletTxRow>(
      `SELECT * FROM wallet_transactions WHERE internal_ref = $1`,
      [ref],
    );
    return rows[0] ?? null;
  }
}
