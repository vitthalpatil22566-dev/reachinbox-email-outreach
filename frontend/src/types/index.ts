export type EmailStatus =
  | 'PENDING'
  | 'SCHEDULED'
  | 'PROCESSING'
  | 'SENT'
  | 'FAILED'
  | 'RESCHEDULED';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}

export interface Sender {
  id: string;
  email: string;
  name: string;
  hourlyLimit: number;
  minDelaySeconds: number;
  isPaused: boolean;
  createdAt: string;
  userId: string;
}

export interface EmailRecord {
  id: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduledFor: string;
  sentAt?: string | null;
  etherealPreviewUrl?: string | null;
  etherealMessageId?: string | null;
  attempts: number;
  lastError?: string | null;
  bullJobId?: string | null;
  createdAt: string;
  sender?: {
    id: string;
    email: string;
    name: string;
  } | null;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ListEmailsResponse {
  emails: EmailRecord[];
  pagination: Pagination;
}

export interface BulkScheduleResult {
  totalRecipients: number;
  scheduledCount: number;
  duplicateCount: number;
  emails: Array<{
    id: string;
    recipientEmail: string;
    status: string;
    scheduledFor: string;
    bullJobId: string;
    isDuplicate: boolean;
  }>;
}

export interface SearchResultItem {
  id: string;
  emailId: string;
  recipient: string;
  subject: string;
  body: string;
  senderEmail?: string;
  senderId?: string;
  status: EmailStatus;
  scheduledFor: string;
  sentAt?: string | null;
  attempts: number;
  lastError?: string | null;
  etherealPreviewUrl?: string | null;
  createdAt: string;
}

export interface SearchResponse {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  tookMs: number;
  results: SearchResultItem[];
}

export interface SlackStatus {
  connected: boolean;
  teamId?: string | null;
  teamName?: string | null;
  channelId?: string | null;
  channelName?: string | null;
  connectedAt?: string | null;
}

export interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
}

export interface ParsedRecipients {
  rawCount: number;
  valid: string[];
  invalid: string[];
  duplicatesRemoved: number;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | string;
  timestamp: string;
  services: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
  };
  version: string;
}

export interface EmailJobStatus {
  emailId: string;
  bullJobId: string;
  jobStatus: string;
  delay?: number;
  timestamp?: number;
  progress?: number;
  failedReason?: string;
}
