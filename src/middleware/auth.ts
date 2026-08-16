import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../lib/jwt';
import { unauthorized } from '../utils/httpError';

/**
 * Requires `Authorization: Bearer <token>`. Verifies the JWT and attaches
 * `req.userId`. Every route except /api/auth/signup and /api/auth/login
 * sits behind this — all data below it is scoped to req.userId.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

  if (!token) {
    next(unauthorized('Missing bearer token'));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    next();
  } catch {
    next(unauthorized('Invalid or expired token'));
  }
}
