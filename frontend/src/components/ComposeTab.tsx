import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Upload,
  AlertCircle,
  CheckCircle2,
  Clock,
  Shield,
  Plus,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { parseRecipientInput } from '../utils/csvParser';
import { api } from '../api/client';
import { Sender, ParsedRecipients } from '../types';
import { SenderModal } from './SenderModal';

interface ComposeTabProps {
  senders: Sender[];
  onRefreshSenders: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export const ComposeTab: React.FC<ComposeTabProps> = ({
  senders,
  onRefreshSenders,
  onSuccess,
  onError,
}) => {
  const [selectedSenderId, setSelectedSenderId] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [rawText, setRawText] = useState<string>('');
  const [parsed, setParsed] = useState<ParsedRecipients>({
    rawCount: 0,
    valid: [],
    invalid: [],
    duplicatesRemoved: 0,
  });
  const [showInvalidDetails, setShowInvalidDetails] = useState<boolean>(false);

  // Scheduling timing
  const defaultStartTime = new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16);
  const [scheduledFor, setScheduledFor] = useState<string>(defaultStartTime);
  const [hourlyLimit, setHourlyLimit] = useState<number>(50);
  const [minDelaySeconds, setMinDelaySeconds] = useState<number>(5);

  const [inputMode, setInputMode] = useState<'upload' | 'text'>('upload');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSenderModalOpen, setIsSenderModalOpen] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Set default sender when senders list loads
  useEffect(() => {
    if (senders.length > 0 && !selectedSenderId) {
      setSelectedSenderId(senders[0].id);
      setHourlyLimit(senders[0].hourlyLimit);
      setMinDelaySeconds(senders[0].minDelaySeconds);
    }
  }, [senders]);

  // When sender selection changes, update default limits
  const handleSenderChange = (id: string) => {
    setSelectedSenderId(id);
    const chosen = senders.find((s) => s.id === id);
    if (chosen) {
      setHourlyLimit(chosen.hourlyLimit);
      setMinDelaySeconds(chosen.minDelaySeconds);
    }
  };

  // Parse recipient text on change
  useEffect(() => {
    const res = parseRecipientInput(rawText);
    setParsed(res);
  }, [rawText]);

  // Handle CSV/text file drop or upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      onError('File exceeds maximum size of 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRawText(content);
    };
    reader.onerror = () => {
      onError('Could not read file');
    };
    reader.readAsText(file);
  };

  // Quick timing offset button
  const setQuickOffset = (minutes: number) => {
    const d = new Date(Date.now() + minutes * 60 * 1000);
    setScheduledFor(d.toISOString().slice(0, 16));
  };

  // Schedule submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subject.trim()) {
      onError('Please enter an email subject');
      return;
    }

    if (!body.trim()) {
      onError('Please enter an email body');
      return;
    }

    if (parsed.valid.length === 0) {
      onError('Please provide at least one valid recipient email address');
      return;
    }

    const targetDate = new Date(scheduledFor);
    if (isNaN(targetDate.getTime()) || targetDate.getTime() < Date.now() - 30000) {
      onError('Scheduled start time must be in the future');
      return;
    }

    try {
      setIsSubmitting(true);

      const result = await api.emails.bulkSchedule({
        recipients: parsed.valid,
        subject: subject.trim(),
        body: body.trim(),
        scheduledFor: targetDate.toISOString(),
        senderId: selectedSenderId || undefined,
        hourlyLimit,
        minDelaySeconds,
      });

      onSuccess(
        `Successfully scheduled ${result.scheduledCount} email(s)${
          result.duplicateCount > 0 ? ` (${result.duplicateCount} duplicate(s) skipped)` : ''
        }`
      );

      // Reset form
      setRawText('');
      setSubject('');
      setBody('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      onError(err.response?.data?.message || err.message || 'Bulk scheduling failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedSender = senders.find((s) => s.id === selectedSenderId);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <SenderModal
        isOpen={isSenderModalOpen}
        onClose={() => setIsSenderModalOpen(false)}
        onSenderCreated={(created) => {
          onRefreshSenders();
          setSelectedSenderId(created.id);
          setHourlyLimit(created.hourlyLimit);
          setMinDelaySeconds(created.minDelaySeconds);
          onSuccess(`Sender "${created.name}" created successfully`);
        }}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Top Configuration Bar: Sender & Rate Limit Parameters */}
        <div className="p-6 rounded-2xl bg-reach-card border border-reach-border shadow-xl grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Sender Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-reach-muted flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                Sender Profile
              </label>
              <button
                type="button"
                onClick={() => setIsSenderModalOpen(true)}
                className="text-[11px] font-medium text-reach-primary hover:text-reach-primaryHover flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add Sender
              </button>
            </div>
            <select
              value={selectedSenderId}
              onChange={(e) => handleSenderChange(e.target.value)}
              className="w-full bg-reach-bg border border-reach-border text-sm rounded-lg px-3 py-2 text-white focus:outline-none focus:border-reach-primary"
            >
              {senders.length === 0 ? (
                <option value="" disabled>
                  Loading senders...
                </option>
              ) : (
                senders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.email})
                  </option>
                ))
              )}
            </select>
            {selectedSender && (
              <p className="text-[11px] text-reach-muted mt-1.5 truncate">
                Rate Limit: {selectedSender.hourlyLimit}/hr • Min Delay: {selectedSender.minDelaySeconds}s
              </p>
            )}
          </div>

          {/* Start Date & Time */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-reach-muted flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                Start Date & Time
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setQuickOffset(5)}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-reach-bg border border-reach-border text-reach-muted hover:text-white"
                >
                  +5m
                </button>
                <button
                  type="button"
                  onClick={() => setQuickOffset(15)}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-reach-bg border border-reach-border text-reach-muted hover:text-white"
                >
                  +15m
                </button>
                <button
                  type="button"
                  onClick={() => setQuickOffset(60)}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-reach-bg border border-reach-border text-reach-muted hover:text-white"
                >
                  +1h
                </button>
              </div>
            </div>
            <input
              type="datetime-local"
              required
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="w-full bg-reach-bg border border-reach-border text-sm rounded-lg px-3 py-2 text-white focus:outline-none focus:border-reach-primary"
            />
            <p className="text-[11px] text-reach-muted mt-1.5">
              Target execution time for the initial batch in BullMQ
            </p>
          </div>

          {/* Rate Limits Overrides */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-reach-muted mb-1.5 block">
                Hourly Limit
              </label>
              <input
                type="number"
                min="1"
                max="10000"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-reach-bg border border-reach-border text-sm rounded-lg px-3 py-2 text-white focus:outline-none focus:border-reach-primary"
              />
              <p className="text-[10px] text-reach-muted mt-1">Sends / rolling hr</p>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-reach-muted mb-1.5 block">
                Min Delay (s)
              </label>
              <input
                type="number"
                min="0"
                max="3600"
                value={minDelaySeconds}
                onChange={(e) => setMinDelaySeconds(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-reach-bg border border-reach-border text-sm rounded-lg px-3 py-2 text-white focus:outline-none focus:border-reach-primary"
              />
              <p className="text-[10px] text-reach-muted mt-1">Inter-email gap</p>
            </div>
          </div>
        </div>

        {/* Content Section: Subject & Body */}
        <div className="p-6 rounded-2xl bg-reach-card border border-reach-border shadow-xl space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-reach-muted mb-1.5">
              Subject Line <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Introducing our Next-Generation Growth Infrastructure"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-reach-bg border border-reach-border text-sm rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-reach-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-reach-muted mb-1.5">
              Email Body <span className="text-red-400">*</span>
            </label>
            <textarea
              required
              rows={6}
              placeholder="Write your email copy here. Supports plain text and HTML tags..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full bg-reach-bg border border-reach-border text-sm rounded-lg p-4 text-white placeholder-gray-500 focus:outline-none focus:border-reach-primary font-sans leading-relaxed"
            />
          </div>
        </div>

        {/* Recipient Ingestion: CSV Upload / Direct Paste & Metrics */}
        <div className="p-6 rounded-2xl bg-reach-card border border-reach-border shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-reach-border">
            <div>
              <h3 className="font-semibold text-white text-base flex items-center gap-2">
                Recipient Ingestion
                <span className="text-xs font-normal text-reach-muted">
                  (CSV, TXT, or direct paste)
                </span>
              </h3>
              <p className="text-xs text-reach-muted">
                Deduplication and invalid email formatting checks run client-side before scheduling.
              </p>
            </div>

            <div className="flex items-center gap-1 bg-reach-bg p-1 rounded-lg border border-reach-border">
              <button
                type="button"
                onClick={() => setInputMode('upload')}
                className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                  inputMode === 'upload'
                    ? 'bg-reach-primary text-white shadow-sm'
                    : 'text-reach-muted hover:text-white'
                }`}
              >
                File Upload
              </button>
              <button
                type="button"
                onClick={() => setInputMode('text')}
                className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                  inputMode === 'text'
                    ? 'bg-reach-primary text-white shadow-sm'
                    : 'text-reach-muted hover:text-white'
                }`}
              >
                Direct Paste
              </button>
            </div>
          </div>

          {inputMode === 'upload' ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-reach-border hover:border-reach-primary/60 rounded-xl p-8 text-center cursor-pointer transition-colors bg-reach-bg/40 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20 group-hover:scale-105 transition-all mx-auto flex items-center justify-center mb-3">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-white mb-1">
                Click to browse or drag & drop recipient file
              </p>
              <p className="text-xs text-reach-muted">
                Accepts .csv (with an "email" column or one per line) and .txt files (max 5MB)
              </p>
            </div>
          ) : (
            <div>
              <textarea
                rows={5}
                placeholder="Paste email addresses separated by commas, tabs, or newlines..."
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="w-full bg-reach-bg border border-reach-border text-sm rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:border-reach-primary font-mono text-xs"
              />
            </div>
          )}

          {/* Ingestion Metrics Card */}
          {rawText.length > 0 && (
            <div className="p-4 rounded-xl bg-reach-bg border border-reach-border space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-reach-card border border-reach-border text-center">
                  <p className="text-[11px] text-reach-muted uppercase font-semibold">Total Found</p>
                  <p className="text-lg font-bold text-white mt-0.5">{parsed.rawCount}</p>
                </div>
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <p className="text-[11px] text-emerald-400 uppercase font-semibold flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Valid
                  </p>
                  <p className="text-lg font-bold text-emerald-300 mt-0.5">{parsed.valid.length}</p>
                </div>
                <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-center">
                  <p className="text-[11px] text-purple-400 uppercase font-semibold">Duplicates</p>
                  <p className="text-lg font-bold text-purple-300 mt-0.5">
                    {parsed.duplicatesRemoved}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
                  <p className="text-[11px] text-red-400 uppercase font-semibold flex items-center justify-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Invalid
                  </p>
                  <p className="text-lg font-bold text-red-300 mt-0.5">{parsed.invalid.length}</p>
                </div>
              </div>

              {parsed.invalid.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowInvalidDetails(!showInvalidDetails)}
                    className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                  >
                    {showInvalidDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {showInvalidDetails ? 'Hide' : 'View'} {parsed.invalid.length} invalid addresses (will be skipped)
                  </button>
                  {showInvalidDetails && (
                    <div className="mt-2 p-2 rounded bg-red-950/20 border border-red-900/30 text-xs text-red-300 font-mono max-h-24 overflow-y-auto">
                      {parsed.invalid.join(', ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Schedule Action Button */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-reach-muted">
            {parsed.valid.length > 0 ? (
              <span className="text-gray-300">
                Ready to schedule <strong>{parsed.valid.length}</strong> email(s) starting{' '}
                <strong>{new Date(scheduledFor).toLocaleTimeString()}</strong>.
              </span>
            ) : (
              <span>Add valid recipients above to enable scheduling.</span>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || parsed.valid.length === 0}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-reach-primary hover:bg-reach-primaryHover text-white transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Scheduling Batch...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Schedule {parsed.valid.length > 0 ? `${parsed.valid.length} Emails` : 'Campaign'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
