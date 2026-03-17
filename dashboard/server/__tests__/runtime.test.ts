import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock infrastructure modules BEFORE importing runtime
// ---------------------------------------------------------------------------

// Mock gateway-adapter
const mockAdapterStart = vi.fn().mockResolvedValue(undefined);
const mockAdapterStop = vi.fn().mockResolvedValue(undefined);
let capturedOnDomainEvent: ((event: unknown) => void) | undefined;
let capturedLoadSettings: (() => unknown) | undefined;

vi.mock("../gateway-adapter.js", () => {
  const OpenClawGatewayAdapter = vi.fn(function (
    this: Record<string, unknown>,
    opts: Record<string, unknown>,
  ) {
    capturedOnDomainEvent = opts.onDomainEvent as (event: unknown) => void;
    capturedLoadSettings = opts.loadSettings as () => unknown;
    this.start = mockAdapterStart;
    this.stop = mockAdapterStop;
    this.getStatus = () => "connected";
  });
  return { OpenClawGatewayAdapter };
});

// Mock db — return a minimal fake DB
const fakeDb = { close: vi.fn() };
vi.mock("../db.js", () => ({
  getDb: vi.fn(() => fakeDb),
}));

// Mock projection-store — must use `function` for `new` invocation
const mockGetSetting = vi.fn().mockReturnValue(undefined);
vi.mock("../projection-store.js", () => {
  // eslint-disable-next-line @typescript-eslint/no-extraneous-class
  const ProjectionStore = vi.fn(function (this: Record<string, unknown>) {
    this.getSetting = mockGetSetting;
    this.setSetting = vi.fn();
    this.appendEvent = vi.fn();
    this.outboxHead = vi.fn().mockReturnValue(0);
  });
  return { ProjectionStore };
});

// Mock event-bus — use a real-ish EventBus so we can verify broadcasts
const mockBroadcast = vi.fn();
const mockEventBus = {
  broadcast: mockBroadcast,
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  getEventsSince: vi.fn().mockReturnValue([]),
  subscriberCount: 0,
};
vi.mock("../event-bus.js", () => ({
  EventBus: vi.fn(),
  getEventBus: vi.fn(() => mockEventBus),
}));

// Mock rate-limit
const mockDispose = vi.fn();
const mockCheckLimit = vi.fn().mockReturnValue({ allowed: true, remaining: 59, resetAt: 0 });
vi.mock("../rate-limit.js", () => ({
  createRateLimiter: vi.fn(() => ({ checkLimit: mockCheckLimit, dispose: mockDispose })),
}));

// ---------------------------------------------------------------------------
// Import runtime (after mocks are set up)
// ---------------------------------------------------------------------------

import { getRuntime, initRuntime, shutdownRuntime } from "../runtime.js";

// ---------------------------------------------------------------------------
// Global key for cleanup
// ---------------------------------------------------------------------------

const GLOBAL_KEY = "__openclawDeckRuntime__";

function clearRuntimeSingleton(): void {
  const g = globalThis as unknown as Record<string, unknown>;
  delete g[GLOBAL_KEY];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Server Runtime Singleton", () => {
  beforeEach(() => {
    clearRuntimeSingleton();
    vi.clearAllMocks();
    capturedOnDomainEvent = undefined;
    capturedLoadSettings = undefined;
    // Clear env vars
    delete process.env.DECK_GATEWAY_URL;
    delete process.env.DECK_GATEWAY_TOKEN;
  });

  afterEach(async () => {
    await shutdownRuntime();
    clearRuntimeSingleton();
  });

  // -----------------------------------------------------------------------
  // initRuntime assembles all components
  // -----------------------------------------------------------------------

  it("initRuntime correctly assembles all components", () => {
    process.env.DECK_GATEWAY_URL = "ws://localhost:18789";
    process.env.DECK_GATEWAY_TOKEN = "test-token";

    const runtime = initRuntime();

    expect(runtime).not.toBeNull();
    expect(runtime!.adapter).toBeDefined();
    expect(runtime!.eventBus).toBe(mockEventBus);
    expect(runtime!.db).toBe(fakeDb);
    expect(runtime!.store).toBeDefined();
    expect(runtime!.rateLimiter).toBeDefined();
    expect(runtime!.rateLimiter.checkLimit).toBe(mockCheckLimit);

    // Adapter.start should have been called
    expect(mockAdapterStart).toHaveBeenCalledOnce();
  });

  // -----------------------------------------------------------------------
  // getRuntime returns the same singleton
  // -----------------------------------------------------------------------

  it("getRuntime returns singleton (same reference)", () => {
    process.env.DECK_GATEWAY_URL = "ws://localhost:18789";
    process.env.DECK_GATEWAY_TOKEN = "test-token";

    const first = initRuntime();
    const second = getRuntime();

    expect(first).not.toBeNull();
    expect(second).toBe(first);
  });

  // -----------------------------------------------------------------------
  // Gateway events bridge to EventBus
  // -----------------------------------------------------------------------

  it("gateway domain events are bridged to EventBus", () => {
    process.env.DECK_GATEWAY_URL = "ws://localhost:18789";
    process.env.DECK_GATEWAY_TOKEN = "test-token";

    initRuntime();

    expect(capturedOnDomainEvent).toBeDefined();

    // Simulate a gateway event
    const domainEvent = {
      type: "gateway.event" as const,
      event: "chat.delta",
      seq: 1,
      connectionEpoch: "epoch-1",
      payload: { text: "hello" },
      asOf: new Date().toISOString(),
    };

    capturedOnDomainEvent!(domainEvent);

    expect(mockBroadcast).toHaveBeenCalledOnce();
    expect(mockBroadcast).toHaveBeenCalledWith("gateway.event", domainEvent);
  });

  it("runtime.status events are bridged to EventBus", () => {
    process.env.DECK_GATEWAY_URL = "ws://localhost:18789";
    process.env.DECK_GATEWAY_TOKEN = "test-token";

    initRuntime();

    const statusEvent = {
      type: "runtime.status" as const,
      status: "connected" as const,
      reason: null,
      asOf: new Date().toISOString(),
    };

    capturedOnDomainEvent!(statusEvent);

    expect(mockBroadcast).toHaveBeenCalledWith("runtime.status", statusEvent);
  });

  // -----------------------------------------------------------------------
  // getRuntime returns null when not initialized and no settings
  // -----------------------------------------------------------------------

  it("getRuntime returns null when no gateway settings available", () => {
    // No env vars, no DB settings
    mockGetSetting.mockReturnValue(undefined);

    const runtime = getRuntime();

    expect(runtime).toBeNull();
  });

  // -----------------------------------------------------------------------
  // initRuntime returns null without gateway settings
  // -----------------------------------------------------------------------

  it("initRuntime returns null without gateway URL/token", () => {
    const runtime = initRuntime();
    expect(runtime).toBeNull();
  });

  it("initRuntime returns null with only URL (no token)", () => {
    process.env.DECK_GATEWAY_URL = "ws://localhost:18789";
    const runtime = initRuntime();
    expect(runtime).toBeNull();
  });

  // -----------------------------------------------------------------------
  // initRuntime reads settings from explicit params
  // -----------------------------------------------------------------------

  it("initRuntime accepts explicit settings", () => {
    const runtime = initRuntime({
      gatewayUrl: "ws://localhost:18789",
      gatewayToken: "explicit-token",
    });

    expect(runtime).not.toBeNull();
    expect(mockAdapterStart).toHaveBeenCalledOnce();
  });

  // -----------------------------------------------------------------------
  // initRuntime reads gateway settings from DB via ProjectionStore
  // -----------------------------------------------------------------------

  it("initRuntime falls back to DB settings", () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === "gateway_url") {
        return "ws://from-db:18789";
      }
      if (key === "gateway_token") {
        return "db-token";
      }
      return undefined;
    });

    const runtime = initRuntime();

    expect(runtime).not.toBeNull();
  });

  // -----------------------------------------------------------------------
  // shutdownRuntime cleans up resources
  // -----------------------------------------------------------------------

  it("shutdownRuntime stops adapter and disposes rate limiter", async () => {
    process.env.DECK_GATEWAY_URL = "ws://localhost:18789";
    process.env.DECK_GATEWAY_TOKEN = "test-token";

    initRuntime();

    await shutdownRuntime();

    expect(mockAdapterStop).toHaveBeenCalledOnce();
    expect(mockDispose).toHaveBeenCalledOnce();

    // Singleton should be cleared
    const g = globalThis as unknown as Record<string, unknown>;
    expect(g[GLOBAL_KEY]).toBeUndefined();
  });

  it("shutdownRuntime is safe to call when no runtime exists", async () => {
    // Should not throw
    await shutdownRuntime();
    expect(mockAdapterStop).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // loadSettings callback re-resolves on each call
  // -----------------------------------------------------------------------

  it("loadSettings callback re-resolves settings on reconnect", () => {
    process.env.DECK_GATEWAY_URL = "ws://localhost:18789";
    process.env.DECK_GATEWAY_TOKEN = "test-token";

    initRuntime();

    expect(capturedLoadSettings).toBeDefined();

    // First call
    const settings1 = capturedLoadSettings!();
    expect(settings1).toEqual({ url: "ws://localhost:18789", token: "test-token" });

    // Simulate env change
    process.env.DECK_GATEWAY_URL = "ws://localhost:9999";
    const settings2 = capturedLoadSettings!();
    expect(settings2).toEqual({ url: "ws://localhost:9999", token: "test-token" });
  });

  // -----------------------------------------------------------------------
  // Repeated initRuntime returns existing singleton
  // -----------------------------------------------------------------------

  it("initRuntime returns existing singleton on second call", () => {
    process.env.DECK_GATEWAY_URL = "ws://localhost:18789";
    process.env.DECK_GATEWAY_TOKEN = "test-token";

    const first = initRuntime();
    const second = initRuntime();

    expect(first).toBe(second);
    // Adapter should only be started once
    expect(mockAdapterStart).toHaveBeenCalledOnce();
  });
});
