import { Request, Response } from 'express';
import { SenderService } from '../services/sender.service';

export class SenderController {
  /**
   * GET /api/v1/senders
   * Lists senders available to the authenticated user.
   */
  public static async listSenders(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const senders = await SenderService.listSenders(userId);

      res.json({
        success: true,
        data: senders,
      });
    } catch (err: any) {
      console.error('Error in listSenders controller:', err.message);
      res.status(500).json({
        success: false,
        error: 'ServerError',
        message: err.message,
      });
    }
  }

  /**
   * POST /api/v1/senders
   * Creates a new sender profile with its own rate-limit configuration.
   */
  public static async createSender(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { name, email, hourlyLimit, minDelaySeconds } = req.body;

      if (!name || name.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'BadRequest',
          message: 'Sender name is required',
        });
        return;
      }

      const sender = await SenderService.createSender(userId || 'default-user', {
        name,
        email,
        hourlyLimit: hourlyLimit ? parseInt(hourlyLimit, 10) : undefined,
        minDelaySeconds: minDelaySeconds !== undefined ? parseInt(minDelaySeconds, 10) : undefined,
      });

      res.status(201).json({
        success: true,
        data: sender,
      });
    } catch (err: any) {
      console.error('Error in createSender controller:', err.message);
      res.status(400).json({
        success: false,
        error: 'CreateSenderError',
        message: err.message,
      });
    }
  }
}
