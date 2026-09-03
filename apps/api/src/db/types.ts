export interface DbExec {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
}

// Structural conformer for pg.Pool (already returns {rows})
export type PoolLike = {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
};

// A transaction-scoped exec also supports BEGIN/COMMIT/ROLLBACK via query.
export type TxExec = DbExec & {
  isTx: true;
};
