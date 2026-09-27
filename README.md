# ReachInbox Distributed Email Scheduler

A production-grade, distributed, multi-sender email scheduling platform built for ReachInbox.

## 🚀 Key Architectural Guarantees
- **Strictly Zero Cron / Polling Loops:** All delayed executions are handled exclusively via BullMQ delayed jobs persisted in Redis.
- **Restart & Crash Safety:** BullMQ delayed job timers survive backend restarts and container reboots via Redis AOF persistence. A specialized startup reconciler resolves any orphaned in-flight jobs without rebuilding existing queues.
- **Multi-Tier Idempotency:** Deterministic job IDs, atomic PostgreSQL conditional updates (`SCHEDULED` -> `PROCESSING` -> `SENT`), and idempotency keys guarantee duplicate-safe scheduling and dispatch.
- **Cluster-Safe Rate Limiting (Phase 3):** Atomic Redis Lua sliding window algorithm enforces per-sender hourly limits across multiple worker instances.
- **Graceful Rescheduling (Never Fail on Limit - Phase 3):** When a sender hits their hourly limit, in-flight jobs are calculated for the next available window and automatically rescheduled in BullMQ rather than permanently failed.
- **Full-Text Search (Phase 4):** Elasticsearch 8 indexes scheduled and sent emails with instant multi-field search and fallback to PostgreSQL text search.
- **Slack Alerting (Phase 4):** Native Slack OAuth with live Block Kit alert dispatch when a sender reaches their hourly rate limit.
- **Google OAuth Login (Phase 5):** Secure authentication with Google Identity Services and JWT session management.
- **Live Queue Monitoring (Phase 4):** Embedded Bull Board UI mounted at `/admin/queues`.

---

## 🛠️ Tech Stack
- **Backend:** Node.js, TypeScript, Express.js, Prisma ORM, BullMQ, IORedis, Nodemailer (Ethereal Email), Elasticsearch Client, Slack SDK, Google Auth Library.
- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, Lucide React, Axios.
- **Database & Infrastructure:** PostgreSQL 16, Redis 7 (AOF enabled), Elasticsearch 8.11, Docker Compose.

---

## 📋 Implementation Phases
- [x] **Phase 1:** Foundation, Docker Compose & Project Scaffolding
- [x] **Phase 2:** BullMQ Queue, Worker & Ethereal Email Engine
- [x] **Phase 3:** Redis Lua Sliding Window Rate Limiting & Inter-Email Delays
- [x] **Phase 4A:** Elasticsearch Email Indexing & Search
- [x] **Phase 4B:** Bull Board Live Queue Dashboard
- [x] **Phase 4C:** Slack OAuth & Google OAuth
- [ ] **Phase 5:** Multi-Sender CSV Ingestion & Bulk Scheduling
- [ ] **Phase 6:** ReachInbox-Inspired Frontend UI
- [ ] **Phase 7:** Resilience & Concurrency Verification, Demo Video & Submission

---

## 📦 Phase 2 Implementation Details

### 1. BullMQ Email Queue & Redis Architecture
- **Queue Instance:** Initialized in `src/queues/email.queue.ts` as `reachinbox-email-queue` using the shared IORedis client configuration.
- **Zero Cron Guarantee:** Scheduling uses BullMQ delayed jobs exclusively:
  $$\text{delayMs} = \max(0, \text{scheduledFor}.getTime() - Date.now())$$
  Timers are maintained in Redis Sorted Sets (`ZSET`) where the score is the target UNIX timestamp.
- **Deterministic Job Deduplication:** Every job is registered with `jobId = idempotencyKey`. BullMQ rejects duplicate queue additions for identical pending or delayed jobs.
- **Retry & Exponential Backoff:** Configured with 3 attempts and exponential backoff (`delay: 5000` -> 5s, 10s, 20s). Jobs that fail transiently are retried; if attempts are exhausted, the database record transitions to `FAILED` with `lastError` recorded.

### 2. Nodemailer & Ethereal Email Engine
- **Service:** `src/services/mailer.service.ts` encapsulates all SMTP interactions.
- **Dynamic Provisioning:** On first use (or when custom sender credentials are not supplied), the service calls `nodemailer.createTestAccount()` to safely provision an ephemeral Ethereal account and caches it.
- **Web Preview URLs:** Following SMTP acceptance, the service extracts the preview link using `nodemailer.getTestMessageUrl(info)` (e.g. `https://ethereal.email/message/...`) and persists it in PostgreSQL alongside `etherealMessageId`.
- **Security:** SMTP credentials are never logged or exposed in client API responses.

### 3. BullMQ Worker & Atomic State Machine
- **Configurable Concurrency:** Configured in `src/queues/email.worker.ts` via `env.WORKER_CONCURRENCY` (default: 5 parallel jobs per worker).
- **Atomic State Transitions:**
  - Initial state: `SCHEDULED` in PostgreSQL.
  - Acquisition: Worker executes an atomic conditional update:
    ```sql
    UPDATE "Email" 
    SET status = 'PROCESSING', "attempts" = "attempts" + 1, "updatedAt" = NOW() 
    WHERE id = :id AND status IN ('SCHEDULED', 'RESCHEDULED');
    ```
    If another worker already acquired the row, 0 rows are returned and execution aborts immediately.
  - Delivery: Nodemailer dispatches the message.
  - Finalization: Only **after** SMTP returns a success response is the status updated to `SENT` with `sentAt` and `etherealPreviewUrl`.
  - Already-Sent Guard: If an email's status is already `SENT`, the worker skips it immediately.

### 4. Restart Safety & Crash Recovery
- **Redis AOF Durability:** BullMQ delayed jobs are saved in Redis Append-Only File (`--appendonly yes`), surviving server restarts without queue loss.
- **No Indiscriminate Re-enqueuing:** On server restart, the application does **not** re-enqueue all `SCHEDULED` emails from PostgreSQL, preventing job duplication.
- **Startup Reconciler (`ReconcilerService`):** Only scans for genuinely orphaned `PROCESSING` jobs older than 5 minutes. If a `messageId` exists, it marks them `SENT`; otherwise, it safely resets them to `SCHEDULED` and re-queues them with `delay: 0`.

### 5. Honest Tradeoff: Known "Exactly-Once" Limitation
In distributed systems, pure "exactly-once" delivery over external network protocols like SMTP is impossible.
- **The Failure Window:** If Nodemailer successfully sends an email to the SMTP server, but the backend process dies (e.g. ungraceful OS kill or power outage) **before** the PostgreSQL database transaction writes `status = SENT`, the email will be marked as orphaned upon restart.
- **Mitigation:** Our 3-tier idempotency eliminates duplicates under normal retries and duplicate scheduling requests. The startup reconciler logs recovery operations for full auditability.

---

## 📦 Phase 3 Implementation Details

### 1. Atomic Redis Lua Script & Key Namespacing
To avoid multi-worker race conditions, all rate-limiting and minimum-delay decisions are evaluated in a single atomic Lua script (`RateLimiterService`):
- `rate-limit:sender:{senderId}:window`: Redis Sorted Set (`ZSET`) containing member `${emailId}:${timestamp}` scored by send timestamp in milliseconds.
- `rate-limit:sender:{senderId}:last_sent`: Redis String holding the UNIX timestamp of the most recent email sent by this sender.
- `rate-limit:sender:{senderId}:log_cooldown`: 5-minute cooldown key to prevent database log flooding under heavy traffic.

### 2. Sliding Window Hourly Rate Limiting
- Calculates capacity across a rolling 1-hour window ($T_{\text{now}} - 3600000\text{ms}$).
- Clears expired timestamps using `ZREMRANGEBYSCORE`.
- If capacity is exhausted ($N \ge \text{hourlyLimit}$), queries the oldest timestamp in the active window (`ZRANGE key 0 0 WITHSCORES`) to calculate the exact millisecond delay until capacity is restored:
  $$\text{waitMs} = (T_{\text{oldest}} + 3600000) - T_{\text{now}} + 1000\text{ms}$$
- Returns `{ allowed: false, reason: 'HOURLY_LIMIT', delayMs: waitMs }`.

### 3. Inter-Email Minimum Delay Enforcement
- Reads `rate-limit:sender:{senderId}:last_sent`.
- If $T_{\text{now}} - T_{\text{last\_sent}} < \text{minDelayMs}$, calculates the exact remaining cooldown time:
  $$\text{delayNeeded} = \text{minDelayMs} - (T_{\text{now}} - T_{\text{last\_sent}})$$
- Returns `{ allowed: false, reason: 'MIN_DELAY', delayMs: delayNeeded }`.
- Multi-worker safe: The atomic script checks and sets `last_sent` in a single Redis transaction, preventing two concurrent workers from sending simultaneously.

### 4. Zero-Drop Rescheduling Architecture
When a rate limit or minimum delay constraint is encountered:
1. The email is **never marked FAILED**.
2. Status in PostgreSQL transitions to `RESCHEDULED`.
3. `scheduledFor` is updated to $T_{\text{now}} + \text{delayMs}$.
4. A new BullMQ delayed job is registered with `jobId = ${email.idempotencyKey}:rescheduled:${timestamp}` and `delay = delayMs`.
5. `Email.bullJobId` is updated in PostgreSQL to point to the active BullMQ delayed job.
6. The current job returns gracefully without throwing, allowing BullMQ to acknowledge the current execution cycle.

### 5. Multi-Worker Concurrency & Ordering Guarantees
- **Cluster Safety:** Evaluated in Redis single-threaded runtime. Tested under concurrent bursts of 15 simultaneous worker threads with zero breaches.
- **Sender Ordering:** Rescheduling delays are calculated proportionally from the sender's current window state, preserving queue order among pending emails for that sender.
- **Unavoidable Concurrency Edge Case:** In extreme worker race conditions where two emails have identical scheduled timestamps down to the millisecond, the worker whose Redis Lua command is scheduled first by Redis wins the slot; the second email is delayed by `minDelaySeconds`, preserving non-burst delivery.

---

## 📦 Phase 4A Implementation Details: Elasticsearch Email Indexing & Search

### 1. Elasticsearch Client & Configuration
- **Client Service:** Configured in `src/config/elasticsearch.ts` via `@elastic/elasticsearch` `Client`.
- **Environment Variables:**
  - `ELASTICSEARCH_URL` / `ELASTICSEARCH_NODE`: Base endpoint (e.g. `http://localhost:9200` or `http://elasticsearch:9200`).
  - `ELASTICSEARCH_USERNAME` / `ELASTICSEARCH_PASSWORD`: Optional cluster credentials.
- **Resilient Availability:** Includes connection health checks and automatic offline detection so local testing runs without blocking network timeouts.

### 2. Dedicated Index & Mapping Schema (`reachinbox-emails`)
Created safely and idempotently on application startup via `ensureIndexExists()` without dropping existing data:
```json
{
  "mappings": {
    "properties": {
      "emailId": { "type": "keyword" },
      "senderId": { "type": "keyword" },
      "senderEmail": { "type": "keyword" },
      "recipient": {
        "type": "text",
        "fields": { "keyword": { "type": "keyword" } }
      },
      "subject": { "type": "text", "analyzer": "standard" },
      "body": { "type": "text", "analyzer": "standard" },
      "status": { "type": "keyword" },
      "scheduledFor": { "type": "date" },
      "sentAt": { "type": "date" },
      "failedAt": { "type": "date" },
      "createdAt": { "type": "date" },
      "updatedAt": { "type": "date" },
      "idempotencyKey": { "type": "keyword" },
      "lastError": { "type": "text" }
    }
  }
}
```

### 3. Deterministic Idempotency & Lifecycle Sync
- **Deterministic Document ID:** Uses `email.id` as the Elasticsearch document ID (`_id = email.id`). Re-indexing the same email modifies the existing document in place rather than creating duplicate search hits.
- **Event-Driven Synchronization:**
  - **On Scheduling / Rescheduling:** `ElasticsearchService.indexScheduledEmail()` stores `SCHEDULED` / `RESCHEDULED` state and target timestamp.
  - **On SMTP Delivery:** `ElasticsearchService.indexSentEmail()` updates document status to `SENT` with `sentAt`.
  - **On Failure:** `ElasticsearchService.indexFailedEmail()` updates document status to `FAILED` with `failedAt` and `lastError`.

### 4. Non-Blocking Failure Guarantee
- Elasticsearch indexing calls are wrapped in non-blocking try/catch handlers.
- **PostgreSQL Database Remains the Single Source of Truth:** If Elasticsearch is unreachable, down, or encounters an internal timeout, email delivery continues without interruption. A successful send is **never** failed due to Elasticsearch.

### 5. Full-Text Search API Endpoint (`GET /api/v1/emails/search`)
- **Query Parameters:**
  - `q` / `query`: Free-text search matching across `recipient`, `subject`, and `body` (with fuzziness support).
  - `status`: Filter by delivery status (`SCHEDULED`, `RESCHEDULED`, `SENT`, `FAILED`).
  - `senderId`: Filter by sender UUID.
  - `page` (default: 1) and `limit` (default: 20): Offset pagination.
  - `sortField` (default: `updatedAt`) and `sortOrder` (`asc` | `desc`): Result ordering.
- **Response Format:**
  ```json
  {
    "success": true,
    "data": {
      "total": 42,
      "page": 1,
      "limit": 20,
      "totalPages": 3,
      "results": [...]
    }
  }
  ```

---

## 📦 Phase 4B Implementation Details: Bull Board Live Queue Dashboard

### 1. Dedicated Monitoring Endpoint & Adapter
- **Dashboard URL:** `http://localhost:5000/admin/queues`
- **Architecture:** Initialized in `src/queues/bullboard.ts` using `@bull-board/api` and `@bull-board/express`.
- **Zero Redundant Connections:** Directly mounts the existing `emailQueue` (`reachinbox-email-queue`) using `BullMQAdapter`, sharing the persistent Redis instance without duplicate connections.

### 2. Live Queue Observability
Displays real-time metrics and job lifecycles across five core states:
- **Delayed:** Future scheduled emails countdown and rate-limit backoff timers.
- **Waiting:** Ready for immediate pickup by the worker pool.
- **Active:** Currently being evaluated or dispatched via SMTP.
- **Completed:** Successfully delivered messages (retained for 24 hours).
- **Failed:** Permanently failed dispatches with error traces.

### 3. Administrative Actions & Controls
Enables operators and evaluators to:
- Inspect granular job payloads (recipient, subject, scheduled time, attempts made).
- Trigger manual job retries on failed items.
- Remove or clean completed queues.

### 4. Security & Credentials Hygiene
- **Configurable HTTP Basic Auth:** Guarded by `bullBoardAuthMiddleware`:
  - `BULL_BOARD_USERNAME`: Configured in `.env` (default: `admin`).
  - `BULL_BOARD_PASSWORD`: Configured in `.env` (default: `admin`).
- **Secrets Redaction:** SMTP passwords, database connection strings, and Redis credentials are never stored in BullMQ job data and are strictly excluded from dashboard serialization.

---

## 📦 Phase 4C Implementation Details

### 1. Real Google OAuth Authentication
- **Service:** `src/services/auth.service.ts` uses Google's official `OAuth2Client` from `google-auth-library`.
- **Flow:**
  1. `GET /auth/google` (or `/api/v1/auth/google`) redirects user to Google's consent screen requesting `openid`, `email`, and `profile` scopes.
  2. Google redirects back to `GET /auth/google/callback` with authorization `code`.
  3. `AuthService.handleGoogleCallback` exchanges code for tokens, validates the OpenID `id_token` ticket signature against `GOOGLE_CLIENT_ID`, and extracts verified identity (`sub`, `email`, `name`, `picture`).
  4. Idempotently creates or updates the `User` record in PostgreSQL (preventing duplicates).
  5. Signs a secure session token (JWT signed with `SESSION_SECRET`, 7-day expiration) and sets an HTTP-only cookie `reachinbox_session` (`sameSite: 'lax'`, `secure: production`).
  6. Redirects user back to frontend at `/?auth=success`.
- **Security Guard:** `requireAuth` middleware verifies HTTP-only cookie or `Authorization: Bearer <token>`, looks up user, and attaches safe user profile (`id`, `email`, `name`, `avatarUrl`) to `req.user`.

### 2. Real Slack OAuth Integration & Workspace Linking
- **Service:** `src/services/slack.service.ts` implements real Slack OAuth v2 flow using `@slack/web-api`.
- **Zero Webhook Substitute:** Uses real Slack OAuth application tokens rather than static incoming webhooks.
- **Flow:**
  1. User clicks "Connect Slack" in frontend, hitting `GET /auth/slack` (guarded by `requireAuth`).
  2. Backend signs user ID into OAuth `state` parameter and redirects to `https://slack.com/oauth/v2/authorize` with scopes `channels:read,groups:read,chat:write,chat:write.public`.
  3. Slack redirects to `GET /auth/slack/callback` with `code` and `state`.
  4. Backend exchanges code for bot token, encrypts access token at rest, and upserts `SlackIntegration` record linked to `userId`.
  5. Redirects to frontend with `/?slack=connected`.
- **AES-256-GCM Encryption at Rest:**
  - Token is encrypted in `src/utils/crypto.ts` with randomized 16-byte IV, 32-byte key derived from `ENCRYPTION_KEY`, and authentication tag: `${ivHex}:${authTagHex}:${cipherHex}`.
  - Raw tokens are NEVER stored in PostgreSQL or logged.
  - `decryptToken` verifies GCM authentication tag before returning plaintext.
- **Channel Listing & Selection:**
  - `GET /api/v1/slack/channels` decrypts bot token in-memory and queries Slack `conversations.list`.
  - `POST /api/v1/slack/channel` saves target notification channel.
  - `GET /api/v1/slack/status` returns connection state, team name, and selected channel while strictly masking access tokens and secrets.

### 3. Live Rate-Limit Slack Block Kit Alerting
- **Trigger:** Hooked directly into `src/queues/email.worker.ts` when an email job hits `HOURLY_LIMIT`.
- **Non-Blocking Architecture:** Slack notification dispatch is wrapped asynchronously (`.catch(() => {})`); delivery failures or Slack API downtime NEVER block or fail email queue processing.
- **15-Minute Redis Debounce Cooldown:**
  - Key: `rate-limit:sender:{senderId}:slack_alert_cooldown` (TTL 900s).
  - When a sender hits their hourly limit, multiple pending jobs mature around the same time. The cooldown ensures only ONE Slack notification is dispatched per 15-minute window per sender, completely preventing channel spamming.
- **Block Kit Formatting:** Sends structured card displaying sender email, configured hourly threshold, calculated next window delay, and reassurance that pending jobs were safely deferred rather than dropped.

---

## ⚙️ Quick Start (Local Development)

### Prerequisites
- Node.js >= 18
- Docker & Docker Compose (or local Postgres, Redis, Elasticsearch instances)

### Setup Instructions
1. Clone the repository and navigate into the root directory:
   ```bash
   cd reachinbox-scheduler
   ```
2. Copy the environment file:
   ```bash
   cp .env.example .env
   ```
3. Start infrastructure services using Docker Compose:
   ```bash
   docker compose up -d postgres redis elasticsearch
   ```
4. Install backend dependencies and initialize the database:
   ```bash
   cd backend
   npm install
   npx prisma db push
   npm run dev
   ```
5. Run the Phase 2 test suite:
   ```bash
   npm test
   ```
6. Install frontend dependencies and start Vite dev server:
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```
