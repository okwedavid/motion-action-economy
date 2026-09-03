import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool, closePool } from './pool.js';
import { logger } from '../lib/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type MigrationExec = (sql: string, params?: unknown[]) => Promise<unknown>;

export async function runMigrations(exec: MigrationExec = sqlExec): Promise<string[]> {
  await exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    filename TEXT NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);

  const dir = path.join(__dirname, 'migrations');
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const appliedResult = await exec(`SELECT filename FROM schema_migrations`);
  const applied = new Set((appliedResult as { rows?: { filename: string }[] }).rows?.map((r) => r.filename) ?? []);

  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    await exec(sql);
    await exec(`INSERT INTO schema_migrations (filename) VALUES ($1)`, [file]);
    ran.push(file);
    logger.info('Applied migration', { file });
  }
  return ran;
}

async function sqlExec(sql: string, params: unknown[] = []): Promise<unknown> {
  const r = await getPool().query(sql, params);
  return { rows: r.rows };
}

async function main(): Promise<void> {
  const ran = await runMigrations();
  await closePool();
  if (ran.length === 0) {
    logger.info('No pending migrations');
  } else {
    logger.info('Migration complete', { applied: ran });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => {
    logger.error('Migration failed', { error: err.message });
    process.exit(1);
  });
}
