process.env.NODE_ENV = 'test';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SenderService } from '../services/sender.service';
import { EmailService } from '../services/email.service';
import { EmailStatus } from '@prisma/client';

describe('Phase 5 — Senders, Bulk Scheduling & Email Listing Verification', () => {
  // --------------------------------------------------------------------------
  // 1. Sender Management & Security
  // --------------------------------------------------------------------------
  it('1. SenderService.listSenders returns senders and strictly hides SMTP passwords', async () => {
    const senders = await SenderService.listSenders('test-user-phase5');
    assert.ok(Array.isArray(senders) && senders.length > 0, 'Must return at least one sender');

    const primary = senders[0];
    assert.ok(primary.id, 'Sender must have an id');
    assert.ok(primary.email, 'Sender must have an email');
    assert.ok(primary.name, 'Sender must have a name');
    assert.strictEqual(typeof primary.hourlyLimit, 'number');
    assert.strictEqual(typeof primary.minDelaySeconds, 'number');

    // Strict security assertion: SMTP credentials must NEVER be exposed
    assert.strictEqual((primary as any).etherealPass, undefined, 'etherealPass must strictly not be returned');
    assert.strictEqual((primary as any).pass, undefined, 'pass must strictly not be returned');
  });

  it('2. SenderService.createSender provisions a new sender with custom rate limits', async () => {
    const newSender = await SenderService.createSender('test-user-phase5', {
      name: 'Secondary Outreach Sender',
      email: 'outreach@reachinbox.ethereal',
      hourlyLimit: 75,
      minDelaySeconds: 10,
    });

    assert.ok(newSender.id);
    assert.strictEqual(newSender.name, 'Secondary Outreach Sender');
    assert.strictEqual(newSender.hourlyLimit, 75);
    assert.strictEqual(newSender.minDelaySeconds, 10);
    assert.strictEqual((newSender as any).etherealPass, undefined);
  });

  // --------------------------------------------------------------------------
  // 2. Bulk Scheduling & Deduplication
  // --------------------------------------------------------------------------
  it('3. EmailService.bulkSchedule processes recipient lists idempotently', async () => {
    const senders = await SenderService.listSenders('test-user-phase5');
    const sender = senders[0];

    const recipients = [
      'prospect1@company.com',
      'prospect2@company.com',
      'prospect3@company.com',
      'invalid-email-address', // Should be skipped or ignored
    ];

    const targetDate = new Date(Date.now() + 3600000); // 1 hour in future

    // First bulk scheduling run
    const result1 = await EmailService.bulkSchedule({
      recipients,
      subject: 'Special Partnership Invitation',
      body: 'Hello, we would love to connect with your team.',
      scheduledFor: targetDate,
      senderId: sender.id,
      userId: 'test-user-phase5',
    });

    assert.strictEqual(result1.totalRecipients, 4);
    assert.strictEqual(result1.scheduledCount, 3, '3 valid recipients must be scheduled');
    assert.strictEqual(result1.duplicateCount, 0, 'No duplicates on initial run');

    // Second bulk scheduling run with identical payload -> must detect duplicates
    const result2 = await EmailService.bulkSchedule({
      recipients,
      subject: 'Special Partnership Invitation',
      body: 'Hello, we would love to connect with your team.',
      scheduledFor: targetDate,
      senderId: sender.id,
      userId: 'test-user-phase5',
    });

    assert.strictEqual(result2.duplicateCount, 3, 'All 3 valid recipients must be recognized as duplicates');
    assert.strictEqual(result2.scheduledCount, 0, '0 new emails scheduled on identical submission');
  });

  // --------------------------------------------------------------------------
  // 3. Email Listing & Pagination
  // --------------------------------------------------------------------------
  it('4. EmailService.listEmails filters by status and calculates pagination accurately', async () => {
    // List scheduled emails
    const scheduledList = await EmailService.listEmails({
      type: 'scheduled',
      page: 1,
      limit: 10,
    });

    assert.ok(Array.isArray(scheduledList.emails));
    assert.ok(scheduledList.pagination.total >= 3);
    assert.strictEqual(scheduledList.pagination.page, 1);
    assert.strictEqual(scheduledList.pagination.limit, 10);
    assert.strictEqual(typeof scheduledList.pagination.totalPages, 'number');

    // Verify all returned emails in scheduled list have scheduled statuses
    for (const email of scheduledList.emails) {
      assert.ok(
        [EmailStatus.SCHEDULED, EmailStatus.RESCHEDULED, EmailStatus.PROCESSING].includes(email.status),
        `Status ${email.status} must be a pending/scheduled status`
      );
    }

    // List sent emails (initially empty in test map)
    const sentList = await EmailService.listEmails({
      type: 'sent',
      page: 1,
      limit: 10,
    });
    assert.ok(Array.isArray(sentList.emails));
    for (const email of sentList.emails) {
      assert.strictEqual(email.status, EmailStatus.SENT);
    }
  });
});
