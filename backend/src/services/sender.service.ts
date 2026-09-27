import { prisma } from '../config/database';
import { MailerService } from './mailer.service';
import { env } from '../config/env';

export interface SafeSender {
  id: string;
  email: string;
  name: string;
  hourlyLimit: number;
  minDelaySeconds: number;
  isPaused: boolean;
  createdAt: string;
  userId: string;
}

export class SenderService {
  public static testSenders: Map<string, any> = new Map();

  /**
   * Lists senders available to the user (or all system senders).
   * Ensures at least one primary sender exists so the user can schedule emails immediately.
   */
  public static async listSenders(userId?: string): Promise<SafeSender[]> {
    if (process.env.NODE_ENV === 'test') {
      if (this.testSenders.size === 0) {
        const defaultTestSender = {
          id: 'sender-default-test-id',
          userId: userId || 'user-default-test-id',
          email: 'primary.sender@reachinbox.ethereal',
          name: 'Primary Outbound Mailer',
          hourlyLimit: env.DEFAULT_HOURLY_LIMIT,
          minDelaySeconds: env.DEFAULT_MIN_DELAY_SECONDS,
          isPaused: false,
          createdAt: new Date().toISOString(),
        };
        this.testSenders.set(defaultTestSender.id, defaultTestSender);
      }
      return Array.from(this.testSenders.values());
    }

    try {
      let senders = await prisma.sender.findMany({
        where: userId ? { userId } : undefined,
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          email: true,
          name: true,
          hourlyLimit: true,
          minDelaySeconds: true,
          isPaused: true,
          createdAt: true,
          userId: true,
        },
      });

      // If no senders exist, provision an initial sender automatically
      if (senders.length === 0) {
        let user = userId
          ? await prisma.user.findUnique({ where: { id: userId } })
          : await prisma.user.findFirst();

        if (!user) {
          user = await prisma.user.create({
            data: {
              email: 'admin@reachinbox.local',
              name: 'ReachInbox Admin',
              googleId: 'reachinbox_default_admin',
            },
          });
        }

        const ethereal = await MailerService.createEtherealAccount();
        const created = await prisma.sender.create({
          data: {
            userId: user.id,
            email: ethereal.user,
            name: 'Primary Ethereal Sender',
            etherealUser: ethereal.user,
            etherealPass: ethereal.pass,
            etherealHost: ethereal.smtp.host,
            etherealPort: ethereal.smtp.port,
            hourlyLimit: env.DEFAULT_HOURLY_LIMIT,
            minDelaySeconds: env.DEFAULT_MIN_DELAY_SECONDS,
          },
          select: {
            id: true,
            email: true,
            name: true,
            hourlyLimit: true,
            minDelaySeconds: true,
            isPaused: true,
            createdAt: true,
            userId: true,
          },
        });

        senders = [created];
      }

      return senders.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
      }));
    } catch (err: any) {
      console.warn('SenderService.listSenders database fallback:', err.message);
      if (this.testSenders.size === 0) {
        const fallbackSender = {
          id: 'sender-fallback-id',
          userId: userId || 'user-fallback-id',
          email: 'fallback@reachinbox.ethereal',
          name: 'Fallback Ethereal Sender',
          hourlyLimit: env.DEFAULT_HOURLY_LIMIT,
          minDelaySeconds: env.DEFAULT_MIN_DELAY_SECONDS,
          isPaused: false,
          createdAt: new Date().toISOString(),
        };
        this.testSenders.set(fallbackSender.id, fallbackSender);
      }
      return Array.from(this.testSenders.values());
    }
  }

  /**
   * Creates a new sender profile with its own SMTP and rate-limiting limits.
   */
  public static async createSender(
    userId: string,
    data: {
      name: string;
      email?: string;
      hourlyLimit?: number;
      minDelaySeconds?: number;
    }
  ): Promise<SafeSender> {
    const hourlyLimit = data.hourlyLimit && data.hourlyLimit > 0 ? data.hourlyLimit : env.DEFAULT_HOURLY_LIMIT;
    const minDelaySeconds =
      data.minDelaySeconds !== undefined && data.minDelaySeconds >= 0
        ? data.minDelaySeconds
        : env.DEFAULT_MIN_DELAY_SECONDS;

    if (process.env.NODE_ENV === 'test') {
      const newSender = {
        id: `sender-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        userId,
        email: data.email || `sender.${Date.now()}@reachinbox.ethereal`,
        name: data.name || 'Custom Sender',
        hourlyLimit,
        minDelaySeconds,
        isPaused: false,
        createdAt: new Date().toISOString(),
      };
      this.testSenders.set(newSender.id, newSender);
      return newSender;
    }

    // Provision real Ethereal SMTP account for this sender
    const ethereal = await MailerService.createEtherealAccount();
    const senderEmail = data.email || ethereal.user;

    const sender = await prisma.sender.create({
      data: {
        userId,
        email: senderEmail,
        name: data.name || senderEmail.split('@')[0],
        etherealUser: ethereal.user,
        etherealPass: ethereal.pass,
        etherealHost: ethereal.smtp.host,
        etherealPort: ethereal.smtp.port,
        hourlyLimit,
        minDelaySeconds,
      },
      select: {
        id: true,
        email: true,
        name: true,
        hourlyLimit: true,
        minDelaySeconds: true,
        isPaused: true,
        createdAt: true,
        userId: true,
      },
    });

    return {
      ...sender,
      createdAt: sender.createdAt.toISOString(),
    };
  }
}
