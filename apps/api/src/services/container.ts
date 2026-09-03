import type { DbExec } from '../db/types.js';
import { UsersRepo, SessionsRepo } from '../repos/users.js';
import { MissionsRepo } from '../repos/missions.js';
import { AttemptsRepo, ProofsRepo, QrTokensRepo } from '../repos/attempts.js';
import { LedgerRepo } from '../repos/ledger.js';
import { RewardsRepo, ReputationRepo } from '../repos/rewards.js';
import { WalletRepo } from '../repos/wallet.js';
import { AuditRepo, WebhookRepo } from '../repos/audit.js';

export interface Repos {
  users: UsersRepo;
  sessions: SessionsRepo;
  missions: MissionsRepo;
  attempts: AttemptsRepo;
  proofs: ProofsRepo;
  qrTokens: QrTokensRepo;
  ledger: LedgerRepo;
  rewards: RewardsRepo;
  reputation: ReputationRepo;
  wallet: WalletRepo;
  audit: AuditRepo;
  webhook: WebhookRepo;
}

export function createRepos(db: DbExec): Repos {
  return {
    users: new UsersRepo(db),
    sessions: new SessionsRepo(db),
    missions: new MissionsRepo(db),
    attempts: new AttemptsRepo(db),
    proofs: new ProofsRepo(db),
    qrTokens: new QrTokensRepo(db),
    ledger: new LedgerRepo(db),
    rewards: new RewardsRepo(db),
    reputation: new ReputationRepo(db),
    wallet: new WalletRepo(db),
    audit: new AuditRepo(db),
    webhook: new WebhookRepo(db),
  };
}
