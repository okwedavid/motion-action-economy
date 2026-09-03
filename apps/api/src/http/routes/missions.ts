import { Router } from 'express';
import { z } from 'zod';
import type { AppServices } from '../../services/app.js';
import { BadRequestError, NotFoundError } from '../../lib/errors.js';
import { handle, requireAuth, type AuthedRequest } from '../middleware.js';

const quizSchema = z.object({
  answers: z.array(
    z.object({ questionIndex: z.number().int().min(0), answerIndex: z.number().int().min(0) }),
  ),
});

const qrSchema = z.object({ token: z.string().min(1) });

const locationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  clientTimestamp: z.string().optional(),
});

function missionId(req: AuthedRequest): string {
  const id = req.params.id;
  if (!id) throw new NotFoundError('Mission not found');
  return id;
}

export function missionsRouter(app: AppServices): Router {
  const { missions, proofs, auth } = app;
  const router = Router();

  router.get(
    '/',
    requireAuth(auth),
    handle(async (_req, res) => {
      res.json({ missions: await missions.list() });
    }),
  );

  router.get(
    '/:id',
    requireAuth(auth),
    handle(async (req, res) => {
      res.json({ mission: await missions.detail(missionId(req as AuthedRequest)) });
    }),
  );

  router.post(
    '/:id/complete/quiz',
    requireAuth(auth),
    handle(async (req: AuthedRequest, res) => {
      const parsed = quizSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError('Invalid quiz payload', 'INVALID_BODY');
      const result = await proofs.completeQuiz(req.user!.id, missionId(req), parsed.data.answers, {
        ip: req.ip,
      });
      res.json(result);
    }),
  );

  router.post(
    '/:id/complete/qr',
    requireAuth(auth),
    handle(async (req: AuthedRequest, res) => {
      const parsed = qrSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError('Invalid QR payload', 'INVALID_BODY');
      const result = await proofs.completeQr(req.user!.id, missionId(req), parsed.data.token, { ip: req.ip });
      res.json(result);
    }),
  );

  router.post(
    '/:id/complete/location',
    requireAuth(auth),
    handle(async (req: AuthedRequest, res) => {
      const parsed = locationSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError('Invalid location payload', 'INVALID_BODY');
      const result = await proofs.completeLocation(req.user!.id, missionId(req), parsed.data, { ip: req.ip });
      res.json(result);
    }),
  );

  return router;
}
