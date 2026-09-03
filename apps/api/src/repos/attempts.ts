import type { DbExec } from '../db/types.js';

export interface AttemptRow {
  id: string;
  user_id: string;
  mission_id: string;
  status: 'in_progress' | 'passed' | 'failed';
  verification: Record<string, unknown>;
  risk_flag: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProofRow {
  id: string;
  attempt_id: string;
  user_id: string;
  mission_id: string;
  verification: 'QUIZ' | 'QR' | 'LOCATION';
  evidence: Record<string, unknown>;
  status: 'submitted' | 'verified' | 'rejected';
  verified_at: string | null;
  created_at: string;
}

export class AttemptsRepo {
  constructor(private db: DbExec) {}

  async create(userId: string, missionId: string): Promise<AttemptRow> {
    const { rows } = await this.db.query<AttemptRow>(
      `INSERT INTO mission_attempts (user_id, mission_id, status, verification)
       VALUES ($1, $2, 'in_progress', '{}'::jsonb)
       RETURNING *`,
      [userId, missionId],
    );
    return rows[0];
  }

  /** Returns the existing attempt for (user, mission) or creates a fresh one. */
  async getOrCreate(userId: string, missionId: string): Promise<AttemptRow> {
    const existing = await this.findByUserAndMission(userId, missionId);
    if (existing) return existing;
    try {
      return await this.create(userId, missionId);
    } catch {
      // concurrent create — race lost, re-read
      const again = await this.findByUserAndMission(userId, missionId);
      return again as AttemptRow;
    }
  }

  async findByUserAndMission(userId: string, missionId: string): Promise<AttemptRow | null> {
    const { rows } = await this.db.query<AttemptRow>(
      `SELECT * FROM mission_attempts WHERE user_id = $1 AND mission_id = $2`,
      [userId, missionId],
    );
    return rows[0] ?? null;
  }

  async markPassed(userId: string, missionId: string, riskFlag: string): Promise<AttemptRow> {
    const { rows } = await this.db.query<AttemptRow>(
      `UPDATE mission_attempts
       SET status = 'passed', risk_flag = $3, completed_at = now(), updated_at = now()
       WHERE user_id = $1 AND mission_id = $2
       RETURNING *`,
      [userId, missionId, riskFlag],
    );
    return rows[0];
  }

  async markFailed(userId: string, missionId: string): Promise<AttemptRow> {
    const { rows } = await this.db.query<AttemptRow>(
      `UPDATE mission_attempts SET status = 'failed', updated_at = now()
       WHERE user_id = $1 AND mission_id = $2
       RETURNING *`,
      [userId, missionId],
    );
    return rows[0];
  }

  async listForUser(userId: string): Promise<Array<AttemptRow & { mission: Record<string, unknown> }>> {
    const { rows } = await this.db.query(
      `SELECT a.*, to_jsonb(m) AS mission
       FROM mission_attempts a
       JOIN missions m ON m.id = a.mission_id
       WHERE a.user_id = $1
       ORDER BY a.created_at DESC
       LIMIT 50`,
      [userId],
    );
    return rows as unknown as Array<AttemptRow & { mission: Record<string, unknown> }>;
  }
}

export class ProofsRepo {
  constructor(private db: DbExec) {}

  async create(input: {
    attemptId: string;
    userId: string;
    missionId: string;
    verification: 'QUIZ' | 'QR' | 'LOCATION';
    evidence: Record<string, unknown>;
  }): Promise<ProofRow> {
    const { rows } = await this.db.query<ProofRow>(
      `INSERT INTO proofs (attempt_id, user_id, mission_id, verification, evidence)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [
        input.attemptId,
        input.userId,
        input.missionId,
        input.verification,
        JSON.stringify(input.evidence),
      ],
    );
    return rows[0];
  }

  async markVerified(proofId: string): Promise<void> {
    await this.db.query(
      `UPDATE proofs SET status = 'verified', verified_at = now() WHERE id = $1`,
      [proofId],
    );
  }

  async findById(proofId: string): Promise<ProofRow | null> {
    const { rows } = await this.db.query<ProofRow>(`SELECT * FROM proofs WHERE id = $1`, [proofId]);
    return rows[0] ?? null;
  }

  async findForUser(userId: string): Promise<Array<ProofRow & { mission: Record<string, unknown> }>> {
    const { rows } = await this.db.query(
      `SELECT p.*, to_jsonb(m) AS mission
       FROM proofs p JOIN missions m ON m.id = p.mission_id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC
       LIMIT 50`,
      [userId],
    );
    return rows as unknown as Array<ProofRow & { mission: Record<string, unknown> }>;
  }
}

export interface QrTokenRow {
  id: string;
  mission_id: string;
  token: string;
  expires_at: string;
  used_at: string | null;
  used_by: string | null;
  created_at: string;
}

export class QrTokensRepo {
  constructor(private db: DbExec) {}

  async create(missionId: string, token: string, expiresAt: Date): Promise<QrTokenRow> {
    const { rows } = await this.db.query<QrTokenRow>(
      `INSERT INTO qr_tokens (mission_id, token, expires_at) VALUES ($1,$2,$3) RETURNING *`,
      [missionId, token, expiresAt],
    );
    return rows[0];
  }

  /**
   * Validate a QR token. Returns the token row when valid (exists, not expired).
   * If the mission flags the token single-use, also requires it not be used yet.
   * Uses atomic single-use claim when required to prevent replay.
   */
  async validate(token: string, missionId: string, singleUse: boolean, userId: string): Promise<QrTokenRow | null> {
    if (singleUse) {
      const { rows } = await this.db.query<QrTokenRow>(
        `UPDATE qr_tokens
         SET used_at = now(), used_by = $2
         WHERE token = $1 AND mission_id = $3
           AND used_at IS NULL AND expires_at > now()
         RETURNING *`,
        [token, userId, missionId],
      );
      return rows[0] ?? null;
    }
    const { rows } = await this.db.query<QrTokenRow>(
      `SELECT * FROM qr_tokens
       WHERE token = $1 AND mission_id = $2 AND expires_at > now()`,
      [token, missionId],
    );
    return rows[0] ?? null;
  }
}
