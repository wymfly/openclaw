import { describe, expect, it, vi, beforeEach } from "vitest";
import { EventBus } from "../event-bus.js";
import type { AlertRule } from "../budget-alert-stores.js";

// Mock the webhooks module before importing alert engine
vi.mock("../../src/lib/webhooks.js", () => ({
  fireWebhooks: vi.fn(),
}));

// Mock budget-alert-stores — provide a controllable alert rule list
let mockRules: AlertRule[] = [];
vi.mock("../budget-alert-stores.js", () => ({
  getAlertRuleStore: vi.fn(() => ({
    get: () => mockRules,
    find: (pred: (r: AlertRule) => boolean) => mockRules.find(pred),
    updateItem: vi.fn((pred: (r: AlertRule) => boolean, updater: (r: AlertRule) => AlertRule) => {
      const idx = mockRules.findIndex(pred);
      if (idx >= 0) {
        mockRules[idx] = updater(mockRules[idx]);
      }
      return idx >= 0;
    }),
  })),
}));

import { initAlertEngine } from "../alert-engine.js";
import type { DeckRuntime } from "../runtime.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRule(overrides: Partial<AlertRule> & { id: string }): AlertRule {
  return {
    name: "Test Rule",
    entityType: "usage",
    condition: ">=",
    threshold: 100,
    action: "toast",
    cooldownMs: 300000,
    lastFiredAt: null,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createMockRuntime() {
  const eventBus = new EventBus();
  return {
    runtime: {
      eventBus,
      adapter: {} as DeckRuntime["adapter"],
      gw: {} as DeckRuntime["gw"],
      rateLimiter: {} as DeckRuntime["rateLimiter"],
      capabilities: { status: "ready", reason: null, snapshot: null, ready: Promise.resolve() },
    } as unknown as DeckRuntime,
    eventBus,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("alert-engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRules = [];
  });

  it("should subscribe to EventBus on init", () => {
    const { runtime, eventBus } = createMockRuntime();
    const initialCount = eventBus.subscriberCount;
    initAlertEngine(runtime);
    expect(eventBus.subscriberCount).toBe(initialCount + 1);
  });

  it("should fire alert when event matches rule and exceeds threshold", () => {
    mockRules = [makeRule({ id: "rule-1", name: "High Usage", threshold: 100 })];
    const { runtime, eventBus } = createMockRuntime();
    initAlertEngine(runtime);

    const events: { type: string; data: unknown }[] = [];
    eventBus.subscribe((e) => events.push({ type: e.type, data: e.data }));

    eventBus.broadcast("budget.warn", { value: 150 });

    expect(events.find((e) => e.type === "alert.fired")).toBeDefined();
    expect(events.find((e) => e.type === "notification.toast")).toBeDefined();
    expect(events.find((e) => e.type === "activity.event")).toBeDefined();
  });

  it("should not fire when value is below threshold", () => {
    mockRules = [makeRule({ id: "rule-2", threshold: 100 })];
    const { runtime, eventBus } = createMockRuntime();
    initAlertEngine(runtime);

    const events: { type: string }[] = [];
    eventBus.subscribe((e) => events.push({ type: e.type }));

    eventBus.broadcast("budget.warn", { value: 50 });
    expect(events.find((e) => e.type === "alert.fired")).toBeUndefined();
  });

  it("should respect cooldown period", () => {
    const recentTime = new Date(Date.now() - 1000).toISOString();
    mockRules = [makeRule({ id: "rule-3", condition: ">", threshold: 50, cooldownMs: 300000, lastFiredAt: recentTime })];
    const { runtime, eventBus } = createMockRuntime();
    initAlertEngine(runtime);

    const events: { type: string }[] = [];
    eventBus.subscribe((e) => events.push({ type: e.type }));

    eventBus.broadcast("budget.warn", { value: 200 });
    expect(events.find((e) => e.type === "alert.fired")).toBeUndefined();
  });

  it("should fire after cooldown expires", () => {
    const oldTime = new Date(Date.now() - 600000).toISOString();
    mockRules = [makeRule({ id: "rule-4", condition: ">", threshold: 50, action: "activity", cooldownMs: 300000, lastFiredAt: oldTime })];
    const { runtime, eventBus } = createMockRuntime();
    initAlertEngine(runtime);

    const events: { type: string }[] = [];
    eventBus.subscribe((e) => events.push({ type: e.type }));

    eventBus.broadcast("budget.warn", { value: 200 });
    expect(events.find((e) => e.type === "alert.fired")).toBeDefined();
  });

  it("should ignore events with no matching entity type", () => {
    mockRules = [makeRule({ id: "rule-5", threshold: 50, cooldownMs: 0 })];
    const { runtime, eventBus } = createMockRuntime();
    initAlertEngine(runtime);

    const events: { type: string }[] = [];
    eventBus.subscribe((e) => events.push({ type: e.type }));

    eventBus.broadcast("runtime.status", { value: 999 });
    expect(events.find((e) => e.type === "alert.fired")).toBeUndefined();
  });

  it("should always create activity event regardless of action type", () => {
    mockRules = [makeRule({ id: "rule-6", entityType: "cron", condition: ">", threshold: 10, action: "webhook", cooldownMs: 0 })];
    const { runtime, eventBus } = createMockRuntime();
    initAlertEngine(runtime);

    const events: { type: string; data: unknown }[] = [];
    eventBus.subscribe((e) => events.push({ type: e.type, data: e.data }));

    eventBus.broadcast("cron.run.complete", { value: 15 });
    const activity = events.find((e) => e.type === "activity.event");
    expect(activity).toBeDefined();
  });

  // F11: evaluateCondition tests
  it("should evaluate '>' condition correctly", () => {
    mockRules = [makeRule({ id: "gt-1", condition: ">", threshold: 100, cooldownMs: 0 })];
    const { runtime, eventBus } = createMockRuntime();
    initAlertEngine(runtime);

    const events: { type: string }[] = [];
    eventBus.subscribe((e) => events.push({ type: e.type }));

    eventBus.broadcast("budget.warn", { value: 100 });
    expect(events.filter((e) => e.type === "alert.fired")).toHaveLength(0);

    eventBus.broadcast("budget.warn", { value: 101 });
    expect(events.filter((e) => e.type === "alert.fired")).toHaveLength(1);
  });

  it("should evaluate '<' condition correctly", () => {
    mockRules = [makeRule({ id: "lt-1", condition: "<", threshold: 50, cooldownMs: 0 })];
    const { runtime, eventBus } = createMockRuntime();
    initAlertEngine(runtime);

    const events: { type: string }[] = [];
    eventBus.subscribe((e) => events.push({ type: e.type }));

    eventBus.broadcast("budget.warn", { value: 30 });
    expect(events.filter((e) => e.type === "alert.fired")).toHaveLength(1);
  });

  it("should evaluate '==' condition correctly", () => {
    mockRules = [makeRule({ id: "eq-1", condition: "==", threshold: 42, cooldownMs: 0 })];
    const { runtime, eventBus } = createMockRuntime();
    initAlertEngine(runtime);

    const events: { type: string }[] = [];
    eventBus.subscribe((e) => events.push({ type: e.type }));

    eventBus.broadcast("budget.warn", { value: 42 });
    expect(events.filter((e) => e.type === "alert.fired")).toHaveLength(1);

    eventBus.broadcast("budget.warn", { value: 43 });
    expect(events.filter((e) => e.type === "alert.fired")).toHaveLength(1);
  });

  it("should evaluate '!=' condition correctly", () => {
    mockRules = [makeRule({ id: "ne-1", condition: "!=", threshold: 0, cooldownMs: 0 })];
    const { runtime, eventBus } = createMockRuntime();
    initAlertEngine(runtime);

    const events: { type: string }[] = [];
    eventBus.subscribe((e) => events.push({ type: e.type }));

    eventBus.broadcast("budget.warn", { value: 5 });
    expect(events.filter((e) => e.type === "alert.fired")).toHaveLength(1);
  });

  it("should unsubscribe on cleanup", () => {
    const { runtime, eventBus } = createMockRuntime();
    const initialCount = eventBus.subscriberCount;
    const cleanup = initAlertEngine(runtime);
    expect(eventBus.subscriberCount).toBe(initialCount + 1);
    cleanup();
    expect(eventBus.subscriberCount).toBe(initialCount);
  });
});
