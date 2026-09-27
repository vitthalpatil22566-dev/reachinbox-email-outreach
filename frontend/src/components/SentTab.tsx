import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MailCheck,
} from 'lucide-react';
import { api } from '../api/client';
import { EmailRecord } from '../types';

export const SentTab: React.FC = () => {
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  const fetchSentEmails = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.emails.list({
        type: 'sent',
        page,
        limit: 10,
      });

      setEmails(res.emails);
      setTotalPages(res.pagination.totalPages);
      setTotalCount(res.pagination.total);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load delivered emails');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSentEmails();
  }, [page]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            Delivered Emails
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {totalCount} Total
            </span>
          </h2>
          <p className="text-xs text-reach-muted mt-0.5">
            Verified SMTP acceptance with live Ethereal email preview links.
          </p>
        </div>

        <button
          onClick={fetchSentEmails}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-reach-card hover:bg-reach-border border border-reach-border text-gray-300 transition-colors"
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
                <th className="py-3.5 px-6">Delivered Timestamp</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right">Ethereal Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-reach-border/60">
              {loading && emails.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-reach-muted">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-reach-primary" />
                    Loading delivered emails...
                  </td>
                </tr>
              ) : emails.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-reach-muted">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center mb-3">
                      <MailCheck className="w-6 h-6" />
                    </div>
                    <p className="text-base font-medium text-white mb-1">No sent emails yet</p>
                    <p className="text-xs">Once scheduled jobs mature and send via SMTP, they appear here.</p>
                  </td>
                </tr>
              ) : (
                emails.map((e) => (
                  <tr key={e.id} className="hover:bg-reach-bg/40 transition-colors">
                    <td className="py-4 px-6 font-medium text-white max-w-xs truncate">
                      {e.recipientEmail}
                    </td>
                    <td className="py-4 px-6 max-w-xs truncate text-gray-300">{e.subject}</td>
                    <td className="py-4 px-6 text-xs text-reach-muted truncate">
                      {e.sender ? `${e.sender.name} (${e.sender.email})` : 'Primary Sender'}
                    </td>
                    <td className="py-4 px-6 text-xs text-gray-300 whitespace-nowrap">
                      {e.sentAt ? new Date(e.sentAt).toLocaleString() : 'Delivered'}
                    </td>
                    <td className="py-4 px-6 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Delivered
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      {e.etherealPreviewUrl ? (
                        <a
                          href={e.etherealPreviewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-reach-bg hover:bg-reach-border border border-reach-border text-indigo-300 hover:text-white transition-colors"
                        >
                          View Email
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-reach-muted">—</span>
                      )}
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
