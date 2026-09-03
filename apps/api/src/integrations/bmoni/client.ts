import type { BmoniConfig } from './config.js';
import type { CreateUserResponse, OnboardingStatus, SmartWallet, WebhookConfigResponse } from './types.js';
import { logger } from '../../lib/logger.js';

/**
 * Base BMONI "capability" — the seam between MOTION and BMONI Embedded.
 * The reward engine, wallet service, and webhook handler only ever depend on
 * this interface, never on the concrete client or mock.
 */
export interface BmoniGateway {
  readonly mode: 'mock' | 'sandbox' | 'live';
  /** Create a BMONI user. Returns the persisted bmoniUserId. */
  createUser(input: { email: string; firstName: string; lastName: string; phone?: string }): Promise<CreateUserResponse>;
  /** Read a smart wallet for a currency (stablecoin code, e.g. CNGN). */
  getSmartWallet(bmoniUserId: string, currency: string): Promise<SmartWallet | null>;
  /** Read onboarding status for a currency. */
  getOnboardingStatus(bmoniUserId: string, currency: string): Promise<OnboardingStatus>;
  /** Subscribe to the documented partner-scoped webhook events. */
  subscribeWebhooks(callbackUrl: string, events: string[]): Promise<WebhookConfigResponse | null>;
}

/**
 * Live HTTP client for the BMONI Embedded REST API.
 *
 * Uses the documented conventions:
 *  - x-api-key header on every request
 *  - base URL without /v1 (paths already include it)
 */
export class BmoniClient implements BmoniGateway {
  readonly mode: 'mock' | 'sandbox' | 'live';

  constructor(private cfg: BmoniConfig) {
    this.mode = cfg.mode;
  }

  private path = (p: string) => `${this.cfg.baseUrl}${p.startsWith('/v1/') || p === '/v1' ? p : `/v1${p.startsWith('/') ? p : `/${p}`}`}`;

  private async request<T>(method: string, urlPath: string, body?: unknown): Promise<T> {
    const url = this.path(urlPath);
    const headers: Record<string, string> = {
      'x-api-key': this.cfg.apiKey,
      'Content-Type': 'application/json',
    };
    logger.info('bmoni.request', { method, urlPath, mode: this.mode });
    const res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`BMONI ${method} ${urlPath} failed: ${res.status} ${text.slice(0, 300)}`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  createUser(input: { email: string; firstName: string; lastName: string; phone?: string }): Promise<CreateUserResponse> {
    return this.request<CreateUserResponse>('POST', '/users', {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      phoneNumber: input.phone ?? null,
    });
  }

  async getSmartWallet(bmoniUserId: string, currency: string): Promise<SmartWallet | null> {
    const wallets = await this.request<SmartWallet[]>(
      'GET',
      `/users/${bmoniUserId}/smart-wallets`,
    ).catch(() => []);
    return wallets.find((w) => w.currency === currency) ?? null;
  }

  getOnboardingStatus(bmoniUserId: string, currency: string): Promise<OnboardingStatus> {
    return this.request<OnboardingStatus>(
      'GET',
      `/users/${bmoniUserId}/onboarding/status?currency=${encodeURIComponent(currency)}`,
    );
  }

  subscribeWebhooks(callbackUrl: string, events: string[]): Promise<WebhookConfigResponse | null> {
    return this.request<WebhookConfigResponse>('POST', '/webhooks/config', {
      callbackUrl,
      events,
      ...(this.cfg.partnerId ? { partnerId: this.cfg.partnerId } : {}),
      active: true,
    });
  }
}
