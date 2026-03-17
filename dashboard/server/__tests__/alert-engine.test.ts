import { describe, expect, it, vi, beforeEach } from "vitest";
import { EventBus } from "../event-bus.js";

// Mock the webhooks module before importing alert engine
vi.mock("../../src/lib/webhooks.js", () => ({
  fireWebhooks: vi.fn(),
}));

// We test initAlertEngine by directly importing and calling it
import { initAlertEngine } from "../alert-engine.js";
import type { DeckRuntime } from "../runtime.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal in-memory DB mock. */
function createMockDb(rules: Record<string, unknown>[] = []) {
  const stmts: Record<
    string,
    { all: ReturnType<typeof vi.fn>; run: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> }
  > = {};

  return {
    prepare: vi.fn((sql: string) => {
      if (!stmts[sql]) {
        stmts[sql] = {
          all: vi.fn(() => rules),
          run: vi.fn(() => ({ changes: 1 })),
          get: vi.fn(),
        };
      }
      return stmts[sql];
    }),
    _stmts: stmts,
  };
}

function createMockStore() {
  return {
    appendEvent: vi.fn(),
    getEventsSince: vi.fn(() => []),
    outboxHead: vi.fn(() => 0),
    getSetting: vi.fn(),
    setSetting: vi.fn(),
    deleteSetting: vi.fn(),
    pruneEvents: vi.fn(() => 0),
    close: vi.fn(),
  };
}

function createMockRuntime(rules: Record<string, unknown>[] = []) {
  const db = createMockDb(rules);
  const eventBus = new EventBus();
  const store = createMockStore();

  return {
    runtime: {
      db,
      eventBus,
      store,
      adapter: {} as DeckRuntime["adapter"],
      rateLimiter: {} as DeckRuntime["rateLimiter"],
    } as unknown as DeckRuntime,
    db,
    eventBus,
    store,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("alert-engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should subscribe to EventBus on init", () => {
    const { runtime, eventBus } = createMockRuntime();
    const initialCount = eventBus.subscriberCount;
    initAlertEngine(runtime);
    expect(eventBus.subscriberCount).toBe(initialCount + 1);
  });

  it("should fire alert when event matches rule and exceeds threshold", () => {
    const rules = [
      {
        id: "rule-1",
        name: "High Usage",
        entity_type: "usage",
        condition: "cost > 100",
        threshold: 100,
        action: "toast",
        cooldown_ms: 300000,
        last_fired_at: null,
        enabled: 1,
      },
    ];
    const { runtime, eventBus } = createMockRuntime(rules);
    initAlertEngine(runtime);

    const events: { type: string; data: unknown }[] = [];
    eventBus.subscribe((e) => events.push({ type: e.type, data: e.data }));

    // Broadcast a budget.warn event with value > threshold
    eventBus.broadcast("budget.warn", { value: 150 });

    // Should have: notification.toast + activity.event + alert.fired
    const alertFired = events.find((e) => e.type === "alert.fired");
    expect(alertFired).toBeDefined();

    const toast = events.find((e) => e.type === "notification.toast");
    expect(toast).toBeDefined();

    const activity = events.find((e) => e.type === "activity.event");
    expect(activity).toBeDefined();
  });

  it("should not fire when value is below threshold", () => {
    const rules = [
      {
        id: "rule-2",
        name: "Low Usage Alert",
        entity_type: "usage",
        condition: "cost > 100",
        threshold: 100,
        action: "toast",
        cooldown_ms: 300000,
        last_fired_at: null,
        enabled: 1,
      },
    ];
    const { runtime, eventBus } = createMockRuntime(rules);
    initAlertEngine(runtime);

    const events: { type: string }[] = [];
    eventBus.subscribe((e) => events.push({ type: e.type }));

    eventBus.broadcast("budget.warn", { value: 50 });

    const alertFired = events.find((e) => e.type === "alert.fired");
    expect(alertFired).toBeUndefined();
  });

  it("should respect cooldown period", () => {
    // last_fired_at is very recent (1 second ago)
    const recentTime = new Date(Date.now() - 1000).toISOString();
    const rules = [
      {
        id: "rule-3",
        name: "Cooldown Test",
        entity_type: "usage",
        condition: "cost > 50",
        threshold: 50,
        action: "toast",
        cooldown_ms: 300000,
        last_fired_at: recentTime,
        enabled: 1,
      },
    ];
    const { runtime, eventBus } = createMockRuntime(rules);
    initAlertEngine(runtime);

    const events: { type: string }[] = [];
    eventBus.subscribe((e) => events.push({ type: e.type }));

    eventBus.broadcast("budget.warn", { value: 200 });

    const alertFired = events.find((e) => e.type === "alert.fired");
    expect(alertFired).toBeUndefined();
  });

  it("should fire after cooldown expires", () => {
    // last_fired_at is long ago (10 minutes ago, cooldown is 5 minutes)
    const oldTime = new Date(Date.now() - 600000).toISOString();
    const rules = [
      {
        id: "rule-4",
        name: "Expired Cooldown",
        entity_type: "usage",
        condition: "cost > 50",
        threshold: 50,
        action: "activity",
        cooldown_ms: 300000,
        last_fired_at: oldTime,
        enabled: 1,
      },
    ];
    const { runtime, eventBus } = createMockRuntime(rules);
    initAlertEngine(runtime);

    const events: { type: string }[] = [];
    eventBus.subscribe((e) => events.push({ type: e.type }));

    eventBus.broadcast("budget.warn", { value: 200 });

    const alertFired = events.find((e) => e.type === "alert.fired");
    expect(alertFired).toBeDefined();
  });

  it("should ignore events with no matching entity type", () => {
    const rules = [
      {
        id: "rule-5",
        name: "Usage Only",
        entity_type: "usage",
        condition: "cost > 50",
        threshold: 50,
        action: "toast",
        cooldown_ms: 0,
        last_fired_at: null,
        enabled: 1,
      },
    ];
    const { runtime, eventBus } = createMockRuntime(rules);
    initAlertEngine(runtime);

    const events: { type: string }[] = [];
    eventBus.subscribe((e) => events.push({ type: e.type }));

    // runtime.status has no entity type mapping, should be ignored
    eventBus.broadcast("runtime.status", { value: 999 });

    const alertFired = events.find((e) => e.type === "alert.fired");
    expect(alertFired).toBeUndefined();
  });

  it("should always create activity event regardless of action type", () => {
    const rules = [
      {
        id: "rule-6",
        name: "Webhook Alert",
        entity_type: "cron",
        condition: "runs > 10",
        threshold: 10,
        action: "webhook",
        cooldown_ms: 0,
        last_fired_at: null,
        enabled: 1,
      },
    ];
    const { runtime, eventBus, store } = createMockRuntime(rules);
    initAlertEngine(runtime);

    eventBus.broadcast("cron.run.complete", { value: 15 });

    // Should persist activity event
    expect(store.appendEvent).toHaveBeenCalledWith(
      "activity.event",
      expect.objectContaining({ type: "alert" }),
    );
  });

  // F11: evaluateCondition tests
  it("should evaluate '>' condition correctly", () => {
    const rules = [
      {
        id: "gt-1",
        name: "Greater Than",
        entity_type: "usage",
        condition: ">",
        threshold: 100,
        action: "toast",
        cooldown_ms: 0,
        last_fired_at: null,
        enabled: 1,
      },
    ];
    const { runtime, eventBus } = createMockRuntime(rules);
    initAlertEngine(runtime);

    const events: { type: string }[] = [];
    eventBus.subscribe((e) => events.push({ type: e.type }));

    // Value 100 should NOT fire (not strictly greater)
    eventBus.broadcast("budget.warn", { value: 100 });
    expect(events.filter((e) => e.type === "alert.fired")).toHaveLength(0);

    // Value 101 should fire
    eventBus.broadcast("budget.warn", { value: 101 });
    expect(events.filter((e) => e.type === "alert.fired")).toHaveLength(1);
  });

  it("should evaluate '<' condition correctly", () => {
    const rules = [
      {
        id: "lt-1",
        name: "Less Than",
        entity_type: "usage",
        condition: "<",
        threshold: 50,
        action: "toast",
        cooldown_ms: 0,
        last_fired_at: null,
        enabled: 1,
      },
    ];
    const { runtime, eventBus } = createMockRuntime(rules);
    initAlertEngine(runtime);

    const events: { type: string }[] = [];
    eventBus.subscribe((e) => events.push({ type: e.type }));

    eventBus.broadcast("budget.warn", { value: 30 });
    expect(events.filter((e) => e.type === "alert.fired")).toHaveLength(1);
  });

  it("should evaluate '==' condition correctly", () => {
    const rules = [
      {
        id: "eq-1",
        name: "Equal",
        entity_type: "usage",
        condition: "==",
        threshold: 42,
        action: "toast",
        cooldown_ms: 0,
        last_fired_at: null,
        enabled: 1,
      },
    ];
    const { runtime, eventBus } = createMockRuntime(rules);
    initAlertEngine(runtime);

    const events: { type: string }[] = [];
    eventBus.subscribe((e) => events.push({ type: e.type }));

    eventBus.broadcast("budget.warn", { value: 42 });
    expect(events.filter((e) => e.type === "alert.fired")).toHaveLength(1);

    eventBus.broadcast("budget.warn", { value: 43 });
    // Should still be 1 (second event didn't match)
    expect(events.filter((e) => e.type === "alert.fired")).toHaveLength(1);
  });

  it("should evaluate '!=' condition correctly", () => {
    const rules = [
      {
        id: "ne-1",
        name: "Not Equal",
        entity_type: "usage",
        condition: "!=",
        threshold: 0,
        action: "toast",
        cooldown_ms: 0,
        last_fired_at: null,
        enabled: 1,
      },
    ];
    const { runtime, eventBus } = createMockRuntime(rules);
    initAlertEngine(runtime);

    const events: { type: string }[] = [];
    eventBus.subscribe((e) => events.push({ type: e.type }));

    eventBus.broadcast("budget.warn", { value: 5 });
    expect(events.filter((e) => e.type === "alert.fired")).toHaveLength(1);
  });

  it("should default to >= for unrecognized conditions (backward compat)", () => {
    const rules = [
      {
        id: "compat-1",
        name: "Legacy Condition",
        entity_type: "usage",
        condition: "cost > 100",
        threshold: 100,
        action: "toast",
        cooldown_ms: 0,
        last_fired_at: null,
        enabled: 1,
      },
    ];
    const { runtime, eventBus } = createMockRuntime(rules);
    initAlertEngine(runtime);

    const events: { type: string }[] = [];
    eventBus.subscribe((e) => events.push({ type: e.type }));

    eventBus.broadcast("budget.warn", { value: 100 });
    // 100 >= 100 should fire with default behavior
    expect(events.filter((e) => e.type === "alert.fired")).toHaveLength(1);
  });

  // F12: cleanup function
  it("initAlertEngine returns a cleanup function", () => {
    const { runtime } = createMockRuntime();
    const cleanup = initAlertEngine(runtime);
    expect(typeof cleanup).toBe("function");
  });

  it("cleanup unsubscribes from EventBus", () => {
    const { runtime, eventBus } = createMockRuntime();
    const initialCount = eventBus.subscriberCount;
    const cleanup = initAlertEngine(runtime);
    expect(eventBus.subscriberCount).toBe(initialCount + 1);
    cleanup();
    expect(eventBus.subscriberCount).toBe(initialCount);
  });

  it("should update last_fired_at in DB when alert fires", () => {
    const rules = [
      {
        id: "rule-7",
        name: "DB Update Test",
        entity_type: "usage",
        condition: "cost > 10",
        threshold: 10,
        action: "toast",
        cooldown_ms: 0,
        last_fired_at: null,
        enabled: 1,
      },
    ];
    const { runtime, eventBus, db } = createMockRuntime(rules);
    initAlertEngine(runtime);

    eventBus.broadcast("budget.warn", { value: 20 });

    // Check that db.prepare was called with an UPDATE query
    const updateCalls = db.prepare.mock.calls.filter(
      (call: string[]) => typeof call[0] === "string" && call[0].includes("UPDATE alert_rules"),
    );
    expect(updateCalls.length).toBeGreaterThan(0);
  });
});
