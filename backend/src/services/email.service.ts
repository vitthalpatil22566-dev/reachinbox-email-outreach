import crypto from 'crypto';
import { prisma } from '../config/database';
import { addDelayedEmailJob, getEmailJob, EmailJobData } from '../queues/email.queue';
import { MailerService } from './mailer.service';
import { Email, EmailStatus, Prisma } from '@prisma/client';

export type EmailWithSender = Prisma.EmailGetPayload<{
  include: { sender: true };
}>;

export interface ScheduleEmailInput {
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledFor: Date | string;
  senderId?: string;
  userId?: string;
  idempotencyKey?: string;
}

export interface ScheduleEmailResult {
  email: Email;
  bullJobId: string;
  delayMs: number;
  isDuplicate: boolean;
}

export class EmailService {
  /**
   * Helper to ensure an initial User and Sender exist in the database.
   * Enables immediate local testing and API verification.
   */
  public static async getOrCreateDefaultSenderAndUser(): Promise<{
    userId: string;
    senderId: string;
  }> {
    // 1. Find or create default user
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'admin@reachinbox.local',
          name: 'ReachInbox Admin',
          googleId: 'reachinbox_default_admin',
        },
      });
    }

    // 2. Find or create default sender with Ethereal credentials
    let sender = await prisma.sender.findFirst({
      where: { userId: user.id },
    });

    if (!sender) {
      const ethereal = await MailerService.createEtherealAccount();
      sender = await prisma.sender.create({
        data: {
          userId: user.id,
          email: ethereal.user,
          name: 'ReachInbox Primary Sender',
          etherealUser: ethereal.user,
          etherealPass: ethereal.pass,
          etherealHost: ethereal.smtp.host,
          etherealPort: ethereal.smtp.port,
          hourlyLimit: 50,
          minDelaySeconds: 5,
        },
      });
    }

    return { userId: user.id, senderId: sender.id };
  }

  /**
   * Schedules a new email job.
   * Enforces idempotency via deterministic idempotencyKey, creates DB record,
   * calculates delay, and schedules a delayed BullMQ job in Redis.
   */
  public static async scheduleEmail(input: ScheduleEmailInput): Promise<ScheduleEmailResult> {
    const { recipientEmail, subject, body } = input;

    // Validation
    if (!recipientEmail || !recipientEmail.includes('@')) {
      throw new Error('A valid recipientEmail is required');
    }
    if (!subject || subject.trim().length === 0) {
      throw new Error('Email subject cannot be empty');
    }
    if (!body || body.trim().length === 0) {
      throw new Error('Email body cannot be empty');
    }

    const scheduledDate = new Date(input.scheduledFor);
    if (isNaN(scheduledDate.getTime())) {
      throw new Error('Invalid scheduledFor date provided');
    }

    // Resolve User and Sender
    let userId = input.userId;
    let senderId = input.senderId;

    if (!userId || !senderId) {
      const defaults = await this.getOrCreateDefaultSenderAndUser();
      userId = userId || defaults.userId;
      senderId = senderId || defaults.senderId;
    }

    // Generate deterministic idempotency key if not supplied by client
    const idempotencyKey =
      input.idempotencyKey ||
      crypto
        .createHash('sha256')
        .update(`${senderId}:${recipientEmail.toLowerCase().trim()}:${scheduledDate.toISOString()}:${subject}`)
        .digest('hex');

    // 1. Idempotency Check: verify if an email with this idempotency key already exists
    const existing = await prisma.email.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      console.log(`[EmailService] Idempotent request detected for key: ${idempotencyKey}`);
      const existingJob = await getEmailJob(existing.bullJobId || idempotencyKey);
      const remainingDelay = Math.max(0, existing.scheduledFor.getTime() - Date.now());

      return {
        email: existing,
        bullJobId: existingJob?.id || existing.bullJobId || idempotencyKey,
        delayMs: remainingDelay,
        isDuplicate: true,
      };
    }

    // 2. Create Email record in PostgreSQL (Status: SCHEDULED)
    const email = await prisma.email.create({
      data: {
        userId,
        senderId,
        recipientEmail: recipientEmail.toLowerCase().trim(),
        subject,
        body,
        status: EmailStatus.SCHEDULED,
        scheduledFor: scheduledDate,
        idempotencyKey,
      },
    });

    // 3. Calculate delay from target scheduledFor timestamp
    const now = Date.now();
    const targetTimestamp = scheduledDate.getTime();
    const delayMs = Math.max(0, targetTimestamp - now);

    // 4. Add delayed job to BullMQ
    const jobPayload: EmailJobData = {
      emailId: email.id,
      idempotencyKey: email.idempotencyKey,
      recipientEmail: email.recipientEmail,
      subject: email.subject,
      body: email.body,
      senderId: email.senderId,
      userId: email.userId,
      scheduledFor: email.scheduledFor.toISOString(),
    };

    const job = await addDelayedEmailJob(jobPayload, delayMs);

    // 5. Update DB record with the BullMQ job ID
    const jobId = job.id || email.idempotencyKey;
    const updatedEmail = await prisma.email.update({
      where: { id: email.id },
      data: { bullJobId: jobId },
    });

    console.log(
      `📅 Scheduled Email [${email.id}] for ${scheduledDate.toISOString()} (Delay: ${delayMs}ms, BullJobId: ${jobId})`
    );

    return {
      email: updatedEmail,
      bullJobId: jobId,
      delayMs,
      isDuplicate: false,
    };
  }

  /**
   * Fetches an email by its UUID with sender information.
   */
  public static async getEmailById(id: string): Promise<EmailWithSender | null> {
    return await prisma.email.findUnique({
      where: { id },
      include: { sender: true },
    });
  }

  /**
   * Fetches an email by its idempotency key.
   */
  public static async getEmailByIdempotencyKey(key: string): Promise<EmailWithSender | null> {
    return await prisma.email.findUnique({
      where: { idempotencyKey: key },
      include: { sender: true },
    });
  }
}
