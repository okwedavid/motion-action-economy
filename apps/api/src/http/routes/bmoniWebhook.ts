import express, { type Request, type Response, type RequestHandler } from 'express';
import type { AppServices } from '../../services/app.js';
import { BmoniWebhookService, dispatchWebhookEvent, type WebhookStoreAdapter } from '../../integrations/bmoni/webhookService.js';
import { logger } from '../../lib/logger.js';
import { config } from '../../config/index.js';

/**
 * BMONI webhook endpoint.
 *
 * Spec (https://bkey.mintlify.app/api-reference/webhooks.md):
 *  - Body must be read as RAW bytes for signature verification.
 *  - On invalid signature, return 401 (permanent failure, never retried).
 *  - Acknowledge promptly (2xx) and process out of band.
 *  - Dedup via X-Webhook-Id.
 *
 * Mount with `express.raw` BEFORE the global JSON parser so the raw bytes are
 * available (a re-serialized parsed body produces a different digest).
 */
export function bmoniWebhookMiddleware(app: AppServices): RequestHandler[] {
  return [
    express.raw({ type: 'application/json' }),
    (req: Request, res: Response) => {
      const rawBody = req.body;
      const signature = req.get('X-Webhook-Signature') ?? '';

      if (!(rawBody instanceof Buffer)) {
        return res.sendStatus(400);
      }

      if (!config.bmoni.webhookSecret) {
        logger.warn('bmoni.webhook_no_secret');
        return res.sendStatus(500);
      }

      const verifier = new BmoniWebhookService(config.bmoni.webhookSecret);
      if (!verifier.isValidSignature(rawBody, signature)) {
        // 401 is a permanent failure per the docs' retry table.
        return res.sendStatus(401);
      }

      let event: { id?: string; eventType?: string; payload?: Record<string, unknown> };
      try {
        event = JSON.parse(rawBody.toString('utf8')) as typeof event;
      } catch {
        return res.sendStatus(400);
      }

      const eventId = req.get('X-Webhook-Id') || event.id;
      if (!eventId || !event.eventType) return res.sendStatus(400);

      const store: WebhookStoreAdapter = {
        claim: (id, type, payload) => app.repos.webhook.claim('bmoni', id, type, payload),
        markProcessed: (id) => app.repos.webhook.markProcessed('bmoni', id),
      };

      // Acknowledge immediately (2xx), then process out of band.
      res.sendStatus(202);
      void dispatchWebhookEvent(eventId, event.eventType, event.payload ?? {}, store).catch((err) => {
        logger.error('bmoni.dispatch_error', { eventId, error: err instanceof Error ? err.message : String(err) });
      });
    },
  ];
}
