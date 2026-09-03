import { getPool } from './pool.js';
import type { DbExec } from './types.js';

/**
 * A DbExec-compatible adapter around the shared pg.Pool.
 * Repos/services operate purely against this narrow interface.
 */
export const db: DbExec = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]) {
    return getPool().query(text, params) as unknown as Promise<{ rows: T[]; rowCount: number | null }>;
  },
};

/** A pool-backed exec that exposes connect() for transaction helpers. */
export type PoolClientLike = { query: DbExec['query']; release: () => void };

export const poolDb: DbExec & { connect: () => Promise<PoolClientLike> } = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]) {
    return getPool().query(text, params) as unknown as Promise<{ rows: T[]; rowCount: number | null }>;
  },
  async connect() {
    const client = await getPool().connect();
    return { query: client.query.bind(client), release: () => client.release() };
  },
};
