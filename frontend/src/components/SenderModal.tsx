import React, { useState } from 'react';
import { X, Plus, RefreshCw } from 'lucide-react';
import { api } from '../api/client';
import { Sender } from '../types';

interface SenderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSenderCreated: (newSender: Sender) => void;
}

export const SenderModal: React.FC<SenderModalProps> = ({ isOpen, onClose, onSenderCreated }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [hourlyLimit, setHourlyLimit] = useState(50);
  const [minDelaySeconds, setMinDelaySeconds] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Sender name is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const created = await api.senders.create({
        name: name.trim(),
        email: email.trim() || undefined,
        hourlyLimit,
        minDelaySeconds,
      });

      onSenderCreated(created);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to create sender');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-reach-card border border-reach-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-reach-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-white text-base">Add New Sender</h3>
          </div>
          <button
            onClick={onClose}
            className="text-reach-muted hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Sender Display Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Sales Team, Partnerships"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-reach-bg border border-reach-border text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-reach-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Custom Email (Optional)
            </label>
            <input
              type="email"
              placeholder="Leave blank to auto-generate Ethereal account"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-reach-bg border border-reach-border text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-reach-primary"
            />
            <p className="text-[11px] text-reach-muted mt-1">
              If left empty, a test Ethereal SMTP sender is provisioned instantly.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Hourly Limit</label>
              <input
                type="number"
                min="1"
                max="10000"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 50)}
                className="w-full bg-reach-bg border border-reach-border text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-reach-primary"
              />
              <p className="text-[10px] text-reach-muted mt-1">Max emails per hour</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Min Delay (s)</label>
              <input
                type="number"
                min="0"
                max="3600"
                value={minDelaySeconds}
                onChange={(e) => setMinDelaySeconds(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-reach-bg border border-reach-border text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-reach-primary"
              />
              <p className="text-[10px] text-reach-muted mt-1">Between sends</p>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-reach-muted hover:text-white bg-reach-bg border border-reach-border transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-reach-primary hover:bg-reach-primaryHover text-white transition-all shadow-md disabled:opacity-50"
            >
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              Create Sender
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
