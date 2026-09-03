import { createRepos, type Repos } from './container.js';
import { AuthService } from './auth.js';
import { HomeService } from './home.js';
import { MissionsService } from './missions.js';
import { ProofEngine, type ProofEngineDb } from './proofEngine.js';
import { ReputationService } from './reputation.js';

export interface AppServices {
  repos: Repos;
  auth: AuthService;
  home: HomeService;
  missions: MissionsService;
  reputation: ReputationService;
  proofs: ProofEngine;
}

/**
 * Assembles the full set of application services around a DbExec.
 * Pass the pool-backed exec to wire into the live PostgreSQL instance.
 */
export function createServices(db: ProofEngineDb): AppServices {
  const repos = createRepos(db);
  return {
    repos,
    auth: new AuthService(repos.users, repos.sessions),
    home: new HomeService(repos),
    missions: new MissionsService(repos.missions),
    reputation: new ReputationService(repos),
    proofs: new ProofEngine(db),
  };
}
