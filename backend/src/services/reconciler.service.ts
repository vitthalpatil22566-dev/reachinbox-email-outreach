import { prisma } from '../config/database';
import { addDelayedEmailJob } from '../queues/email.queue';
import { EmailStatus } from '@prisma/client';

export class ReconcilerService {
  /**
   * Safe Startup Crash Reconciler.
   *
   * IMPORTANT ARCHITECTURAL GUARANTEE:
   * BullMQ delayed jobs are already persisted in Redis ZSET.
   * This method does NOT rebuild or re-enqueue existing SCHEDULED emails.
   * It strictly investigates orphaned PROCESSING jobs left behind if the
   * server crashed mid-send (older than 5 minutes).
   */
  public static async runStartupReconciliation(): Promise<{
    reconciledCount: number;
    recoveredCount: number;
  }> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const orphanedEmails = await prisma.email.findMany({
      where: {
        status: EmailStatus.PROCESSING,
        updatedAt: { lt: fiveMinutesAgo },
      },
    });

    if (orphanedEmails.length === 0) {
      console.log('🛡️ [Reconciler] Startup check passed. No orphaned PROCESSING jobs found.');
      return { reconciledCount: 0, recoveredCount: 0 };
    }

    console.warn(
      `⚠️ [Reconciler] Found ${orphanedEmails.length} orphaned PROCESSING job(s) from a previous crash.`
    );

    let recoveredCount = 0;

    for (const email of orphanedEmails) {
      if (email.etherealMessageId) {
        // SMTP already accepted it before crash: mark SENT
        await prisma.email.update({
          where: { id: email.id },
          data: {
            status: EmailStatus.SENT,
            sentAt: email.updatedAt,
          },
        });
        console.log(`[Reconciler] Confirmed send for orphaned email [${email.id}] -> marked SENT.`);
      } else {
        // SMTP did not complete: safely reset to SCHEDULED and re-enqueue with deterministic jobId
        const resetResult = await prisma.email.updateMany({
          where: {
            id: email.id,
            status: EmailStatus.PROCESSING,
          },
          data: {
            status: EmailStatus.SCHEDULED,
            lastError: 'Server restarted during processing. Re-enqueued by startup reconciler.',
            updatedAt: new Date(),
          },
        });

        if (resetResult.count > 0) {
          await addDelayedEmailJob(
            {
              emailId: email.id,
              idempotencyKey: email.idempotencyKey,
              recipientEmail: email.recipientEmail,
              subject: email.subject,
              body: email.body,
              senderId: email.senderId,
              userId: email.userId,
              scheduledFor: email.scheduledFor.toISOString(),
            },
            0 // Send immediately
          );
          recoveredCount++;
          console.log(`[Reconciler] Recovered orphaned email [${email.id}] -> re-enqueued.`);
        }
      }
    }

    return {
      reconciledCount: orphanedEmails.length,
      recoveredCount,
    };
  }
}
