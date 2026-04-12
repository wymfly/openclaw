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

    bus.broadcast("chat", { token: "hi" });

    expect(received1).toHaveLength(1);
    expect(received2).toHaveLength(1);
    expect(received1[0].type).toBe("chat");
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
    const e1 = bus.broadcast("chat", "a");
    const e2 = bus.broadcast("chat", "b");
    const e3 = bus.broadcast("chat", "c");

    expect(e1.id).toBe(1);
    expect(e2.id).toBe(2);
    expect(e3.id).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Replay buffer
// ---------------------------------------------------------------------------

describe("replay buffer", () => {
  it("retains the most recent 2000 events", () => {
    for (let i = 0; i < 2020; i++) {
      bus.broadcast("gateway.event", i);
    }

    const { events: all } = bus.getEventsSince(0);
    expect(all).toHaveLength(2000);
    // First retained event should be id=21 (2020 - 2000 + 1)
    expect(all[0].id).toBe(21);
    expect(all[1999].id).toBe(2020);
  });

  it("getEventsSince returns events after the given ID", () => {
    bus.broadcast("chat", "a");
    bus.broadcast("chat", "b");
    bus.broadcast("chat", "c");

    const { events: since1 } = bus.getEventsSince(1);
    expect(since1).toHaveLength(2);
    expect(since1[0].id).toBe(2);
    expect(since1[1].id).toBe(3);
  });

  it("getEventsSince(0) returns all buffered events", () => {
    bus.broadcast("runtime.status", "x");
    bus.broadcast("agent.updated", "y");

    const { events, gapDetected } = bus.getEventsSince(0);
    expect(events).toHaveLength(2);
    expect(gapDetected).toBe(false);
  });

  it("getEventsSince with future ID returns empty", () => {
    bus.broadcast("chat", "a");
    const { events } = bus.getEventsSince(999);
    expect(events).toHaveLength(0);
  });

  it("detects gap when lastId falls out of buffer", () => {
    // Fill beyond buffer
    for (let i = 0; i < 2010; i++) {
      bus.broadcast("gateway.event", i);
    }
    // Asking for id=5 which has been evicted
    const { gapDetected } = bus.getEventsSince(5);
    expect(gapDetected).toBe(true);
  });

  it("no gap when lastId is within buffer", () => {
    bus.broadcast("chat", "a");
    bus.broadcast("chat", "b");
    const { gapDetected } = bus.getEventsSince(1);
    expect(gapDetected).toBe(false);
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

    bus.broadcast("chat", "first");
    expect(received).toHaveLength(1);

    bus.unsubscribe(cb);
    bus.broadcast("chat", "second");
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
      "chat",
      "agent",
      "agent.updated",
      "gateway.health",
      "notification.toast",
    ];
    for (const t of types) {
      const event = bus.broadcast(t, null);
      expect(event.type).toBe(t);
    }
  });

  it("broadcasts canvas events", () => {
    const bus = new EventBus();
    const received: ServerEvent[] = [];
    bus.subscribe((e) => received.push(e));
    bus.broadcast("canvas", { action: "a2ui_push", jsonl: "{}" });
    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("canvas");
    expect((received[0].data as Record<string, unknown>).action).toBe("a2ui_push");
  });
});
