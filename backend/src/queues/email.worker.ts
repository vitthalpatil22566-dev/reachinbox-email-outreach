import { Worker, Job } from 'bullmq';
import { prisma } from '../config/database';
import { redisClient } from '../config/redis';
import { env } from '../config/env';
import { EMAIL_QUEUE_NAME, EmailJobData, emailQueue } from './email.queue';
import { MailerService } from '../services/mailer.service';
import { RateLimiterService } from '../services/ratelimiter.service';
import { EmailStatus } from '@prisma/client';

/**
 * Processor for each individual email job in BullMQ.
 * Integrates atomic Redis Lua rate limiting (hourly sliding window and minimum delay)
 * and safe conditional database state transitions (SCHEDULED -> PROCESSING -> SENT).
 */
export async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { emailId } = job.data;

  // 1. Fetch current Email record from database
  const email = await prisma.email.findUnique({
    where: { id: emailId },
    include: { sender: true },
  });

  if (!email) {
    console.warn(`[Worker] Email record [${emailId}] not found in database. Discarding job.`);
    return;
  }

  // 2. Strict Idempotency / Eligibility Check
  if (email.status === EmailStatus.SENT) {
    console.log(
      `[Worker] Email [${emailId}] is already marked as SENT. Skipping send to prevent duplication.`
    );
    return;
  }

  if (email.status === EmailStatus.FAILED && job.attemptsMade >= (job.opts.attempts || 3)) {
    console.log(`[Worker] Email [${emailId}] has permanently failed. Skipping.`);
    return;
  }

  // 3. Distributed Redis Rate Limiting & Minimum Delay Check (Atomic Lua)
  const hourlyLimit = email.sender?.hourlyLimit ?? env.DEFAULT_HOURLY_LIMIT;
  const minDelaySeconds = email.sender?.minDelaySeconds ?? env.DEFAULT_MIN_DELAY_SECONDS;

  const rateCheck = await RateLimiterService.checkAndReserve(
    email.senderId,
    hourlyLimit,
    minDelaySeconds,
    email.id,
    true // Reserve the slot if capacity is available
  );

  // 4. Rescheduling Logic when rate limit or minimum delay constraint is hit
  if (!rateCheck.allowed) {
    const delayMs = Math.max(200, rateCheck.delayMs);
    const newScheduledFor = new Date(Date.now() + delayMs);
    const rescheduledJobId = `${email.idempotencyKey}:rescheduled:${Date.now()}`;

    console.log(
      `⏳ [Worker] Sender [${email.sender?.email || email.senderId}] hit ${rateCheck.reason}. Rescheduling email [${email.id}] in ${delayMs}ms (new target: ${newScheduledFor.toISOString()})`
    );

    // Update Email in PostgreSQL to RESCHEDULED with new scheduled time
    await prisma.email.update({
      where: { id: email.id },
      data: {
        status: EmailStatus.RESCHEDULED,
        scheduledFor: newScheduledFor,
        bullJobId: rescheduledJobId,
        lastError: `Throttled by ${rateCheck.reason}. Automatically rescheduled.`,
        updatedAt: new Date(),
      },
    });

    // Re-enqueue as a delayed job in BullMQ with deterministic rescheduled ID
    await emailQueue.add('send-email', job.data, {
      jobId: rescheduledJobId,
      delay: delayMs,
    });

    // Audit log rate limit event in database (debounced to avoid flooding)
    if (rateCheck.reason === 'HOURLY_LIMIT') {
      await RateLimiterService.logRateLimitEvent(email.senderId, hourlyLimit);
    }

    // Acknowledge current execution as successfully rescheduled (not failed)
    return;
  }

  // 5. Safe Conditional Database State Transition: SCHEDULED / RESCHEDULED -> PROCESSING
  const transitionResult = await prisma.email.updateMany({
    where: {
      id: email.id,
      status: { in: [EmailStatus.SCHEDULED, EmailStatus.RESCHEDULED] },
    },
    data: {
      status: EmailStatus.PROCESSING,
      attempts: { increment: 1 },
      updatedAt: new Date(),
    },
  });

  if (transitionResult.count === 0) {
    console.log(
      `[Worker] Email [${email.id}] could not be transitioned to PROCESSING (current status: ${email.status}). Skipping.`
    );
    return;
  }

  console.log(`⚡ [Worker] Processing email [${email.id}] to ${email.recipientEmail}`);

  // 6. Dispatch Email via SMTP
  try {
    const senderCreds = email.sender
      ? {
          user: email.sender.etherealUser,
          pass: email.sender.etherealPass,
          host: email.sender.etherealHost,
          port: email.sender.etherealPort,
        }
      : undefined;

    const result = await MailerService.sendEmail({
      from: email.sender?.email,
      to: email.recipientEmail,
      subject: email.subject,
      body: email.body,
      senderCredentials: senderCreds,
    });

    // 7. Post-Send State Transition: PROCESSING -> SENT
    // ONLY executed after SMTP has verified and accepted the message
    await prisma.email.update({
      where: { id: email.id },
      data: {
        status: EmailStatus.SENT,
        sentAt: new Date(),
        etherealMessageId: result.messageId,
        etherealPreviewUrl: result.previewUrl,
        lastError: null,
        updatedAt: new Date(),
      },
    });

    console.log(`✅ [Worker] Email [${email.id}] successfully SENT via SMTP`);
  } catch (err: any) {
    const errorMessage = err?.message || 'Unknown SMTP error';
    console.error(`❌ [Worker] SMTP delivery failed for email [${email.id}]:`, errorMessage);

    const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts || 3);

    // Update database with failure info and reset status for retry or mark FAILED
    await prisma.email.update({
      where: { id: email.id },
      data: {
        lastError: errorMessage,
        status: isFinalAttempt ? EmailStatus.FAILED : EmailStatus.SCHEDULED,
        updatedAt: new Date(),
      },
    });

    // Rethrow to trigger BullMQ retry/backoff mechanism
    throw err;
  }
}

/**
 * BullMQ Worker instance.
 * Reads concurrency from configuration environment variable.
 */
export const emailWorker = new Worker<EmailJobData>(
  EMAIL_QUEUE_NAME,
  processEmailJob,
  {
    connection: redisClient,
    concurrency: env.WORKER_CONCURRENCY,
  }
);

emailWorker.on('completed', (job: Job<EmailJobData>) => {
  console.log(`[Worker] Job [${job.id}] completed successfully.`);
});

emailWorker.on('failed', (job: Job<EmailJobData> | undefined, err: Error) => {
  console.error(`[Worker] Job [${job?.id}] failed: ${err.message}`);
});

emailWorker.on('error', (err: Error) => {
  if (process.env.NODE_ENV !== 'test') {
    console.error('[Worker] Fatal queue worker error:', err);
  }
});
