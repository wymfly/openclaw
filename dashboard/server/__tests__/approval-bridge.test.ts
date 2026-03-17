import { describe, it, expect, beforeEach } from "vitest";
import { getPendingApprovals, initApprovalBridge } from "../approval-bridge.js";
import { EventBus } from "../event-bus.js";
import type { ServerEvent } from "../event-bus.js";
import type { DeckRuntime } from "../runtime.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockRuntime(eventBus: EventBus): DeckRuntime {
  return {
    eventBus,
    adapter: {} as DeckRuntime["adapter"],
    db: {} as DeckRuntime["db"],
    store: {} as DeckRuntime["store"],
    rateLimiter: {} as DeckRuntime["rateLimiter"],
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
    const runtime = createMockRuntime(bus);
    initApprovalBridge(runtime);

    const received: ServerEvent[] = [];
    bus.subscribe((e) => {
      if (e.type === "approval.pending") {
        received.push(e);
      }
    });

    // Simulate a gateway.event wrapping exec.approval.requested
    bus.broadcast("gateway.event", {
      type: "gateway.event",
      event: "exec.approval.requested",
      payload: {
        id: "apr-1",
        command: "rm -rf /",
        agentId: "agent-x",
        createdAtMs: 1000,
        expiresAtMs: 2000,
      },
    });

    expect(received).toHaveLength(1);
    expect(received[0].data).toMatchObject({
      id: "apr-1",
      command: "rm -rf /",
      agentId: "agent-x",
    });

    // Verify in-memory map
    const pending = getPendingApprovals();
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe("apr-1");
  });

  it("removes pending approval on exec.approval.resolved gateway event", () => {
    const runtime = createMockRuntime(bus);
    initApprovalBridge(runtime);

    // Add one first
    bus.broadcast("gateway.event", {
      type: "gateway.event",
      event: "exec.approval.requested",
      payload: { id: "apr-2", command: "echo hello", createdAtMs: 1000, expiresAtMs: 2000 },
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
  });

  it("ignores non-approval gateway events", () => {
    const runtime = createMockRuntime(bus);
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
    const runtime = createMockRuntime(bus);
    initApprovalBridge(runtime);

    const payload = {
      type: "gateway.event",
      event: "exec.approval.requested",
      payload: { id: "apr-3", command: "test", createdAtMs: 1000, expiresAtMs: 2000 },
    };

    bus.broadcast("gateway.event", payload);
    bus.broadcast("gateway.event", payload);

    // Map deduplicates by ID (Map.set overwrites same key)
    expect(getPendingApprovals()).toHaveLength(1);
  });

  it("ignores events with empty id", () => {
    const runtime = createMockRuntime(bus);
    initApprovalBridge(runtime);

    bus.broadcast("gateway.event", {
      type: "gateway.event",
      event: "exec.approval.requested",
      payload: { id: "", command: "test", createdAtMs: 1000, expiresAtMs: 2000 },
    });

    expect(getPendingApprovals()).toHaveLength(0);
  });
});

describe("getPendingApprovals", () => {
  it("returns empty array when no approvals exist", () => {
    expect(getPendingApprovals()).toEqual([]);
  });

  it("returns all pending approvals after multiple additions", () => {
    const runtime = createMockRuntime(bus);
    initApprovalBridge(runtime);

    for (let i = 1; i <= 3; i++) {
      bus.broadcast("gateway.event", {
        type: "gateway.event",
        event: "exec.approval.requested",
        payload: { id: `apr-${i}`, command: `cmd-${i}`, createdAtMs: 1000, expiresAtMs: 2000 },
      });
    }

    const pending = getPendingApprovals();
    expect(pending).toHaveLength(3);
    expect(pending.map((p) => p.id).toSorted()).toEqual(["apr-1", "apr-2", "apr-3"]);
  });
});
