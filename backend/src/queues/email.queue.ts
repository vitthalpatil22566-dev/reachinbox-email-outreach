import { Queue, Job } from 'bullmq';
import { redisClient } from '../config/redis';

export const EMAIL_QUEUE_NAME = 'reachinbox-email-queue';

export interface EmailJobData {
  emailId: string;
  idempotencyKey: string;
  recipientEmail: string;
  subject: string;
  body: string;
  senderId: string;
  userId: string;
  scheduledFor: string;
}

/**
 * Dedicated BullMQ Queue for scheduled and delayed emails.
 * Uses shared Redis connection and persists delayed jobs in Redis ZSET.
 */
export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5s, 10s, 20s
    },
    removeOnComplete: {
      age: 86400, // Retain completed jobs for 24 hours for inspection
      count: 2000,
    },
    removeOnFail: {
      age: 86400 * 7, // Retain failed jobs for 7 days
    },
  },
});

/**
 * Adds a delayed email job to BullMQ.
 * Uses deterministic jobId = idempotencyKey to prevent duplicate queuing.
 */
export async function addDelayedEmailJob(
  data: EmailJobData,
  delayMs: number
): Promise<Job<EmailJobData>> {
  const safeDelay = Math.max(0, Math.floor(delayMs));

  // jobId = data.idempotencyKey ensures deterministic BullMQ deduplication
  const job = await emailQueue.add('send-email', data, {
    jobId: data.idempotencyKey,
    delay: safeDelay,
  });

  return job;
}

/**
 * Inspects a job by its deterministic ID.
 */
export async function getEmailJob(jobId: string): Promise<Job<EmailJobData> | undefined> {
  return await emailQueue.getJob(jobId);
}
