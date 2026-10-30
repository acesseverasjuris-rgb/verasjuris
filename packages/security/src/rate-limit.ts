type Bucket = {
  resetAt: number;
  count: number;
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export class MemoryRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  consume(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
    const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) {
      this.buckets.set(key, { resetAt: now + windowMs, count: 1 });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (current.count >= limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      };
    }
    current.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

/** Buckets nomeados para superfícies sensíveis (Etapa 27+). */
export const RATE_LIMIT_BUCKETS = {
  login: { limit: 10, windowMs: 15 * 60_000 },
  mfa: { limit: 10, windowMs: 15 * 60_000 },
  password: { limit: 5, windowMs: 60 * 60_000 },
  api: { limit: 120, windowMs: 60_000 },
  upload: { limit: 30, windowMs: 60_000 },
  ai: { limit: 60, windowMs: 60_000 },
  payment: { limit: 30, windowMs: 60_000 },
  marketplace: { limit: 60, windowMs: 60_000 },
  webhooks: { limit: 300, windowMs: 60_000 },
} as const;

export type RateLimitBucketName = keyof typeof RATE_LIMIT_BUCKETS;

export function consumeNamedBucket(
  limiter: MemoryRateLimiter,
  bucket: RateLimitBucketName,
  subjectKey: string,
  now = Date.now(),
): RateLimitResult {
  const config = RATE_LIMIT_BUCKETS[bucket];
  return limiter.consume(`${bucket}:${subjectKey}`, config.limit, config.windowMs, now);
}
