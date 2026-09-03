import type { Repos } from './container.js';

export interface LevelInfo {
  level: number;
  name: string;
  progressToNext: number; // 0..1
  currentMin: number;
  nextMin: number | null;
}

const LEVELS: Array<{ min: number; name: string }> = [
  { min: 0, name: 'First Steps' },
  { min: 20, name: 'Consistent' },
  { min: 50, name: 'In Motion' },
  { min: 90, name: 'Momentum' },
  { min: 140, name: 'Trailblazer' },
  { min: 200, name: 'Action Builder' },
  { min: 280, name: 'Trusted' },
  { min: 380, name: 'Proof Pioneer' },
];

export function levelFromScore(score: number): LevelInfo {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (score >= LEVELS[i].min) idx = i;
  }
  const current = LEVELS[idx];
  const next = LEVELS[idx + 1] ?? null;
  const span = next ? next.min - current.min : 1;
  const progress = next ? Math.min(1, (score - current.min) / span) : 1;
  return {
    level: idx + 1,
    name: current.name,
    progressToNext: progress,
    currentMin: current.min,
    nextMin: next ? next.min : null,
  };
}

export class ReputationService {
  constructor(private repos: Repos) {}

  async get(userId: string): Promise<{
    score: number;
    level: LevelInfo;
    reasons: Array<{ delta: number; label: string; reason: string; date: string }>;
  }> {
    const score = Math.max(0, await this.repos.reputation.scoreFor(userId));
    const events = await this.repos.reputation.eventsFor(userId);
    return {
      score,
      level: levelFromScore(score),
      reasons: events.map((e) => ({
        delta: e.delta,
        label: e.label,
        reason: e.reason,
        date: e.created_at,
      })),
    };
  }
}
