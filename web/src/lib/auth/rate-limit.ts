/**
 * Fixed-window rate limiter, in memory.
 *
 * Scoped to a single server instance, so it is not a hard guarantee behind
 * multiple replicas. For a personal deployment on one instance that is genuinely
 * adequate, and it is a large improvement on the original app, which had no
 * limiting at all and would happily accept unlimited login attempts.
 *
 * If this ever runs multi-instance, swap the Map for Vercel KV or Upstash Redis;
 * the interface is deliberately narrow so that is a one-file change.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Bound memory against unbounded distinct keys (e.g. spoofed IPs).
const MAX_TRACKED_KEYS = 10_000;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    if (buckets.size >= MAX_TRACKED_KEYS) evictExpired(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;

  if (existing.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  return { allowed: true, remaining: limit - existing.count, retryAfterSeconds: 0 };
}

function evictExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Still full of live entries: drop the oldest to stay bounded.
  if (buckets.size >= MAX_TRACKED_KEYS) {
    const oldest = [...buckets.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt).slice(0, 1000);
    for (const [key] of oldest) buckets.delete(key);
  }
}

export function resetRateLimit(key: string): void {
  buckets.delete(key);
}
