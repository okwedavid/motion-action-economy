import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb, runMigrationsOn, createTestContext } from './helpers.js';

/**
 * Regression: pg-mem was caching gen_random_uuid() as a constant DEFAULT,
 * reusing the same uuid for every INSERT → duplicate primary key (23505).
 * This proves the test-only pgcrypto shim (impure:true) yields unique ids.
 */
test('regression: two inserts against uuid default produce different ids (no 23505)', async () => {
  const db = createTestDb();
  await runMigrationsOn(db);

  await db.query(`CREATE TABLE _probe_ids (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), n int)`);
  await db.query(`INSERT INTO _probe_ids (n) VALUES (1)`);
  await db.query(`INSERT INTO _probe_ids (n) VALUES (2)`);
  const { rows } = await db.query<{ id: string; n: number }>(`SELECT id, n FROM _probe_ids ORDER BY n`);
  assert.equal(rows.length, 2);
  assert.notEqual(rows[0].id, rows[1].id, 'gen_random_uuid default must differ per row');
});

test('regression: seedMissions is idempotent (no duplicate errors, stable count)', async () => {
  const { services, repos } = await createTestContext();
  await repos.missions.listActive();
  const before = (await services.missions.list()).length;
  assert.equal(before, 3, 'three seed missions present');

  // Running the seed again must be a safe no-op (guarded by findBySlug).
  await import('../services/missions.js').then(async (m) => {
    await m.seedMissions(repos.missions);
    await m.seedMissions(repos.missions);
  });

  const after = (await services.missions.list()).length;
  assert.equal(after, 3, 'count remains stable after repeated seeding');
});
