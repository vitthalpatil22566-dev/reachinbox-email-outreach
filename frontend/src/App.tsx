import { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Database,
  LogIn,
} from 'lucide-react';
import { api, API_BASE } from './api/client';
import { UserProfile, Sender, EmailRecord } from './types';
import { Navbar } from './components/Navbar';
import { Sidebar, TabKey } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { DashboardTab } from './components/DashboardTab';
import { ComposeTab } from './components/ComposeTab';
import { ScheduledTab } from './components/ScheduledTab';
import { SentTab } from './components/SentTab';
import { SearchTab } from './components/SearchTab';
import { SlackTab } from './components/SlackTab';
import { EmailDetailsPanel } from './components/EmailDetailsPanel';
import { SenderModal } from './components/SenderModal';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [senders, setSenders] = useState<Sender[]>([]);
  const [bannerMessage, setBannerMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Enhanced SaaS Layout State — starts collapsed by default
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailRecord | null>(null);
  const [isSenderModalOpen, setIsSenderModalOpen] = useState<boolean>(false);
  const [scheduledCount, setScheduledCount] = useState<number>(0);

  // Fetch scheduled count for sidebar badge
  const fetchScheduledCount = async () => {
    try {
      const res = await api.emails.list({ type: 'scheduled', limit: 1 });
      setScheduledCount(res.pagination.total);
    } catch {
      // ignore
    }
  };

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
      setActiveTab('dashboard');
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
      fetchScheduledCount();
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
      setSelectedEmail(null);
      setBannerMessage({ type: 'success', text: 'You have been logged out.' });
    } catch {
      setUser(null);
    }
  };

  return (
    <div className="min-h-screen bg-reach-bg text-reach-text font-sans">
      {/* Unauthenticated Landing Experience */}
      {!user && !authLoading ? (
        <div className="min-h-screen flex flex-col">
          <Navbar
            user={user}
            authLoading={authLoading}
            onLogin={handleLogin}
            onLogout={handleLogout}
          />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-12 flex flex-col justify-center items-center text-center space-y-10">
            {bannerMessage && (
              <div
                className={`w-full max-w-xl p-4 rounded-xl border flex items-center justify-between text-sm ${
                  bannerMessage.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    : 'bg-red-500/10 border-red-500/20 text-red-300'
                }`}
              >
                <span>{bannerMessage.text}</span>
                <button
                  onClick={() => setBannerMessage(null)}
                  className="text-xs opacity-75 hover:opacity-100 underline ml-4"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div className="space-y-4 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium bg-reach-primary/10 text-reach-primary border border-reach-primary/20">
                <span className="w-2 h-2 rounded-full bg-reach-primary animate-pulse" />
                Email scheduling, simplified
              </div>
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-gray-200 to-indigo-300 bg-clip-text text-transparent">
                Email Scheduling & Outreach Platform
              </h1>
              <p className="text-reach-muted text-base max-w-xl mx-auto leading-relaxed">
                Reliable email outreach and scheduling. Dispatch multi-sender campaigns with automated rate limits, scheduled delivery, and team notifications.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <button
                onClick={handleLogin}
                className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-base font-semibold bg-white text-gray-900 hover:bg-gray-100 transition-all shadow-xl shadow-white/5 active:scale-95"
              >
                <LogIn className="w-5 h-5 text-reach-primary" />
                Sign in with Google
              </button>
            </div>

            {/* Product Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-left w-full pt-6 max-w-5xl">
              <div className="p-5 rounded-2xl bg-reach-card border border-reach-border">
                <Clock className="w-5 h-5 text-indigo-400 mb-2" />
                <h4 className="font-semibold text-white text-sm mb-1">Reliable Scheduling</h4>
                <p className="text-xs text-reach-muted">Schedule and dispatch outreach emails at the exact right moment for your prospects.</p>
              </div>
              <div className="p-5 rounded-2xl bg-reach-card border border-reach-border">
                <ShieldCheck className="w-5 h-5 text-emerald-400 mb-2" />
                <h4 className="font-semibold text-white text-sm mb-1">Smart Delivery Limits</h4>
                <p className="text-xs text-reach-muted">Protect your sender reputation with automated hourly limits and delivery pacing.</p>
              </div>
              <div className="p-5 rounded-2xl bg-reach-card border border-reach-border">
                <Database className="w-5 h-5 text-violet-400 mb-2" />
                <h4 className="font-semibold text-white text-sm mb-1">Search & Notifications</h4>
                <p className="text-xs text-reach-muted">Quickly search past email outreach and receive instant updates in your Slack channels.</p>
              </div>
            </div>
          </main>
        </div>
      ) : (
        /* Authenticated SaaS Dashboard Layout */
        <div className="min-h-screen bg-reach-bg flex">
          {/* Left Navigation Sidebar */}
          <Sidebar
            activeTab={activeTab}
            onSelectTab={(tab) => setActiveTab(tab)}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            isMobileOpen={isMobileSidebarOpen}
            onCloseMobile={() => setIsMobileSidebarOpen(false)}
            onOpenSenderModal={() => setIsSenderModalOpen(true)}
            onLogout={handleLogout}
            scheduledCount={scheduledCount}
          />

          {/* Main Area: TopHeader + Tab Views */}
          <div
            className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
              isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
            }`}
          >
            {/* Top SaaS Header */}
            <TopHeader
              user={user}
              authLoading={authLoading}
              activeTab={activeTab}
              onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
              onLogin={handleLogin}
              onLogout={handleLogout}
            />

            {/* Main Content Area */}
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
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

              {/* Active Tab Views */}
              <div>
                {activeTab === 'dashboard' && (
                  <DashboardTab
                    onNavigateToCompose={() => setActiveTab('compose')}
                    onNavigateToScheduled={() => setActiveTab('scheduled')}
                    onNavigateToSent={() => setActiveTab('sent')}
                    onSelectEmail={(email) => setSelectedEmail(email)}
                    senders={senders}
                  />
                )}

                {activeTab === 'compose' && (
                  <ComposeTab
                    senders={senders}
                    onRefreshSenders={fetchSenders}
                    onSuccess={(msg) => {
                      setBannerMessage({ type: 'success', text: msg });
                      fetchScheduledCount();
                      setActiveTab('scheduled');
                    }}
                    onError={(err) => setBannerMessage({ type: 'error', text: err })}
                  />
                )}

                {activeTab === 'scheduled' && (
                  <ScheduledTab onSelectEmail={(email) => setSelectedEmail(email)} />
                )}

                {activeTab === 'sent' && (
                  <SentTab onSelectEmail={(email) => setSelectedEmail(email)} />
                )}

                {activeTab === 'search' && (
                  <SearchTab
                    senders={senders}
                    onSelectEmail={(email) => setSelectedEmail(email)}
                  />
                )}

                {activeTab === 'slack' && (
                  <SlackTab
                    onSuccess={(msg) => setBannerMessage({ type: 'success', text: msg })}
                    onError={(err) => setBannerMessage({ type: 'error', text: err })}
                  />
                )}
              </div>
            </main>
          </div>

          {/* Right Slide-out Details Drawer */}
          <EmailDetailsPanel
            email={selectedEmail}
            onClose={() => setSelectedEmail(null)}
          />

          {/* Sender Creation Modal */}
          <SenderModal
            isOpen={isSenderModalOpen}
            onClose={() => setIsSenderModalOpen(false)}
            onSenderCreated={(newSender) => {
              setSenders((prev) => [...prev, newSender]);
              setBannerMessage({
                type: 'success',
                text: `Sender "${newSender.name}" created successfully.`,
              });
            }}
          />
        </div>
      )}
    </div>
  );
}
