import crypto from 'node:crypto';
import { logger } from '../../lib/logger.js';

/**
 * BMONI webhook signature verification.
 *
 * Spec (https://bkey.mintlify.app/api-reference/webhooks.md):
 *  - `X-Webhook-Signature` is an HMAC-SHA256 of the RAW request body bytes,
 *    keyed with the webhook secretKey, hex-encoded.
 *  - Compare digests in constant time; check the length first because
 *    crypto.timingSafeEqual throws on a length mismatch.
 *  - `X-Webhook-Id` matches the body `id` and is used for deduplication.
 */
export class BmoniWebhookService {
  constructor(private secret: string) {}

  /** Compute the expected signature over the exact raw bytes. */
  signatureFor(rawBody: Buffer): string {
    return crypto.createHmac('sha256', this.secret).update(rawBody).digest('hex');
  }

  /** Constant-time comparison safe for length mismatches. */
  isValidSignature(rawBody: Buffer, received: string | undefined): boolean {
    if (!received) return false;
    const expected = this.signatureFor(rawBody);
    if (received.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(expected, 'hex'));
  }
}

/**
 * Dispatch result used by the HTTP layer to decide the response code and hence
 * whether BMONI will retry (see the retry table in the docs).
 */
export type WebhookDispatchOutcome =
  | { ok: true; eventId: string }
  | { ok: false; code: string; message: string };

/**
 * Handles a verified delivery idempotently and safely.
 *
 * `claim` / `markProcessed` are provided by a WebhookRepo-backed adapter so that
 * processed event ids are persisted and replays are dropped.
 */
export interface WebhookStoreAdapter {
  claim(eventId: string, eventType: string, payload: unknown): Promise<boolean>;
  markProcessed(eventId: string): Promise<void>;
}

/** Events we know how to handle. Anything else is acknowledged but logged. */
export async function dispatchWebhookEvent(
  eventId: string,
  eventType: string,
  payload: Record<string, unknown>,
  store: WebhookStoreAdapter,
): Promise<WebhookDispatchOutcome> {
  const claimed = await store.claim(eventId, eventType, payload);
  if (!claimed) {
    // Already seen — treat as success so BMONI does not retry a replay.
    return { ok: true, eventId };
  }

  // Process supported event types idempotently. Unsupported events are logged
  // and acknowledged (a 2xx means "delivered", which is true).
  switch (eventType) {
    case 'employee.deposit.completed':
    case 'employee.withdrawal.completed':
      logger.info('bmoni.money_event', { eventId, eventType });
      break;
    case 'onboarding.completed':
      logger.info('bmoni.onboarding_completed', { eventId });
      break;
    case 'kyc.action_required':
      logger.info('bmoni.kyc_action_required', { eventId });
      break;
    default:
      logger.warn('bmoni.unknown_event', { eventId, eventType });
  }

  await store.markProcessed(eventId);
  return { ok: true, eventId };
}
