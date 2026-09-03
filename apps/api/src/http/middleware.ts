import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { ApiError, SystemError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import type { AuthService, PublicUser } from '../services/auth.js';

export interface AuthedRequest extends Request {
  user?: PublicUser;
}

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/** Wrap an async handler so rejections flow to Express error middleware. */
export function handle(handler: AsyncHandler): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

/** Bearer-token authentication guard. Attaches req.user on success. */
export function requireAuth(auth: AuthService): RequestHandler {
  return (req: AuthedRequest, _res, next) => {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : undefined;
    auth
      .authenticate(token)
      .then((user) => {
        req.user = user;
        next();
      })
      .catch(next);
  };
}

/** Centralized error handler. Maps ApiError -> JSON, everything else -> 500. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }
  const wrapped = new SystemError();
  logger.error('Unhandled error', { error: err instanceof Error ? err.message : String(err) });
  res.status(wrapped.statusCode).json({
    error: { code: wrapped.code, message: wrapped.message },
  });
}

/** 404 handler for unknown routes. */
export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
}
