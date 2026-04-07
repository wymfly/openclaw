import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryReliableDeliveryStore } from "./reliable-delivery-store.js";

describe("InMemoryReliableDeliveryStore", () => {
  let store: ReturnType<typeof createInMemoryReliableDeliveryStore>;

  beforeEach(() => {
    store = createInMemoryReliableDeliveryStore();
  });

  it("enqueues and counts pending replies", () => {
    expect(store.countPendingReplies()).toBe(0);
    const entry = store.enqueuePendingReply({ text: "hello", to: "user1" });
    expect(entry).not.toBeNull();
    expect(entry!.status).toBe("pending");
    expect(store.countPendingReplies()).toBe(1);
  });

  it("lists due pending replies by time", () => {
    store.enqueuePendingReply({ text: "a", to: "u1" });
    store.enqueuePendingReply({ text: "b", to: "u2" });
    const due = store.listDuePendingReplies({ at: Date.now() + 60_000, limit: 10 });
    expect(due.length).toBe(2);
  });

  it("marks pending as delivered", () => {
    const entry = store.enqueuePendingReply({ text: "a", to: "u1" })!;
    store.markPendingDelivered({ id: entry.id, at: Date.now() });
    expect(store.countPendingReplies()).toBe(0);
  });

  it("reschedules with backoff and respects max retries", () => {
    const entry = store.enqueuePendingReply({ text: "a", to: "u1" })!;
    expect(store.reschedulePendingReply({ id: entry.id, reason: "err", at: Date.now() })).toBe(
      true,
    );
    expect(store.reschedulePendingReply({ id: entry.id, reason: "err", at: Date.now() })).toBe(
      true,
    );
    // Third retry hits max (default 3)
    expect(store.reschedulePendingReply({ id: entry.id, reason: "err", at: Date.now() })).toBe(
      false,
    );
    expect(store.countPendingReplies()).toBe(0);
  });

  it("drops expired entries", () => {
    store.enqueuePendingReply({ text: "a", to: "u1" });
    store.dropExpiredPendingReplies({ at: Date.now() + 86_400_000 * 2 });
    expect(store.countPendingReplies()).toBe(0);
  });
});
