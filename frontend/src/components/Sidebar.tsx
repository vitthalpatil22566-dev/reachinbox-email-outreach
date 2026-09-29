import React from 'react';
import {
  LayoutDashboard,
  Send,
  Clock,
  CheckCircle2,
  Search as SearchIcon,
  Slack,
  Radio,
  ExternalLink,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Mail,
  X,
} from 'lucide-react';
import { API_BASE } from '../api/client';

export type TabKey = 'dashboard' | 'compose' | 'scheduled' | 'sent' | 'search' | 'slack';

interface SidebarProps {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenSenderModal: () => void;
  onLogout: () => void;
  scheduledCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  onOpenSenderModal,
  onLogout,
  scheduledCount = 0,
}) => {
  const navItems = [
    { key: 'dashboard' as TabKey, label: 'Dashboard', icon: LayoutDashboard },
    { key: 'compose' as TabKey, label: 'Compose & Schedule', icon: Send },
    {
      key: 'scheduled' as TabKey,
      label: 'Scheduled Emails',
      icon: Clock,
      badge: scheduledCount > 0 ? scheduledCount : undefined,
    },
    { key: 'sent' as TabKey, label: 'Sent Emails', icon: CheckCircle2 },
    { key: 'search' as TabKey, label: 'Search Leads', icon: SearchIcon },
    { key: 'slack' as TabKey, label: 'Notifications', icon: Slack },
  ];

  const handleNavClick = (key: TabKey) => {
    onSelectTab(key);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Main Sidebar Element */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 bg-[#0E131F] border-r border-reach-border flex flex-col transition-all duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}`}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 border-b border-reach-border flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-reach-primary to-reach-accent flex items-center justify-center shadow-md shadow-indigo-500/20 flex-shrink-0">
              <Mail className="w-5 h-5 text-white" />
            </div>
            {(!isCollapsed || isMobileOpen) && (
              <div className="truncate">
                <span className="font-bold text-base tracking-tight text-white block leading-tight">
                  ReachInbox
                </span>
                <span className="text-[10px] text-reach-muted block font-medium">
                  Email Scheduler
                </span>
              </div>
            )}
          </div>

          {/* Close button on mobile */}
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 text-reach-muted hover:text-white rounded-lg hover:bg-reach-card"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Collapse toggle button on desktop */}
          <button
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:flex items-center justify-center p-1 rounded-md text-reach-muted hover:text-white hover:bg-reach-card transition-colors"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <div className="mb-2 px-3">
            {(!isCollapsed || isMobileOpen) && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-reach-muted">
                Main Menu
              </span>
            )}
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => handleNavClick(item.key)}
                title={item.label}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-reach-primary text-white shadow-md shadow-indigo-500/20 font-semibold'
                    : 'text-gray-400 hover:text-white hover:bg-reach-card/80'
                } ${isCollapsed && !isMobileOpen ? 'justify-center px-2' : ''}`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                {(!isCollapsed || isMobileOpen) && (
                  <span className="flex-1 text-left truncate">{item.label}</span>
                )}
                {(!isCollapsed || isMobileOpen) && item.badge !== undefined && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-indigo-500/20 text-indigo-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* External Queue Monitor (Bull Board) link */}
          <div className="pt-2 mt-2 border-t border-reach-border/60">
            <a
              href={`${API_BASE}/admin/queues`}
              target="_blank"
              rel="noopener noreferrer"
              title="Queue Monitor"
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-gray-400 hover:text-white hover:bg-reach-card/80 transition-all ${
                isCollapsed && !isMobileOpen ? 'justify-center px-2' : ''
              }`}
            >
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse flex-shrink-0" />
              {(!isCollapsed || isMobileOpen) && (
                <>
                  <span className="flex-1 text-left truncate">Queue Monitor</span>
                  <ExternalLink className="w-3.5 h-3.5 text-reach-muted" />
                </>
              )}
            </a>
          </div>
        </div>

        {/* Bottom Utility & Profile Section */}
        <div className="p-3 border-t border-reach-border space-y-1 bg-[#090D16]/50 flex-shrink-0">
          {/* Sender Profiles Action */}
          <button
            onClick={() => {
              onOpenSenderModal();
              onCloseMobile();
            }}
            title="Sender Profiles"
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-white hover:bg-reach-card/80 transition-all ${
              isCollapsed && !isMobileOpen ? 'justify-center px-2' : ''
            }`}
          >
            <Users className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            {(!isCollapsed || isMobileOpen) && <span className="flex-1 text-left truncate">Sender Profiles</span>}
          </button>

          {/* Sign Out Button */}
          <button
            onClick={onLogout}
            title="Sign Out"
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-red-400/80 hover:text-red-300 hover:bg-red-500/10 transition-all ${
              isCollapsed && !isMobileOpen ? 'justify-center px-2' : ''
            }`}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {(!isCollapsed || isMobileOpen) && <span className="flex-1 text-left truncate">Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
