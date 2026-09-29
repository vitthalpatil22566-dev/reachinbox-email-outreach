import React from 'react';
import { Menu, Radio, ExternalLink, LogIn, LogOut } from 'lucide-react';
import { UserProfile } from '../types';
import { API_BASE } from '../api/client';
import { TabKey } from './Sidebar';

interface TopHeaderProps {
  user: UserProfile | null;
  authLoading: boolean;
  activeTab: TabKey;
  onOpenMobileSidebar: () => void;
  onLogin: () => void;
  onLogout: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  user,
  authLoading,
  activeTab,
  onOpenMobileSidebar,
  onLogin,
  onLogout,
}) => {
  const getTabTitle = (tab: TabKey) => {
    switch (tab) {
      case 'dashboard':
        return {
          title: 'ReachInbox Dashboard',
          subtitle: 'Overview of your outreach performance and email activity.',
        };
      case 'compose':
        return {
          title: 'Compose & Schedule',
          subtitle: 'Create and schedule single or bulk email outreach campaigns.',
        };
      case 'scheduled':
        return {
          title: 'Scheduled Emails',
          subtitle: 'Manage upcoming scheduled email outreach dispatches.',
        };
      case 'sent':
        return {
          title: 'Sent Emails',
          subtitle: 'Review delivered outreach emails and delivery receipts.',
        };
      case 'search':
        return {
          title: 'Search Leads',
          subtitle: 'Search across your outreach contacts, subjects, and campaign history.',
        };
      case 'slack':
        return {
          title: 'Notifications',
          subtitle: 'Configure Slack channel notifications for your outreach campaigns.',
        };
      default:
        return {
          title: 'ReachInbox Email Scheduler',
          subtitle: 'Professional email outreach infrastructure.',
        };
    }
  };

  const { title, subtitle } = getTabTitle(activeTab);

  return (
    <header className="h-16 px-4 sm:px-6 bg-[#0E131F]/90 backdrop-blur border-b border-reach-border flex items-center justify-between sticky top-0 z-30">
      {/* Left: Mobile Menu Toggle & Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 text-reach-muted hover:text-white rounded-lg hover:bg-reach-card"
          title="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight leading-tight">
            {title}
          </h2>
          <p className="hidden md:block text-[11px] text-reach-muted truncate max-w-xl">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Right: Actions & User Profile */}
      <div className="flex items-center gap-2.5 sm:gap-3">

        {/* Bull Board Queue Monitor Link */}
        <a
          href={`${API_BASE}/admin/queues`}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-reach-card hover:bg-reach-border border border-reach-border text-gray-300 transition-colors"
          title="Inspect live Redis BullMQ jobs"
        >
          <Radio className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
          Queue Monitor
          <ExternalLink className="w-3 h-3 text-reach-muted" />
        </a>

        {/* User Auth Section */}
        {authLoading ? (
          <div className="w-8 h-8 rounded-full border-2 border-reach-border border-t-reach-primary animate-spin" />
        ) : user ? (
          <div className="flex items-center gap-2.5 bg-reach-card border border-reach-border px-3 py-1.5 rounded-full">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-7 h-7 rounded-full object-cover border border-indigo-500/30"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-reach-primary text-white flex items-center justify-center text-xs font-bold shadow-inner">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="hidden lg:block text-left text-xs">
              <p className="font-semibold text-white leading-none">{user.name}</p>
              <p className="text-reach-muted text-[10px] mt-0.5 leading-none">{user.email}</p>
            </div>
            <button
              onClick={onLogout}
              title="Sign Out"
              className="p-1 hover:text-red-400 text-reach-muted transition-colors rounded ml-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onLogin}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white text-gray-900 hover:bg-gray-100 transition-all shadow-md active:scale-95"
          >
            <LogIn className="w-4 h-4 text-reach-primary" />
            Sign in with Google
          </button>
        )}
      </div>
    </header>
  );
};
