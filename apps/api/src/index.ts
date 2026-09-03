import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config } from './config/index.js';
import { logger } from './lib/logger.js';
import { poolDb } from './db/index.js';
import { closePool } from './db/pool.js';
import { createServices } from './services/app.js';
import { errorHandler, notFound } from './http/middleware.js';
import { authRouter } from './http/routes/auth.js';
import { missionsRouter } from './http/routes/missions.js';
import { homeRouter } from './http/routes/home.js';
import { reputationRouter } from './http/routes/reputation.js';
import { walletRouter } from './http/routes/wallet.js';
import { bmoniWebhookMiddleware } from './http/routes/bmoniWebhook.js';

export function createApp(): Express {
  const app = express();
  const services = createServices(poolDb);

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins, credentials: true }));

  // BMONI webhook must see RAW bytes, so mount its raw parser before JSON.
  app.post('/webhooks/bmoni', ...bmoniWebhookMiddleware(services));

  app.use(express.json({ limit: '1mb' }));
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
  );

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'motion-api', env: config.env });
  });

  app.use('/auth', authRouter(services));
  app.use('/home', homeRouter(services));
  app.use('/missions', missionsRouter(services));
  app.use('/reputation', reputationRouter(services));
  app.use('/wallet', walletRouter(services));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

async function main(): Promise<void> {
  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info('Motion API listening', { port: config.port, env: config.env, demoMode: config.demoMode });
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
  });
}
