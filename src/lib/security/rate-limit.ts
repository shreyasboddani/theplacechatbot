interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const records = new Map<string, RateLimitRecord>();
const WINDOW_MS = 10 * 60 * 1_000;
const MAX_REQUESTS = 20;
const MAX_RECORDS = 5_000;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function checkRateLimit(key: string, now = Date.now()): RateLimitResult {
  if (records.size >= MAX_RECORDS) {
    for (const [recordKey, record] of records) {
      if (record.resetAt <= now) records.delete(recordKey);
    }
    if (records.size >= MAX_RECORDS) {
      const oldestKey = records.keys().next().value;
      if (typeof oldestKey === "string") records.delete(oldestKey);
    }
  }

  const current = records.get(key);
  if (!current || current.resetAt <= now) {
    records.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function resetRateLimitForTests(): void {
  records.clear();
}

