import { useState, useEffect } from 'react';
import {
  Mail,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Database,
  ExternalLink,
  LogIn,
  LogOut,
  Slack,
  AlertTriangle,
  Radio,
  RefreshCw,
  BellRing,
} from 'lucide-react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
axios.defaults.withCredentials = true;

interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}

interface SlackStatus {
  connected: boolean;
  teamId?: string | null;
  teamName?: string | null;
  channelId?: string | null;
  channelName?: string | null;
  connectedAt?: string | null;
}

interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
}

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [slackStatus, setSlackStatus] = useState<SlackStatus | null>(null);
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [slackLoading, setSlackLoading] = useState<boolean>(false);
  const [bannerMessage, setBannerMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Check URL query parameters on initial page load (OAuth callbacks)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authParam = params.get('auth');
    const slackParam = params.get('slack');
    const errorParam = params.get('error');

    if (authParam === 'success') {
      setBannerMessage({ type: 'success', text: 'Google authentication successful! You are now logged in.' });
    } else if (slackParam === 'connected') {
      setBannerMessage({ type: 'success', text: 'Slack workspace connected successfully!' });
    } else if (errorParam) {
      setBannerMessage({ type: 'error', text: `Authentication error: ${decodeURIComponent(errorParam)}` });
    }

    if (authParam || slackParam || errorParam) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Fetch authenticated user profile
  const fetchCurrentUser = async () => {
    try {
      setAuthLoading(true);
      const res = await axios.get(`${API_BASE}/auth/me`);
      if (res.data?.success && res.data?.data) {
        setUser(res.data.data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  // Fetch Slack integration status
  const fetchSlackStatus = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/v1/slack/status`);
      if (res.data?.success && res.data?.data) {
        setSlackStatus(res.data.data);
        if (res.data.data.channelId) {
          setSelectedChannel(res.data.data.channelId);
        }
      }
    } catch {
      setSlackStatus(null);
    }
  };

  // Fetch Slack channels
  const fetchSlackChannels = async () => {
    try {
      setSlackLoading(true);
      const res = await axios.get(`${API_BASE}/api/v1/slack/channels`);
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setChannels(res.data.data);
      }
    } catch (err: any) {
      console.warn('Could not fetch Slack channels:', err.message);
    } finally {
      setSlackLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchSlackStatus();
    } else {
      setSlackStatus(null);
      setChannels([]);
    }
  }, [user]);

  useEffect(() => {
    if (slackStatus?.connected) {
      fetchSlackChannels();
    }
  }, [slackStatus?.connected]);

  // Google Login initiation
  const handleGoogleLogin = () => {
    window.location.href = `${API_BASE}/auth/google`;
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      await axios.post(`${API_BASE}/auth/logout`);
      setUser(null);
      setSlackStatus(null);
      setChannels([]);
      setBannerMessage({ type: 'success', text: 'You have been logged out.' });
    } catch {
      setUser(null);
    }
  };

  // Slack Connect initiation
  const handleConnectSlack = () => {
    window.location.href = `${API_BASE}/auth/slack`;
  };

  // Slack Disconnect handler
  const handleDisconnectSlack = async () => {
    try {
      setSlackLoading(true);
      await axios.post(`${API_BASE}/api/v1/slack/disconnect`);
      setSlackStatus({ connected: false });
      setChannels([]);
      setSelectedChannel('');
      setBannerMessage({ type: 'success', text: 'Slack workspace disconnected.' });
    } catch (err: any) {
      setBannerMessage({ type: 'error', text: err.response?.data?.message || 'Failed to disconnect Slack' });
    } finally {
      setSlackLoading(false);
    }
  };

  // Save selected Slack notification channel
  const handleChannelChange = async (newChannelId: string) => {
    setSelectedChannel(newChannelId);
    const channelObj = channels.find((c) => c.id === newChannelId);
    const channelName = channelObj ? channelObj.name : newChannelId;

    try {
      await axios.post(`${API_BASE}/api/v1/slack/channel`, {
        channelId: newChannelId,
        channelName,
      });
      setSlackStatus((prev) => (prev ? { ...prev, channelId: newChannelId, channelName } : null));
      setBannerMessage({ type: 'success', text: `Alerts will now be sent to #${channelName}` });
    } catch (err: any) {
      setBannerMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save channel' });
    }
  };

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

        <div className="flex items-center gap-4">
          <a
            href={`${API_BASE}/admin/queues`}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-reach-card hover:bg-reach-border border border-reach-border text-gray-300 transition-colors"
          >
            <Radio className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            Bull Board Queues
            <ExternalLink className="w-3 h-3 text-reach-muted" />
          </a>

          {authLoading ? (
            <div className="w-8 h-8 rounded-full border-2 border-reach-border border-t-reach-primary animate-spin" />
          ) : user ? (
            <div className="flex items-center gap-3 bg-reach-card border border-reach-border px-3 py-1.5 rounded-full">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-reach-primary text-white flex items-center justify-center text-xs font-bold">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="hidden sm:block text-left text-xs">
                <p className="font-medium text-white">{user.name}</p>
                <p className="text-reach-muted text-[10px]">{user.email}</p>
              </div>
              <button
                onClick={handleLogout}
                title="Sign Out"
                className="p-1 hover:text-red-400 text-reach-muted transition-colors rounded"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleGoogleLogin}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white text-gray-900 hover:bg-gray-100 transition-all shadow-md active:scale-95"
            >
              <LogIn className="w-4 h-4 text-reach-primary" />
              Sign in with Google
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 flex flex-col gap-8">
        {/* Banner Alert */}
        {bannerMessage && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between text-sm ${
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

        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-reach-primary/10 text-reach-primary border border-reach-primary/20 mb-4">
            <span className="w-2 h-2 rounded-full bg-reach-primary animate-pulse"></span>
            Phase 4C Live: Google & Slack OAuth Ready
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4 bg-gradient-to-r from-white via-gray-200 to-indigo-300 bg-clip-text text-transparent">
            High-Performance Email Queue & Distributed Scheduler
          </h2>
          <p className="text-reach-muted text-base">
            Engineered with BullMQ, Redis Lua sliding window rate limits, Elasticsearch indexing, and real Slack & Google OAuth.
          </p>
        </div>

        {/* Slack Integration Card */}
        <div className="p-6 rounded-2xl bg-reach-card border border-reach-border shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-reach-border">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#4A154B]/30 text-[#ECB22E] flex items-center justify-center border border-[#ECB22E]/20">
                <Slack className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  Slack Rate-Limit Alerts
                  {slackStatus?.connected ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">
                      Disconnected
                    </span>
                  )}
                </h3>
                <p className="text-xs text-reach-muted mt-0.5">
                  Sends live Block Kit alerts when a sender reaches their hourly rate limit.
                </p>
              </div>
            </div>

            <div>
              {!user ? (
                <button
                  onClick={handleGoogleLogin}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-reach-card hover:bg-reach-border border border-reach-border text-reach-muted transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Sign in first to connect Slack
                </button>
              ) : slackStatus?.connected ? (
                <button
                  onClick={handleDisconnectSlack}
                  disabled={slackLoading}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                >
                  {slackLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Disconnect Slack
                </button>
              ) : (
                <button
                  onClick={handleConnectSlack}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#4A154B] hover:bg-[#611f69] text-white border border-[#ECB22E]/30 transition-all shadow-md active:scale-95"
                >
                  <Slack className="w-4 h-4 text-[#ECB22E]" />
                  Connect Slack Workspace
                </button>
              )}
            </div>
          </div>

          {/* Connected State Configuration */}
          {user && slackStatus?.connected && (
            <div className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 rounded-xl bg-reach-bg/60 border border-reach-border">
                <p className="text-xs text-reach-muted font-medium mb-1">CONNECTED WORKSPACE</p>
                <p className="text-base font-semibold text-white">{slackStatus.teamName || 'Slack Workspace'}</p>
                {slackStatus.connectedAt && (
                  <p className="text-xs text-reach-muted mt-1">
                    Connected on {new Date(slackStatus.connectedAt).toLocaleDateString()}
                  </p>
                )}
              </div>

              <div className="p-4 rounded-xl bg-reach-bg/60 border border-reach-border flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-reach-muted font-medium flex items-center gap-1.5">
                      <BellRing className="w-3.5 h-3.5 text-indigo-400" />
                      NOTIFICATION CHANNEL
                    </p>
                    {slackLoading && <RefreshCw className="w-3 h-3 text-reach-muted animate-spin" />}
                  </div>
                  <select
                    value={selectedChannel}
                    onChange={(e) => handleChannelChange(e.target.value)}
                    disabled={slackLoading || channels.length === 0}
                    className="w-full bg-reach-card border border-reach-border text-sm rounded-lg px-3 py-2 text-white focus:outline-none focus:border-reach-primary disabled:opacity-50"
                  >
                    <option value="" disabled>
                      {channels.length === 0 ? 'No channels available' : '-- Select a channel --'}
                    </option>
                    {channels.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        #{ch.name} {ch.isPrivate ? '(Private)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[11px] text-reach-muted mt-2">
                  When a sender hits the hourly threshold, ReachInbox notifies this channel with action details.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-reach-card border border-reach-border hover:border-reach-borderLight transition-all">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Zero Cron Architecture</h3>
            <p className="text-sm text-reach-muted leading-relaxed">
              Delayed email execution powered entirely by BullMQ Redis ZSET persistence. Guaranteed to survive crashes without cron jobs.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-reach-card border border-reach-border hover:border-reach-borderLight transition-all">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Cluster-Safe Rate Limiting</h3>
            <p className="text-sm text-reach-muted leading-relaxed">
              Atomic Redis Lua sliding window algorithm prevents race conditions across clusters. Jobs are deferred and rescheduled.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-reach-card border border-reach-border hover:border-reach-borderLight transition-all">
            <div className="w-10 h-10 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center mb-4">
              <Database className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Elasticsearch & Bull Board</h3>
            <p className="text-sm text-reach-muted leading-relaxed">
              Full-text search indexed in Elasticsearch and live queue inspection via the Bull Board monitoring dashboard.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
