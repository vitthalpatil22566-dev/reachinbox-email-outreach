import { Request, Response } from 'express';
import { EmailService } from '../services/email.service';
import { getEmailJob } from '../queues/email.queue';

export class EmailController {
  /**
   * POST /api/v1/emails/schedule
   * Creates/schedules a new email job.
   */
  public static async scheduleEmail(req: Request, res: Response): Promise<void> {
    try {
      const { recipientEmail, subject, body, scheduledFor, senderId, userId, idempotencyKey } =
        req.body;

      if (!recipientEmail || !subject || !body || !scheduledFor) {
        res.status(400).json({
          success: false,
          error: 'BadRequest',
          message: 'Missing required fields: recipientEmail, subject, body, scheduledFor',
        });
        return;
      }

      const result = await EmailService.scheduleEmail({
        recipientEmail,
        subject,
        body,
        scheduledFor,
        senderId,
        userId,
        idempotencyKey,
      });

      res.status(result.isDuplicate ? 200 : 201).json({
        success: true,
        data: {
          id: result.email.id,
          recipientEmail: result.email.recipientEmail,
          subject: result.email.subject,
          status: result.email.status,
          scheduledFor: result.email.scheduledFor,
          bullJobId: result.bullJobId,
          delayMs: result.delayMs,
          isDuplicate: result.isDuplicate,
        },
      });
    } catch (err: any) {
      console.error('Error in scheduleEmail controller:', err.message);
      res.status(400).json({
        success: false,
        error: 'SchedulingError',
        message: err.message,
      });
    }
  }

  /**
   * GET /api/v1/emails/:id
   * Retrieves an email record from the database.
   */
  public static async getEmailStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const email = await EmailService.getEmailById(id);

      if (!email) {
        res.status(404).json({
          success: false,
          error: 'NotFound',
          message: `Email with ID ${id} not found`,
        });
        return;
      }

      res.json({
        success: true,
        data: {
          id: email.id,
          recipientEmail: email.recipientEmail,
          subject: email.subject,
          status: email.status,
          scheduledFor: email.scheduledFor,
          sentAt: email.sentAt,
          etherealMessageId: email.etherealMessageId,
          etherealPreviewUrl: email.etherealPreviewUrl,
          idempotencyKey: email.idempotencyKey,
          attempts: email.attempts,
          lastError: email.lastError,
          bullJobId: email.bullJobId,
          sender: email.sender
            ? {
                id: email.sender.id,
                email: email.sender.email,
                name: email.sender.name,
              }
            : null,
        },
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: 'ServerError',
        message: err.message,
      });
    }
  }

  /**
   * GET /api/v1/emails/:id/job
   * Inspects the underlying BullMQ job status in Redis.
   */
  public static async getJobStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const email = await EmailService.getEmailById(id);

      if (!email) {
        res.status(404).json({
          success: false,
          error: 'NotFound',
          message: `Email with ID ${id} not found`,
        });
        return;
      }

      const jobId = email.bullJobId || email.idempotencyKey;
      const job = await getEmailJob(jobId);

      if (!job) {
        res.status(404).json({
          success: false,
          error: 'JobNotFound',
          message: `BullMQ job ${jobId} not found in Redis (may have expired or been purged)`,
        });
        return;
      }

      const state = await job.getState();
      const delay = job.opts.delay || 0;

      res.json({
        success: true,
        data: {
          jobId: job.id,
          state, // 'delayed', 'active', 'waiting', 'completed', 'failed'
          delayMs: delay,
          timestamp: job.timestamp,
          attemptsMade: job.attemptsMade,
          maxAttempts: job.opts.attempts,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
          failedReason: job.failedReason,
        },
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: 'ServerError',
        message: err.message,
      });
    }
  }
}
