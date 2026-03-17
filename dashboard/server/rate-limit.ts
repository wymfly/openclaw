/**
 * IP-based rate limiter for openclaw-deck.
 *
 * Fixed-window algorithm with in-memory Map storage.
 * Expired entries are cleaned up every 60 seconds.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RateLimiterOptions = {
  /** Window duration in milliseconds (default: 60_000). */
  windowMs?: number;
  /** Maximum requests per window (default: 60). */
  maxRequests?: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

type BucketEntry = {
  count: number;
  resetAt: number;
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createRateLimiter(options?: RateLimiterOptions) {
  const windowMs = options?.windowMs ?? 60_000;
  const maxRequests = options?.maxRequests ?? 60;
  const buckets = new Map<string, BucketEntry>();

  // Periodic cleanup of expired entries.
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of buckets) {
      if (entry.resetAt <= now) {
        buckets.delete(key);
      }
    }
  }, 60_000);

  // Allow the process to exit even if the interval is still active.
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  function checkLimit(ip: string): RateLimitResult {
    const now = Date.now();
    let entry = buckets.get(ip);

    // Window expired or first request — start fresh.
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      buckets.set(ip, entry);
    }

    entry.count += 1;
    const remaining = Math.max(0, maxRequests - entry.count);
    const allowed = entry.count <= maxRequests;

    return { allowed, remaining, resetAt: entry.resetAt };
  }

  /** Stop the background cleanup timer (useful in tests). */
  function dispose(): void {
    clearInterval(cleanupInterval);
    buckets.clear();
  }

  return { checkLimit, dispose };
}
