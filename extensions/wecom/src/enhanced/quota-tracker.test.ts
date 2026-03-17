import { describe, it, expect, beforeEach } from "vitest";
import {
  createQuotaTracker,
  REPLY_LIMIT,
  REPLY_WARN_THRESHOLD,
  ACTIVE_SEND_LIMIT,
  ACTIVE_SEND_WARN_THRESHOLD,
  type QuotaTracker,
} from "./quota-tracker.js";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("quota-tracker", () => {
  let tracker: QuotaTracker;

  beforeEach(() => {
    tracker = createQuotaTracker();
  });

  describe("forecastReplyQuota", () => {
    it("returns full quota for unknown account/chat", () => {
      const q = tracker.forecastReplyQuota({ accountId: "a1", chatId: "c1" });
      expect(q.bucket).toBe("reply24h");
      expect(q.limit).toBe(REPLY_LIMIT);
      expect(q.used).toBe(0);
      expect(q.remaining).toBe(REPLY_LIMIT);
      expect(q.exhausted).toBe(false);
      expect(q.nearLimit).toBe(false);
      expect(q.windowActive).toBe(false);
    });

    it("returns full quota with empty chatId", () => {
      const q = tracker.forecastReplyQuota({ accountId: "a1", chatId: "" });
      expect(q.remaining).toBe(REPLY_LIMIT);
      expect(q.windowActive).toBe(false);
    });

    it("activates window after inbound", () => {
      const now = Date.now();
      tracker.recordInboundMessage({ accountId: "a1", chatId: "c1", at: now });
      const q = tracker.forecastReplyQuota({ accountId: "a1", chatId: "c1", at: now + 100 });
      expect(q.windowActive).toBe(true);
      expect(q.used).toBe(0);
      expect(q.remaining).toBe(REPLY_LIMIT);
    });

    it("increments used count after passive reply", () => {
      const now = Date.now();
      tracker.recordInboundMessage({ accountId: "a1", chatId: "c1", at: now });
      tracker.recordPassiveReply({ accountId: "a1", chatId: "c1", at: now + 100 });
      const q = tracker.forecastReplyQuota({ accountId: "a1", chatId: "c1", at: now + 200 });
      expect(q.used).toBe(1);
      expect(q.remaining).toBe(REPLY_LIMIT - 1);
    });
  });

  describe("24h window boundary", () => {
    it("resets reply count when window expires", () => {
      const now = Date.now();
      tracker.recordInboundMessage({ accountId: "a1", chatId: "c1", at: now });
      for (let i = 0; i < 10; i++) {
        tracker.recordPassiveReply({ accountId: "a1", chatId: "c1", at: now + i + 1 });
      }
      // After 24h the window should be inactive
      const q = tracker.forecastReplyQuota({ accountId: "a1", chatId: "c1", at: now + DAY_MS + 1 });
      expect(q.windowActive).toBe(false);
      expect(q.used).toBe(0);
      expect(q.remaining).toBe(REPLY_LIMIT);
    });

    it("keeps window active just before 24h", () => {
      const now = Date.now();
      tracker.recordInboundMessage({ accountId: "a1", chatId: "c1", at: now });
      tracker.recordPassiveReply({ accountId: "a1", chatId: "c1", at: now + 100 });
      const q = tracker.forecastReplyQuota({ accountId: "a1", chatId: "c1", at: now + DAY_MS - 1 });
      expect(q.windowActive).toBe(true);
      expect(q.used).toBe(1);
    });
  });

  describe("nearLimit threshold (24/30)", () => {
    it("sets nearLimit when used >= REPLY_WARN_THRESHOLD", () => {
      const now = Date.now();
      tracker.recordInboundMessage({ accountId: "a1", chatId: "c1", at: now });
      for (let i = 0; i < REPLY_WARN_THRESHOLD; i++) {
        tracker.recordPassiveReply({ accountId: "a1", chatId: "c1", at: now + i + 1 });
      }
      const q = tracker.forecastReplyQuota({
        accountId: "a1",
        chatId: "c1",
        at: now + REPLY_WARN_THRESHOLD + 1,
      });
      expect(q.nearLimit).toBe(true);
      expect(q.exhausted).toBe(false);
      expect(q.used).toBe(REPLY_WARN_THRESHOLD);
    });
  });

  describe("exhausted (30/30)", () => {
    it("sets exhausted when used >= REPLY_LIMIT", () => {
      const now = Date.now();
      tracker.recordInboundMessage({ accountId: "a1", chatId: "c1", at: now });
      for (let i = 0; i < REPLY_LIMIT; i++) {
        tracker.recordPassiveReply({ accountId: "a1", chatId: "c1", at: now + i + 1 });
      }
      const q = tracker.forecastReplyQuota({
        accountId: "a1",
        chatId: "c1",
        at: now + REPLY_LIMIT + 1,
      });
      expect(q.exhausted).toBe(true);
      expect(q.nearLimit).toBe(true);
      expect(q.remaining).toBe(0);
    });
  });

  describe("forecastActiveSendQuota", () => {
    it("returns reply quota if reply window is active and not exhausted", () => {
      const now = Date.now();
      tracker.recordInboundMessage({ accountId: "a1", chatId: "c1", at: now });
      const q = tracker.forecastActiveSendQuota({ accountId: "a1", chatId: "c1", at: now + 100 });
      // Should use reply window since it's active
      expect(q.bucket).toBe("reply24h");
      expect(q.windowActive).toBe(true);
    });

    it("returns activeDaily quota when no reply window", () => {
      const q = tracker.forecastActiveSendQuota({ accountId: "a1", chatId: "c1" });
      expect(q.bucket).toBe("activeDaily");
      expect(q.limit).toBe(ACTIVE_SEND_LIMIT);
    });

    it("returns activeDaily quota when reply window is exhausted", () => {
      const now = Date.now();
      tracker.recordInboundMessage({ accountId: "a1", chatId: "c1", at: now });
      for (let i = 0; i < REPLY_LIMIT; i++) {
        tracker.recordPassiveReply({ accountId: "a1", chatId: "c1", at: now + i + 1 });
      }
      const q = tracker.forecastActiveSendQuota({
        accountId: "a1",
        chatId: "c1",
        at: now + REPLY_LIMIT + 1,
      });
      expect(q.bucket).toBe("activeDaily");
    });
  });

  describe("UTC midnight daily reset", () => {
    it("resets activeSendCountToday on new UTC day", () => {
      // Pick a time near midnight UTC
      const beforeMidnight = new Date("2026-03-17T23:59:00Z").getTime();
      const afterMidnight = new Date("2026-03-18T00:01:00Z").getTime();

      tracker.recordActiveSend({ accountId: "a1", chatId: "c1", at: beforeMidnight });
      const q1 = tracker.forecastActiveSendQuota({
        accountId: "a1",
        chatId: "c1",
        at: beforeMidnight + 1,
      });
      expect(q1.bucket).toBe("activeDaily");
      expect(q1.used).toBe(1);

      // After midnight the daily count resets
      const q2 = tracker.forecastActiveSendQuota({
        accountId: "a1",
        chatId: "c1",
        at: afterMidnight,
      });
      expect(q2.bucket).toBe("activeDaily");
      expect(q2.used).toBe(0);
    });
  });

  describe("recordActiveSend", () => {
    it("uses reply window if active and not exhausted", () => {
      const now = Date.now();
      tracker.recordInboundMessage({ accountId: "a1", chatId: "c1", at: now });
      const result = tracker.recordActiveSend({ accountId: "a1", chatId: "c1", at: now + 100 });
      expect(result.bucket).toBe("reply24h");
      expect(result.used).toBe(1);
    });

    it("uses activeDaily bucket when no reply window", () => {
      const now = Date.now();
      const result = tracker.recordActiveSend({ accountId: "a1", chatId: "c1", at: now });
      expect(result.bucket).toBe("activeDaily");
      expect(result.used).toBe(1);
    });

    it("active send nearLimit at threshold", () => {
      const now = Date.now();
      for (let i = 0; i < ACTIVE_SEND_WARN_THRESHOLD; i++) {
        tracker.recordActiveSend({ accountId: "a1", chatId: "c1", at: now + i });
      }
      const q = tracker.forecastActiveSendQuota({
        accountId: "a1",
        chatId: "c1",
        at: now + ACTIVE_SEND_WARN_THRESHOLD,
      });
      expect(q.bucket).toBe("activeDaily");
      expect(q.nearLimit).toBe(true);
      expect(q.exhausted).toBe(false);
    });

    it("active send exhausted at limit", () => {
      const now = Date.now();
      for (let i = 0; i < ACTIVE_SEND_LIMIT; i++) {
        tracker.recordActiveSend({ accountId: "a1", chatId: "c1", at: now + i });
      }
      const q = tracker.forecastActiveSendQuota({
        accountId: "a1",
        chatId: "c1",
        at: now + ACTIVE_SEND_LIMIT,
      });
      expect(q.bucket).toBe("activeDaily");
      expect(q.exhausted).toBe(true);
    });
  });

  describe("recordOutboundActivity", () => {
    it("updates account-level lastOutboundAt", () => {
      const now = Date.now();
      tracker.recordOutboundActivity({ accountId: "a1", at: now });
      const telemetry = tracker.getAccountTelemetry("a1", { now });
      expect(telemetry.lastOutboundAt).toBe(now);
    });
  });

  describe("getAccountTelemetry", () => {
    it("returns empty telemetry for unknown account", () => {
      const t = tracker.getAccountTelemetry("unknown");
      expect(t.lastInboundAt).toBeNull();
      expect(t.lastOutboundAt).toBeNull();
      expect(t.quotas.trackedChats).toBe(0);
    });

    it("aggregates reply and active quota stats", () => {
      const now = Date.now();
      // Chat c1: inbound + 25 replies (nearLimit)
      tracker.recordInboundMessage({ accountId: "a1", chatId: "c1", at: now });
      for (let i = 0; i < 25; i++) {
        tracker.recordPassiveReply({ accountId: "a1", chatId: "c1", at: now + i + 1 });
      }
      // Chat c2: 9 active sends (nearLimit)
      for (let i = 0; i < 9; i++) {
        tracker.recordActiveSend({ accountId: "a1", chatId: "c2", at: now + i });
      }

      const t = tracker.getAccountTelemetry("a1", { now: now + 100 });
      expect(t.quotas.trackedChats).toBe(2);
      expect(t.quotas.replyWindowChats).toBe(1);
      expect(t.quotas.totalReplyCount24h).toBe(25);
      expect(t.quotas.nearLimitReplyChats).toBe(1);
      expect(t.quotas.activeDailyChats).toBe(1);
      expect(t.quotas.totalActiveSendCountToday).toBe(9);
      expect(t.quotas.nearLimitActiveChats).toBe(1);
    });
  });

  describe("account displacement tracking", () => {
    it("marks and clears displaced state", () => {
      tracker.markAccountDisplaced({ accountId: "a1", reason: "kicked" });
      let t = tracker.getAccountTelemetry("a1");
      expect(t.connection.displaced).toBe(true);
      expect(t.connection.lastDisplacedReason).toBe("kicked");

      tracker.clearAccountDisplaced("a1");
      t = tracker.getAccountTelemetry("a1");
      expect(t.connection.displaced).toBe(false);
    });
  });

  describe("pruning", () => {
    it("evicts stale chats beyond MAX_TRACKED_CHATS", () => {
      const now = Date.now();
      // Add 501 chats — oldest should be pruned
      for (let i = 0; i < 501; i++) {
        tracker.recordInboundMessage({ accountId: "a1", chatId: `chat-${i}`, at: now + i });
      }
      const t = tracker.getAccountTelemetry("a1", { now: now + 1000 });
      expect(t.quotas.trackedChats).toBeLessThanOrEqual(500);
    });
  });
});
