import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  RefreshCw,
  ShieldCheck,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { api } from '../api/client';
import { EmailRecord, Sender } from '../types';

interface DashboardTabProps {
  onNavigateToCompose: () => void;
  onNavigateToScheduled: () => void;
  onNavigateToSent: () => void;
  onSelectEmail: (email: EmailRecord) => void;
  senders: Sender[];
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  onNavigateToCompose,
  onNavigateToScheduled,
  onNavigateToSent,
  onSelectEmail,
  senders,
}) => {
  const [scheduledCount, setScheduledCount] = useState<number>(0);
  const [sentCount, setSentCount] = useState<number>(0);
  const [failedCount, setFailedCount] = useState<number>(0);
  const [recentEmails, setRecentEmails] = useState<EmailRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setError(null);
      // Fetch counts and recent emails using real backend endpoints
      const [scheduledRes, sentRes, failedRes, recentRes] = await Promise.all([
        api.emails.list({ type: 'scheduled', limit: 1 }),
        api.emails.list({ type: 'sent', limit: 1 }),
        api.emails.list({ status: 'FAILED', limit: 1 }),
        api.emails.list({ limit: 8 }),
      ]);

      setScheduledCount(scheduledRes.pagination.total);
      setSentCount(sentRes.pagination.total);
      setFailedCount(failedRes.pagination.total);
      setRecentEmails(recentRes.emails);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Scheduled
          </span>
        );
      case 'RESCHEDULED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">
            <RotateCcw className="w-3 h-3 text-purple-400" />
            Rescheduled
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            In Flight
          </span>
        );
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Delivered
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            <AlertTriangle className="w-3 h-3 text-red-400" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-gray-800 text-gray-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Welcome & Quick Actions Bar */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-reach-card via-[#131B2E] to-reach-card border border-reach-border shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Campaign Overview
          </h1>
          <p className="text-reach-muted text-xs mt-1 max-w-xl">
            Overview of your outreach performance and email activity.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-reach-bg hover:bg-reach-border border border-reach-border text-gray-300 hover:text-white transition-all shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={onNavigateToCompose}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-reach-primary hover:bg-reach-primaryHover text-white shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
          >
            <Send className="w-4 h-4" />
            Compose Batch
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Real Summary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Scheduled Emails */}
        <div
          onClick={onNavigateToScheduled}
          className="p-5 rounded-2xl bg-reach-card border border-reach-border hover:border-reach-primary/50 cursor-pointer transition-all shadow-lg group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-reach-muted">
              Scheduled Emails
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white">
            {loading ? '—' : scheduledCount}
          </div>
          <p className="text-[11px] text-reach-muted mt-1 flex items-center gap-1">
            <span>Upcoming deliveries</span>
            <ChevronRight className="w-3 h-3 text-reach-muted group-hover:translate-x-0.5 transition-transform ml-auto" />
          </p>
        </div>

        {/* Card 2: Sent Emails */}
        <div
          onClick={onNavigateToSent}
          className="p-5 rounded-2xl bg-reach-card border border-reach-border hover:border-emerald-500/50 cursor-pointer transition-all shadow-lg group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-reach-muted">
              Sent Emails
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white">
            {loading ? '—' : sentCount}
          </div>
          <p className="text-[11px] text-reach-muted mt-1 flex items-center gap-1">
            <span>Successfully sent</span>
            <ChevronRight className="w-3 h-3 text-reach-muted group-hover:translate-x-0.5 transition-transform ml-auto" />
          </p>
        </div>

        {/* Card 3: Failed Emails */}
        <div className="p-5 rounded-2xl bg-reach-card border border-reach-border shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-reach-muted">
              Failed Emails
            </span>
            <div className="w-9 h-9 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white">
            {loading ? '—' : failedCount}
          </div>
          <p className="text-[11px] text-reach-muted mt-1">Delivery issues</p>
        </div>

        {/* Card 4: Sender Profiles */}
        <div className="p-5 rounded-2xl bg-reach-card border border-reach-border shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-reach-muted">
              Sender Profiles
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white">
            {senders.length}
          </div>
          <p className="text-[11px] text-reach-muted mt-1">Active senders</p>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="p-6 rounded-2xl bg-reach-card border border-reach-border shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white text-base">Recent Campaigns</h3>
            <p className="text-xs text-reach-muted">
              View recent email outreach activity and delivery status.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="bg-reach-bg/80 border-b border-reach-border text-[11px] uppercase tracking-wider text-reach-muted font-semibold">
              <tr>
                <th className="py-3 px-4">Recipient</th>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4">Sender</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-reach-border/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-reach-muted">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-reach-primary" />
                    Loading recent activity...
                  </td>
                </tr>
              ) : recentEmails.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-reach-muted">
                    No email activity recorded yet. Click "Compose Batch" above to schedule outreach emails.
                  </td>
                </tr>
              ) : (
                recentEmails.map((email) => (
                  <tr
                    key={email.id}
                    onClick={() => onSelectEmail(email)}
                    className="hover:bg-reach-bg/60 cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-4 font-mono font-medium text-white max-w-xs truncate">
                      {email.recipientEmail}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs truncate text-gray-300">
                      {email.subject}
                    </td>
                    <td className="py-3.5 px-4 text-reach-muted truncate">
                      {email.sender?.name || 'Primary Mailer'}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-gray-400">
                      {email.sentAt
                        ? new Date(email.sentAt).toLocaleString()
                        : new Date(email.scheduledFor).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getStatusBadge(email.status)}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <span className="text-[11px] font-semibold text-reach-primary group-hover:underline">
                        View Details →
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
