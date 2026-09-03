import { Router } from 'express';
import type { AppServices } from '../../services/app.js';
import { handle, requireAuth, type AuthedRequest } from '../middleware.js';

export function reputationRouter(app: AppServices): Router {
  const { reputation, auth } = app;
  const router = Router();

  router.get(
    '/',
    requireAuth(auth),
    handle(async (req: AuthedRequest, res) => {
      res.json({ reputation: await reputation.get(req.user!.id) });
    }),
  );

  return router;
}
