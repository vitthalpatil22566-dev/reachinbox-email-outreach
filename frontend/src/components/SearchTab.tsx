import React, { useState, useEffect } from 'react';
import {
  Search as SearchIcon,
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Database,
} from 'lucide-react';
import { api } from '../api/client';
import { SearchResultItem, Sender } from '../types';

interface SearchTabProps {
  senders: Sender[];
}

export const SearchTab: React.FC<SearchTabProps> = ({ senders }) => {
  const [query, setQuery] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [senderId, setSenderId] = useState<string>('');
  const [sortField, setSortField] = useState<string>('scheduledFor');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [tookMs, setTookMs] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  const performSearch = async (targetPage = 1) => {
    try {
      setLoading(true);
      setHasSearched(true);
      const res = await api.emails.search({
        q: query.trim() || undefined,
        status: status || undefined,
        senderId: senderId || undefined,
        sortField,
        sortOrder,
        page: targetPage,
        limit: 10,
      });

      setResults(res.results || []);
      setTotal(res.total || 0);
      setTookMs(res.tookMs || 0);
      setTotalPages(res.totalPages || 1);
      setPage(res.page || 1);
    } catch (err: any) {
      console.warn('Search error:', err.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    performSearch(1);
  }, [status, senderId, sortField, sortOrder]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(1);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Search Header Bar */}
      <form onSubmit={handleSearchSubmit} className="space-y-4">
        <div className="p-4 rounded-2xl bg-reach-card border border-reach-border shadow-xl space-y-4">
          <div className="relative">
            <SearchIcon className="w-5 h-5 text-reach-muted absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by recipient email, subject keywords, or body contents..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-reach-bg border border-reach-border rounded-xl pl-12 pr-28 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-reach-primary"
            />
            <button
              type="submit"
              disabled={loading}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 rounded-lg text-xs font-semibold bg-reach-primary hover:bg-reach-primaryHover text-white transition-all shadow disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Search'}
            </button>
          </div>

          {/* Granular Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-reach-border/60">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-reach-muted block mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-reach-bg border border-reach-border text-xs rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-reach-primary"
              >
                <option value="">All Statuses</option>
                <option value="SCHEDULED">SCHEDULED</option>
                <option value="RESCHEDULED">RESCHEDULED</option>
                <option value="PROCESSING">PROCESSING</option>
                <option value="SENT">SENT</option>
                <option value="FAILED">FAILED</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-reach-muted block mb-1">
                Sender
              </label>
              <select
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
                className="w-full bg-reach-bg border border-reach-border text-xs rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-reach-primary"
              >
                <option value="">All Senders</option>
                {senders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-reach-muted block mb-1">
                Sort Field
              </label>
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value)}
                className="w-full bg-reach-bg border border-reach-border text-xs rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-reach-primary"
              >
                <option value="scheduledFor">Scheduled Time</option>
                <option value="sentAt">Sent Time</option>
                <option value="createdAt">Created Time</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-reach-muted block mb-1">
                Order
              </label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                className="w-full bg-reach-bg border border-reach-border text-xs rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-reach-primary"
              >
                <option value="desc">Newest First (DESC)</option>
                <option value="asc">Oldest First (ASC)</option>
              </select>
            </div>
          </div>
        </div>
      </form>

      {/* Metrics Banner */}
      <div className="flex items-center justify-between text-xs text-reach-muted px-1">
        <span className="flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-indigo-400" />
          Elasticsearch Index: <code className="text-gray-300">reachinbox-emails</code>
        </span>
        {hasSearched && (
          <span>
            Found <strong>{total}</strong> result(s) in <strong>{tookMs}ms</strong>
          </span>
        )}
      </div>

      {/* Results Table */}
      <div className="bg-reach-card border border-reach-border rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-reach-bg/80 border-b border-reach-border text-[11px] uppercase tracking-wider text-reach-muted font-semibold">
              <tr>
                <th className="py-3.5 px-6">Recipient</th>
                <th className="py-3.5 px-6">Subject</th>
                <th className="py-3.5 px-6">Sender</th>
                <th className="py-3.5 px-6">Target Date</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-reach-border/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-reach-muted">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-reach-primary" />
                    Searching Elasticsearch index...
                  </td>
                </tr>
              ) : results.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-reach-muted">
                    <p className="text-base font-medium text-white mb-1">No matching emails found</p>
                    <p className="text-xs">Try adjusting your keyword query or clearing the status filter.</p>
                  </td>
                </tr>
              ) : (
                results.map((r) => (
                  <tr key={r.emailId || r.id} className="hover:bg-reach-bg/40 transition-colors">
                    <td className="py-4 px-6 font-medium text-white max-w-xs truncate">{r.recipient}</td>
                    <td className="py-4 px-6 max-w-xs truncate text-gray-300">{r.subject}</td>
                    <td className="py-4 px-6 text-xs text-reach-muted truncate">
                      {r.senderEmail || 'Primary Sender'}
                    </td>
                    <td className="py-4 px-6 text-xs text-gray-300 whitespace-nowrap">
                      {new Date(r.scheduledFor).toLocaleString()}
                    </td>
                    <td className="py-4 px-6 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-reach-bg border border-reach-border text-gray-300">
                        {r.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      {r.etherealPreviewUrl ? (
                        <a
                          href={r.etherealPreviewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
                        >
                          Preview
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
              Showing Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({total} total)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1 || loading}
                onClick={() => performSearch(page - 1)}
                className="p-1.5 rounded-lg bg-reach-card border border-reach-border hover:bg-reach-border disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages || loading}
                onClick={() => performSearch(page + 1)}
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
