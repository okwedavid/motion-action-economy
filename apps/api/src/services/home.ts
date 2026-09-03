import type { Repos } from './container.js';
import { levelFromScore, type LevelInfo } from './reputation.js';
import type { MissionDto } from './missions.js';

export interface ActivityItem {
  kind: 'mission' | 'points' | 'reward' | 'wallet' | 'reputation';
  title: string;
  subtitle: string;
  date: string;
  amount?: number;
  positive?: boolean;
}

export interface HomeSummary {
  greeting: string;
  points: number;
  level: LevelInfo;
  reputation: { score: number; level: LevelInfo };
  recommendedMission: MissionDto | null;
  recentActivity: ActivityItem[];
  wallet: { available: boolean; currency: string; status: string } | null;
  consistencyDays: number;
}

export function greetingFor(firstName: string): string {
  const h = new Date().getHours();
  if (h < 12) return `Good morning, ${firstName}`;
  if (h < 18) return `Good afternoon, ${firstName}`;
  return `Good evening, ${firstName}`;
}

export class HomeService {
  constructor(private repos: Repos) {}

  async getSummary(userId: string): Promise<HomeSummary> {
    const [profile, points, missions, proofs, recentLedger, walletTxs, wallets] = await Promise.all([
      this.repos.users.getProfile(userId),
      this.repos.ledger.getBalance(userId),
      this.repos.missions.listActive(),
      this.repos.proofs.findForUser(userId),
      this.repos.ledger.listForUser(userId, 8),
      this.repos.wallet.txsForUser(userId, 8),
      this.repos.wallet.listForUser(userId),
    ]);

    const repScore = Math.max(0, await this.repos.reputation.scoreFor(userId));

    const userRows = await this.repos.users.findById(userId);
    const firstName = (profile.display_name as string) || userRows?.first_name || 'there';
    const completedIds = new Set(proofs.map((p) => p.mission_id));
    const recommended = missions.find((m) => !completedIds.has(m.id)) ?? missions[0] ?? null;

    const activity: ActivityItem[] = [];
    for (const p of proofs) {
      const mission = (p as unknown as { mission?: Record<string, unknown> }).mission;
      activity.push({
        kind: 'mission',
        title: mission?.title as string,
        subtitle: 'Verified action',
        date: p.verified_at ?? p.created_at,
        positive: true,
      });
    }
    for (const l of recentLedger) {
      activity.push({
        kind: 'points',
        title: l.reason.replace(/_/g, ' '),
        subtitle: 'Motion Points',
        date: l.created_at,
        amount: l.delta,
        positive: l.delta > 0,
      });
    }
    for (const t of walletTxs) {
      activity.push({
        kind: 'wallet',
        title: t.type,
        subtitle: `${t.currency} wallet · ${t.state}`,
        date: t.created_at,
      });
    }
    activity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const consistencyDays = this.consistencyDays(proofs.map((p) => p.created_at));

    const activeWallet = wallets.find((w) => w.status !== 'not_created') ?? wallets[0] ?? null;

    return {
      greeting: greetingFor(firstName),
      points,
      level: levelFromScore(repScore),
      reputation: { score: repScore, level: levelFromScore(repScore) },
      recommendedMission: recommended
        ? {
            id: recommended.id,
            slug: recommended.slug,
            title: recommended.title,
            description: recommended.description,
            type: recommended.type,
            verification: recommended.verification_method,
            rewardPoints: recommended.reward_points,
            status: recommended.status,
            expiresAt: recommended.expires_at,
          }
        : null,
      recentActivity: activity.slice(0, 10),
      wallet: activeWallet
        ? { available: activeWallet.status !== 'not_created', currency: activeWallet.currency, status: activeWallet.status }
        : null,
      consistencyDays,
    };
  }

  private consistencyDays(dates: string[]): number {
    const set = new Set(dates.map((d) => new Date(d).toISOString().slice(0, 10)));
    return set.size;
  }
}
