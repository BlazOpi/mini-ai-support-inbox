/**
 * Fixed-window in-memory rate limiter. Protects the (paid) LLM endpoints from abuse.
 *
 * Limitation: state is per server instance, so on serverless it is a best-effort guard.
 * Production upgrade path: same interface backed by Redis/Upstash or a Postgres table.
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function createRateLimiter({
  limit,
  windowMs,
  now = Date.now,
}: {
  limit: number;
  windowMs: number;
  now?: () => number;
}) {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return {
    check(key: string): RateLimitResult {
      const t = now();
      // Opportunistic cleanup keeps memory bounded without a timer.
      if (buckets.size > 10_000) {
        for (const [k, b] of buckets) if (b.resetAt <= t) buckets.delete(k);
      }

      let bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= t) {
        bucket = { count: 0, resetAt: t + windowMs };
        buckets.set(key, bucket);
      }

      if (bucket.count >= limit) {
        return { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil((bucket.resetAt - t) / 1000) };
      }
      bucket.count += 1;
      return { allowed: true, remaining: limit - bucket.count, retryAfterSeconds: 0 };
    },

    /** Current standing of a key, without using up a request. */
    peek(key: string): { limit: number; remaining: number; resetInSeconds: number } {
      const t = now();
      const bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= t) return { limit, remaining: limit, resetInSeconds: 0 };
      return { limit, remaining: limit - bucket.count, resetInSeconds: Math.ceil((bucket.resetAt - t) / 1000) };
    },
  };
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;
