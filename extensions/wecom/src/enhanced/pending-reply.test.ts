import { describe, it, expect, vi, beforeEach } from "vitest";
import { createWecomPendingReplyManager } from "./pending-reply.js";

function createMockStore() {
  const entries: Map<string, any> = new Map();
  let nextId = 1;

  return {
    entries,
    countPendingReplies: vi.fn(() => entries.size),
    enqueuePendingReply: vi.fn((payload: any) => {
      const id = `pr-${nextId++}`;
      const entry = {
        id,
        ...payload,
        retries: 0,
        nextRetryAt: 0,
        createdAt: 0,
        status: "pending" as const,
      };
      entries.set(id, entry);
      return entry;
    }),
    listDuePendingReplies: vi.fn(({ at, limit }: { at: number; limit: number }) => {
      const due: any[] = [];
      for (const entry of entries.values()) {
        if (entry.status === "pending" && entry.nextRetryAt <= at && due.length < limit) {
          due.push(entry);
        }
      }
      return due;
    }),
    markPendingDelivered: vi.fn(({ id }: { id: string }) => {
      const entry = entries.get(id);
      if (entry) entry.status = "delivered";
    }),
    reschedulePendingReply: vi.fn(
      ({ id, reason, at }: { id: string; reason: string; at: number }) => {
        const entry = entries.get(id);
        if (!entry) return false;
        entry.retries++;
        const backoff = entry.retryBackoffMs ?? 5000;
        entry.nextRetryAt = at + backoff * Math.pow(2, entry.retries - 1);
        if (entry.retries >= (entry.maxRetries ?? 3)) {
          entry.status = "exhausted";
          return false;
        }
        return true;
      },
    ),
    dropExpiredPendingReplies: vi.fn(({ at }: { at: number }) => {
      for (const [id, entry] of entries) {
        if (entry.expireMs && at - entry.createdAt > entry.expireMs) {
          entries.delete(id);
        }
      }
    }),
    listPendingRepliesForSession: vi.fn(() => []),
  };
}

function createDefaultDeps(overrides: Record<string, unknown> = {}) {
  const store = createMockStore();
  return {
    reliableDeliveryStore: store,
    resolveWecomPendingReplyPolicy: vi.fn(() => ({
      enabled: true,
      maxRetries: 3,
      retryBackoffMs: 5000,
      expireMs: 300_000,
    })),
    deliverPendingReply: vi.fn(async () => ({ ok: true })),
    ensurePersistenceLoaded: vi.fn(async () => true),
    schedulePersistenceFlush: vi.fn(),
    logger: { warn: vi.fn(), info: vi.fn() },
    now: vi.fn(() => 1000),
    sweepIntervalMs: 15000,
    ...overrides,
  };
}

describe("createWecomPendingReplyManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("throws if reliableDeliveryStore is missing", () => {
    expect(() =>
      createWecomPendingReplyManager({
        reliableDeliveryStore: undefined as any,
        resolveWecomPendingReplyPolicy: vi.fn(),
        deliverPendingReply: vi.fn(),
      }),
    ).toThrow("reliableDeliveryStore is required");
  });

  it("throws if resolveWecomPendingReplyPolicy is missing", () => {
    expect(() =>
      createWecomPendingReplyManager({
        reliableDeliveryStore: createMockStore(),
        resolveWecomPendingReplyPolicy: undefined as any,
        deliverPendingReply: vi.fn(),
      }),
    ).toThrow("resolveWecomPendingReplyPolicy is required");
  });

  it("throws if deliverPendingReply is missing", () => {
    expect(() =>
      createWecomPendingReplyManager({
        reliableDeliveryStore: createMockStore(),
        resolveWecomPendingReplyPolicy: vi.fn(),
        deliverPendingReply: undefined as any,
      }),
    ).toThrow("deliverPendingReply is required");
  });

  describe("enqueuePendingReply", () => {
    it("enqueues when policy is enabled", () => {
      const deps = createDefaultDeps();
      const mgr = createWecomPendingReplyManager(deps);
      const entry = mgr.enqueuePendingReply({}, { text: "hello", to: "user1" });
      expect(entry).toBeTruthy();
      expect(deps.reliableDeliveryStore.enqueuePendingReply).toHaveBeenCalled();
      expect(deps.schedulePersistenceFlush).toHaveBeenCalledWith(
        "pending-enqueue",
        expect.anything(),
      );
    });

    it("returns null when policy is disabled", () => {
      const deps = createDefaultDeps({
        resolveWecomPendingReplyPolicy: vi.fn(() => ({ enabled: false })),
      });
      const mgr = createWecomPendingReplyManager(deps);
      const entry = mgr.enqueuePendingReply({}, { text: "hello" });
      expect(entry).toBeNull();
    });
  });

  describe("flushDuePendingReplies (sweep)", () => {
    it("delivers due entries and marks them delivered", async () => {
      const deps = createDefaultDeps();
      const store = deps.reliableDeliveryStore;

      // Pre-seed an entry
      store.enqueuePendingReply({
        text: "retry me",
        maxRetries: 3,
        retryBackoffMs: 5000,
        expireMs: 300_000,
      });
      store.countPendingReplies.mockReturnValue(1);

      const mgr = createWecomPendingReplyManager(deps);
      await mgr.flushDuePendingReplies("manual");

      expect(deps.deliverPendingReply).toHaveBeenCalled();
      expect(store.markPendingDelivered).toHaveBeenCalled();
    });

    it("reschedules on delivery failure", async () => {
      const deps = createDefaultDeps({
        deliverPendingReply: vi.fn(async () => ({ ok: false, error: "timeout" })),
      });
      const store = deps.reliableDeliveryStore;

      store.enqueuePendingReply({
        text: "retry me",
        maxRetries: 3,
        retryBackoffMs: 5000,
        expireMs: 300_000,
      });

      const mgr = createWecomPendingReplyManager(deps);
      await mgr.flushDuePendingReplies("manual");

      expect(store.reschedulePendingReply).toHaveBeenCalled();
      expect(store.markPendingDelivered).not.toHaveBeenCalled();
    });

    it("reschedules on delivery exception", async () => {
      const deps = createDefaultDeps({
        deliverPendingReply: vi.fn(async () => {
          throw new Error("network error");
        }),
      });
      const store = deps.reliableDeliveryStore;

      store.enqueuePendingReply({
        text: "retry me",
        maxRetries: 3,
        retryBackoffMs: 5000,
        expireMs: 300_000,
      });

      const mgr = createWecomPendingReplyManager(deps);
      await mgr.flushDuePendingReplies("manual");

      expect(store.reschedulePendingReply).toHaveBeenCalled();
      expect(deps.logger.warn).toHaveBeenCalled();
    });

    it("drops expired entries before sweep", async () => {
      const deps = createDefaultDeps();
      const store = deps.reliableDeliveryStore;
      const mgr = createWecomPendingReplyManager(deps);

      await mgr.flushDuePendingReplies("timer");

      expect(store.dropExpiredPendingReplies).toHaveBeenCalledWith({ at: 1000 });
    });
  });

  describe("initialize", () => {
    it("starts sweep timer when pending entries exist", async () => {
      const deps = createDefaultDeps();
      deps.reliableDeliveryStore.countPendingReplies.mockReturnValue(5);

      const mgr = createWecomPendingReplyManager(deps);
      await mgr.initialize({});

      expect(deps.ensurePersistenceLoaded).toHaveBeenCalled();
    });

    it("does not start sweep timer when no pending entries", async () => {
      const deps = createDefaultDeps();
      deps.reliableDeliveryStore.countPendingReplies.mockReturnValue(0);

      const mgr = createWecomPendingReplyManager(deps);
      const result = await mgr.initialize({});

      expect(result).toBe(true);
    });
  });

  describe("flushSessionPendingReplies", () => {
    it("flushes entries for a specific session", async () => {
      const deps = createDefaultDeps();
      const sessionEntries = [
        { id: "s1", text: "hello", retries: 0, nextRetryAt: 0, status: "pending" },
      ];
      deps.reliableDeliveryStore.listPendingRepliesForSession.mockReturnValue(sessionEntries);

      const mgr = createWecomPendingReplyManager(deps);
      await mgr.flushSessionPendingReplies({
        mode: "agent",
        accountId: "default",
        sessionId: "sess-1",
      });

      expect(deps.reliableDeliveryStore.listPendingRepliesForSession).toHaveBeenCalledWith({
        mode: "agent",
        accountId: "default",
        sessionId: "sess-1",
      });
      expect(deps.deliverPendingReply).toHaveBeenCalled();
    });

    it("skips when no session entries exist", async () => {
      const deps = createDefaultDeps();
      deps.reliableDeliveryStore.listPendingRepliesForSession.mockReturnValue([]);

      const mgr = createWecomPendingReplyManager(deps);
      await mgr.flushSessionPendingReplies({ sessionId: "empty" });

      expect(deps.deliverPendingReply).not.toHaveBeenCalled();
    });
  });
});
