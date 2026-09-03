import type { DbExec } from '../db/types.js';
import { NotFoundError } from '../lib/errors.js';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  status: string;
  bmoni_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
  revoked_at: string | null;
}

export class UsersRepo {
  constructor(private db: DbExec) {}

  async create(input: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
  }): Promise<UserRow> {
    const { rows } = await this.db.query<UserRow>(
      `INSERT INTO users (email, password_hash, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.email.toLowerCase(), input.passwordHash, input.firstName, input.lastName],
    );
    return rows[0];
  }

  async insertProfile(userId: string, displayName: string): Promise<void> {
    await this.db.query(
      `INSERT INTO profiles (user_id, display_name) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name`,
      [userId, displayName],
    );
  }

  async findByEmail(email: string): Promise<UserRow | null> {
    const { rows } = await this.db.query<UserRow>(
      `SELECT * FROM users WHERE lower(email) = $1`,
      [email.toLowerCase()],
    );
    return rows[0] ?? null;
  }

  async findById(id: string): Promise<UserRow | null> {
    const { rows } = await this.db.query<UserRow>(`SELECT * FROM users WHERE id = $1`, [id]);
    return rows[0] ?? null;
  }

  async updateProfile(
    userId: string,
    patch: { firstName?: string; lastName?: string; displayName?: string; phoneNumber?: string; country?: string },
  ): Promise<void> {
    await this.db.query(
      `UPDATE users SET
         first_name = COALESCE($2, first_name),
         last_name = COALESCE($3, last_name),
         updated_at = now()
       WHERE id = $1`,
      [userId, patch.firstName ?? null, patch.lastName ?? null],
    );
    await this.db.query(
      `UPDATE profiles SET
         display_name = COALESCE($2, display_name),
         phone_number = COALESCE($3, phone_number),
         country = COALESCE($4, country),
         updated_at = now()
       WHERE user_id = $1`,
      [userId, patch.displayName ?? null, patch.phoneNumber ?? null, patch.country ?? null],
    );
  }

  async getUserWithProfile(userId: string): Promise<{ user: UserRow; profile: Record<string, unknown> }> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    const { rows } = await this.db.query(`SELECT * FROM profiles WHERE user_id = $1`, [userId]);
    return { user, profile: (rows[0] ?? {}) as Record<string, unknown> };
  }

  async getProfile(userId: string): Promise<Record<string, unknown>> {
    const { rows } = await this.db.query(`SELECT * FROM profiles WHERE user_id = $1`, [userId]);
    return (rows[0] ?? {}) as Record<string, unknown>;
  }

  async setBmoniUserId(userId: string, bmoniUserId: string): Promise<void> {
    await this.db.query(`UPDATE users SET bmoni_user_id = $2, updated_at = now() WHERE id = $1`, [
      userId,
      bmoniUserId,
    ]);
  }

  async deleteUser(userId: string): Promise<void> {
    await this.db.query(`UPDATE users SET status = 'deleted', updated_at = now() WHERE id = $1`, [userId]);
  }
}

export class SessionsRepo {
  constructor(private db: DbExec) {}

  async create(userId: string, tokenHash: string, expiresAt: Date): Promise<SessionRow> {
    const { rows } = await this.db.query<SessionRow>(
      `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3) RETURNING *`,
      [userId, tokenHash, expiresAt],
    );
    return rows[0];
  }

  async findByTokenHash(tokenHash: string): Promise<SessionRow | null> {
    const { rows } = await this.db.query<SessionRow>(
      `SELECT * FROM sessions WHERE token_hash = $1 AND expires_at > now() AND revoked_at IS NULL`,
      [tokenHash],
    );
    return rows[0] ?? null;
  }

  async revoke(userId: string, tokenHash?: string): Promise<void> {
    if (tokenHash) {
      await this.db.query(`UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND token_hash = $2`, [
        userId,
        tokenHash,
      ]);
    } else {
      await this.db.query(`UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [
        userId,
      ]);
    }
  }
}
