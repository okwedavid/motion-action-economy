import type { DbExec } from '../db/types.js';

export class AuditRepo {
  constructor(private db: DbExec) {}

  async record(input: {
    userId?: string | null;
    action: string;
    resource?: string;
    resourceId?: string;
    ip?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO audit_events (user_id, action, resource, resource_id, ip, metadata)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        input.userId ?? null,
        input.action,
        input.resource ?? null,
        input.resourceId ?? null,
        input.ip ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
  }
}

export interface WebhookEventRow {
  id: string;
  provider: string;
  provider_event_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: string;
  created_at: string;
  processed_at: string | null;
}

export function makeProviderKey(provider: string, eventId: string): string {
  return `${provider}:${eventId}`;
}

export class WebhookRepo {
  constructor(private db: DbExec) {}

  /**
   * Atomically claim a provider event for processing. Returns true if this caller
   * is the first to claim it (idempotency), false if already processed.
   */
  async claim(provider: string, providerEventId: string, eventType: string, payload: unknown): Promise<boolean> {
    try {
      const { rows } = await this.db.query<{ id: string }>(
        `INSERT INTO webhook_events (provider, provider_event_id, event_type, payload)
         VALUES ($1,$2,$3,$4) RETURNING id`,
        [provider, providerEventId, eventType, JSON.stringify(payload)],
      );
      return rows.length > 0;
    } catch {
      // Unique (provider, provider_event_id) violation -> already processed/claimed
      return false;
    }
  }

  async markProcessed(provider: string, providerEventId: string): Promise<void> {
    await this.db.query(
      `UPDATE webhook_events SET status = 'processed', processed_at = now()
       WHERE provider = $1 AND provider_event_id = $2`,
      [provider, providerEventId],
    );
  }

  async isProcessed(provider: string, providerEventId: string): Promise<boolean> {
    const { rows } = await this.db.query(
      `SELECT 1 FROM webhook_events WHERE provider = $1 AND provider_event_id = $2`,
      [provider, providerEventId],
    );
    return rows.length > 0;
  }
}
