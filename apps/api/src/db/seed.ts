import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getPool, closePool } from './pool.js';
import { createRepos } from '../services/container.js';
import { hashPassword } from '../services/auth.js';
import { seedMissions } from '../services/missions.js';
import { logger } from '../lib/logger.js';

/**
 * Seeds a development/demo database.
 *
 * Creates:
 *  - a demo user (credentials logged at the end)
 *  - a POINTS reward pool
 *  - the standard set of missions (idempotent)
 *  - a QR token row so the seeded QR check-in mission actually validates
 */
export async function seed(demoEmail = 'demo@motion.app', demoPassword = 'demo-password'): Promise<void> {
  const db = getPool();
  const repos = createRepos(db);

  // POINTS pool (idempotent via findPoolByType).
  const pool = await repos.rewards.findPoolByType('POINTS');
  if (!pool) {
    await repos.rewards.createPool({ poolType: 'POINTS', total: 100000, sponsorName: 'MOTION' });
    logger.info('Created POINTS reward pool');
  }

  // Ensure demo user exists (idempotent).
  let user = await repos.users.findByEmail(demoEmail);
  if (!user) {
    const passwordHash = await hashPassword(demoPassword);
    user = await repos.users.create({
      email: demoEmail,
      passwordHash,
      firstName: 'Demo',
      lastName: 'User',
    });
    await repos.users.insertProfile(user.id, 'Demo User');
    logger.info('Created demo user', { email: demoEmail });
  }

  // Missions (idempotent).
  await seedMissions(repos.missions);
  const mission = await repos.missions.findBySlug('event-check-in');
  if (mission) {
    const token = mission.payload.qrToken as string | undefined;
    const { rows } = await db.query<{ id: string }>(
      `SELECT id FROM qr_tokens WHERE mission_id = $1 LIMIT 1`,
      [mission.id],
    );
    if (token && rows.length === 0) {
      await repos.qrTokens.create(mission.id, token, new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));
      logger.info('Created QR token for event-check-in mission', { missionId: mission.id });
    }
  }

  logger.info('Seed complete');
}

async function main(): Promise<void> {
  await seed();
  await closePool();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => {
    logger.error('Seed failed', { error: err.message });
    process.exit(1);
  });
}
