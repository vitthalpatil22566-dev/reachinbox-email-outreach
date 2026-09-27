import { Mail, CheckCircle2, Clock, ShieldCheck, Database, Layers } from 'lucide-react';

export default function App() {
  return (
    <div className="min-h-screen bg-reach-bg text-reach-text flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-reach-border bg-reach-card/60 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-reach-primary to-reach-accent flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight">ReachInbox</h1>
            <p className="text-xs text-reach-muted">Distributed Email Scheduler</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Phase 1 Ready
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 flex flex-col justify-center">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4 bg-gradient-to-r from-white via-gray-200 to-indigo-300 bg-clip-text text-transparent">
            High-Performance Email Queue & Distributed Scheduler
          </h2>
          <p className="text-reach-muted text-base">
            Built with TypeScript, Express, PostgreSQL, BullMQ, Redis Lua sliding window rate limiting, and Elasticsearch.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-reach-card border border-reach-border hover:border-reach-borderLight transition-all">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Zero Cron Architecture</h3>
            <p className="text-sm text-reach-muted leading-relaxed">
              Delayed email execution powered entirely by BullMQ Redis ZSET persistence. Guaranteed to survive backend crashes and restarts.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-reach-card border border-reach-border hover:border-reach-borderLight transition-all">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Cluster-Safe Rate Limiting</h3>
            <p className="text-sm text-reach-muted leading-relaxed">
              Atomic Redis Lua sliding window algorithm prevents race conditions across worker clusters. Jobs are automatically rescheduled rather than failed.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-reach-card border border-reach-border hover:border-reach-borderLight transition-all">
            <div className="w-10 h-10 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center mb-4">
              <Database className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Three-Tier Idempotency</h3>
            <p className="text-sm text-reach-muted leading-relaxed">
              Deterministic job IDs, atomic PostgreSQL state updates, and Redis distributed locks strictly prevent duplicate email dispatches.
            </p>
          </div>
        </div>

        {/* Phase Status Box */}
        <div className="mt-12 p-6 rounded-2xl bg-reach-card/80 border border-reach-border">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-5 h-5 text-indigo-400" />
            <h4 className="font-semibold">Phase 1 Foundation Checklist</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-reach-muted">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Docker Compose (Postgres, Redis AOF, Elasticsearch)</span>
            </div>
            <div className="flex items-center gap-2 text-reach-muted">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Prisma ORM Schema with multi-sender & audit models</span>
            </div>
            <div className="flex items-center gap-2 text-reach-muted">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>TypeScript Express setup with validated environment</span>
            </div>
            <div className="flex items-center gap-2 text-reach-muted">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Vite React frontend with ReachInbox Tailwind palette</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
