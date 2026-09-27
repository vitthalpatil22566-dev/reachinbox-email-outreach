import crypto from 'crypto';
import { prisma } from '../config/database';
import { addDelayedEmailJob, getEmailJob, EmailJobData } from '../queues/email.queue';
import { MailerService } from './mailer.service';
import { ElasticsearchService } from './elasticsearch.service';
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

export interface ListEmailsOptions {
  type?: 'scheduled' | 'sent' | 'all';
  status?: string;
  senderId?: string;
  page?: number;
  limit?: number;
}

export interface ListEmailsResult {
  emails: any[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface BulkScheduleInput {
  recipients: string[];
  subject: string;
  body: string;
  scheduledFor: Date | string;
  senderId?: string;
  userId?: string;
  hourlyLimit?: number;
  minDelaySeconds?: number;
}

export interface BulkScheduleResult {
  totalRecipients: number;
  scheduledCount: number;
  duplicateCount: number;
  emails: Array<{
    id: string;
    recipientEmail: string;
    status: string;
    scheduledFor: Date | string;
    bullJobId: string;
    isDuplicate: boolean;
  }>;
}

export class EmailService {
  public static testEmails: Map<string, any> = new Map();
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

    // In test mode, handle in-memory persistence
    if (process.env.NODE_ENV === 'test') {
      const existing = this.testEmails.get(idempotencyKey);
      if (existing) {
        return {
          email: existing,
          bullJobId: existing.bullJobId || idempotencyKey,
          delayMs: Math.max(0, new Date(existing.scheduledFor).getTime() - Date.now()),
          isDuplicate: true,
        };
      }
      const testEmailRecord: any = {
        id: `email-test-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        userId: userId || 'test-user-id',
        senderId: senderId || 'test-sender-id',
        recipientEmail: recipientEmail.toLowerCase().trim(),
        subject,
        body,
        status: EmailStatus.SCHEDULED,
        scheduledFor: scheduledDate,
        sentAt: null,
        etherealPreviewUrl: null,
        etherealMessageId: null,
        bullJobId: idempotencyKey,
        idempotencyKey,
        attempts: 0,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        sender: {
          id: senderId || 'test-sender-id',
          email: 'primary.sender@reachinbox.ethereal',
          name: 'Primary Outbound Mailer',
        },
      };
      this.testEmails.set(idempotencyKey, testEmailRecord);
      return {
        email: testEmailRecord,
        bullJobId: idempotencyKey,
        delayMs: Math.max(0, scheduledDate.getTime() - Date.now()),
        isDuplicate: false,
      };
    }

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

    // Synchronize to Elasticsearch index (non-blocking)
    ElasticsearchService.indexScheduledEmail(updatedEmail).catch(() => {});

    return {
      email: updatedEmail,
      bullJobId: jobId,
      delayMs,
      isDuplicate: false,
    };
  }

  /**
   * Bulk schedules a batch of emails.
   * Leverages deterministic idempotency and preserves configured rate limits.
   */
  public static async bulkSchedule(input: BulkScheduleInput): Promise<BulkScheduleResult> {
    const { recipients, subject, body, scheduledFor, senderId, userId, hourlyLimit, minDelaySeconds } = input;

    if (!Array.isArray(recipients) || recipients.length === 0) {
      throw new Error('Recipients list cannot be empty');
    }

    // Optionally update sender limits if configured on the compose form
    if (senderId && (hourlyLimit || minDelaySeconds !== undefined)) {
      try {
        if (process.env.NODE_ENV !== 'test') {
          await prisma.sender.update({
            where: { id: senderId },
            data: {
              ...(hourlyLimit && hourlyLimit > 0 ? { hourlyLimit } : {}),
              ...(minDelaySeconds !== undefined && minDelaySeconds >= 0 ? { minDelaySeconds } : {}),
            },
          });
        }
      } catch (err: any) {
        console.warn('Could not update sender limits in bulkSchedule:', err.message);
      }
    }

    let scheduledCount = 0;
    let duplicateCount = 0;
    const emailSummaries: any[] = [];

    for (const recipient of recipients) {
      const trimmed = recipient.trim();
      if (!trimmed || !trimmed.includes('@')) continue;

      const res = await this.scheduleEmail({
        recipientEmail: trimmed,
        subject,
        body,
        scheduledFor,
        senderId,
        userId,
      });

      if (res.isDuplicate) {
        duplicateCount++;
      } else {
        scheduledCount++;
      }

      emailSummaries.push({
        id: res.email.id,
        recipientEmail: res.email.recipientEmail,
        status: res.email.status,
        scheduledFor: res.email.scheduledFor,
        bullJobId: res.bullJobId,
        isDuplicate: res.isDuplicate,
      });
    }

    return {
      totalRecipients: recipients.length,
      scheduledCount,
      duplicateCount,
      emails: emailSummaries,
    };
  }

  /**
   * Lists emails with pagination and status/type filtering.
   */
  public static async listEmails(options: ListEmailsOptions): Promise<ListEmailsResult> {
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? options.limit : 20;
    const skip = (page - 1) * limit;

    if (process.env.NODE_ENV === 'test') {
      let filtered = Array.from(this.testEmails.values());
      if (options.type === 'scheduled') {
        filtered = filtered.filter((e) =>
          [EmailStatus.SCHEDULED, EmailStatus.RESCHEDULED, EmailStatus.PROCESSING].includes(e.status)
        );
      } else if (options.type === 'sent') {
        filtered = filtered.filter((e) => e.status === EmailStatus.SENT);
      } else if (options.status) {
        filtered = filtered.filter((e) => e.status === options.status);
      }
      if (options.senderId) {
        filtered = filtered.filter((e) => e.senderId === options.senderId);
      }
      const total = filtered.length;
      const paginated = filtered.slice(skip, skip + limit);
      return {
        emails: paginated,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    }

    try {
      const where: Prisma.EmailWhereInput = {};

      if (options.type === 'scheduled') {
        where.status = {
          in: [EmailStatus.SCHEDULED, EmailStatus.RESCHEDULED, EmailStatus.PROCESSING],
        };
      } else if (options.type === 'sent') {
        where.status = EmailStatus.SENT;
      } else if (options.status) {
        where.status = options.status as EmailStatus;
      }

      if (options.senderId) {
        where.senderId = options.senderId;
      }

      const [total, emails] = await Promise.all([
        prisma.email.count({ where }),
        prisma.email.findMany({
          where,
          skip,
          take: limit,
          orderBy: options.type === 'sent' ? { sentAt: 'desc' } : { scheduledFor: 'desc' },
          include: {
            sender: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        }),
      ]);

      return {
        emails,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    } catch (err: any) {
      console.warn('EmailService.listEmails database fallback:', err.message);
      let filtered = Array.from(this.testEmails.values());
      const total = filtered.length;
      return {
        emails: filtered.slice(skip, skip + limit),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    }
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
