import { config } from '../../config/index.js';

/**
 * BMONI Embedded configuration.
 *
 * Official docs: https://bkey.mintlify.app/
 * - Base URLs: production https://embedded.bmoni.com, sandbox https://embedded-dev.bmoni.com
 * - Auth: `x-api-key: <partner key>` on every request.
 * - Paths already start with /v1/ — the base URL must NOT include /v1.
 *
 * Modes:
 *   mock   -> deterministic in-process sandbox provider. No network. Clearly marked.
 *   sandbox-> real HTTP calls against the BMONI development environment.
 *   live   -> real HTTP calls against BMONI production (requires partner credentials).
 *
 * The BMONI API key is server-side ONLY. Never expose it to Flutter/Web clients.
 */
export interface BmoniConfig {
  mode: 'mock' | 'sandbox' | 'live';
  baseUrl: string;
  apiKey: string;
  partnerId?: string;
  webhookSecret?: string;
}

export function bmoniConfig(): BmoniConfig {
  const mode = (process.env.BMONI_MODE ?? 'mock') as BmoniConfig['mode'];
  const baseUrl = config.bmoni.baseUrl || (mode === 'live' ? 'https://embedded.bmoni.com' : 'https://embedded-dev.bmoni.com');
  const demoSandboxKey = process.env.BMONI_DEMO_SANDBOX_KEY ?? '';
  const apiKey = config.bmoni.apiKey || (mode === 'sandbox' ? demoSandboxKey : '');

  if (mode === 'live' && !config.bmoni.apiKey) {
    throw new Error(
      'BMONI_MODE=live requires BMONI_API_KEY. Get a production partner key, or use BMONI_MODE=sandbox with the development key.',
    );
  }

  return {
    mode,
    baseUrl: baseUrl.replace(/\/$/, '').replace(/\/v1$/, ''),
    apiKey,
    partnerId: config.bmoni.partnerId || undefined,
    webhookSecret: config.bmoni.webhookSecret || undefined,
  };
}
