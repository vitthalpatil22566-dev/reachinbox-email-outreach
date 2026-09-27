import { esClient } from '../config/elasticsearch';
import { prisma } from '../config/database';
import { Email, EmailStatus } from '@prisma/client';

export const EMAIL_INDEX = 'reachinbox-emails';

export interface EmailSearchDoc {
  emailId: string;
  senderId: string;
  senderEmail: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledFor: string;
  sentAt?: string | null;
  failedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  idempotencyKey: string;
  lastError?: string | null;
  userId?: string;
}

export interface SearchQueryParams {
  query?: string;
  status?: string;
  senderId?: string;
  userId?: string;
  page?: number;
  limit?: number;
  sortField?: 'scheduledFor' | 'sentAt' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResult {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  results: EmailSearchDoc[];
}

export class ElasticsearchService {
  // In-memory document store for test environments or ES offline fallback
  private static inMemoryDocs: Map<string, EmailSearchDoc> = new Map();
  private static esAvailable: boolean | null = null;

  /**
   * Cached availability check to prevent waiting for connection timeouts.
   */
  public static async isElasticsearchAvailable(): Promise<boolean> {
    if (this.esAvailable !== null) return this.esAvailable;
    if (process.env.NODE_ENV === 'test') {
      this.esAvailable = false;
      return false;
    }
    try {
      const health = await esClient.cluster.health({});
      this.esAvailable = health.status === 'green' || health.status === 'yellow';
    } catch {
      this.esAvailable = false;
    }
    return this.esAvailable;
  }

  /**
   * Initializes the Elasticsearch index with appropriate mappings.
   * Safe and idempotent: Does NOT delete or alter existing indices.
   */
  public static async ensureIndexExists(): Promise<boolean> {
    if (!(await this.isElasticsearchAvailable())) {
      return true; // Graceful non-destructive bypass
    }

    try {
      const exists = await esClient.indices.exists({ index: EMAIL_INDEX });
      if (exists) {
        return true;
      }

      await esClient.indices.create({
        index: EMAIL_INDEX,
        mappings: {
          properties: {
            emailId: { type: 'keyword' },
            userId: { type: 'keyword' },
            senderId: { type: 'keyword' },
            senderEmail: { type: 'keyword' },
            recipient: {
              type: 'text',
              fields: {
                keyword: { type: 'keyword' },
              },
            },
            subject: { type: 'text', analyzer: 'standard' },
            body: { type: 'text', analyzer: 'standard' },
            status: { type: 'keyword' },
            scheduledFor: { type: 'date' },
            sentAt: { type: 'date' },
            failedAt: { type: 'date' },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' },
            idempotencyKey: { type: 'keyword' },
            lastError: { type: 'text' },
          },
        },
      });

      console.log(`✅ [Elasticsearch] Created index: ${EMAIL_INDEX}`);
      return true;
    } catch (err: any) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('⚠️ [Elasticsearch] Index initialization skipped (offline):', err.message);
      }
      return false;
    }
  }

  /**
   * Indexes or updates an email document in Elasticsearch.
   * Uses emailId as the deterministic document ID (_id) for idempotency.
   * NON-BLOCKING: Errors are logged but will NEVER fail or crash the calling process.
   */
  public static async indexEmail(doc: EmailSearchDoc): Promise<boolean> {
    // Save in memory fallback for resilience & testing
    this.inMemoryDocs.set(doc.emailId, doc);

    if (!(await this.isElasticsearchAvailable())) {
      return true; // Handled by fallback store
    }

    try {
      await esClient.index({
        index: EMAIL_INDEX,
        id: doc.emailId, // Deterministic document ID ensures idempotency
        document: doc,
        refresh: process.env.NODE_ENV === 'test' ? 'wait_for' : false,
      });
      return true;
    } catch (err: any) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`⚠️ [Elasticsearch] Indexing failed for email [${doc.emailId}]:`, err.message);
      }
      return false; // Continues gracefully
    }
  }

  /**
   * Helper to format and index an email in SCHEDULED or RESCHEDULED state.
   */
  public static async indexScheduledEmail(email: Email, senderEmail: string = ''): Promise<void> {
    await this.indexEmail({
      emailId: email.id,
      senderId: email.senderId,
      senderEmail,
      userId: (email as any).userId,
      recipient: email.recipientEmail,
      subject: email.subject,
      body: email.body,
      status: email.status,
      scheduledFor: email.scheduledFor.toISOString(),
      sentAt: email.sentAt ? email.sentAt.toISOString() : null,
      failedAt: null,
      createdAt: email.createdAt.toISOString(),
      updatedAt: email.updatedAt.toISOString(),
      idempotencyKey: email.idempotencyKey,
      lastError: email.lastError,
    });
  }

  /**
   * Helper to format and index an email in SENT state.
   */
  public static async indexSentEmail(email: Email, senderEmail: string = ''): Promise<void> {
    await this.indexEmail({
      emailId: email.id,
      senderId: email.senderId,
      senderEmail,
      userId: (email as any).userId,
      recipient: email.recipientEmail,
      subject: email.subject,
      body: email.body,
      status: EmailStatus.SENT,
      scheduledFor: email.scheduledFor.toISOString(),
      sentAt: (email.sentAt || new Date()).toISOString(),
      failedAt: null,
      createdAt: email.createdAt.toISOString(),
      updatedAt: new Date().toISOString(),
      idempotencyKey: email.idempotencyKey,
      lastError: null,
    });
  }

  /**
   * Helper to format and index an email in FAILED state.
   */
  public static async indexFailedEmail(
    email: Email,
    error: string,
    senderEmail: string = ''
  ): Promise<void> {
    await this.indexEmail({
      emailId: email.id,
      senderId: email.senderId,
      senderEmail,
      userId: (email as any).userId,
      recipient: email.recipientEmail,
      subject: email.subject,
      body: email.body,
      status: EmailStatus.FAILED,
      scheduledFor: email.scheduledFor.toISOString(),
      sentAt: null,
      failedAt: new Date().toISOString(),
      createdAt: email.createdAt.toISOString(),
      updatedAt: new Date().toISOString(),
      idempotencyKey: email.idempotencyKey,
      lastError: error,
    });
  }

  /**
   * Searches indexed emails with free-text querying, status/sender filtering,
   * sorting, and pagination.
   */
  public static async searchEmails(params: SearchQueryParams): Promise<SearchResult> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 20));
    const from = (page - 1) * limit;
    const sortField = params.sortField || 'updatedAt';
    const sortOrder = params.sortOrder || 'desc';

    // 1. Check if Elasticsearch cluster is available
    if (!(await this.isElasticsearchAvailable())) {
      return this.searchInMemory(params, from, limit, page, sortField, sortOrder);
    }

    try {
      const mustClauses: any[] = [];
      const filterClauses: any[] = [];

      if (params.query && params.query.trim().length > 0) {
        mustClauses.push({
          multi_match: {
            query: params.query.trim(),
            fields: ['recipient', 'recipient.keyword', 'subject', 'body'],
            fuzziness: 'AUTO',
          },
        });
      } else {
        mustClauses.push({ match_all: {} });
      }

      if (params.status) {
        filterClauses.push({
          term: { status: params.status.toUpperCase() },
        });
      }

      if (params.senderId) {
        filterClauses.push({
          term: { senderId: params.senderId },
        });
      }

      if (params.userId) {
        filterClauses.push({
          term: { userId: params.userId },
        });
      }

      const response = await esClient.search({
        index: EMAIL_INDEX,
        from,
        size: limit,
        query: {
          bool: {
            must: mustClauses,
            filter: filterClauses,
          },
        },
        sort: [{ [sortField]: { order: sortOrder } }],
      });

      const totalHits =
        typeof response.hits.total === 'number'
          ? response.hits.total
          : response.hits.total?.value || 0;

      const docs = response.hits.hits.map((hit) => hit._source as EmailSearchDoc);

      return {
        total: totalHits,
        page,
        limit,
        totalPages: Math.ceil(totalHits / limit) || 1,
        results: docs,
      };
    } catch (err: any) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('⚠️ [Elasticsearch] Search query failed, falling back to memory/DB:', err.message);
      }
    }

    // 2. High-fidelity in-memory / fallback query
    return this.searchInMemory(params, from, limit, page, sortField, sortOrder);
  }

  /**
   * Search simulator for test environments and offline fallback.
   */
  public static searchInMemory(
    params: SearchQueryParams,
    from: number,
    limit: number,
    page: number,
    sortField: string,
    sortOrder: 'asc' | 'desc'
  ): SearchResult {
    let list = Array.from(this.inMemoryDocs.values());

    // Status filter
    if (params.status) {
      const s = params.status.toUpperCase();
      list = list.filter((doc) => doc.status.toUpperCase() === s);
    }

    // Sender filter
    if (params.senderId) {
      list = list.filter((doc) => doc.senderId === params.senderId);
    }

    // User data isolation filter
    if (params.userId) {
      list = list.filter((doc) => doc.userId === params.userId);
    }

    // Free-text query
    if (params.query && params.query.trim().length > 0) {
      const q = params.query.toLowerCase().trim();
      list = list.filter(
        (doc) =>
          doc.recipient.toLowerCase().includes(q) ||
          doc.subject.toLowerCase().includes(q) ||
          doc.body.toLowerCase().includes(q)
      );
    }

    // Sorting
    list.sort((a, b) => {
      const valA = new Date((a as any)[sortField] || 0).getTime();
      const valB = new Date((b as any)[sortField] || 0).getTime();
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    const total = list.length;
    const paginated = list.slice(from, from + limit);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      results: paginated,
    };
  }

  /**
   * Clears in-memory test store (used in tests).
   */
  public static resetTestStore(): void {
    this.inMemoryDocs.clear();
  }
}
