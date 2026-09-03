/**
 * BMONI Embedded API — documented request/response types.
 * Source of truth: https://bkey.mintlify.app/api-reference/
 *
 * Only types we actually use are declared here. Everything reflects the
 * official documentation; no endpoints are invented.
 */

/** Response of `POST /v1/users`. Persist `bmoniUserId` — never recreate per launch. */
export interface CreateUserResponse {
  bmoniUserId: string;
}

/** A provisioned/created smart wallet. */
export interface SmartWallet {
  id: string;
  address: string;
  chain: string;
  currency: string;
  status: string;
}

/** Onboarding status response (`GET /v1/onboarding/status`). */
export interface OnboardingStatus {
  status: 'active' | 'inactive' | 'pending';
  currency?: string;
}

/** A wallet transaction. */
export interface WalletTransaction {
  id: string;
  type: string;
  state: string;
  currency: string;
  amount: string;
  statusMessage?: string;
}

/** Webhook subscription request (`POST /v1/webhooks/config`). */
export interface WebhookConfigRequest {
  callbackUrl: string;
  events: string[];
  partnerId?: string;
  active?: boolean;
}

/** Webhook subscription response — contains the signing secret. */
export interface WebhookConfigResponse {
  id: string;
  partnerId?: string;
  callbackUrl: string;
  secretKey: string;
  active: boolean;
  events: string[];
}

/**
 * A delivery is a POST to your callbackUrl:
 *   { "id": "...", "eventType": "employee.deposit.completed", "payload": {...}, "timestamp": "..." }
 * Headers: X-Webhook-Signature (HMAC-SHA256 hex of raw body), X-Webhook-Id (dedup).
 */
export interface WebhookEvent {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  timestamp: string;
}
