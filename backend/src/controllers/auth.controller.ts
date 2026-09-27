import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { env } from '../config/env';
import { SESSION_COOKIE_NAME } from '../middlewares/auth.middleware';

export class AuthController {
  /**
   * GET /auth/google
   * Redirects user to Google OAuth consent screen.
   */
  public static googleLogin(req: Request, res: Response): void {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      res.status(500).json({
        success: false,
        error: 'MisconfiguredOAuth',
        message: 'GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing in server environment variables.',
      });
      return;
    }

    const authUrl = AuthService.getGoogleAuthUrl();
    res.redirect(authUrl);
  }

  /**
   * GET /auth/google/callback
   * Exchanges authorization code with Google, sets secure HTTP-only session cookie,
   * and redirects user back to the application dashboard.
   */
  public static async googleCallback(req: Request, res: Response): Promise<void> {
    try {
      const { code } = req.query;
      if (!code || typeof code !== 'string') {
        res.redirect(`${env.FRONTEND_URL}/?error=missing_oauth_code`);
        return;
      }

      const safeUser = await AuthService.handleGoogleCallback(code);
      const sessionToken = AuthService.generateSessionToken(safeUser);

      // Set secure HTTP-only cookie
      res.cookie(SESSION_COOKIE_NAME, sessionToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.redirect(`${env.FRONTEND_URL}/?auth=success`);
    } catch (err: any) {
      console.error('❌ Google OAuth callback error:', err.message);
      res.redirect(`${env.FRONTEND_URL}/?error=${encodeURIComponent(err.message)}`);
    }
  }

  /**
   * GET /auth/me
   * Returns authenticated user profile.
   */
  public static getCurrentUser(req: Request, res: Response): void {
    res.json({
      success: true,
      data: req.user,
    });
  }

  /**
   * POST /auth/logout
   * Clears the HTTP-only session cookie.
   */
  public static logout(_req: Request, res: Response): void {
    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  }
}
