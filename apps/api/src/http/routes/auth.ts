import { Router } from 'express';
import { z } from 'zod';
import type { AppServices } from '../../services/app.js';
import { BadRequestError } from '../../lib/errors.js';
import { handle, requireAuth, type AuthedRequest } from '../middleware.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  displayName: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export function authRouter(app: AppServices): Router {
  const { auth } = app;
  const router = Router();

  router.post(
    '/register',
    handle(async (req, res) => {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError('Invalid registration payload', 'INVALID_BODY', parsed.error.flatten());
      }
      const result = await auth.register(parsed.data);
      res.status(201).json({ user: result.user, token: result.token, expiresAt: result.expiresAt });
    }),
  );

  router.post(
    '/login',
    handle(async (req, res) => {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError('Invalid login payload', 'INVALID_BODY', parsed.error.flatten());
      }
      const result = await auth.login(parsed.data.email, parsed.data.password);
      res.json({ user: result.user, token: result.token, expiresAt: result.expiresAt });
    }),
  );

  router.post(
    '/logout',
    requireAuth(auth),
    handle(async (req: AuthedRequest, res) => {
      const header = req.headers.authorization ?? '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : undefined;
      await auth.logout(req.user!.id, token);
      res.status(204).end();
    }),
  );

  router.get(
    '/me',
    requireAuth(auth),
    handle(async (req: AuthedRequest, res) => {
      res.json({ user: req.user });
    }),
  );

  return router;
}
