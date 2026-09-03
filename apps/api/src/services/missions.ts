import crypto from 'node:crypto';
import { MissionsRepo, type MissionRow } from '../repos/missions.js';

export interface MissionDto {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: string;
  verification: string;
  rewardPoints: number;
  status: string;
  expiresAt: string | null;
  // client-safe detail
  quiz?: { questions: Array<{ index: number; prompt: string; options: string[] }> };
  location?: { center: { lat: number; lng: number }; radiusMeters: number };
  qrPayload?: string;
}

const QUIZ_PASSTHRESHOLD = 3;

function toMissionDto(mission: MissionRow): MissionDto {
  const base: MissionDto = {
    id: mission.id,
    slug: mission.slug,
    title: mission.title,
    description: mission.description,
    type: mission.type,
    verification: mission.verification_method,
    rewardPoints: mission.reward_points,
    status: mission.status,
    expiresAt: mission.expires_at,
  };
  if (mission.verification_method === 'QUIZ' && Array.isArray(mission.payload.questions)) {
    base.quiz = {
      questions: mission.payload.questions.map((q: { prompt: string; options: string[] }, i: number) => ({
        index: i,
        prompt: q.prompt,
        options: q.options,
      })),
    };
  }
  if (mission.verification_method === 'LOCATION' && mission.payload.center) {
    base.location = {
      center: mission.payload.center as { lat: number; lng: number },
      radiusMeters: Number(mission.requirements.radiusMeters ?? 100),
    };
  }
  if (mission.verification_method === 'QR') {
    const token = (mission.payload.qrToken as string) || '';
    base.qrPayload = `${mission.id}::${token}`;
  }
  return base;
}

export class MissionsService {
  constructor(private missions: MissionsRepo) {}

  async list(): Promise<MissionDto[]> {
    const rows = await this.missions.listActive();
    return rows.map(toMissionDto);
  }

  async detail(missionId: string): Promise<MissionDto> {
    const mission = await this.missions.requireActive(missionId);
    return toMissionDto(mission);
  }
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------
export function makeSeedMissions(repo: MissionsRepo): ReturnType<typeof seedMissions> {
  return seedMissions(repo);
}

export async function seedMissions(repo: MissionsRepo): Promise<void> {
  if (await repo.findBySlug('compound-interest')) return;

  const makeToken = () => crypto.randomBytes(24).toString('base64url');

  await repo.create({
    slug: 'compound-interest',
    title: 'Understand compound interest',
    description:
      'A short financial literacy challenge. Master the single most powerful idea in personal finance.',
    type: 'LEARN',
    verificationMethod: 'QUIZ',
    rewardPoints: 50,
    requirements: { passThreshold: QUIZ_PASSTHRESHOLD },
    payload: {
      questions: [
        {
          prompt: 'What does compound interest do to your savings over time?',
          options: ['It grows your money faster as time passes', 'It only applies to loans', 'It reduces inflation', 'It taxes your interest'],
          correctIndex: 0,
        },
        {
          prompt: 'Interest is said to "compound" when …',
          options: [
            'interest earns interest on top of itself',
            'you withdraw everything every month',
            'the bank sets a fixed fee',
            'you never save again',
          ],
          correctIndex: 0,
        },
        {
          prompt: 'Starting to save early is powerful mainly because …',
          options: [
            'time lets compounding work for you',
            'early savers pay no tax',
            'banks give early savers bonuses',
            'inflation stops after a year',
          ],
          correctIndex: 0,
        },
        {
          prompt: 'Which is generally better for long-term growth?',
          options: [
            'Earning compound interest on your savings',
            'Holding all your money as cash under a mattress',
            'Spending income the moment you receive it',
            'Avoiding any financial product',
          ],
          correctIndex: 0,
        },
        {
          prompt: 'A key rule of thumb for building wealth is …',
          options: [
            'pay yourself first: save and invest before spending',
            'spend first, save whatever is left',
            'borrow to buy things you cannot afford',
            'avoid planning your finances',
          ],
          correctIndex: 0,
        },
      ],
    },
  });

  await repo.create({
    slug: 'event-check-in',
    title: 'Check in at the event',
    description:
      'Scan the mission QR code at the venue to prove you showed up. Your presence becomes verified activity.',
    type: 'DISCOVER',
    verificationMethod: 'QR',
    rewardPoints: 100,
    requirements: { singleUse: false },
    payload: { qrToken: makeToken(), venue: 'MOTION Launch Event' },
  });

  await repo.create({
    slug: 'legacy-square-visit',
    title: 'Visit the motion square',
    description:
      'Check in at the MOTION location to prove you were here. We only verify your location presence — a quick tap of "Check in" while you are on site.',
    type: 'MOVE',
    verificationMethod: 'LOCATION',
    rewardPoints: 75,
    requirements: { radiusMeters: 300, maxAgeMs: 5 * 60 * 1000 },
    payload: {
      center: { lat: 6.4551, lng: 3.4351 }, // Lagos region as example center
      name: 'MOTION Square',
    },
  });
}
