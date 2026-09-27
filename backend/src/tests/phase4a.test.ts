process.env.NODE_ENV = 'test';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  ElasticsearchService,
  EMAIL_INDEX,
  EmailSearchDoc,
} from '../services/elasticsearch.service';

describe('Phase 4A — Elasticsearch Email Indexing & Search', () => {
  beforeEach(() => {
    ElasticsearchService.resetTestStore();
  });

  // --------------------------------------------------------------------------
  // 1. Index creation / mapping
  // --------------------------------------------------------------------------
  it('1. Index creation and mapping check operates non-destructively', async () => {
    assert.strictEqual(EMAIL_INDEX, 'reachinbox-emails', 'Index name must be reachinbox-emails');
    const result = await ElasticsearchService.ensureIndexExists();
    assert.ok(typeof result === 'boolean', 'ensureIndexExists must return a boolean');
  });

  // --------------------------------------------------------------------------
  // 2. Deterministic document ID
  // --------------------------------------------------------------------------
  it('2. Indexing uses deterministic emailId as the document identifier', async () => {
    const doc: EmailSearchDoc = {
      emailId: 'email-uuid-test-1',
      senderId: 'sender-1',
      senderEmail: 'sender1@reachinbox.local',
      recipient: 'lead@targetcompany.com',
      subject: 'Partnership Inquiry',
      body: 'Hi, we would love to discuss a partnership.',
      status: 'SCHEDULED',
      scheduledFor: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      idempotencyKey: 'idemp-key-1',
    };

    await ElasticsearchService.indexEmail(doc);

    // Search specifically for this ID
    const searchResult = await ElasticsearchService.searchEmails({
      query: 'lead@targetcompany.com',
    });

    assert.strictEqual(searchResult.total, 1);
    assert.strictEqual(searchResult.results[0].emailId, 'email-uuid-test-1');
  });

  // --------------------------------------------------------------------------
  // 3 & 4. Scheduled vs SENT email indexing & updating same document without duplicating
  // --------------------------------------------------------------------------
  it('3, 4 & 5. Scheduled email updates to SENT on delivery without duplicating documents', async () => {
    const emailId = 'email-uuid-lifecycle-1';
    const now = new Date();

    // 1. Initially index as SCHEDULED
    const scheduledDoc: EmailSearchDoc = {
      emailId,
      senderId: 'sender-1',
      senderEmail: 'sender1@reachinbox.local',
      recipient: 'prospect@acme.com',
      subject: 'Product Demo Next Tuesday',
      body: 'Are you available for a quick 15-minute call?',
      status: 'SCHEDULED',
      scheduledFor: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      idempotencyKey: 'lifecycle-key-1',
    };

    await ElasticsearchService.indexEmail(scheduledDoc);

    const initialSearch = await ElasticsearchService.searchEmails({
      query: 'prospect@acme.com',
    });
    assert.strictEqual(initialSearch.total, 1);
    assert.strictEqual(initialSearch.results[0].status, 'SCHEDULED');

    // 2. Worker dispatches email: update document to SENT with sentAt
    const sentTime = new Date(now.getTime() + 5000);
    const sentDoc: EmailSearchDoc = {
      ...scheduledDoc,
      status: 'SENT',
      sentAt: sentTime.toISOString(),
      updatedAt: sentTime.toISOString(),
    };

    await ElasticsearchService.indexEmail(sentDoc);

    // 3. Verify total documents is STILL 1 (updated, not duplicated!)
    const updatedSearch = await ElasticsearchService.searchEmails({
      query: 'prospect@acme.com',
    });
    assert.strictEqual(updatedSearch.total, 1, 'Total documents must remain 1 after update');
    assert.strictEqual(updatedSearch.results[0].status, 'SENT', 'Status must be updated to SENT');
    assert.strictEqual(updatedSearch.results[0].sentAt, sentTime.toISOString());
  });

  // --------------------------------------------------------------------------
  // 6. Free-text search across recipient, subject, and body
  // --------------------------------------------------------------------------
  it('6. Free-text search matches keywords across recipient, subject, and body', async () => {
    await ElasticsearchService.indexEmail({
      emailId: 'email-1',
      senderId: 'sender-1',
      senderEmail: 'outreach@reachinbox.com',
      recipient: 'alice@alpha.io',
      subject: 'Revolutionize your outbound sales pipeline',
      body: 'Check out our new AI platform.',
      status: 'SENT',
      scheduledFor: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      idempotencyKey: 'k-1',
    });

    await ElasticsearchService.indexEmail({
      emailId: 'email-2',
      senderId: 'sender-1',
      senderEmail: 'outreach@reachinbox.com',
      recipient: 'bob@beta.org',
      subject: 'Quarterly Newsletter',
      body: 'Here is what happened in Q3.',
      status: 'SCHEDULED',
      scheduledFor: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      idempotencyKey: 'k-2',
    });

    // Match by subject keyword
    const matchSubject = await ElasticsearchService.searchEmails({ query: 'pipeline' });
    assert.strictEqual(matchSubject.total, 1);
    assert.strictEqual(matchSubject.results[0].emailId, 'email-1');

    // Match by recipient email
    const matchRecipient = await ElasticsearchService.searchEmails({ query: 'bob@beta.org' });
    assert.strictEqual(matchRecipient.total, 1);
    assert.strictEqual(matchRecipient.results[0].emailId, 'email-2');

    // Match by body text
    const matchBody = await ElasticsearchService.searchEmails({ query: 'newsletter' });
    assert.strictEqual(matchBody.total, 1);
    assert.strictEqual(matchBody.results[0].emailId, 'email-2');
  });

  // --------------------------------------------------------------------------
  // 7. Status filtering
  // --------------------------------------------------------------------------
  it('7. Status filtering correctly isolates emails by delivery state', async () => {
    await ElasticsearchService.indexEmail({
      emailId: 'doc-sent',
      senderId: 's1',
      senderEmail: 's1@test.com',
      recipient: 'user1@test.com',
      subject: 'Sent Email',
      body: 'Text',
      status: 'SENT',
      scheduledFor: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      idempotencyKey: 'key-s',
    });

    await ElasticsearchService.indexEmail({
      emailId: 'doc-scheduled',
      senderId: 's1',
      senderEmail: 's1@test.com',
      recipient: 'user2@test.com',
      subject: 'Scheduled Email',
      body: 'Text',
      status: 'SCHEDULED',
      scheduledFor: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      idempotencyKey: 'key-sc',
    });

    const sentOnly = await ElasticsearchService.searchEmails({ status: 'SENT' });
    assert.strictEqual(sentOnly.total, 1);
    assert.strictEqual(sentOnly.results[0].emailId, 'doc-sent');

    const scheduledOnly = await ElasticsearchService.searchEmails({ status: 'SCHEDULED' });
    assert.strictEqual(scheduledOnly.total, 1);
    assert.strictEqual(scheduledOnly.results[0].emailId, 'doc-scheduled');
  });

  // --------------------------------------------------------------------------
  // 8. Sender filtering
  // --------------------------------------------------------------------------
  it('8. Sender filtering returns only emails belonging to target sender', async () => {
    await ElasticsearchService.indexEmail({
      emailId: 'doc-sender-a',
      senderId: 'sender-uuid-alpha',
      senderEmail: 'alpha@test.com',
      recipient: 'u1@test.com',
      subject: 'From Alpha',
      body: 'Text',
      status: 'SENT',
      scheduledFor: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      idempotencyKey: 'key-alpha',
    });

    await ElasticsearchService.indexEmail({
      emailId: 'doc-sender-b',
      senderId: 'sender-uuid-beta',
      senderEmail: 'beta@test.com',
      recipient: 'u2@test.com',
      subject: 'From Beta',
      body: 'Text',
      status: 'SENT',
      scheduledFor: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      idempotencyKey: 'key-beta',
    });

    const alphaResults = await ElasticsearchService.searchEmails({
      senderId: 'sender-uuid-alpha',
    });
    assert.strictEqual(alphaResults.total, 1);
    assert.strictEqual(alphaResults.results[0].emailId, 'doc-sender-a');
  });

  // --------------------------------------------------------------------------
  // 9. Pagination
  // --------------------------------------------------------------------------
  it('9. Pagination properly calculates offsets, page sizes, and total pages', async () => {
    for (let i = 1; i <= 5; i++) {
      await ElasticsearchService.indexEmail({
        emailId: `paginated-doc-${i}`,
        senderId: 's1',
        senderEmail: 's1@test.com',
        recipient: `user${i}@test.com`,
        subject: `Batch Subject ${i}`,
        body: `Body ${i}`,
        status: 'SCHEDULED',
        scheduledFor: new Date(Date.now() + i * 1000).toISOString(),
        createdAt: new Date(Date.now() + i * 1000).toISOString(),
        updatedAt: new Date(Date.now() + i * 1000).toISOString(),
        idempotencyKey: `pag-key-${i}`,
      });
    }

    const page1 = await ElasticsearchService.searchEmails({ page: 1, limit: 2 });
    assert.strictEqual(page1.total, 5);
    assert.strictEqual(page1.results.length, 2);
    assert.strictEqual(page1.totalPages, 3);

    const page2 = await ElasticsearchService.searchEmails({ page: 2, limit: 2 });
    assert.strictEqual(page2.results.length, 2);

    const page3 = await ElasticsearchService.searchEmails({ page: 3, limit: 2 });
    assert.strictEqual(page3.results.length, 1);
  });

  // --------------------------------------------------------------------------
  // 10. Elasticsearch failure does not break email delivery
  // --------------------------------------------------------------------------
  it('10. Non-blocking failure guarantee: ES errors do not throw or crash delivery', async () => {
    // Calling indexEmail with any input will never throw an unhandled exception
    const malformedDoc: any = {
      emailId: 'safe-fail-test',
    };

    let didThrow = false;
    try {
      const res = await ElasticsearchService.indexEmail(malformedDoc);
      assert.ok(typeof res === 'boolean', 'Must return boolean indicating success/failure');
    } catch {
      didThrow = true;
    }

    assert.strictEqual(didThrow, false, 'indexEmail must never throw or crash caller');
  });
});
