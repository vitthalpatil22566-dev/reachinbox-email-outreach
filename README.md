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
- [ ] **Phase 3:** Redis Lua Sliding Window Rate Limiting & Inter-Email Delays
- [ ] **Phase 4:** Elasticsearch Sync, Bull Board & Slack / Google OAuth
- [ ] **Phase 5:** REST APIs & Business Logic
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
