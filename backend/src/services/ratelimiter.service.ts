import { redisClient } from '../config/redis';
import { env } from '../config/env';
import { prisma } from '../config/database';

export interface RateLimitCheckResult {
  allowed: boolean;
  reason: 'ALLOWED' | 'MIN_DELAY' | 'HOURLY_LIMIT';
  delayMs: number;
  remainingSlots: number;
}

export class RateLimiterService {
  private static readonly LUA_SCRIPT = `
    local windowKey = KEYS[1]
    local lastSentKey = KEYS[2]
    local now = tonumber(ARGV[1])
    local windowMs = tonumber(ARGV[2])
    local hourlyLimit = tonumber(ARGV[3])
    local minDelayMs = tonumber(ARGV[4])
    local emailId = ARGV[5]
    local reserve = ARGV[6]

    -- 1. Check Minimum Inter-Email Delay
    local lastSentStr = redis.call('GET', lastSentKey)
    if lastSentStr then
        local lastSent = tonumber(lastSentStr)
        local elapsed = now - lastSent
        if elapsed < minDelayMs then
            local delayNeeded = minDelayMs - elapsed
            if delayNeeded < 100 then delayNeeded = 100 end
            return { 0, 'MIN_DELAY', tostring(delayNeeded), '0' }
        end
    end

    -- 2. Clear old timestamps outside sliding window
    local clearThreshold = now - windowMs
    redis.call('ZREMRANGEBYSCORE', windowKey, '-inf', clearThreshold)

    -- 3. Check Hourly Sliding Window Count
    local currentCount = redis.call('ZCARD', windowKey)
    if currentCount >= hourlyLimit then
        local oldestEntry = redis.call('ZRANGE', windowKey, 0, 0, 'WITHSCORES')
        local waitMs = 5000
        if oldestEntry and #oldestEntry >= 2 then
            local oldestTimestamp = tonumber(oldestEntry[2])
            waitMs = (oldestTimestamp + windowMs) - now + 1000
            if waitMs < 1000 then waitMs = 1000 end
        end
        return { 0, 'HOURLY_LIMIT', tostring(waitMs), tostring(currentCount) }
    end

    -- 4. Authorized
    if reserve == '1' then
        redis.call('ZADD', windowKey, now, emailId .. ':' .. now)
        redis.call('EXPIRE', windowKey, math.ceil(windowMs / 1000) + 60)
        redis.call('SET', lastSentKey, tostring(now), 'PX', math.max(minDelayMs * 2, 60000))
        local remaining = hourlyLimit - (currentCount + 1)
        return { 1, 'ALLOWED', '0', tostring(remaining) }
    else
        local remaining = hourlyLimit - currentCount
        return { 1, 'ALLOWED', '0', tostring(remaining) }
    end
  `;

  // In-memory simulator for unit tests when Redis is mocked or offline
  private static inMemoryWindows: Map<string, { timestamps: number[]; lastSent: number }> =
    new Map();

  /**
   * Evaluates both hourly limit and minimum inter-email delay atomically.
   * If allowed and reserve = true, records the send in Redis.
   */
  public static async checkAndReserve(
    senderId: string,
    hourlyLimit: number = env.DEFAULT_HOURLY_LIMIT,
    minDelaySeconds: number = env.DEFAULT_MIN_DELAY_SECONDS,
    emailId: string = 'test',
    reserve: boolean = true
  ): Promise<RateLimitCheckResult> {
    const windowKey = `rate-limit:sender:${senderId}:window`;
    const lastSentKey = `rate-limit:sender:${senderId}:last_sent`;
    const now = Date.now();
    const windowMs = 3600000; // 1 hour
    const minDelayMs = Math.max(0, minDelaySeconds * 1000);

    // Try Redis Lua script execution first
    try {
      if (redisClient.status === 'ready' || redisClient.status === 'connect') {
        const result = (await redisClient.eval(
          this.LUA_SCRIPT,
          2,
          windowKey,
          lastSentKey,
          now.toString(),
          windowMs.toString(),
          hourlyLimit.toString(),
          minDelayMs.toString(),
          emailId,
          reserve ? '1' : '0'
        )) as [number, string, string, string];

        const allowed = result[0] === 1;
        const reason = result[1] as 'ALLOWED' | 'MIN_DELAY' | 'HOURLY_LIMIT';
        const delayMs = parseInt(result[2], 10);
        const remainingSlots = parseInt(result[3], 10);

        return {
          allowed,
          reason,
          delayMs,
          remainingSlots,
        };
      }
    } catch (err: any) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('⚠️ Redis rate limiter error, using memory fallback:', err.message);
      }
    }

    // High-fidelity fallback algorithm matching the exact Lua logic
    return this.evaluateInMemory(senderId, hourlyLimit, minDelayMs, emailId, reserve, now, windowMs);
  }

  /**
   * In-memory implementation of the exact same Lua sliding window logic.
   * Used for isolated unit testing and extreme resiliency.
   */
  public static evaluateInMemory(
    senderId: string,
    hourlyLimit: number,
    minDelayMs: number,
    emailId: string,
    reserve: boolean,
    now: number = Date.now(),
    windowMs: number = 3600000
  ): RateLimitCheckResult {
    let state = this.inMemoryWindows.get(senderId);
    if (!state) {
      state = { timestamps: [], lastSent: 0 };
      this.inMemoryWindows.set(senderId, state);
    }

    // 1. Minimum delay check
    if (state.lastSent > 0) {
      const elapsed = now - state.lastSent;
      if (elapsed < minDelayMs) {
        const delayNeeded = Math.max(100, minDelayMs - elapsed);
        return {
          allowed: false,
          reason: 'MIN_DELAY',
          delayMs: delayNeeded,
          remainingSlots: 0,
        };
      }
    }

    // 2. Sliding window purge
    const threshold = now - windowMs;
    state.timestamps = state.timestamps.filter((ts) => ts > threshold);

    // 3. Hourly limit check
    if (state.timestamps.length >= hourlyLimit) {
      const oldest = state.timestamps[0] || now;
      const waitMs = Math.max(1000, oldest + windowMs - now + 1000);
      return {
        allowed: false,
        reason: 'HOURLY_LIMIT',
        delayMs: waitMs,
        remainingSlots: 0,
      };
    }

    // 4. Authorized
    if (reserve) {
      state.timestamps.push(now);
      state.lastSent = now;
      const remaining = hourlyLimit - state.timestamps.length;
      return {
        allowed: true,
        reason: 'ALLOWED',
        delayMs: 0,
        remainingSlots: remaining,
      };
    }

    return {
      allowed: true,
      reason: 'ALLOWED',
      delayMs: 0,
      remainingSlots: hourlyLimit - state.timestamps.length,
    };
  }

  /**
   * Records a rate-limit event in PostgreSQL RateLimitLog with a 5-minute debounce
   * to avoid generating excessive duplicate records from concurrent workers.
   */
  public static async logRateLimitEvent(
    senderId: string,
    hourlyLimit: number
  ): Promise<void> {
    const cooldownKey = `rate-limit:sender:${senderId}:log_cooldown`;

    try {
      if (redisClient.status === 'ready' || redisClient.status === 'connect') {
        const isCooldown = await redisClient.get(cooldownKey);
        if (isCooldown) {
          return; // Skip logging duplicate events during cooldown
        }
        await redisClient.set(cooldownKey, '1', 'EX', 300); // 5-minute cooldown
      }

      await prisma.rateLimitLog.create({
        data: {
          senderId,
          hourlyLimit,
          delayedJobCount: 1,
          slackNotified: false,
        },
      });

      console.log(`📝 [RateLimiter] Logged hourly rate-limit event for sender [${senderId}]`);
    } catch (err: any) {
      console.warn('Could not record rate-limit log in database:', err.message);
    }
  }

  /**
   * Resets rate-limiting state for a sender (used in testing).
   */
  public static async resetSender(senderId: string): Promise<void> {
    this.inMemoryWindows.delete(senderId);
    try {
      if (redisClient.status === 'ready' || redisClient.status === 'connect') {
        await redisClient.del(`rate-limit:sender:${senderId}:window`);
        await redisClient.del(`rate-limit:sender:${senderId}:last_sent`);
        await redisClient.del(`rate-limit:sender:${senderId}:log_cooldown`);
      }
    } catch {}
  }
}
