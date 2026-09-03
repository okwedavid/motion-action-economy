import { newDb, DataType } from 'pg-mem';
import { randomUUID } from 'node:crypto';
import type { DbExec } from '../db/types.js';
import type { ProofEngineDb } from '../services/proofEngine.js';
import { runMigrations } from '../db/migrate.js';
import { createServices, type AppServices } from '../services/app.js';
import { createRepos, type Repos } from '../services/container.js';
import { seedMissions } from '../services/missions.js';

/** A pg-mem backed DB conforming to ProofEngineDb (query + connect) and migration exec. */
export interface TestDb extends ProofEngineDb {
  pool: unknown;
}

/**
 * Creates an in-memory PostgreSQL database.
 *
 * The migration SQL is executed through the SAME `runMigrations` path used in
 * production (the whole file is sent as one multi-statement query, which keeps
 * dollar-quoted PL/pgSQL function bodies intact). pg-mem's Postgres adapter
 * understands multi-statement SQL, so no naive semicolon splitting is needed.
 */
export function createTestDb(): TestDb {
  const mem = newDb();

  // The production schema runs `CREATE EXTENSION IF NOT EXISTS pgcrypto` and
  // uses `gen_random_uuid()` as a column default. pg-mem does not ship pgcrypto,
  // so we register a pgcrypto extension that installs an equivalent in-memory
  // `gen_random_uuid`. `impure: true` is REQUIRED: pg-mem otherwise treats a
  // no-arg column default as a constant and reuses the SAME uuid for every
  // INSERT (→ duplicate primary key 23505). Production PostgreSQL is unchanged.
  mem.registerExtension('pgcrypto', (schema) =>
    schema.registerFunction({
      name: 'gen_random_uuid',
      returns: DataType.uuid,
      impure: true,
      implementation: () => randomUUID(),
    }),
  );

  // `to_jsonb(record)` is a PostgreSQL built-in used by the repos (e.g. to embed
  // a joined mission row into a payload). pg-mem does not implement it, so we
  // provide an equivalent in-memory shim for tests. Production is unchanged.
  mem.public.registerFunction({
    name: 'to_jsonb',
    args: [DataType.record],
    returns: DataType.jsonb,
    implementation: (arg: unknown) => JSON.stringify(arg ?? null),
  });

  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();

  const testDb: TestDb = {
    query: <T = Record<string, unknown>>(text: string, params?: unknown[]) =>
      pool.query(text, params).then((r: { rows: unknown[]; rowCount: number | null }) => ({
        rows: r.rows as T[],
        rowCount: r.rowCount,
      })),
    connect: async () => {
      return new Promise<{ query: DbExec['query']; release: () => void }>((resolve, reject) => {
        pool.connect((err: Error | null, client: { query: (t: string, p?: unknown[]) => Promise<{ rows: unknown[] }> }) => {
          if (err) return reject(err);
          const q = <T = Record<string, unknown>>(t: string, p?: unknown[]) =>
            client.query(t, p).then((r: { rows: unknown[] }) => ({
              rows: r.rows as T[],
              rowCount: null,
            }));
          resolve({ query: q, release: () => undefined });
        });
      });
    },
    pool,
  };
  return testDb;
}

/**
 * Applies the production migrations to an in-memory db by reusing the real
 * `runMigrations` runner with a pg-mem backed exec. Returns the applied files.
 */
export async function runMigrationsOn(db: TestDb): Promise<string[]> {
  return runMigrations((sql, params = []) => db.query(sql as string, params) as Promise<unknown>);
}

export interface TestContext {
  db: TestDb;
  services: AppServices;
  repos: Repos;
}

/** Fresh migrated + mission-seeded in-memory app context for tests. */
export async function createTestContext(seed = true): Promise<TestContext> {
  const db = createTestDb();
  await runMigrationsOn(db);
  const services = createServices(db);
  const repos = createRepos(db);
  if (seed) await seedMissions(repos.missions);
  return { db, services, repos };
}

