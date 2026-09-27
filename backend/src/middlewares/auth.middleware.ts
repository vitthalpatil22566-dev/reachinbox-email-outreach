import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { prisma } from '../config/database';

export const SESSION_COOKIE_NAME = 'reachinbox_session';

/**
 * Authentication guard middleware for protected endpoints.
 * Extracts session token from HTTP-only cookie or Authorization header.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const cookieToken = req.cookies?.[SESSION_COOKIE_NAME];
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

  const token = cookieToken || bearerToken;

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication required. Please sign in with Google.',
    });
    return;
  }

  try {
    const payload = AuthService.verifySessionToken(token);
    let user: any = null;

    if (process.env.NODE_ENV === 'test') {
      user = AuthService.getTestUser(payload.userId);
    }

    if (!user) {
      try {
        user = await prisma.user.findUnique({
          where: { id: payload.userId },
        });
      } catch {
        if (process.env.NODE_ENV === 'test') {
          user = AuthService.getTestUser(payload.userId);
        }
      }
    }

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authenticated user no longer exists in system.',
      });
      return;
    }

    req.user = AuthService.toSafeUser(user);
    next();
  } catch (err: any) {
    res.status(401).json({
      success: false,
      error: 'InvalidSession',
      message: 'Session has expired or is invalid. Please sign in again.',
    });
  }
}
