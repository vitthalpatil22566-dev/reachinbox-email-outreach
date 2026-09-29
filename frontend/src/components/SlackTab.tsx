import React, { useState, useEffect } from 'react';
import {
  Slack,
  RefreshCw,
  BellRing,
  ShieldCheck,
} from 'lucide-react';
import { api, API_BASE } from '../api/client';
import { SlackStatus, SlackChannel } from '../types';

interface SlackTabProps {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export const SlackTab: React.FC<SlackTabProps> = ({ onSuccess, onError }) => {
  const [status, setStatus] = useState<SlackStatus | null>(null);
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [savingChannel, setSavingChannel] = useState<boolean>(false);
  const [disconnecting, setDisconnecting] = useState<boolean>(false);

  const fetchStatusAndChannels = async () => {
    try {
      setLoading(true);
      const s = await api.slack.getStatus();
      setStatus(s);

      if (s.connected) {
        if (s.channelId) setSelectedChannel(s.channelId);
        const chList = await api.slack.listChannels();
        setChannels(chList);
      }
    } catch (err: any) {
      onError('Failed to load Slack status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusAndChannels();
  }, []);

  const handleConnect = () => {
    window.location.href = `${API_BASE}/auth/slack`;
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect this Slack workspace?')) return;

    try {
      setDisconnecting(true);
      await api.slack.disconnect();
      setStatus({ connected: false });
      setChannels([]);
      setSelectedChannel('');
      onSuccess('Slack workspace disconnected successfully');
    } catch (err: any) {
      onError(err.response?.data?.message || 'Failed to disconnect Slack');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSaveChannel = async () => {
    if (!selectedChannel) {
      onError('Please select a destination channel');
      return;
    }

    try {
      setSavingChannel(true);
      const chObj = channels.find((c) => c.id === selectedChannel);
      const channelName = chObj ? chObj.name : selectedChannel;

      await api.slack.setChannel(selectedChannel, channelName);
      setStatus((prev) => (prev ? { ...prev, channelId: selectedChannel, channelName } : null));
      onSuccess(`Alerts destination set to #${channelName}`);
    } catch (err: any) {
      onError(err.response?.data?.message || 'Failed to update channel');
    } finally {
      setSavingChannel(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Main Slack Card */}
      <div className="p-8 rounded-2xl bg-reach-card border border-reach-border shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-reach-border">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#4A154B]/30 text-[#ECB22E] flex items-center justify-center border border-[#ECB22E]/20 shadow-inner">
              <Slack className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-bold text-xl text-white flex items-center gap-2.5">
                Slack Notifications
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-reach-muted" />
                ) : status?.connected ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-gray-500/10 text-gray-400 border border-gray-500/20">
                    Disconnected
                  </span>
                )}
              </h3>
              <p className="text-xs text-reach-muted mt-1 max-w-lg leading-relaxed">
                Connect your team workspace to receive real-time alerts whenever an email sender hits their hourly limit or requires attention.
              </p>
            </div>
          </div>

          <div>
            {status?.connected ? (
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all shadow-sm disabled:opacity-50"
              >
                {disconnecting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Disconnect Workspace
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConnect}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#4A154B] hover:bg-[#611f69] text-white border border-[#ECB22E]/30 transition-all shadow-lg active:scale-95"
              >
                <Slack className="w-4 h-4 text-[#ECB22E]" />
                Connect Slack Workspace
              </button>
            )}
          </div>
        </div>

        {/* Connected Configuration Grid */}
        {status?.connected && (
          <div className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 rounded-xl bg-reach-bg border border-reach-border space-y-2">
              <p className="text-[11px] font-semibold text-reach-muted uppercase tracking-wider">
                Connected Workspace
              </p>
              <p className="text-lg font-bold text-white">{status.teamName || 'Slack Workspace'}</p>
              {status.connectedAt && (
                <p className="text-xs text-reach-muted">
                  Authenticated on {new Date(status.connectedAt).toLocaleDateString()}
                </p>
              )}
            </div>

            <div className="p-5 rounded-xl bg-reach-bg border border-reach-border space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-reach-muted uppercase tracking-wider flex items-center gap-1.5">
                  <BellRing className="w-3.5 h-3.5 text-indigo-400" />
                  Target Notification Channel
                </p>
                {channels.length > 0 && (
                  <span className="text-[10px] text-reach-muted">{channels.length} channel(s)</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value)}
                  className="flex-1 bg-reach-card border border-reach-border text-sm rounded-lg px-3 py-2 text-white focus:outline-none focus:border-reach-primary"
                >
                  <option value="" disabled>
                    -- Select destination channel --
                  </option>
                  {channels.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      #{ch.name} {ch.isPrivate ? '(Private)' : ''}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleSaveChannel}
                  disabled={savingChannel || !selectedChannel}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-reach-primary hover:bg-reach-primaryHover text-white transition-all shadow disabled:opacity-50"
                >
                  {savingChannel ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
                </button>
              </div>

              <p className="text-[11px] text-reach-muted">
                Current destination:{' '}
                <strong className="text-white">#{status.channelName || 'general'}</strong>
              </p>
            </div>
          </div>
        )}

        {/* Notification Policy Notes */}
        <div className="mt-6 p-4 rounded-xl bg-indigo-950/20 border border-indigo-900/30 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-indigo-200 leading-relaxed space-y-1">
            <p className="font-semibold text-white">Smart Rate Limit Notifications</p>
            <p>
              When a sender profile reaches its hourly delivery limit, ReachInbox sends an alert to your chosen Slack channel so your team stays informed. Alerts are automatically debounced to avoid notification overload.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
