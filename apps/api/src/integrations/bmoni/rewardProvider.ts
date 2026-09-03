import type { RewardProvider, RewardGrant } from '../../services/rewardEngine.js';
import type { BmoniGateway } from './client.js';

/**
 * Financial reward provider backed by BMONI.
 *
 * Implements the existing `RewardProvider` seam so the RewardEngine can issue
 * financial rewards through BMONI once a user has a funded, active wallet and
 * country rail (the documented lifecycle: user -> wallet -> KYC -> rail -> fund
 * -> move money).
 *
 * HONESTY RULE: Money movement requires a funded, active BMONI rail. We never
 * fabricate a transfer or claim NGN moved when it did not. Until the full
 * lifecycle is enabled for a given user/currency, this provider reports
 * `status: 'pending'` with a human `statusMessage` and NO external reference,
 * so callers know no money actually moved.
 */
export class BmoniRewardProvider implements RewardProvider {
  name = 'BMONI' as const;

  constructor(private gateway: BmoniGateway) {}

  async issue(_grant: RewardGrant): Promise<{ externalRef?: string; status: 'issued' | 'pending' | 'failed'; statusMessage?: string }> {
    // In mock mode there is no real rail: surface a clearly labelled pending state.
    if (this.gateway.mode === 'mock') {
      return {
        status: 'pending',
        statusMessage: 'Financial reward unavailable in demo mode (no active BMONI rail).',
      };
    }

    // Real money movement requires an onboarded, funded user. The gateway
    // exposes the documented onboarding status; a real transfer endpoint would
    // be called here once credentials + onboarding are enabled.
    return {
      status: 'pending',
      statusMessage: 'Financial reward pending — requires active BMONI rail + funding.',
    };
  }
}
