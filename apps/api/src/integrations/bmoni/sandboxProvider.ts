import type { BmoniGateway } from './client.js';
import type { CreateUserResponse, OnboardingStatus, SmartWallet, WebhookConfigResponse } from './types.js';
import crypto from 'node:crypto';

/**
 * Deterministic, in-process sandbox provider.
 *
 * This is NOT a real BMONI integration. It exists so the full product can be
 * demonstrated without credentials, and it is always clearly labelled as such.
 *
 * It mirrors the documented lifecycle (user -> wallet -> KYC -> rail) with
 * realistic, deterministic values so the UI and backend logic are exercised for
 * real, without ever pretending a real transfer happened.
 *
 * When BMONI credentials are available, switch `BMONI_MODE=sandbox` (or `live`)
 * and the BmoniClient is used instead — same interface.
 */
export class BmoniSandboxProvider implements BmoniGateway {
  readonly mode = 'mock' as const;

  private seeded = new Map<string, { bmoniUserId: string; wallet: SmartWallet | null; onboarded: boolean }>();

  private db() {
    return this.seeded;
  }

  async createUser(input: { email: string; firstName: string; lastName: string; phone?: string }): Promise<CreateUserResponse> {
    const key = input.email.toLowerCase();
    let existing = this.seeded.get(key);
    if (!existing) {
      existing = {
        bmoniUserId: crypto.randomUUID(),
        wallet: null,
        onboarded: false,
      };
      this.seeded.set(key, existing);
    }
    return { bmoniUserId: existing.bmoniUserId };
  }

  async getSmartWallet(bmoniUserId: string, currency: string): Promise<SmartWallet | null> {
    const entry = [...this.seeded.values()].find((e) => e.bmoniUserId === bmoniUserId);
    if (!entry || !entry.wallet || entry.wallet.currency !== currency) return null;
    return entry.wallet;
  }

  async getOnboardingStatus(bmoniUserId: string, currency: string): Promise<OnboardingStatus> {
    const entry = [...this.seeded.values()].find((e) => e.bmoniUserId === bmoniUserId);
    if (!entry || !entry.wallet || entry.wallet.currency !== currency) {
      return { status: 'inactive', currency };
    }
    return { status: entry.onboarded ? 'active' : 'inactive', currency };
  }

  async subscribeWebhooks(): Promise<WebhookConfigResponse | null> {
    // In mock mode there is nothing to subscribe to — return null so callers
    // know live webhook delivery is not active.
    return null;
  }
}
