import { Router } from 'express';
import { z } from 'zod';
import type { AppServices } from '../../services/app.js';
import { BadRequestError } from '../../lib/errors.js';
import { handle, requireAuth, type AuthedRequest } from '../middleware.js';

const onboardSchema = z.object({ currency: z.string().toUpperCase().optional() });

export function walletRouter(app: AppServices): Router {
  const { wallet, auth } = app;
  const router = Router();

  router.get(
    '/',
    requireAuth(auth),
    handle(async (req: AuthedRequest, res) => {
      res.json({ wallet: await wallet.getOverview(req.user!.id) });
    }),
  );

  router.get(
    '/balance',
    requireAuth(auth),
    handle(async (req: AuthedRequest, res) => {
      const [points, overview] = await Promise.all([
        app.repos.ledger.getBalance(req.user!.id),
        wallet.getOverview(req.user!.id),
      ]);
      res.json({
        motionPoints: points,
        financial: {
          provider: overview.provider,
          mode: overview.mode,
          demo: overview.demo,
          balanceAvailable: overview.balanceAvailable,
          onboarding: overview.onboarding,
        },
      });
    }),
  );

  router.get(
    '/transactions',
    requireAuth(auth),
    handle(async (req: AuthedRequest, res) => {
      const limit = Math.min(Number(req.query.limit ?? 50) || 50, 100);
      res.json({ transactions: await wallet.transactions(req.user!.id, limit) });
    }),
  );

  router.post(
    '/onboard',
    requireAuth(auth),
    handle(async (req: AuthedRequest, res) => {
      const parsed = onboardSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError('Invalid onboarding payload', 'INVALID_BODY');
      res.json({ wallet: await wallet.onboard(req.user!.id, parsed.data.currency) });
    }),
  );

  return router;
}
