import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { getPendingApprovals, initApprovalBridge } from "../approval-bridge.js";
import { EventBus } from "../event-bus.js";
import type { ServerEvent } from "../event-bus.js";
import type { DeckRuntime } from "../runtime.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockRuntime {
  runtime: DeckRuntime;
  setProjectionMock: ReturnType<typeof vi.fn>;
  clearProjectionMock: ReturnType<typeof vi.fn>;
}

function createMockRuntime(eventBus: EventBus): MockRuntime {
  const chatProjections = new Map<string, Record<string, unknown>>();
  const approvalProjections = new Map<string, Record<string, unknown>>();

  const setProjection = vi.fn((domain: string, key: string, data: Record<string, unknown>) => {
    const map = domain === "approval" ? approvalProjections : chatProjections;
    map.set(key, data);
  });
  const clearProjection = vi.fn((domain: string, key: string) => {
    const map = domain === "approval" ? approvalProjections : chatProjections;
    return map.delete(key);
  });

  // Legacy mocks remain for code paths that still read/write chat projections directly.
  const getChatSessionProjection = vi.fn(
    (sessionKey: string) => chatProjections.get(sessionKey) ?? null,
  );
  const setChatSessionProjection = vi.fn(
    (sessionKey: string, projection: Record<string, unknown>) => {
      chatProjections.set(sessionKey, projection);
    },
  );
  const clearChatSessionProjection = vi.fn((sessionKey: string) =>
    chatProjections.delete(sessionKey),
  );

  return {
    setProjectionMock: setProjection,
    clearProjectionMock: clearProjection,
    runtime: {
      eventBus,
      adapter: {} as DeckRuntime["adapter"],
      gw: {} as DeckRuntime["gw"],
      db: {} as DeckRuntime["db"],
      store: {
        getChatSessionProjection,
        setChatSessionProjection,
        clearChatSessionProjection,
        setProjection,
        clearProjection,
      } as unknown as DeckRuntime["store"],
      rateLimiter: {} as DeckRuntime["rateLimiter"],
      capabilities: {
        status: "ready",
        reason: null,
        snapshot: null,
        ready: Promise.resolve(),
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let bus: EventBus;

beforeEach(() => {
  bus = new EventBus();
  // Clear global pending map
  const GLOBAL_KEY = "__openclawDeckPendingApprovals__";
  const g = globalThis as unknown as Record<string, unknown>;
  g[GLOBAL_KEY] = undefined;
});

describe("initApprovalBridge", () => {
  it("adds pending approval on exec.approval.requested gateway event", () => {
    const { runtime, setProjectionMock } = createMockRuntime(bus);
    initApprovalBridge(runtime);

    const received: ServerEvent[] = [];
    bus.subscribe((e) => {
      if (e.type === "approval.pending") {
        received.push(e);
      }
    });

    // Simulate a gateway.event wrapping exec.approval.requested
    // Gateway nests command/agentId/cwd inside `request`
    bus.broadcast("gateway.event", {
      type: "gateway.event",
      event: "exec.approval.requested",
      payload: {
        id: "apr-1",
        request: {
          command: "rm -rf /",
          agentId: "agent-x",
          sessionKey: "agent:main:main",
          runId: "run-approval-1",
        },
        createdAtMs: 1000,
        expiresAtMs: 2000,
      },
    });

    expect(received).toHaveLength(1);
    expect(received[0].data).toMatchObject({
      id: "apr-1",
      command: "rm -rf /",
      agentId: "agent-x",
      sessionKey: "agent:main:main",
      runId: "run-approval-1",
    });

    // Verify in-memory map
    const pending = getPendingApprovals();
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe("apr-1");
    expect(setProjectionMock).toHaveBeenCalledWith("approval", "agent:main:main", {
      id: "apr-1",
      toolName: "command",
      command: "rm -rf /",
      description: undefined,
    });
  });

  it("removes pending approval on exec.approval.resolved gateway event", () => {
    const { runtime, clearProjectionMock } = createMockRuntime(bus);
    initApprovalBridge(runtime);

    // Add one first
    bus.broadcast("gateway.event", {
      type: "gateway.event",
      event: "exec.approval.requested",
      payload: {
        id: "apr-2",
        request: { command: "echo hello", sessionKey: "session-2" },
        createdAtMs: 1000,
        expiresAtMs: 2000,
      },
    });
    expect(getPendingApprovals()).toHaveLength(1);

    const resolved: ServerEvent[] = [];
    bus.subscribe((e) => {
      if (e.type === "approval.resolved") {
        resolved.push(e);
      }
    });

    // Resolve it
    bus.broadcast("gateway.event", {
      type: "gateway.event",
      event: "exec.approval.resolved",
      payload: { id: "apr-2", decision: "allow-once" },
    });

    expect(resolved).toHaveLength(1);
    expect(getPendingApprovals()).toHaveLength(0);
    expect(clearProjectionMock).toHaveBeenCalledWith("approval", "session-2");
  });

  it("ignores non-approval gateway events", () => {
    const { runtime } = createMockRuntime(bus);
    initApprovalBridge(runtime);

    const received: ServerEvent[] = [];
    bus.subscribe((e) => {
      if (e.type === "approval.pending" || e.type === "approval.resolved") {
        received.push(e);
      }
    });

    bus.broadcast("gateway.event", {
      type: "gateway.event",
      event: "chat.delta",
      payload: { token: "hi" },
    });

    expect(received).toHaveLength(0);
    expect(getPendingApprovals()).toHaveLength(0);
  });

  it("does not add duplicates to pending map", () => {
    const { runtime } = createMockRuntime(bus);
    initApprovalBridge(runtime);

    const payload = {
      type: "gateway.event",
      event: "exec.approval.requested",
      payload: { id: "apr-3", request: { command: "test" }, createdAtMs: 1000, expiresAtMs: 2000 },
    };

    bus.broadcast("gateway.event", payload);
    bus.broadcast("gateway.event", payload);

    // Map deduplicates by ID (Map.set overwrites same key)
    expect(getPendingApprovals()).toHaveLength(1);
  });

  it("ignores events with empty id", () => {
    const { runtime } = createMockRuntime(bus);
    initApprovalBridge(runtime);

    bus.broadcast("gateway.event", {
      type: "gateway.event",
      event: "exec.approval.requested",
      payload: { id: "", request: { command: "test" }, createdAtMs: 1000, expiresAtMs: 2000 },
    });

    expect(getPendingApprovals()).toHaveLength(0);
  });
});

describe("approval projection domain", () => {
  it("writes approval to the approval domain on exec.approval.requested", () => {
    const { runtime, setProjectionMock } = createMockRuntime(bus);
    initApprovalBridge(runtime);

    bus.broadcast("gateway.event", {
      type: "gateway.event",
      event: "exec.approval.requested",
      payload: {
        id: "apr-domain-1",
        request: {
          command: "npm install",
          agentId: "agent-x",
          sessionKey: "agent:main:main",
          runId: "run-1",
          cwd: "/workspace",
        },
        createdAtMs: 1000,
        expiresAtMs: 2000,
      },
    });

    expect(setProjectionMock).toHaveBeenCalledWith("approval", "agent:main:main", {
      id: "apr-domain-1",
      toolName: "command",
      command: "npm install",
      description: "/workspace",
    });
  });

  it("clears approval domain on exec.approval.resolved", () => {
    const { runtime, clearProjectionMock } = createMockRuntime(bus);
    initApprovalBridge(runtime);

    bus.broadcast("gateway.event", {
      type: "gateway.event",
      event: "exec.approval.requested",
      payload: {
        id: "apr-domain-2",
        request: { command: "echo hello", sessionKey: "session-2" },
        createdAtMs: 1000,
        expiresAtMs: 2000,
      },
    });

    bus.broadcast("gateway.event", {
      type: "gateway.event",
      event: "exec.approval.resolved",
      payload: { id: "apr-domain-2", decision: "allow-once" },
    });

    expect(clearProjectionMock).toHaveBeenCalledWith("approval", "session-2");
  });

  it("broadcasts approval.resolved and clears approval projection when a pending approval expires", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-04-05T00:00:00.000Z"));

      const { runtime, clearProjectionMock } = createMockRuntime(bus);
      const cleanup = initApprovalBridge(runtime);

      const resolved: ServerEvent[] = [];
      bus.subscribe((e) => {
        if (e.type === "approval.resolved") {
          resolved.push(e);
        }
      });

      bus.broadcast("gateway.event", {
        type: "gateway.event",
        event: "exec.approval.requested",
        payload: {
          id: "apr-expired-1",
          request: {
            command: "rm -rf /tmp/project",
            sessionKey: "session-expired",
            runId: "run-expired-1",
          },
          createdAtMs: Date.now() - 5_000,
          expiresAtMs: Date.now() - 1_000,
        },
      });

      expect(getPendingApprovals()).toHaveLength(1);

      vi.advanceTimersByTime(30_000);

      expect(getPendingApprovals()).toHaveLength(0);
      expect(clearProjectionMock).toHaveBeenCalledWith("approval", "session-expired");
      expect(resolved).toHaveLength(1);
      expect(resolved[0].data).toMatchObject({
        id: "apr-expired-1",
        sessionKey: "session-expired",
        runId: "run-expired-1",
        reason: "expired",
      });

      cleanup();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("getPendingApprovals", () => {
  it("returns empty array when no approvals exist", () => {
    expect(getPendingApprovals()).toEqual([]);
  });

  it("returns all pending approvals after multiple additions", () => {
    const { runtime } = createMockRuntime(bus);
    initApprovalBridge(runtime);

    for (let i = 1; i <= 3; i++) {
      bus.broadcast("gateway.event", {
        type: "gateway.event",
        event: "exec.approval.requested",
        payload: {
          id: `apr-${i}`,
          request: { command: `cmd-${i}` },
          createdAtMs: 1000,
          expiresAtMs: 2000,
        },
      });
    }

    const pending = getPendingApprovals();
    expect(pending).toHaveLength(3);
    expect(pending.map((p) => p.id).toSorted()).toEqual(["apr-1", "apr-2", "apr-3"]);
  });
});

// ---------------------------------------------------------------------------
// F7: Expiry timer
// ---------------------------------------------------------------------------

describe("F7: expiry timer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("removes expired entries every 30s", () => {
    const { runtime } = createMockRuntime(bus);
    const cleanup = initApprovalBridge(runtime);

    // Add an already-expired approval
    bus.broadcast("gateway.event", {
      type: "gateway.event",
      event: "exec.approval.requested",
      payload: {
        id: "exp-1",
        request: { command: "rm -rf" },
        createdAtMs: Date.now() - 60_000,
        expiresAtMs: Date.now() - 1,
      },
    });

    expect(getPendingApprovals()).toHaveLength(1);

    // Advance timer — expiry check fires
    vi.advanceTimersByTime(30_000);

    expect(getPendingApprovals()).toHaveLength(0);

    cleanup();
  });

  it("does NOT remove non-expired entries", () => {
    const { runtime } = createMockRuntime(bus);
    const cleanup = initApprovalBridge(runtime);

    bus.broadcast("gateway.event", {
      type: "gateway.event",
      event: "exec.approval.requested",
      payload: {
        id: "fresh-1",
        request: { command: "ls" },
        createdAtMs: Date.now(),
        expiresAtMs: Date.now() + 600_000,
      },
    });

    vi.advanceTimersByTime(30_000);
    expect(getPendingApprovals()).toHaveLength(1);

    cleanup();
  });
});

// ---------------------------------------------------------------------------
// F12: Cleanup function
// ---------------------------------------------------------------------------

describe("F12: cleanup function", () => {
  it("initApprovalBridge returns a cleanup function", () => {
    const { runtime } = createMockRuntime(bus);
    const cleanup = initApprovalBridge(runtime);
    expect(typeof cleanup).toBe("function");
  });

  it("cleanup unsubscribes from EventBus", () => {
    const { runtime } = createMockRuntime(bus);
    const initialCount = bus.subscriberCount;
    const cleanup = initApprovalBridge(runtime);
    expect(bus.subscriberCount).toBe(initialCount + 1);
    cleanup();
    expect(bus.subscriberCount).toBe(initialCount);
  });

  it("cleanup stops expiry timer", () => {
    vi.useFakeTimers();
    const { runtime } = createMockRuntime(bus);
    const cleanup = initApprovalBridge(runtime);

    // Add an expired entry
    bus.broadcast("gateway.event", {
      type: "gateway.event",
      event: "exec.approval.requested",
      payload: {
        id: "exp-2",
        request: { command: "test" },
        createdAtMs: Date.now() - 60_000,
        expiresAtMs: Date.now() - 1,
      },
    });

    // Cleanup before timer fires
    cleanup();
    vi.advanceTimersByTime(30_000);

    // Entry should still be there (timer was stopped)
    expect(getPendingApprovals()).toHaveLength(1);

    vi.useRealTimers();
  });
});
