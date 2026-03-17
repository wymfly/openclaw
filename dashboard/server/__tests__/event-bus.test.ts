import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventBus, getEventBus } from "../event-bus.js";
import type { DeckEventType, ServerEvent } from "../event-bus.js";

// ---------------------------------------------------------------------------
// Fresh bus per test
// ---------------------------------------------------------------------------

let bus: EventBus;
beforeEach(() => {
  bus = new EventBus();
});

// ---------------------------------------------------------------------------
// Core broadcast / subscribe
// ---------------------------------------------------------------------------

describe("EventBus broadcast", () => {
  it("delivers events to all subscribers", () => {
    const received1: ServerEvent[] = [];
    const received2: ServerEvent[] = [];
    bus.subscribe((e) => received1.push(e));
    bus.subscribe((e) => received2.push(e));

    bus.broadcast("chat.delta", { token: "hi" });

    expect(received1).toHaveLength(1);
    expect(received2).toHaveLength(1);
    expect(received1[0].type).toBe("chat.delta");
    expect(received1[0].data).toEqual({ token: "hi" });
  });

  it("returns the created ServerEvent", () => {
    const event = bus.broadcast("runtime.status", { status: "connected" });
    expect(event.type).toBe("runtime.status");
    expect(event.id).toBe(1);
    expect(event.timestamp).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Error isolation
// ---------------------------------------------------------------------------

describe("subscriber error isolation", () => {
  it("one subscriber throwing does not block others", () => {
    const good: ServerEvent[] = [];
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    bus.subscribe(() => {
      throw new Error("boom");
    });
    bus.subscribe((e) => good.push(e));

    bus.broadcast("notification.toast", "hello");

    expect(good).toHaveLength(1);
    expect(consoleSpy).toHaveBeenCalledOnce();
    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Event ID auto-increment
// ---------------------------------------------------------------------------

describe("event ID auto-increment", () => {
  it("increments IDs monotonically", () => {
    const e1 = bus.broadcast("chat.delta", "a");
    const e2 = bus.broadcast("chat.delta", "b");
    const e3 = bus.broadcast("chat.final", "c");

    expect(e1.id).toBe(1);
    expect(e2.id).toBe(2);
    expect(e3.id).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Replay buffer
// ---------------------------------------------------------------------------

describe("replay buffer", () => {
  it("retains the most recent 100 events", () => {
    for (let i = 0; i < 120; i++) {
      bus.broadcast("gateway.event", i);
    }

    const all = bus.getEventsSince(0);
    expect(all).toHaveLength(100);
    // First retained event should be id=21 (120 - 100 + 1)
    expect(all[0].id).toBe(21);
    expect(all[99].id).toBe(120);
  });

  it("getEventsSince returns events after the given ID", () => {
    bus.broadcast("chat.delta", "a");
    bus.broadcast("chat.delta", "b");
    bus.broadcast("chat.final", "c");

    const since1 = bus.getEventsSince(1);
    expect(since1).toHaveLength(2);
    expect(since1[0].id).toBe(2);
    expect(since1[1].id).toBe(3);
  });

  it("getEventsSince(0) returns all buffered events", () => {
    bus.broadcast("runtime.status", "x");
    bus.broadcast("agent.updated", "y");

    const all = bus.getEventsSince(0);
    expect(all).toHaveLength(2);
  });

  it("getEventsSince with future ID returns empty", () => {
    bus.broadcast("chat.delta", "a");
    expect(bus.getEventsSince(999)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Unsubscribe
// ---------------------------------------------------------------------------

describe("unsubscribe", () => {
  it("removes subscriber from future broadcasts", () => {
    const received: ServerEvent[] = [];
    const cb = (e: ServerEvent) => received.push(e);
    bus.subscribe(cb);

    bus.broadcast("chat.delta", "first");
    expect(received).toHaveLength(1);

    bus.unsubscribe(cb);
    bus.broadcast("chat.delta", "second");
    expect(received).toHaveLength(1);
  });

  it("tracks subscriberCount accurately", () => {
    expect(bus.subscriberCount).toBe(0);
    const cb = () => {};
    bus.subscribe(cb);
    expect(bus.subscriberCount).toBe(1);
    bus.unsubscribe(cb);
    expect(bus.subscriberCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Singleton (globalThis)
// ---------------------------------------------------------------------------

describe("getEventBus singleton", () => {
  it("returns the same instance on repeated calls", () => {
    const a = getEventBus();
    const b = getEventBus();
    expect(a).toBe(b);
  });

  it("instance is a proper EventBus", () => {
    const instance = getEventBus();
    expect(instance).toBeInstanceOf(EventBus);
    expect(typeof instance.broadcast).toBe("function");
    expect(typeof instance.subscribe).toBe("function");
    expect(typeof instance.getEventsSince).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// Type coverage
// ---------------------------------------------------------------------------

describe("DeckEventType coverage", () => {
  it("accepts all defined event types", () => {
    const types: DeckEventType[] = [
      "runtime.status",
      "gateway.event",
      "chat.delta",
      "chat.final",
      "chat.error",
      "agent.updated",
      "gateway.health",
      "notification.toast",
    ];
    for (const t of types) {
      const event = bus.broadcast(t, null);
      expect(event.type).toBe(t);
    }
  });
});
