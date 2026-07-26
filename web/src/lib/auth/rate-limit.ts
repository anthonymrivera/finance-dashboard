import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

/**
 * Rate limiting, backed by Upstash Redis when configured.
 *
 * The previous implementation was a Map in module scope. On Vercel that
 * enforces almost nothing: every cold start begins with an empty map, and
 * concurrent lambdas each keep their own, so the effective limit is the nominal
 * one multiplied by however many instances happen to be warm. A shared store is
 * the only way a limit means what it says.
 *
 * A sliding window is used rather than a fixed one. Fixed windows let an
 * attacker land the full quota at the end of one window and again at the start
 * of the next — double the intended rate across the boundary.
 *
 * Without Upstash credentials the in-memory limiter below takes over, so local
 * development needs no external service. That fallback carries the same caveat
 * as before and is not suitable for production; `limiterBackend()` reports which
 * one is live.
 */

const redis =
  env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

export function limiterBackend(): "upstash" | "memory" {
  return redis ? "upstash" : "memory";
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * One Ratelimit instance per (limit, window) pair.
 *
 * Constructing one per request would discard the ephemeral cache it keeps for
 * already-blocked identifiers, costing an extra Redis round trip on exactly the
 * requests that least deserve one.
 */
const limiters = new Map<string, Ratelimit>();

function limiterFor(limit: number, windowMs: number): Ratelimit {
  const key = `${limit}:${windowMs}`;
  let limiter = limiters.get(key);

  if (!limiter) {
    limiter = new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
      prefix: "fd:rl",
      // Serves repeat offenders from process memory without touching Redis.
      ephemeralCache: new Map(),
      analytics: false,
    });
    limiters.set(key, limiter);
  }

  return limiter;
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  if (!redis) return memoryLimit(key, limit, windowMs);

  try {
    const { success, remaining, reset } = await limiterFor(limit, windowMs).limit(key);
    return {
      allowed: success,
      remaining,
      retryAfterSeconds: Math.max(0, Math.ceil((reset - Date.now()) / 1000)),
    };
  } catch (error) {
    /**
     * Fail open, deliberately.
     *
     * If Upstash is unreachable, refusing every request would turn a limiter
     * outage into a full outage — locking you out of your own dashboard. The
     * in-memory limiter still applies, and the paths that matter most have
     * independent protection: the second factor keeps a persisted attempt
     * counter in Postgres, and sign-in requires a passkey at the identity
     * provider regardless.
     */
    console.error(
      "[rate-limit] Upstash unavailable, falling back to in-memory:",
      error instanceof Error ? error.message : "unknown error",
    );
    return memoryLimit(key, limit, windowMs);
  }
}

/** Clear a key after a legitimate success, so one good login resets the count. */
export async function resetRateLimit(key: string): Promise<void> {
  memoryBuckets.delete(key);

  if (!redis) return;
  try {
    // Mirrors @upstash/ratelimit's own key layout: <prefix>:<identifier>.
    await redis.del(`fd:rl:${key}`);
  } catch {
    // A failed reset only means the user keeps their existing count. Harmless.
  }
}

// ─── In-memory fallback ──────────────────────────────────────────────────────

type Bucket = { count: number; resetAt: number };

const memoryBuckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 10_000;

function memoryLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = memoryBuckets.get(key);

  if (!existing || existing.resetAt <= now) {
    if (memoryBuckets.size >= MAX_TRACKED_KEYS) evictExpired(now);
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
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

/** Bound memory against unbounded distinct keys, e.g. spoofed addresses. */
function evictExpired(now: number): void {
  for (const [key, bucket] of memoryBuckets) {
    if (bucket.resetAt <= now) memoryBuckets.delete(key);
  }

  if (memoryBuckets.size >= MAX_TRACKED_KEYS) {
    const oldest = [...memoryBuckets.entries()]
      .sort((a, b) => a[1].resetAt - b[1].resetAt)
      .slice(0, 1000);
    for (const [key] of oldest) memoryBuckets.delete(key);
  }
}
