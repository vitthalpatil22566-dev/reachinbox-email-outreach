import React, { useEffect, useState } from 'react';
import {
  X,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Copy,
  Check,
  Shield,
  Layers,
  Activity,
  Radio,
} from 'lucide-react';
import { EmailRecord, EmailJobStatus } from '../types';
import { api } from '../api/client';

interface EmailDetailsPanelProps {
  email: EmailRecord | null;
  onClose: () => void;
}

export const EmailDetailsPanel: React.FC<EmailDetailsPanelProps> = ({ email, onClose }) => {
  const [jobStatus, setJobStatus] = useState<EmailJobStatus | null>(null);
  const [loadingJob, setLoadingJob] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!email) {
      setJobStatus(null);
      return;
    }

    const fetchLiveJob = async () => {
      try {
        setLoadingJob(true);
        const js = await api.emails.getJobStatus(email.id);
        setJobStatus(js);
      } catch {
        setJobStatus(null);
      } finally {
        setLoadingJob(false);
      }
    };

    fetchLiveJob();
  }, [email]);

  if (!email) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = () => {
    switch (email.status) {
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Scheduled
          </span>
        );
      case 'RESCHEDULED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
            <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
            Rescheduled (Rate Limit)
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            In Flight
          </span>
        );
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Delivered
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs bg-gray-800 text-gray-300">
            {email.status}
          </span>
        );
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 lg:hidden"
      />

      {/* Slide-out Details Drawer */}
      <div className="fixed top-0 bottom-0 right-0 z-50 w-full max-w-md bg-[#0F1524] border-l border-reach-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Panel Header */}
        <div className="h-16 px-6 border-b border-reach-border flex items-center justify-between flex-shrink-0 bg-[#0E131F]/80">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <h3 className="font-bold text-sm text-white">Email Details</h3>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge()}
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-reach-muted hover:text-white hover:bg-reach-card transition-colors"
              title="Close panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Panel Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* Recipient & Subject Summary */}
          <div className="p-4 rounded-xl bg-reach-card border border-reach-border space-y-3">
            <div>
              <span className="text-[10px] uppercase font-semibold text-reach-muted block mb-1">
                Recipient
              </span>
              <div className="flex items-center justify-between">
                <span className="font-mono text-white text-sm truncate font-medium">
                  {email.recipientEmail}
                </span>
                <button
                  onClick={() => copyToClipboard(email.recipientEmail)}
                  title="Copy email"
                  className="p-1 text-reach-muted hover:text-white rounded hover:bg-reach-bg transition-colors"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase font-semibold text-reach-muted block mb-1">
                Subject
              </span>
              <p className="text-gray-200 font-medium">{email.subject}</p>
            </div>

            <div>
              <span className="text-[10px] uppercase font-semibold text-reach-muted block mb-1">
                Sender Profile
              </span>
              <div className="flex items-center gap-1.5 text-gray-300">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                <span>
                  {email.sender
                    ? `${email.sender.name} (${email.sender.email})`
                    : 'Primary Outbound Mailer'}
                </span>
              </div>
            </div>
          </div>

          {/* Timing & Delivery Information */}
          <div className="p-4 rounded-xl bg-reach-card border border-reach-border space-y-2.5">
            <span className="text-[10px] uppercase font-semibold text-reach-muted block">
              Timing & Dispatch
            </span>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-reach-muted block text-[11px]">Scheduled For</span>
                <span className="text-white font-medium">
                  {new Date(email.scheduledFor).toLocaleString()}
                </span>
              </div>

              <div>
                <span className="text-reach-muted block text-[11px]">Delivered At</span>
                <span className="text-white font-medium">
                  {email.sentAt ? new Date(email.sentAt).toLocaleString() : 'Pending'}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-reach-border/60 flex items-center justify-between">
              <span className="text-reach-muted">Attempt Count</span>
              <span className="text-white font-mono font-bold">{email.attempts} / 3</span>
            </div>

            {email.lastError && (
              <div className="p-2.5 rounded-lg bg-red-950/20 border border-red-900/30 text-red-300">
                <span className="font-semibold block mb-0.5">Last Error:</span>
                <span className="font-mono text-[11px] break-all">{email.lastError}</span>
              </div>
            )}

            {email.etherealPreviewUrl && (
              <div className="pt-2">
                <a
                  href={email.etherealPreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-reach-primary hover:bg-reach-primaryHover text-white shadow-md shadow-indigo-500/20 transition-all"
                >
                  View Email on Ethereal
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>

          {/* Queue & Delivery State */}
          <div className="p-4 rounded-xl bg-reach-card border border-reach-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-semibold text-reach-muted flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                Delivery Queue Status
              </span>
            </div>

            <div className="space-y-1.5 font-mono text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-reach-muted">Queue Job ID:</span>
                <span className="text-white font-semibold truncate max-w-[180px]">
                  {email.bullJobId || 'Registered'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-reach-muted">Status:</span>
                <span
                  className={`font-bold capitalize ${
                    jobStatus?.jobStatus === 'completed'
                      ? 'text-emerald-400'
                      : jobStatus?.jobStatus === 'delayed'
                      ? 'text-amber-400'
                      : jobStatus?.jobStatus === 'active'
                      ? 'text-blue-400'
                      : 'text-gray-300'
                  }`}
                >
                  {loadingJob
                    ? 'Checking queue status...'
                    : jobStatus?.jobStatus || email.status.toLowerCase()}
                </span>
              </div>

              {jobStatus?.delay !== undefined && jobStatus.delay > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-reach-muted">Remaining Delay:</span>
                  <span className="text-amber-300">
                    {Math.round(jobStatus.delay / 1000)}s
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Delivery Timeline */}
          <div className="p-4 rounded-xl bg-reach-card border border-reach-border space-y-3">
            <span className="text-[10px] uppercase font-semibold text-reach-muted flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              Delivery Timeline
            </span>

            <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-reach-border">
              {/* Step 1: Created */}
              <div className="relative">
                <div className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                </div>
                <p className="font-semibold text-white">Email Scheduled</p>
                <p className="text-[11px] text-reach-muted">
                  {new Date(email.createdAt).toLocaleString()}
                </p>
              </div>

              {/* Step 2: Queued */}
              <div className="relative">
                <div className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-indigo-500/20 border-2 border-indigo-400 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                </div>
                <p className="font-semibold text-white">Queued for Delivery</p>
                <p className="text-[11px] text-reach-muted">
                  Registered for automated delivery
                </p>
              </div>

              {/* Step 3: Sending & Rate Check */}
              <div className="relative">
                <div
                  className={`absolute -left-6 top-0.5 w-4 h-4 rounded-full flex items-center justify-center ${
                    email.status === 'PROCESSING' || email.status === 'SENT' || email.status === 'FAILED'
                      ? 'bg-blue-500/20 border-2 border-blue-400'
                      : 'bg-gray-800 border-2 border-gray-600'
                  }`}
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      email.status === 'PROCESSING' || email.status === 'SENT' || email.status === 'FAILED'
                        ? 'bg-blue-400'
                        : 'bg-gray-600'
                    }`}
                  />
                </div>
                <p className="font-semibold text-white">Delivery Queue Check</p>
                <p className="text-[11px] text-reach-muted">
                  {email.status === 'RESCHEDULED'
                    ? 'Hourly rate limit reached — deferred to next window'
                    : 'Evaluated against hourly limits and sending delay'}
                </p>
              </div>

              {/* Step 4: Final Outcome */}
              <div className="relative">
                <div
                  className={`absolute -left-6 top-0.5 w-4 h-4 rounded-full flex items-center justify-center ${
                    email.status === 'SENT'
                      ? 'bg-emerald-500/20 border-2 border-emerald-400'
                      : email.status === 'FAILED'
                      ? 'bg-red-500/20 border-2 border-red-400'
                      : 'bg-gray-800 border-2 border-gray-600'
                  }`}
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      email.status === 'SENT'
                        ? 'bg-emerald-400'
                        : email.status === 'FAILED'
                        ? 'bg-red-400'
                        : 'bg-gray-600'
                    }`}
                  />
                </div>
                <p className="font-semibold text-white">
                  {email.status === 'SENT'
                    ? 'Delivered'
                    : email.status === 'FAILED'
                    ? 'Delivery Failed'
                    : 'Awaiting Target Dispatch'}
                </p>
                <p className="text-[11px] text-reach-muted">
                  {email.sentAt
                    ? new Date(email.sentAt).toLocaleString()
                    : `Target: ${new Date(email.scheduledFor).toLocaleString()}`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
