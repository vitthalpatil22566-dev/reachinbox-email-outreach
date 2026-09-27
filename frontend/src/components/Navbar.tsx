import React from 'react';
import { Mail, Radio, ExternalLink, LogIn, LogOut } from 'lucide-react';
import { UserProfile } from '../types';
import { API_BASE } from '../api/client';

interface NavbarProps {
  user: UserProfile | null;
  authLoading: boolean;
  onLogin: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, authLoading, onLogin, onLogout }) => {
  return (
    <header className="border-b border-reach-border bg-reach-card/75 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-reach-primary to-reach-accent flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Mail className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-lg leading-tight tracking-tight text-white">ReachInbox</h1>
            <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-reach-primary/20 text-indigo-300 border border-reach-primary/30">
              Phase 5
            </span>
          </div>
          <p className="text-xs text-reach-muted">Distributed Multi-Sender Email Scheduler</p>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* Bull Board Quick Link */}
        <a
          href={`${API_BASE}/admin/queues`}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-reach-bg hover:bg-reach-border border border-reach-border text-gray-300 transition-colors"
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
          <div className="flex items-center gap-3 bg-reach-bg border border-reach-border px-3 py-1.5 rounded-full">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-reach-primary text-white flex items-center justify-center text-xs font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="hidden md:block text-left text-xs">
              <p className="font-medium text-white">{user.name}</p>
              <p className="text-reach-muted text-[10px]">{user.email}</p>
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
