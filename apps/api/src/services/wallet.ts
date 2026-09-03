import type { Repos } from './container.js';
import type { BmoniGateway } from '../integrations/bmoni/index.js';
import { WalletRepo, type WalletRow, type WalletTxRow } from '../repos/wallet.js';

/** Currency we default a wallet to (NGN matches the seeded demo persona/docs matrix). */
export const WALLET_DEFAULT_CURRENCY = 'NGN';

export interface WalletOverview {
  provider: 'motion' | 'bmoni';
  mode: 'mock' | 'sandbox' | 'live';
  demo: boolean;
  wallets: WalletRow[];
  active: WalletRow | null;
  onboarding: { status: string; active: boolean; hasKyc: boolean; railActive: boolean };
  balanceAvailable: boolean;
  transactions: WalletTxRow[];
  supportedCurrencies: string[];
}

const STABLECOIN: Record<string, string> = { NGN: 'CNGN', USD: 'USDB', CAD: 'CADC', EUR: 'EURe', MXN: 'MEXe' };

function toStablecoin(currency: string): string {
  return STABLECOIN[currency] ?? currency;
}

export class WalletService {
  constructor(
    private repos: Repos,
    private gateway: BmoniGateway,
  ) {}

  private tx = (): WalletRepo => this.repos.wallet;

  async getOverview(userId: string): Promise<WalletOverview> {
    const wallets = await this.tx().listForUser(userId);
    const active = wallets.find((w) => w.status !== 'not_created') ?? wallets[0] ?? null;
    const transactions = await this.tx().txsForUser(userId, 25);

    let onboarding = { status: 'inactive', active: false, hasKyc: false, railActive: false };
    if (active) {
      onboarding = {
        status: active.status,
        active: active.status === 'active',
        hasKyc: active.has_kyc,
        railActive: active.rail_active,
      };
    }

    return {
      provider: 'bmoni',
      mode: this.gateway.mode,
      demo: this.gateway.mode === 'mock',
      wallets,
      active,
      onboarding,
      balanceAvailable: this.gateway.mode !== 'mock' && !!active && active.status === 'active',
      transactions,
      supportedCurrencies: Object.keys(STABLECOIN),
    };
  }

  /**
   * Starts the BMONI onboarding lifecycle for the user:
   *   1. ensure a wallet row exists
   *   2. create/lookup the BMONI user (persist bmoniUserId — never recreated per launch)
   *   3. report onboarding status.
   * Never exposes keys/secrets. In mock mode the state is clearly labelled.
   */
  async onboard(userId: string, currency: string = WALLET_DEFAULT_CURRENCY): Promise<WalletOverview> {
    const repo = this.tx();
    const profile = await this.repos.users.getProfile(userId);
    const userRow = await this.repos.users.findById(userId);
    const email = userRow?.email ?? '';
    const firstName = (profile.display_name as string) || userRow?.first_name || '';
    const lastName = userRow?.last_name || '';

    const wallet = await repo.getOrCreate(userId, currency);

    // Create/lookup a BMONI user and persist the id. In mock mode the sandbox
    // provider returns a deterministic id; it is still labelled demo.
    const bmoniUser = await this.gateway.createUser({ email, firstName, lastName });
    await this.repos.users.setBmoniUserId(userId, bmoniUser.bmoniUserId);

    // Start provisioning. Real rails require KYC + onboarding calls that we do
    // not fabricate; mock mode surfaces an unambiguous provisioning state.
    await repo.update(wallet.id, {
      status: 'provisioning',
      smart_wallet_id: null,
      onboarded: false,
      has_kyc: false,
      rail_active: false,
    });

    if (this.gateway.mode !== 'mock') {
      const smart = await this.gateway.getSmartWallet(bmoniUser.bmoniUserId, toStablecoin(currency));
      if (smart) {
        await repo.update(wallet.id, {
          smart_wallet_id: smart.id,
          address: smart.address,
          status: smart.status,
        });
      }
      const status = await this.gateway.getOnboardingStatus(bmoniUser.bmoniUserId, toStablecoin(currency));
      await repo.update(wallet.id, { onboarded: status.status === 'active' });
    }

    return this.getOverview(userId);
  }

  async transactions(userId: string, limit = 50): Promise<WalletTxRow[]> {
    return this.tx().txsForUser(userId, limit);
  }
}
