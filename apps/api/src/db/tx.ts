import type { DbExec, TxExec } from './types.js';

/**
 * Runs `fn` inside a transaction.
 *
 * - For a real PostgreSQL Pool the pool exposes a `connect()` method; a dedicated
 *   client is checked out so BEGIN/COMMIT/ROLLBACK all run on the same connection.
 * - For a single-connection test client (e.g. pg-mem) BEGIN/COMMIT issued through
 *   the shared client are correct.
 */
export async function withTransaction<T>(
  db: DbExec & { connect?: () => Promise<{ query: DbExec['query']; release: () => void }> },
  fn: (tx: TxExec) => Promise<T>,
): Promise<T> {
  if (db.connect) {
    const client = await db.connect();
    const clientExec: DbExec = { query: (text, params) => client.query(text, params) };
    try {
      await clientExec.query('BEGIN');
      const result = await fn({ ...clientExec, isTx: true } as TxExec);
      await clientExec.query('COMMIT');
      return result;
    } catch (err) {
      await clientExec.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } else {
    try {
      await db.query('BEGIN');
      const result = await fn({ ...db, isTx: true } as TxExec);
      await db.query('COMMIT');
      return result;
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    }
  }
}
