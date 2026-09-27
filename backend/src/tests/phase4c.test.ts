process.env.NODE_ENV = 'test';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../services/auth.service';
import { SlackService } from '../services/slack.service';
import { encryptToken, decryptToken } from '../utils/crypto';
import { requireAuth, SESSION_COOKIE_NAME } from '../middlewares/auth.middleware';
import { env } from '../config/env';

describe('Phase 4C — Google OAuth Authentication & Slack OAuth Integration Verification', () => {
  // --------------------------------------------------------------------------
  // PART A: Google OAuth & Session Management
  // --------------------------------------------------------------------------
  it('1. Google OAuth authorization URL generates valid consent parameters', () => {
    const authUrl = AuthService.getGoogleAuthUrl('test_state_123');
    assert.ok(authUrl.startsWith('https://accounts.google.com/o/oauth2/v2/auth'));
    assert.ok(authUrl.includes('response_type=code'));
    assert.ok(authUrl.includes('scope=openid'));
    assert.ok(authUrl.includes('state=test_state_123'));
  });

  it('2. Google OAuth code exchange creates new user idempotently without duplicates', async () => {
    const testEmail = 'developer.test@reachinbox.ai';
    const code = `test_code_${testEmail}`;

    // First login -> creates user
    const user1 = await AuthService.handleGoogleCallback(code);
    assert.ok(user1.id, 'User must have an ID');
    assert.strictEqual(user1.email, testEmail);
    assert.strictEqual(user1.name, 'developer.test');

    // Second login with same account -> updates and preserves same user ID
    const user2 = await AuthService.handleGoogleCallback(code);
    assert.strictEqual(user2.id, user1.id, 'User ID must remain identical on subsequent logins');
    assert.strictEqual(user2.email, testEmail);

    // Verify only ONE user record exists for this email
    const count = Array.from(AuthService.testUsers.values()).filter((u) => u.email === testEmail).length;
    assert.strictEqual(count, 1, 'Database/Store must contain exactly 1 user record, avoiding duplicates');
  });

  it('3. Session token generates valid signed JWT and extracts claims correctly', () => {
    const mockUser = {
      id: 'test-user-uuid-12345',
      email: 'test@reachinbox.ai',
      name: 'Test Engineer',
      avatarUrl: 'https://example.com/avatar.png',
    };

    const token = AuthService.generateSessionToken(mockUser);
    assert.ok(typeof token === 'string' && token.length > 20, 'Session token must be a signed JWT string');

    const decoded = AuthService.verifySessionToken(token);
    assert.strictEqual(decoded.userId, mockUser.id);
    assert.strictEqual(decoded.email, mockUser.email);
    assert.strictEqual(decoded.name, mockUser.name);

    // Reject tampered token
    assert.throws(() => {
      AuthService.verifySessionToken(`${token}corrupted`);
    }, 'Tampered session token must be rejected');
  });

  it('4. requireAuth middleware admits valid cookie and bearer token, rejects unauthenticated', async () => {
    // 4.1 Rejects missing credentials
    let statusCode = 0;
    let jsonBody: any = null;
    let nextCalled = false;

    const mockRes: any = {
      status: (code: number) => {
        statusCode = code;
        return {
          json: (body: any) => {
            jsonBody = body;
          },
        };
      },
    };

    const emptyReq: any = {
      cookies: {},
      headers: {},
    };

    await requireAuth(emptyReq, mockRes, () => {
      nextCalled = true;
    });

    assert.strictEqual(statusCode, 401);
    assert.strictEqual(jsonBody?.error, 'Unauthorized');
    assert.strictEqual(nextCalled, false);

    // 4.2 Accepts valid session token via cookie
    const testUser = AuthService.getTestUser('developer.test@reachinbox.ai');
    assert.ok(testUser, 'Test user must exist from step 2');

    const validToken = AuthService.generateSessionToken(AuthService.toSafeUser(testUser));

    const cookieReq: any = {
      cookies: { [SESSION_COOKIE_NAME]: validToken },
      headers: {},
    };

    nextCalled = false;
    await requireAuth(cookieReq, mockRes, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true, 'Next must be called when valid cookie is provided');
    assert.strictEqual(cookieReq.user?.id, testUser.id);
    assert.strictEqual(cookieReq.user?.email, testUser.email);

    // 4.3 Accepts valid session token via Authorization Bearer header
    const bearerReq: any = {
      cookies: {},
      headers: { authorization: `Bearer ${validToken}` },
    };

    nextCalled = false;
    await requireAuth(bearerReq, mockRes, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true, 'Next must be called when valid Bearer header is provided');
    assert.strictEqual(bearerReq.user?.id, testUser.id);
  });

  // --------------------------------------------------------------------------
  // PART B: AES-256-GCM Token Encryption at Rest
  // --------------------------------------------------------------------------
  it('5. AES-256-GCM token encryption and decryption preserves confidentiality and data integrity', () => {
    const rawSlackToken = 'xoxb-real-slack-access-token-1234567890-abcdefg';

    const encrypted = encryptToken(rawSlackToken);
    assert.ok(encrypted.includes(':'), 'Encrypted token must follow iv:authTag:cipherHex format');
    assert.notStrictEqual(encrypted, rawSlackToken, 'Ciphertext must not be plaintext');
    assert.strictEqual(encrypted.includes(rawSlackToken), false, 'Raw token must not appear in encrypted payload');

    const decrypted = decryptToken(encrypted);
    assert.strictEqual(decrypted, rawSlackToken, 'Decrypted token must exactly match raw plaintext token');

    // Verification of tamper detection (GCM auth tag mismatch)
    const parts = encrypted.split(':');
    const tamperedCipher = `${parts[0]}:${parts[1]}:deadbeef${parts[2].slice(8)}`;
    assert.throws(() => {
      decryptToken(tamperedCipher);
    }, 'Tampered ciphertext must fail GCM authentication check');
  });

  // --------------------------------------------------------------------------
  // PART C: Slack OAuth Flow & Workspace Integration
  // --------------------------------------------------------------------------
  it('6. Slack OAuth authorization URL generates valid workspace authorize link with state', () => {
    const testUserId = 'user-test-state-abc';
    const slackAuthUrl = SlackService.getSlackOAuthUrl(testUserId);

    assert.ok(slackAuthUrl.startsWith('https://slack.com/oauth/v2/authorize'));
    assert.ok(slackAuthUrl.includes(`state=${testUserId}`));
    assert.ok(slackAuthUrl.includes(`redirect_uri=${encodeURIComponent(env.SLACK_REDIRECT_URI)}`));
    assert.ok(slackAuthUrl.includes(`scope=${encodeURIComponent(env.SLACK_SCOPES)}`));
  });

  it('7. Slack OAuth code exchange stores token encrypted at rest and avoids duplicate integrations', async () => {
    const testUser = AuthService.getTestUser('developer.test@reachinbox.ai');
    assert.ok(testUser, 'User must exist');

    // First connection
    await SlackService.handleSlackCallback('test_code_slack_initial', testUser.id);

    const integration1 = SlackService.testIntegrations.get(testUser.id);
    assert.ok(integration1, 'SlackIntegration record must be created');
    assert.ok(integration1.accessToken, 'Access token must be present');
    assert.ok(integration1.accessToken.includes(':'), 'Access token must be encrypted in iv:tag:cipher format');
    assert.strictEqual(
      integration1.accessToken.includes('xoxb-test-access-token-12345'),
      false,
      'Raw Slack token must NEVER be stored in plain text in database'
    );

    // Second connection (re-authorizing or reconnecting)
    await SlackService.handleSlackCallback('test_code_slack_reconnect', testUser.id);

    const count = SlackService.testIntegrations.size;
    assert.strictEqual(count, 1, 'Only 1 Slack integration record must exist per user');
  });

  it('8. Slack status API returns connection info and strictly masks access token', async () => {
    const testUser = AuthService.getTestUser('developer.test@reachinbox.ai');
    assert.ok(testUser, 'User must exist');

    const status = await SlackService.getStatus(testUser.id);
    assert.strictEqual(status.connected, true);
    assert.strictEqual(status.teamName, 'Test ReachInbox Workspace');
    assert.ok(status.channelId, 'Channel ID must be present');
    assert.ok(status.connectedAt, 'Connected timestamp must be present');

    // Assert that sensitive token fields are NEVER present in status result
    assert.strictEqual((status as any).accessToken, undefined, 'accessToken must never be exposed');
    assert.strictEqual((status as any).botUserId, undefined, 'botUserId must never be exposed');
    assert.strictEqual((status as any).webhookUrl, undefined, 'webhookUrl must never be exposed');
  });

  it('9. Slack channel listing and target notification channel update works reliably', async () => {
    const testUser = AuthService.getTestUser('developer.test@reachinbox.ai');
    assert.ok(testUser, 'User must exist');

    // List channels
    const channels = await SlackService.listChannels(testUser.id);
    assert.ok(Array.isArray(channels) && channels.length > 0, 'Must return available channels');
    assert.strictEqual(channels[0].name, 'general');

    // Update target channel
    await SlackService.setTargetChannel(testUser.id, 'C87654321', 'alerts');

    const updatedStatus = await SlackService.getStatus(testUser.id);
    assert.strictEqual(updatedStatus.channelId, 'C87654321');
    assert.strictEqual(updatedStatus.channelName, 'alerts');
  });

  // --------------------------------------------------------------------------
  // PART D: Rate-Limit Slack Alerting & Cooldown Debounce
  // --------------------------------------------------------------------------
  it('10. Live Slack alert triggers on hourly rate limit and respects 15-minute cooldown debounce', async () => {
    const testUser = AuthService.getTestUser('developer.test@reachinbox.ai');
    assert.ok(testUser, 'User must exist');

    const sender = {
      id: 'sender-test-123',
      email: 'test.sender@reachinbox.ai',
      hourlyLimit: 10,
      minDelaySeconds: 2,
      userId: testUser.id,
    };

    // Reset dispatched alerts and cooldowns
    SlackService._dispatchedAlerts = [];
    SlackService._testCooldowns.clear();

    // Trigger first alert -> must be dispatched
    await SlackService.sendRateLimitAlert(sender.id, sender.email, 10, 60000);
    assert.strictEqual(SlackService._dispatchedAlerts.length, 1, 'First rate limit hit must dispatch Slack alert');
    assert.strictEqual(SlackService._dispatchedAlerts[0].senderEmail, sender.email);
    assert.strictEqual(SlackService._dispatchedAlerts[0].targetChannel, 'C87654321');
    assert.strictEqual(SlackService._dispatchedAlerts[0].hourlyLimit, 10);

    // Trigger second alert immediately -> must be throttled by 15-minute cooldown
    await SlackService.sendRateLimitAlert(sender.id, sender.email, 10, 60000);
    assert.strictEqual(
      SlackService._dispatchedAlerts.length,
      1,
      'Second rate limit hit within 15-minute cooldown window must be suppressed to avoid Slack channel spam'
    );
  });
});
