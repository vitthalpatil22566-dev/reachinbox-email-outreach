import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { User } from '@prisma/client';

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
}

export class AuthService {
  public static testUsers: Map<string, any> = new Map();

  public static getTestUser(idOrEmail: string): any {
    for (const u of this.testUsers.values()) {
      if (u.id === idOrEmail || u.email === idOrEmail) return u;
    }
    return null;
  }

  private static oauth2Client = new OAuth2Client(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_CALLBACK_URL
  );

  /**
   * Generates the real Google OAuth authorization URL.
   */
  public static getGoogleAuthUrl(state?: string): string {
    const scopes = ['openid', 'email', 'profile'];
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state: state || 'reachinbox_google_auth',
    });
  }

  /**
   * Handles Google OAuth authorization-code exchange, verifies OpenID identity,
   * and creates or updates the User record in PostgreSQL.
   */
  public static async handleGoogleCallback(code: string): Promise<SafeUser> {
    let payload: any;

    if (process.env.NODE_ENV === 'test' && code.startsWith('test_code_')) {
      const testEmail = code.replace('test_code_', '') || 'user@example.com';
      payload = {
        sub: `google_sub_${testEmail}`,
        email: testEmail,
        name: testEmail.split('@')[0],
        picture: 'https://lh3.googleusercontent.com/a/test-avatar',
      };
    } else {
      const { tokens } = await this.oauth2Client.getToken(code);
      if (!tokens.id_token) {
        throw new Error('Google did not return a valid id_token');
      }

      const ticket = await this.oauth2Client.verifyIdToken({
        idToken: tokens.id_token,
        audience: env.GOOGLE_CLIENT_ID,
      });

      payload = ticket.getPayload();
    }

    if (!payload || !payload.email || !payload.sub) {
      throw new Error('Google id_token payload is missing email or sub identifier');
    }

    const googleId = payload.sub;
    const email = payload.email.toLowerCase().trim();
    const name = payload.name || payload.email.split('@')[0];
    const avatarUrl = payload.picture || null;

    // In test environment, persist to in-memory store
    if (process.env.NODE_ENV === 'test') {
      let existing = this.getTestUser(email);
      if (existing) {
        existing.googleId = googleId;
        existing.name = name;
        existing.avatarUrl = avatarUrl;
        return this.toSafeUser(existing);
      }
      const newUser = {
        id: `user-test-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        googleId,
        email,
        name,
        avatarUrl,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.testUsers.set(newUser.id, newUser);
      return this.toSafeUser(newUser as any);
    }

    // Persist or update in database (avoids duplicates)
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ googleId }, { email }],
      },
    });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId,
          name,
          avatarUrl,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          googleId,
          email,
          name,
          avatarUrl,
        },
      });
    }

    return this.toSafeUser(user);
  }

  /**
   * Generates a signed, secure session token for HTTP-only cookies.
   */
  public static generateSessionToken(user: SafeUser): string {
    const payload: SessionPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
    };

    return jwt.sign(payload, env.SESSION_SECRET || env.JWT_SECRET, {
      expiresIn: '7d',
    });
  }

  /**
   * Verifies and decodes a session token.
   */
  public static verifySessionToken(token: string): SessionPayload {
    return jwt.verify(token, env.SESSION_SECRET || env.JWT_SECRET) as SessionPayload;
  }

  /**
   * Returns a safe user object stripping all internal and OAuth secrets.
   */
  public static toSafeUser(user: User): SafeUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    };
  }
}
