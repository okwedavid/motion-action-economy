/**
 * BMONI Embedded integration boundary.
 *
 * MOTION talks to BMONI ONLY through this module. Swap the provider behind the
 * same `BmoniGateway` interface by changing `BMONI_MODE`:
 *
 *   mock   -> deterministic sandbox (default; no credentials required)
 *   sandbox-> real HTTP against embedded-dev.bmoni.com
 *   live   -> real HTTP against embedded.bmoni.com (partner key required)
 *
 * The BMONI API key is server-side only and is never shipped to Flutter/Web.
 */
export { bmoniConfig, type BmoniConfig } from './config.js';
export { BmoniClient, type BmoniGateway } from './client.js';
export { BmoniSandboxProvider } from './sandboxProvider.js';
export { buildBmoniGateway } from './gateway.js';
export {
  BmoniWebhookService,
  dispatchWebhookEvent,
  type WebhookDispatchOutcome,
  type WebhookStoreAdapter,
} from './webhookService.js';
export type * from './types.js';
