import { describe, test, expect, vi, beforeEach } from "vitest";
import {
  parseAccessMetadata,
  buildUpdatedMetadata,
  computeEffectiveHalfLife,
  AccessTracker,
} from "./access-tracker.js";
import type { MemoryStore } from "./store-types.js";

describe("parseAccessMetadata", () => {
  test("returns defaults for undefined", () => {
    const result = parseAccessMetadata(undefined);
    expect(result.accessCount).toBe(0);
    expect(result.lastAccessedAt).toBe(0);
  });

  test("returns defaults for empty string", () => {
    const result = parseAccessMetadata("");
    expect(result.accessCount).toBe(0);
    expect(result.lastAccessedAt).toBe(0);
  });

  test("returns defaults for malformed JSON", () => {
    const result = parseAccessMetadata("{broken");
    expect(result.accessCount).toBe(0);
    expect(result.lastAccessedAt).toBe(0);
  });

  test("parses camelCase keys", () => {
    const meta = JSON.stringify({ accessCount: 5, lastAccessedAt: 1000 });
    const result = parseAccessMetadata(meta);
    expect(result.accessCount).toBe(5);
    expect(result.lastAccessedAt).toBe(1000);
  });

  test("parses snake_case keys", () => {
    const meta = JSON.stringify({ access_count: 7, last_accessed_at: 2000 });
    const result = parseAccessMetadata(meta);
    expect(result.accessCount).toBe(7);
    expect(result.lastAccessedAt).toBe(2000);
  });

  test("clamps access count to max 10000", () => {
    const meta = JSON.stringify({ accessCount: 99999 });
    const result = parseAccessMetadata(meta);
    expect(result.accessCount).toBe(10000);
  });

  test("clamps negative access count to 0", () => {
    const meta = JSON.stringify({ accessCount: -5 });
    const result = parseAccessMetadata(meta);
    expect(result.accessCount).toBe(0);
  });

  test("handles non-numeric values gracefully", () => {
    const meta = JSON.stringify({ accessCount: "not a number" });
    const result = parseAccessMetadata(meta);
    expect(result.accessCount).toBe(0);
  });
});

describe("buildUpdatedMetadata", () => {
  test("creates new metadata from undefined", () => {
    const result = buildUpdatedMetadata(undefined, 1);
    const parsed = JSON.parse(result);
    expect(parsed.accessCount).toBe(1);
    expect(parsed.access_count).toBe(1);
    expect(parsed.lastAccessedAt).toBeGreaterThan(0);
    expect(parsed.last_accessed_at).toBeGreaterThan(0);
  });

  test("preserves existing fields", () => {
    const existing = JSON.stringify({ customField: "hello", accessCount: 3 });
    const result = buildUpdatedMetadata(existing, 2);
    const parsed = JSON.parse(result);
    expect(parsed.customField).toBe("hello");
    expect(parsed.accessCount).toBe(5);
  });

  test("writes both camelCase and snake_case", () => {
    const result = buildUpdatedMetadata(undefined, 1);
    const parsed = JSON.parse(result);
    expect(parsed.accessCount).toBe(parsed.access_count);
    expect(parsed.lastAccessedAt).toBe(parsed.last_accessed_at);
  });
});

describe("computeEffectiveHalfLife", () => {
  test("returns base half-life when reinforcement is 0", () => {
    const result = computeEffectiveHalfLife(30, 10, Date.now(), 0, 3);
    expect(result).toBe(30);
  });

  test("returns base half-life when access count is 0", () => {
    const result = computeEffectiveHalfLife(30, 0, Date.now(), 0.5, 3);
    expect(result).toBe(30);
  });

  test("extends half-life for frequently accessed memories", () => {
    const result = computeEffectiveHalfLife(30, 10, Date.now(), 0.5, 3);
    expect(result).toBeGreaterThan(30);
  });

  test("caps at maxMultiplier * baseHalfLife", () => {
    const result = computeEffectiveHalfLife(30, 10000, Date.now(), 10, 3);
    expect(result).toBeLessThanOrEqual(90); // 30 * 3
  });

  test("stale accesses contribute less reinforcement", () => {
    const recent = computeEffectiveHalfLife(30, 10, Date.now(), 0.5, 3);
    // Simulate access from 90 days ago
    const stale = computeEffectiveHalfLife(30, 10, Date.now() - 90 * 86_400_000, 0.5, 3);
    expect(recent).toBeGreaterThan(stale);
  });
});

describe("AccessTracker", () => {
  let mockStore: MemoryStore;

  beforeEach(() => {
    mockStore = {
      hasId: vi.fn(async () => true),
      getById: vi.fn(async (id: string) => ({
        id,
        text: "test",
        vector: [0.1],
        category: "fact" as const,
        scope: "default",
        importance: 0.7,
        timestamp: Date.now(),
        metadata: JSON.stringify({ accessCount: 1 }),
      })),
      vectorSearch: vi.fn(async () => []),
      bm25Search: vi.fn(async () => []),
      update: vi.fn(async () => {}),
      hasFtsSupport: false,
    };
  });

  test("recordAccess accumulates pending updates", () => {
    const tracker = new AccessTracker({
      store: mockStore,
      logger: { warn: vi.fn() },
      debounceMs: 60_000, // long debounce so it won't auto-flush
    });

    tracker.recordAccess(["id1", "id2"]);
    tracker.recordAccess(["id1"]);

    const pending = tracker.getPendingUpdates();
    expect(pending.get("id1")).toBe(2);
    expect(pending.get("id2")).toBe(1);

    tracker.destroy();
  });

  test("flush writes updates to store", async () => {
    const tracker = new AccessTracker({
      store: mockStore,
      logger: { warn: vi.fn() },
      debounceMs: 60_000,
    });

    tracker.recordAccess(["id1"]);
    await tracker.flush();

    expect(mockStore.getById).toHaveBeenCalledWith("id1");
    expect(mockStore.update).toHaveBeenCalledWith("id1", {
      metadata: expect.any(String),
    });

    // Pending should be cleared
    expect(tracker.getPendingUpdates().size).toBe(0);

    tracker.destroy();
  });

  test("flush is no-op when nothing pending", async () => {
    const tracker = new AccessTracker({
      store: mockStore,
      logger: { warn: vi.fn() },
    });

    await tracker.flush();
    expect(mockStore.getById).not.toHaveBeenCalled();

    tracker.destroy();
  });

  test("requeues failed updates", async () => {
    const failStore: MemoryStore = {
      ...mockStore,
      getById: vi.fn(async () => {
        throw new Error("store failure");
      }),
    };

    const logger = { warn: vi.fn() };
    const tracker = new AccessTracker({
      store: failStore,
      logger,
      debounceMs: 60_000,
    });

    tracker.recordAccess(["id1"]);
    await tracker.flush();

    // Should have been requeued
    const pending = tracker.getPendingUpdates();
    expect(pending.get("id1")).toBe(1);
    expect(logger.warn).toHaveBeenCalled();

    tracker.destroy();
  });

  test("destroy warns about pending writes", () => {
    const logger = { warn: vi.fn() };
    const tracker = new AccessTracker({
      store: mockStore,
      logger,
      debounceMs: 60_000,
    });

    tracker.recordAccess(["id1", "id2"]);
    tracker.destroy();

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("2 pending writes"));
  });
});
