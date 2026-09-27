import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().default('postgresql://reachinbox:reachinbox123@localhost:5432/reachinbox_db?schema=public'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379').transform((val) => parseInt(val, 10)),
  REDIS_PASSWORD: z.string().optional(),
  ELASTICSEARCH_URL: z.string().optional(),
  ELASTICSEARCH_NODE: z.string().default('http://localhost:9200'),
  ELASTICSEARCH_USERNAME: z.string().optional(),
  ELASTICSEARCH_PASSWORD: z.string().optional(),
  WORKER_CONCURRENCY: z.string().default('5').transform((val) => parseInt(val, 10)),
  DEFAULT_HOURLY_LIMIT: z.string().default('50').transform((val) => parseInt(val, 10)),
  DEFAULT_MIN_DELAY_SECONDS: z.string().default('5').transform((val) => parseInt(val, 10)),
  JWT_SECRET: z.string().default('reachinbox_super_secret_jwt_key_2026'),
  SESSION_SECRET: z.string().default('reachinbox_super_secret_session_key_2026'),
  ENCRYPTION_KEY: z.string().default('reachinbox_32_byte_secret_key_aes256!!'),
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  GOOGLE_CALLBACK_URL: z.string().default('http://localhost:5000/auth/google/callback'),
  SLACK_CLIENT_ID: z.string().default(''),
  SLACK_CLIENT_SECRET: z.string().default(''),
  SLACK_REDIRECT_URI: z.string().default('http://localhost:5000/auth/slack/callback'),
  SLACK_SCOPES: z.string().default('channels:read,groups:read,chat:write,chat:write.public'),
  DEFAULT_SLACK_WEBHOOK_URL: z.string().default(''),
  BULL_BOARD_USERNAME: z.string().default('admin'),
  BULL_BOARD_PASSWORD: z.string().default('admin'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  throw new Error('Invalid environment configuration');
}

export const env = parsedEnv.data;
