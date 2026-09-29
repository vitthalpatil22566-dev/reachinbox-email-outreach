import React, { useState, useEffect } from 'react';
import {
  Clock,
  RefreshCw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  RotateCcw,
} from 'lucide-react';
import { api } from '../api/client';
import { EmailRecord, EmailStatus } from '../types';

interface ScheduledTabProps {
  onSelectEmail?: (email: EmailRecord) => void;
}

export const ScheduledTab: React.FC<ScheduledTabProps> = ({ onSelectEmail }) => {
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  const fetchScheduledEmails = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.emails.list({
        type: statusFilter === 'all' ? 'scheduled' : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        page,
        limit: 10,
      });

      setEmails(res.emails);
      setTotalPages(res.pagination.totalPages);
      setTotalCount(res.pagination.total);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load scheduled emails');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScheduledEmails();
  }, [page, statusFilter]);

  const getStatusBadge = (status: EmailStatus) => {
    switch (status) {
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            Scheduled
          </span>
        );
      case 'RESCHEDULED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">
            <RotateCcw className="w-3 h-3 text-purple-400" />
            Rescheduled (Rate Limit)
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            In Flight
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            <ShieldAlert className="w-3 h-3 text-red-400" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Filter and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5 bg-reach-card p-1.5 rounded-xl border border-reach-border">
          {[
            { id: 'all', label: 'All Active' },
            { id: 'SCHEDULED', label: 'Scheduled' },
            { id: 'RESCHEDULED', label: 'Rescheduled' },
            { id: 'PROCESSING', label: 'In Flight' },
            { id: 'FAILED', label: 'Failed' },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => {
                setStatusFilter(pill.id);
                setPage(1);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                statusFilter === pill.id
                  ? 'bg-reach-primary text-white shadow-sm'
                  : 'text-reach-muted hover:text-white'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        <button
          onClick={fetchScheduledEmails}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-reach-card hover:bg-reach-border border border-reach-border text-gray-300 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Table Container */}
      <div className="bg-reach-card border border-reach-border rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-reach-bg/80 border-b border-reach-border text-[11px] uppercase tracking-wider text-reach-muted font-semibold">
              <tr>
                <th className="py-3.5 px-6">Recipient</th>
                <th className="py-3.5 px-6">Subject</th>
                <th className="py-3.5 px-6">Sender</th>
                <th className="py-3.5 px-6">Target Timestamp</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right">Attempts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-reach-border/60">
              {loading && emails.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-reach-muted">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-reach-primary" />
                    Loading scheduled emails...
                  </td>
                </tr>
              ) : emails.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-reach-muted">
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 mx-auto flex items-center justify-center mb-3">
                      <Clock className="w-6 h-6" />
                    </div>
                    <p className="text-base font-medium text-white mb-1">No scheduled emails found</p>
                    <p className="text-xs">Scheduled and in-flight emails will appear here.</p>
                  </td>
                </tr>
              ) : (
                emails.map((e) => (
                  <tr
                    key={e.id}
                    onClick={() => onSelectEmail?.(e)}
                    className="hover:bg-reach-bg/70 cursor-pointer transition-colors group"
                  >
                    <td className="py-4 px-6 font-medium text-white max-w-xs truncate">
                      {e.recipientEmail}
                    </td>
                    <td className="py-4 px-6 max-w-xs truncate text-gray-300">{e.subject}</td>
                    <td className="py-4 px-6 text-xs text-reach-muted truncate">
                      {e.sender ? `${e.sender.name} (${e.sender.email})` : 'Primary Sender'}
                    </td>
                    <td className="py-4 px-6 text-xs text-gray-300 whitespace-nowrap">
                      {new Date(e.scheduledFor).toLocaleString()}
                    </td>
                    <td className="py-4 px-6 whitespace-nowrap">{getStatusBadge(e.status)}</td>
                    <td className="py-4 px-6 text-right font-mono text-xs text-reach-muted">
                      {e.attempts}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-reach-border bg-reach-bg/40 flex items-center justify-between text-xs text-reach-muted">
            <span>
              Showing Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalCount} total)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg bg-reach-card border border-reach-border hover:bg-reach-border disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg bg-reach-card border border-reach-border hover:bg-reach-border disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
