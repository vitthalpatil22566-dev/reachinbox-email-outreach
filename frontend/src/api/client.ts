import axios from 'axios';
import {
  UserProfile,
  Sender,
  ListEmailsResponse,
  BulkScheduleResult,
  SearchResponse,
  SlackStatus,
  SlackChannel,
  SystemHealth,
  EmailJobStatus,
  EmailRecord,
} from '../types';

export const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';

const client = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

export const api = {
  auth: {
    getCurrentUser: async (): Promise<UserProfile | null> => {
      const res = await client.get('/auth/me');
      return res.data?.data || null;
    },
    logout: async (): Promise<void> => {
      await client.post('/auth/logout');
    },
  },

  senders: {
    list: async (): Promise<Sender[]> => {
      const res = await client.get('/api/v1/senders');
      return res.data?.data || [];
    },
    create: async (data: {
      name: string;
      email?: string;
      hourlyLimit?: number;
      minDelaySeconds?: number;
    }): Promise<Sender> => {
      const res = await client.post('/api/v1/senders', data);
      return res.data?.data;
    },
  },

  emails: {
    list: async (params: {
      type?: 'scheduled' | 'sent' | 'all';
      status?: string;
      senderId?: string;
      page?: number;
      limit?: number;
    }): Promise<ListEmailsResponse> => {
      const res = await client.get('/api/v1/emails', { params });
      return res.data?.data;
    },
    bulkSchedule: async (data: {
      recipients: string[];
      subject: string;
      body: string;
      scheduledFor: string;
      senderId?: string;
      hourlyLimit?: number;
      minDelaySeconds?: number;
    }): Promise<BulkScheduleResult> => {
      const res = await client.post('/api/v1/emails/bulk-schedule', data);
      return res.data?.data;
    },
    search: async (params: {
      q?: string;
      status?: string;
      senderId?: string;
      page?: number;
      limit?: number;
      sortField?: string;
      sortOrder?: 'asc' | 'desc';
    }): Promise<SearchResponse> => {
      const res = await client.get('/api/v1/emails/search', { params });
      return res.data?.data;
    },
    getById: async (id: string): Promise<EmailRecord> => {
      const res = await client.get(`/api/v1/emails/${id}`);
      return res.data?.data;
    },
    getJobStatus: async (id: string): Promise<EmailJobStatus> => {
      const res = await client.get(`/api/v1/emails/${id}/job`);
      return res.data?.data;
    },
  },

  system: {
    getHealth: async (): Promise<SystemHealth> => {
      const res = await client.get('/health');
      return res.data;
    },
  },

  slack: {
    getStatus: async (): Promise<SlackStatus> => {
      const res = await client.get('/api/v1/slack/status');
      return res.data?.data || { connected: false };
    },
    listChannels: async (): Promise<SlackChannel[]> => {
      const res = await client.get('/api/v1/slack/channels');
      return res.data?.data || [];
    },
    setChannel: async (channelId: string, channelName: string): Promise<void> => {
      await client.post('/api/v1/slack/channel', { channelId, channelName });
    },
    disconnect: async (): Promise<void> => {
      await client.post('/api/v1/slack/disconnect');
    },
  },
};
