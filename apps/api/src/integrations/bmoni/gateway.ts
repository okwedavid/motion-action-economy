import { bmoniConfig, type BmoniConfig } from './config.js';
import { BmoniClient, type BmoniGateway } from './client.js';
import { BmoniSandboxProvider } from './sandboxProvider.js';
import { logger } from '../../lib/logger.js';

/**
 * Builds the BMONI gateway for the configured mode.
 *
 *  - "mock"    -> deterministic in-process sandbox provider (always clearly labelled).
 *  - "sandbox" -> real HTTP calls against embedded-dev.bmoni.com.
 *  - "live"    -> real HTTP calls against embedded.bmoni.com (requires partner key).
 */
export function buildBmoniGateway(cfg: BmoniConfig = bmoniConfig()): BmoniGateway {
  if (cfg.mode === 'mock') {
    logger.info('bmoni.gateway', { mode: 'mock' });
    return new BmoniSandboxProvider();
  }
  logger.info('bmoni.gateway', { mode: cfg.mode, baseUrl: cfg.baseUrl });
  return new BmoniClient(cfg);
}
