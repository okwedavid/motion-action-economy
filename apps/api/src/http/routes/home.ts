import { Router } from 'express';
import type { AppServices } from '../../services/app.js';
import { handle, requireAuth, type AuthedRequest } from '../middleware.js';

export function homeRouter(app: AppServices): Router {
  const { home, auth } = app;
  const router = Router();

  router.get(
    '/',
    requireAuth(auth),
    handle(async (req: AuthedRequest, res) => {
      res.json({ summary: await home.getSummary(req.user!.id) });
    }),
  );

  return router;
}
