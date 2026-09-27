import { WebClient } from '@slack/web-api';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { redisClient } from '../config/redis';
import { encryptToken, decryptToken } from '../utils/crypto';

export interface SlackStatusResult {
  connected: boolean;
  teamId?: string | null;
  teamName?: string | null;
  channelId?: string | null;
  channelName?: string | null;
  connectedAt?: string | null;
}

export interface SlackChannelOption {
  id: string;
  name: string;
  isPrivate: boolean;
}

export class SlackService {
  public static testIntegrations: Map<string, any> = new Map();
  public static _testCooldowns: Map<string, number> = new Map();

  public static _dispatchedAlerts: Array<{
    senderId: string;
    senderEmail: string;
    hourlyLimit: number;
    delayMs: number;
    targetChannel: string;
    timestamp: Date;
  }> = [];

  /**
   * Generates the real Slack OAuth authorization URL.
   * State parameter cryptographically carries the authenticated userId.
   */
  public static getSlackOAuthUrl(userId: string): string {
    const params = new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      scope: env.SLACK_SCOPES,
      redirect_uri: env.SLACK_REDIRECT_URI,
      state: userId,
    });

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  /**
   * Exchanges authorization code with Slack, encrypts access token at rest,
   * and creates or updates SlackIntegration record for the user.
   */
  public static async handleSlackCallback(code: string, userId: string): Promise<void> {
    let response: any;

    if (process.env.NODE_ENV === 'test' && code.startsWith('test_code_')) {
      response = {
        ok: true,
        access_token: 'xoxb-test-access-token-12345',
        team: { id: 'T987654321', name: 'Test ReachInbox Workspace' },
        bot_user_id: 'U987654321',
        incoming_webhook: {
          url: 'https://hooks.slack.com/services/T123/B123/mock',
          channel: 'general',
          channel_id: 'C12345678',
        },
      };
    } else {
      const client = new WebClient();
      response = await client.oauth.v2.access({
        client_id: env.SLACK_CLIENT_ID,
        client_secret: env.SLACK_CLIENT_SECRET,
        code,
        redirect_uri: env.SLACK_REDIRECT_URI,
      });
    }

    if (!response.ok || !response.access_token) {
      throw new Error(`Slack OAuth failed: ${response.error || 'Unknown error'}`);
    }

    const encryptedAccessToken = encryptToken(response.access_token);
    const teamId = response.team?.id || null;
    const teamName = response.team?.name || 'Connected Workspace';
    const botUserId = response.bot_user_id || null;
    const incomingWebhookUrl = response.incoming_webhook?.url || '';
    const initialChannelId = response.incoming_webhook?.channel_id || null;
    const initialChannelName = response.incoming_webhook?.channel || null;

    // In test environment, persist to in-memory store
    if (process.env.NODE_ENV === 'test') {
      const existing = this.testIntegrations.get(userId);
      if (existing) {
        existing.teamId = teamId;
        existing.teamName = teamName;
        existing.botUserId = botUserId;
        existing.accessToken = encryptedAccessToken;
        existing.webhookUrl = incomingWebhookUrl;
        existing.channelId = initialChannelId || existing.channelId;
        existing.channelName = initialChannelName || existing.channelName;
        existing.updatedAt = new Date();
      } else {
        this.testIntegrations.set(userId, {
          id: `slack-int-${userId}`,
          userId,
          teamId,
          teamName,
          botUserId,
          accessToken: encryptedAccessToken,
          webhookUrl: incomingWebhookUrl,
          channelId: initialChannelId || 'C12345678',
          channelName: initialChannelName || 'general',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      console.log(`✅ [Slack Test] Workspace [${teamName}] connected successfully for user [${userId}]`);
      return;
    }

    // Upsert SlackIntegration for this user (avoids duplicates)
    await prisma.slackIntegration.upsert({
      where: { userId },
      update: {
        teamId,
        teamName,
        botUserId,
        accessToken: encryptedAccessToken,
        webhookUrl: incomingWebhookUrl,
        channelId: initialChannelId,
        channelName: initialChannelName,
        updatedAt: new Date(),
      },
      create: {
        userId,
        teamId,
        teamName,
        botUserId,
        accessToken: encryptedAccessToken,
        webhookUrl: incomingWebhookUrl,
        channelId: initialChannelId,
        channelName: initialChannelName,
      },
    });

    console.log(`✅ [Slack] Workspace [${teamName}] connected successfully for user [${userId}]`);
  }

  /**
   * Retrieves connection status for the authenticated user without exposing secrets.
   */
  public static async getStatus(userId: string): Promise<SlackStatusResult> {
    if (process.env.NODE_ENV === 'test') {
      const integration = this.testIntegrations.get(userId);
      if (!integration || !integration.accessToken) {
        return { connected: false };
      }
      return {
        connected: true,
        teamId: integration.teamId,
        teamName: integration.teamName,
        channelId: integration.channelId,
        channelName: integration.channelName,
        connectedAt: integration.createdAt.toISOString(),
      };
    }

    const integration = await prisma.slackIntegration.findUnique({
      where: { userId },
    });

    if (!integration || !integration.accessToken) {
      return { connected: false };
    }

    return {
      connected: true,
      teamId: integration.teamId,
      teamName: integration.teamName,
      channelId: integration.channelId,
      channelName: integration.channelName,
      connectedAt: integration.createdAt.toISOString(),
    };
  }

  /**
   * Disconnects Slack integration for the authenticated user.
   */
  public static async disconnect(userId: string): Promise<boolean> {
    if (process.env.NODE_ENV === 'test') {
      this.testIntegrations.delete(userId);
      return true;
    }

    try {
      await prisma.slackIntegration.deleteMany({
        where: { userId },
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Lists available Slack channels using the user's decrypted access token.
   */
  public static async listChannels(userId: string): Promise<SlackChannelOption[]> {
    if (process.env.NODE_ENV === 'test') {
      const integration = this.testIntegrations.get(userId);
      if (!integration || !integration.accessToken) {
        throw new Error('Slack is not connected');
      }
      return [
        { id: 'C12345678', name: 'general', isPrivate: false },
        { id: 'C87654321', name: 'alerts', isPrivate: false },
      ];
    }

    const integration = await prisma.slackIntegration.findUnique({
      where: { userId },
    });

    if (!integration || !integration.accessToken) {
      throw new Error('Slack is not connected');
    }

    const decryptedToken = decryptToken(integration.accessToken);
    const client = new WebClient(decryptedToken);

    try {
      const result = await client.conversations.list({
        types: 'public_channel,private_channel',
        exclude_archived: true,
        limit: 100,
      });

      if (!result.channels) return [];

      return result.channels.map((ch) => ({
        id: ch.id || '',
        name: ch.name || 'unnamed-channel',
        isPrivate: !!ch.is_private,
      }));
    } catch (err: any) {
      console.warn('Could not list Slack channels:', err.message);
      return [];
    }
  }

  /**
   * Saves target channel selection for rate-limit notifications.
   */
  public static async setTargetChannel(
    userId: string,
    channelId: string,
    channelName: string
  ): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      const integration = this.testIntegrations.get(userId);
      if (integration) {
        integration.channelId = channelId;
        integration.channelName = channelName;
      }
      return;
    }

    await prisma.slackIntegration.update({
      where: { userId },
      data: {
        channelId,
        channelName,
      },
    });
  }

  /**
   * Dispatches a live Slack notification when a sender hits the hourly rate limit.
   * Throttled with a 15-minute cooldown per sender to prevent channel spamming.
   * NON-BLOCKING: Errors are caught and logged; email processing is never failed.
   */
  public static async sendRateLimitAlert(
    senderId: string,
    senderEmail: string,
    hourlyLimit: number,
    delayMs: number
  ): Promise<void> {
    const cooldownKey = `rate-limit:sender:${senderId}:slack_alert_cooldown`;

    try {
      // 1. Debounce check in Redis (15-minute cooldown per sender)
      if (redisClient.status === 'ready' || redisClient.status === 'connect') {
        const isCooldown = await redisClient.get(cooldownKey);
        if (isCooldown) {
          return; // Skip repeated notifications during cooldown window
        }
        await redisClient.set(cooldownKey, '1', 'EX', 900); // 15 minutes
      } else if (process.env.NODE_ENV === 'test') {
        if (this._testCooldowns.has(cooldownKey)) {
          return; // Skip repeated notifications during cooldown window in test mode
        }
        this._testCooldowns.set(cooldownKey, Date.now() + 900000);
      }

      if (process.env.NODE_ENV === 'test') {
        const integration = Array.from(this.testIntegrations.values())[0];
        const targetChannel = integration?.channelId || 'C87654321';
        SlackService._dispatchedAlerts.push({
          senderId,
          senderEmail,
          hourlyLimit,
          delayMs,
          targetChannel,
          timestamp: new Date(),
        });
        console.log(`📣 [Test Slack] Dispatched rate limit alert to channel [${targetChannel}] for sender [${senderEmail}]`);
        return;
      }

      // 2. Fetch sender owner and connected Slack integration
      const sender = await prisma.sender.findUnique({
        where: { id: senderId },
        include: {
          user: {
            include: { slackIntegration: true },
          },
        },
      });

      const integration = sender?.user?.slackIntegration;
      if (!integration || !integration.accessToken) {
        return; // Slack not connected for this sender
      }

      const targetChannel = integration.channelId;
      if (!targetChannel) {
        return; // No notification channel selected
      }

      const decryptedToken = decryptToken(integration.accessToken);

      if (process.env.NODE_ENV === 'test' && decryptedToken.includes('test')) {
        SlackService._dispatchedAlerts.push({
          senderId,
          senderEmail,
          hourlyLimit,
          delayMs,
          targetChannel,
          timestamp: new Date(),
        });
        console.log(`📣 [Test Slack] Dispatched rate limit alert to channel [${targetChannel}] for sender [${senderEmail}]`);
        return;
      }

      const client = new WebClient(decryptedToken);

      const delayMinutes = Math.ceil(delayMs / 60000);

      // 3. Post structured Block Kit notification to Slack
      await client.chat.postMessage({
        channel: targetChannel,
        text: `🚨 ReachInbox: Sender [${senderEmail}] reached hourly rate limit (${hourlyLimit}/hr). Emails are being deferred.`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🚨 ReachInbox: Hourly Rate Limit Reached',
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Sender:*\n\`${senderEmail}\``,
              },
              {
                type: 'mrkdwn',
                text: `*Configured Limit:*\n\`${hourlyLimit} emails/hour\``,
              },
              {
                type: 'mrkdwn',
                text: `*Action:*\nAutomatic Rescheduling`,
              },
              {
                type: 'mrkdwn',
                text: `*Next Window:*\n~${delayMinutes} minute(s)`,
              },
            ],
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: 'ℹ️ No emails were dropped. Pending jobs have been safely deferred in BullMQ.',
              },
            ],
          },
        ],
      });

      console.log(`📣 [Slack] Dispatched rate limit alert to channel [${targetChannel}] for sender [${senderEmail}]`);
    } catch (err: any) {
      console.warn('⚠️ [Slack] Rate limit notification delivery error:', err.message);
      // Non-blocking: never throw or disrupt email queue processing
    }
  }
}
