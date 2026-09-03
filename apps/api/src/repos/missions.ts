import type { DbExec } from '../db/types.js';
import { NotFoundError } from '../lib/errors.js';

export interface MissionRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: 'LEARN' | 'MOVE' | 'DISCOVER' | 'BUILD';
  verification_method: 'QUIZ' | 'QR' | 'LOCATION';
  reward_points: number;
  status: string;
  requirements: Record<string, unknown>;
  payload: Record<string, unknown>;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export class MissionsRepo {
  constructor(private db: DbExec) {}

  async create(input: {
    slug: string;
    title: string;
    description: string;
    type: string;
    verificationMethod: string;
    rewardPoints: number;
    requirements: Record<string, unknown>;
    payload: Record<string, unknown>;
    status?: string;
    expiresAt?: Date | null;
  }): Promise<MissionRow> {
    const { rows } = await this.db.query<MissionRow>(
      `INSERT INTO missions
         (slug, title, description, type, verification_method, reward_points, requirements, payload, status, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        input.slug,
        input.title,
        input.description,
        input.type,
        input.verificationMethod,
        input.rewardPoints,
        JSON.stringify(input.requirements),
        JSON.stringify(input.payload),
        input.status ?? 'active',
        input.expiresAt ?? null,
      ],
    );
    return rows[0];
  }

  async findById(id: string): Promise<MissionRow | null> {
    const { rows } = await this.db.query<MissionRow>(`SELECT * FROM missions WHERE id = $1`, [id]);
    return rows[0] ?? null;
  }

  async findBySlug(slug: string): Promise<MissionRow | null> {
    const { rows } = await this.db.query<MissionRow>(`SELECT * FROM missions WHERE slug = $1`, [slug]);
    return rows[0] ?? null;
  }

  async requireActive(id: string): Promise<MissionRow> {
    const mission = await this.findById(id);
    if (!mission) throw new NotFoundError('Mission not found');
    return mission;
  }

  async listActive(): Promise<MissionRow[]> {
    const { rows } = await this.db.query<MissionRow>(
      `SELECT * FROM missions
       WHERE status = 'active' AND (expires_at IS NULL OR expires_at > now())
       ORDER BY created_at ASC`,
    );
    return rows;
  }
}
