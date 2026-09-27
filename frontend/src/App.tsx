import { useState, useEffect } from 'react';
import {
  Send,
  Clock,
  CheckCircle2,
  Search as SearchIcon,
  Slack,
  AlertTriangle,
  ShieldCheck,
  Database,
  LogIn,
} from 'lucide-react';
import { api, API_BASE } from './api/client';
import { UserProfile, Sender } from './types';
import { Navbar } from './components/Navbar';
import { ComposeTab } from './components/ComposeTab';
import { ScheduledTab } from './components/ScheduledTab';
import { SentTab } from './components/SentTab';
import { SearchTab } from './components/SearchTab';
import { SlackTab } from './components/SlackTab';

type TabKey = 'compose' | 'scheduled' | 'sent' | 'search' | 'slack';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<TabKey>('compose');
  const [senders, setSenders] = useState<Sender[]>([]);
  const [bannerMessage, setBannerMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Check URL query parameters on initial page load (OAuth callbacks)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authParam = params.get('auth');
    const slackParam = params.get('slack');
    const errorParam = params.get('error');

    if (authParam === 'success') {
      setBannerMessage({
        type: 'success',
        text: 'Google authentication successful! You are now logged in.',
      });
    } else if (slackParam === 'connected') {
      setBannerMessage({
        type: 'success',
        text: 'Slack workspace connected successfully!',
      });
      setActiveTab('slack');
    } else if (errorParam) {
      setBannerMessage({
        type: 'error',
        text: `Authentication error: ${decodeURIComponent(errorParam)}`,
      });
    }

    if (authParam || slackParam || errorParam) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Fetch authenticated user profile
  const fetchUser = async () => {
    try {
      setAuthLoading(true);
      const currentUser = await api.auth.getCurrentUser();
      setUser(currentUser);
    } catch {
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  // Fetch senders list
  const fetchSenders = async () => {
    try {
      const list = await api.senders.list();
      setSenders(list);
    } catch (err: any) {
      console.warn('Could not fetch senders:', err.message);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchSenders();
    }
  }, [user]);

  const handleLogin = () => {
    window.location.href = `${API_BASE}/auth/google`;
  };

  const handleLogout = async () => {
    try {
      await api.auth.logout();
      setUser(null);
      setSenders([]);
      setBannerMessage({ type: 'success', text: 'You have been logged out.' });
    } catch {
      setUser(null);
    }
  };

  return (
    <div className="min-h-screen bg-reach-bg text-reach-text flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        user={user}
        authLoading={authLoading}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        {/* Global Notification Banner */}
        {bannerMessage && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between text-sm animate-in fade-in duration-200 ${
              bannerMessage.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                : 'bg-red-500/10 border-red-500/20 text-red-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {bannerMessage.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-400" />
              )}
              <span>{bannerMessage.text}</span>
            </div>
            <button
              onClick={() => setBannerMessage(null)}
              className="text-xs opacity-75 hover:opacity-100 underline ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Unauthenticated View */}
        {!user && !authLoading ? (
          <div className="flex-1 flex flex-col justify-center items-center py-12 max-w-3xl mx-auto text-center space-y-10">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-reach-primary/10 text-reach-primary border border-reach-primary/20">
                <span className="w-2 h-2 rounded-full bg-reach-primary animate-pulse"></span>
                Phase 5 Dashboard Live
              </div>
              <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-gray-200 to-indigo-300 bg-clip-text text-transparent">
                Distributed Multi-Sender Email Scheduler
              </h2>
              <p className="text-reach-muted text-base max-w-xl mx-auto leading-relaxed">
                Engineered with BullMQ delayed queues, cluster-safe Redis Lua sliding window rate limits, Elasticsearch indexing, and real Google & Slack OAuth.
              </p>
            </div>

            <button
              onClick={handleLogin}
              className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-base font-semibold bg-white text-gray-900 hover:bg-gray-100 transition-all shadow-xl shadow-white/5 active:scale-95"
            >
              <LogIn className="w-5 h-5 text-reach-primary" />
              Sign in with Google to Access Dashboard
            </button>

            {/* Architecture Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-left w-full pt-6">
              <div className="p-5 rounded-2xl bg-reach-card border border-reach-border">
                <Clock className="w-5 h-5 text-indigo-400 mb-2" />
                <h4 className="font-semibold text-white text-sm mb-1">Zero Cron Architecture</h4>
                <p className="text-xs text-reach-muted">BullMQ delayed jobs persisted in Redis survive backend restarts.</p>
              </div>
              <div className="p-5 rounded-2xl bg-reach-card border border-reach-border">
                <ShieldCheck className="w-5 h-5 text-emerald-400 mb-2" />
                <h4 className="font-semibold text-white text-sm mb-1">Redis Lua Rate Limits</h4>
                <p className="text-xs text-reach-muted">Sliding-window hourly limits defer jobs automatically without permanent drops.</p>
              </div>
              <div className="p-5 rounded-2xl bg-reach-card border border-reach-border">
                <Database className="w-5 h-5 text-violet-400 mb-2" />
                <h4 className="font-semibold text-white text-sm mb-1">Elasticsearch & Slack</h4>
                <p className="text-xs text-reach-muted">Instant full-text query engine with Block Kit rate-limit alerting.</p>
              </div>
            </div>
          </div>
        ) : (
          /* Authenticated Dashboard View */
          <div className="space-y-6">
            {/* Dashboard Tabs Navigation */}
            <div className="flex items-center gap-2 border-b border-reach-border pb-3 overflow-x-auto">
              {[
                { key: 'compose', label: 'Compose & Schedule', icon: Send },
                { key: 'scheduled', label: 'Scheduled Queue', icon: Clock },
                { key: 'sent', label: 'Delivered', icon: CheckCircle2 },
                { key: 'search', label: 'Elasticsearch Search', icon: SearchIcon },
                { key: 'slack', label: 'Slack Alerts', icon: Slack },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as TabKey)}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-reach-primary text-white shadow-md shadow-indigo-500/20'
                        : 'text-reach-muted hover:text-white hover:bg-reach-card'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Active Tab Content */}
            <div>
              {activeTab === 'compose' && (
                <ComposeTab
                  senders={senders}
                  onRefreshSenders={fetchSenders}
                  onSuccess={(msg) => {
                    setBannerMessage({ type: 'success', text: msg });
                    setActiveTab('scheduled');
                  }}
                  onError={(err) => setBannerMessage({ type: 'error', text: err })}
                />
              )}

              {activeTab === 'scheduled' && <ScheduledTab />}

              {activeTab === 'sent' && <SentTab />}

              {activeTab === 'search' && <SearchTab senders={senders} />}

              {activeTab === 'slack' && (
                <SlackTab
                  onSuccess={(msg) => setBannerMessage({ type: 'success', text: msg })}
                  onError={(err) => setBannerMessage({ type: 'error', text: err })}
                />
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
