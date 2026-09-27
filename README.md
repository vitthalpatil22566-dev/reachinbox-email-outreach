# ReachInbox Distributed Email Scheduler

A production-grade, distributed, multi-sender email scheduling platform built for ReachInbox.

## 🚀 Key Architectural Guarantees
- **Strictly Zero Cron / Polling Loops:** All delayed executions are handled exclusively via BullMQ delayed jobs persisted in Redis.
- **Restart & Crash Safety:** BullMQ delayed job timers survive backend restarts and container reboots via Redis AOF persistence. A specialized startup reconciler resolves any orphaned in-flight jobs.
- **Three-Tier Idempotency:** Deterministic job IDs, atomic PostgreSQL conditional updates (`SCHEDULED` -> `PROCESSING` -> `SENT`), and Redis distributed locks guarantee zero duplicate emails.
- **Cluster-Safe Rate Limiting:** Atomic Redis Lua sliding window algorithm enforces per-sender hourly limits across multiple worker instances.
- **Graceful Rescheduling (Never Fail on Limit):** When a sender hits their hourly limit, in-flight jobs are calculated for the next available window and automatically rescheduled in BullMQ rather than permanently failed.
- **Full-Text Search:** Elasticsearch 8 indexes scheduled and sent emails with instant multi-field search and fallback to PostgreSQL text search.
- **Slack Alerting:** Native Slack OAuth with live Block Kit alert dispatch when a sender reaches their hourly rate limit.
- **Google OAuth Login:** Secure authentication with Google Identity Services and JWT session management.
- **Live Queue Monitoring:** Embedded Bull Board UI mounted at `/admin/queues`.

---

## 🛠️ Tech Stack
- **Backend:** Node.js, TypeScript, Express.js, Prisma ORM, BullMQ, IORedis, Nodemailer (Ethereal Email), Elasticsearch Client, Slack SDK, Google Auth Library.
- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, Lucide React, Axios.
- **Database & Infrastructure:** PostgreSQL 16, Redis 7 (AOF enabled), Elasticsearch 8.11, Docker Compose.

---

## 📋 Implementation Phases
- [x] **Phase 1:** Foundation, Docker Compose & Project Scaffolding
- [ ] **Phase 2:** BullMQ Queue, Worker & Ethereal Email Engine
- [ ] **Phase 3:** Redis Lua Sliding Window Rate Limiting & Inter-Email Delays
- [ ] **Phase 4:** Elasticsearch Sync, Bull Board & Slack / Google OAuth
- [ ] **Phase 5:** REST APIs & Business Logic
- [ ] **Phase 6:** ReachInbox-Inspired Frontend UI
- [ ] **Phase 7:** Resilience & Concurrency Verification, Demo Video & Submission

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
5. Install frontend dependencies and start Vite dev server:
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```
