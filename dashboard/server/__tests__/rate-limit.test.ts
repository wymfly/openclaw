import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { createRateLimiter } from "../rate-limit.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let disposables: Array<{ dispose: () => void }> = [];

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  for (const d of disposables) {
    d.dispose();
  }
  disposables = [];
});

function makeLimiter(opts?: { windowMs?: number; maxRequests?: number }) {
  const limiter = createRateLimiter(opts);
  disposables.push(limiter);
  return limiter;
}

// ---------------------------------------------------------------------------
// Basic functionality
// ---------------------------------------------------------------------------

describe("createRateLimiter", () => {
  it("allows requests within limit", () => {
    const limiter = makeLimiter({ maxRequests: 3 });
    const r1 = limiter.checkLimit("1.2.3.4");
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);
  });

  it("rejects requests exceeding limit", () => {
    const limiter = makeLimiter({ maxRequests: 2 });
    limiter.checkLimit("1.2.3.4"); // 1
    limiter.checkLimit("1.2.3.4"); // 2
    const r3 = limiter.checkLimit("1.2.3.4"); // 3 → over
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it("tracks remaining count correctly", () => {
    const limiter = makeLimiter({ maxRequests: 5 });
    const ip = "10.0.0.1";
    expect(limiter.checkLimit(ip).remaining).toBe(4);
    expect(limiter.checkLimit(ip).remaining).toBe(3);
    expect(limiter.checkLimit(ip).remaining).toBe(2);
    expect(limiter.checkLimit(ip).remaining).toBe(1);
    expect(limiter.checkLimit(ip).remaining).toBe(0);
    // Over limit — remaining stays at 0.
    expect(limiter.checkLimit(ip).remaining).toBe(0);
  });

  it("isolates different IPs", () => {
    const limiter = makeLimiter({ maxRequests: 1 });
    expect(limiter.checkLimit("a").allowed).toBe(true);
    expect(limiter.checkLimit("b").allowed).toBe(true);
    expect(limiter.checkLimit("a").allowed).toBe(false);
  });

  it("resets after window expires", () => {
    const limiter = makeLimiter({ windowMs: 1000, maxRequests: 1 });
    const ip = "10.0.0.1";
    expect(limiter.checkLimit(ip).allowed).toBe(true);
    expect(limiter.checkLimit(ip).allowed).toBe(false);

    // Advance past the window.
    vi.advanceTimersByTime(1001);

    expect(limiter.checkLimit(ip).allowed).toBe(true);
  });

  it("returns correct resetAt timestamp", () => {
    const now = Date.now();
    const limiter = makeLimiter({ windowMs: 5000 });
    const result = limiter.checkLimit("x");
    expect(result.resetAt).toBe(now + 5000);
  });

  it("uses default 60 requests / 60 seconds", () => {
    const limiter = makeLimiter();
    const ip = "default-ip";
    for (let i = 0; i < 60; i++) {
      expect(limiter.checkLimit(ip).allowed).toBe(true);
    }
    expect(limiter.checkLimit(ip).allowed).toBe(false);
  });

  it("cleans up expired entries on interval", () => {
    const limiter = makeLimiter({ windowMs: 1000, maxRequests: 1 });
    limiter.checkLimit("cleanup-ip");

    // Advance past window + cleanup interval (60s).
    vi.advanceTimersByTime(61_000);

    // After cleanup the IP gets a fresh bucket.
    const result = limiter.checkLimit("cleanup-ip");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0); // maxRequests=1, first request → remaining=0
  });
});
