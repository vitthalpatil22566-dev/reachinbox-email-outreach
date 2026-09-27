import Redis, { RedisOptions } from 'ioredis';
import { env } from './env';

export const redisConnectionOptions: RedisOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  retryStrategy(times) {
    if (process.env.NODE_ENV === 'test') {
      return null; // Stop retrying in test environment if Redis is not running
    }
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
};

export const redisClient = new Redis(redisConnectionOptions);

redisClient.on('connect', () => {
  if (process.env.NODE_ENV !== 'test') {
    console.log('✅ Connected to Redis successfully');
  }
});

redisClient.on('error', (err) => {
  if (process.env.NODE_ENV !== 'test') {
    console.error('❌ Redis error:', err.message);
  }
});

export async function checkRedisConnection(): Promise<boolean> {
  try {
    const res = await redisClient.ping();
    return res === 'PONG';
  } catch (err) {
    console.error('❌ Redis connection error:', err);
    return false;
  }
}
