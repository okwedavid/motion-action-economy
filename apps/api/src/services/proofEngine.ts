import type { DbExec } from '../db/types.js';
import { withTransaction } from '../db/tx.js';
import { createRepos, type Repos } from './container.js';
import { RewardEngine, PointsRewardProvider } from './rewardEngine.js';
import { MissionsRepo } from '../repos/missions.js';
import { BadRequestError, ConflictError, NotFoundError, ForbiddenError } from '../lib/errors.js';

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type QuizAnswer = { questionIndex: number; answerIndex: number };

export type ProofEngineDb = DbExec & {
  connect?: () => Promise<{ query: DbExec['query']; release: () => void }>;
};

export class ProofEngine {
  constructor(private db: ProofEngineDb) {}

  private async loadMission(missionId: string, missions: MissionsRepo) {
    const mission = await missions.requireActive(missionId);
    if (mission.status !== 'active') throw new NotFoundError('Mission is not available');
    if (mission.expires_at && new Date(mission.expires_at).getTime() <= Date.now()) {
      throw new NotFoundError('This mission has expired');
    }
    return mission;
  }

  /**
   * Complete a QUIZ mission. Answers are graded server-side.
   */
  async completeQuiz(
    userId: string,
    missionId: string,
    answers: QuizAnswer[],
    source: { ip?: string } = {},
  ): Promise<{ ok: boolean; missionId: string; points: number }> {
    return withTransaction(this.db, async (tx) => {
      const repos = createRepos(tx);
      const mission = await this.loadMission(missionId, repos.missions);
      if (mission.verification_method !== 'QUIZ') {
        throw new BadRequestError('This mission is not a quiz mission', 'WRONG_VERIFICATION');
      }
      await this.ensureEligible(userId, missionId, repos);
      const questions = Array.isArray(mission.payload.questions) ? mission.payload.questions : [];
      if (questions.length === 0) throw new BadRequestError('Quiz has no questions', 'INVALID_MISSION');

      const passThreshold = Number(mission.requirements.passThreshold ?? questions.length);
      let correct = 0;
      for (const a of answers) {
        const q = questions[a.questionIndex];
        if (q && Number(q.correctIndex) === a.answerIndex) correct++;
      }
      const passed = correct >= passThreshold;
      const attempt = passed
        ? await repos.attempts.markPassed(userId, missionId, 'none')
        : await repos.attempts.markFailed(userId, missionId);

      if (!passed) {
        throw new BadRequestError(
          `You scored ${correct}/${questions.length}. You need ${passThreshold} to complete this mission.`,
          'QUIZ_FAILED',
        );
      }

      const proof = await repos.proofs.create({
        attemptId: attempt.id,
        userId,
        missionId,
        verification: 'QUIZ',
        evidence: { answers, score: correct, total: questions.length },
      });
      await repos.proofs.markVerified(proof.id);
      await repos.audit.record({
        userId,
        action: 'mission.completed',
        resource: 'mission',
        resourceId: missionId,
        ip: source.ip,
        metadata: { verification: 'QUIZ', score: correct },
      });
      await this.award(repos, userId, attempt.id, missionId, mission.reward_points, 'verified_learning', '+verified learning');
      return { ok: true, missionId, points: mission.reward_points };
    });
  }

  /**
   * Complete a QR-check-in mission by presenting the token encoded in the mission QR.
   */
  async completeQr(
    userId: string,
    missionId: string,
    token: string,
    source: { ip?: string } = {},
  ): Promise<{ ok: boolean; missionId: string; points: number }> {
    return withTransaction(this.db, async (tx) => {
      const repos = createRepos(tx);
      const mission = await this.loadMission(missionId, repos.missions);
      if (mission.verification_method !== 'QR') {
        throw new BadRequestError('This mission is not a QR mission', 'WRONG_VERIFICATION');
      }
      await this.ensureEligible(userId, missionId, repos);
      const singleUse = mission.requirements.singleUse === true;
      const valid = await repos.qrTokens.validate(String(token).trim(), missionId, singleUse, userId);
      if (!valid) {
        throw new BadRequestError(
          'This QR code is invalid or has expired.',
          'INVALID_QR',
        );
      }
      const attempt = await repos.attempts.markPassed(userId, missionId, 'none');
      const proof = await repos.proofs.create({
        attemptId: attempt.id,
        userId,
        missionId,
        verification: 'QR',
        evidence: { token: String(token).trim() },
      });
      await repos.proofs.markVerified(proof.id);
      await repos.audit.record({
        userId,
        action: 'mission.completed',
        resource: 'mission',
        resourceId: missionId,
        ip: source.ip,
        metadata: { verification: 'QR' },
      });
      await this.award(repos, userId, attempt.id, missionId, mission.reward_points, 'community_activity', '+check-in verified', null, 0);
      return { ok: true, missionId, points: mission.reward_points };
    });
  }

  /**
   * Complete a LOCATION mission. Server validates coordinates against the
   * configured radius and rejects impossible/future timestamps.
   */
  async completeLocation(
    userId: string,
    missionId: string,
    input: { lat: number; lng: number; clientTimestamp?: string },
    source: { ip?: string; serverNow?: number } = {},
  ): Promise<{ ok: boolean; missionId: string; points: number }> {
    return withTransaction(this.db, async (tx) => {
      const repos = createRepos(tx);
      const mission = await this.loadMission(missionId, repos.missions);
      if (mission.verification_method !== 'LOCATION') {
        throw new BadRequestError('This mission is not a location mission', 'WRONG_VERIFICATION');
      }
      await this.ensureEligible(userId, missionId, repos);

      const center = mission.payload.center as { lat: number; lng: number } | undefined;
      const radius = Number(mission.requirements.radiusMeters ?? 100);
      const maxAgeMs = Number(mission.requirements.maxAgeMs ?? 5 * 60 * 1000);

      if (!center || typeof center.lat !== 'number' || typeof center.lng !== 'number') {
        throw new BadRequestError('Location mission is misconfigured', 'INVALID_MISSION');
      }
      if (typeof input.lat !== 'number' || typeof input.lng !== 'number') {
        throw new BadRequestError('Valid coordinates are required', 'INVALID_LOCATION');
      }
      const lat = Number(input.lat);
      const lng = Number(input.lng);
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        throw new BadRequestError('Those coordinates are not possible', 'INVALID_LOCATION');
      }

      const now = source.serverNow ?? Date.now();
      // Reject "from the future" and stale timestamps (we do not trust the client).
      if (input.clientTimestamp) {
        const t = new Date(input.clientTimestamp).getTime();
        if (!Number.isNaN(t)) {
          if (t > now + 60_000) {
            throw new BadRequestError('That timestamp is in the future.', 'INVALID_TIMESTAMP');
          }
          if (now - t > maxAgeMs) {
            throw new BadRequestError('That location check is too old. Try again.', 'STALE_TIMESTAMP');
          }
        }
      }

      const distance = haversineMeters(center.lat, center.lng, lat, lng);
      if (distance > radius) {
        const attempt = await repos.attempts.markFailed(userId, missionId);
        await repos.audit.record({
          userId,
          action: 'mission.failed',
          resource: 'mission',
          resourceId: missionId,
          ip: source.ip,
          metadata: { reason: 'out_of_radius', distanceMeters: Math.round(distance) },
        });
        void attempt;
        throw new ForbiddenError('You are not at the mission location.', 'OUT_OF_RANGE');
      }

      const attempt = await repos.attempts.markPassed(userId, missionId, 'none');
      const proof = await repos.proofs.create({
        attemptId: attempt.id,
        userId,
        missionId,
        verification: 'LOCATION',
        evidence: { lat, lng, distanceMeters: Math.round(distance), radius },
      });
      await repos.proofs.markVerified(proof.id);
      await repos.audit.record({
        userId,
        action: 'mission.completed',
        resource: 'mission',
        resourceId: missionId,
        ip: source.ip,
        metadata: { verification: 'LOCATION', distanceMeters: Math.round(distance) },
      });
      await this.award(repos, userId, attempt.id, missionId, mission.reward_points, 'physical_activity', '+confirmed presence', null, 0);
      return { ok: true, missionId, points: mission.reward_points };
    });
  }

  private async ensureEligible(userId: string, missionId: string, repos: Repos) {
    const attempt = await repos.attempts.getOrCreate(userId, missionId);
    if (attempt.status === 'passed') {
      throw new ConflictError('This action was already completed.', 'ALREADY_COMPLETED');
    }
    return attempt;
  }

  private async award(
    repos: Repos,
    userId: string,
    attemptId: string,
    missionId: string,
    points: number,
    repReason: string,
    repLabel: string,
    referenceId: string | null = attemptId,
    repDelta: number | null = null,
  ): Promise<void> {
    const engine = new RewardEngine(
      repos.rewards,
      repos.reputation,
      repos.ledger,
      [new PointsRewardProvider(repos.ledger)],
    );
    await engine.grant({
      userId,
      attemptId,
      missionId,
      referenceId: referenceId ?? attemptId,
      points,
      reputationDelta: repDelta ?? 10,
      reputationReason: repReason,
      reputationLabel: repLabel,
    });
  }
}
