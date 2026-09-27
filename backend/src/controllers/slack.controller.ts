import { Request, Response } from 'express';
import { SlackService } from '../services/slack.service';
import { env } from '../config/env';

export class SlackController {
  /**
   * GET /auth/slack
   * Initiates real Slack OAuth authorization flow for the authenticated user.
   */
  public static initiateSlackAuth(req: Request, res: Response): void {
    if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET) {
      res.status(500).json({
        success: false,
        error: 'MisconfiguredSlack',
        message: 'SLACK_CLIENT_ID or SLACK_CLIENT_SECRET is missing in server environment variables.',
      });
      return;
    }

    const userId = req.user!.id;
    const authUrl = SlackService.getSlackOAuthUrl(userId);
    res.redirect(authUrl);
  }

  /**
   * GET /auth/slack/callback
   * Exchanges code with Slack API, encrypts access token, and links to user.
   */
  public static async slackCallback(req: Request, res: Response): Promise<void> {
    try {
      const { code, state, error } = req.query;

      if (error) {
        res.redirect(`${env.FRONTEND_URL}/?error=${encodeURIComponent(error as string)}`);
        return;
      }

      if (!code || typeof code !== 'string' || !state || typeof state !== 'string') {
        res.redirect(`${env.FRONTEND_URL}/?error=invalid_slack_callback`);
        return;
      }

      const userId = state;
      await SlackService.handleSlackCallback(code, userId);

      res.redirect(`${env.FRONTEND_URL}/?slack=connected`);
    } catch (err: any) {
      console.error('❌ Slack OAuth callback error:', err.message);
      res.redirect(`${env.FRONTEND_URL}/?error=${encodeURIComponent(err.message)}`);
    }
  }

  /**
   * GET /api/v1/slack/status
   * Returns current Slack connection status for the authenticated user.
   */
  public static async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const status = await SlackService.getStatus(userId);

      res.json({
        success: true,
        data: status,
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
   * POST /api/v1/slack/disconnect
   * Disconnects the user's Slack workspace.
   */
  public static async disconnect(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      await SlackService.disconnect(userId);

      res.json({
        success: true,
        message: 'Slack workspace disconnected successfully',
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
   * GET /api/v1/slack/channels
   * Lists available Slack channels for channel selection.
   */
  public static async listChannels(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const channels = await SlackService.listChannels(userId);

      res.json({
        success: true,
        data: channels,
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: 'ChannelListError',
        message: err.message,
      });
    }
  }

  /**
   * POST /api/v1/slack/channel
   * Selects and stores target channel for rate-limit notifications.
   */
  public static async setChannel(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { channelId, channelName } = req.body;

      if (!channelId) {
        res.status(400).json({
          success: false,
          error: 'BadRequest',
          message: 'channelId is required',
        });
        return;
      }

      await SlackService.setTargetChannel(userId, channelId, channelName || channelId);

      res.json({
        success: true,
        message: 'Target Slack notification channel updated',
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
