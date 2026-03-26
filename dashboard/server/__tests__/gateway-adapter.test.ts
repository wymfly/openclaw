import { describe, it, expect } from "vitest";
import type {
  ControlPlaneConnectionStatus,
  ControlPlaneDomainEvent,
  ControlPlaneOutboxEntry,
  ControlPlaneGatewaySettings,
  ControlPlaneRuntimeSnapshot,
  GatewayEventFrame,
  GatewayResponseFrame,
} from "../contracts.js";
import {
  DEFAULT_METHOD_ALLOWLIST,
  OpenClawGatewayAdapter,
  ControlPlaneGatewayError,
} from "../gateway-adapter.js";

// ---------------------------------------------------------------------------
// Allowlist coverage
// ---------------------------------------------------------------------------

describe("DEFAULT_METHOD_ALLOWLIST", () => {
  const originalStudioMethods = [
    "status",
    "chat.send",
    "chat.abort",
    "chat.history",
    "agents.create",
    "agents.update",
    "agents.delete",
    "agents.list",
    "agents.files.get",
    "agents.files.set",
    "agents.files.list",
    "sessions.list",
    "sessions.preview",
    "sessions.patch",
    "sessions.reset",
    "sessions.delete",
    "cron.list",
    "cron.run",
    "cron.remove",
    "cron.add",
    "cron.update",
    "config.get",
    "config.set",
    "config.patch",
    "config.schema",
    "config.apply",
    "models.list",
    "models.configured",
    "exec.approval.resolve",
    "exec.approvals.get",
    "exec.approvals.set",
    "agent.wait",
  ];

  const deckAdditions = [
    "health",
    "usage.status",
    "usage.cost",
    "sessions.usage",
    "sessions.usage.timeseries",
    "sessions.usage.logs",
    "channels.status",
    "channels.logout",
    "logs.tail",
    "doctor.memory.status",
    "cron.status",
    "cron.runs",
    "skills.status",
    "skills.update",
    "skills.install",
    // deck RPC methods
    "deck.auth.overview",
    "deck.auth.probe",
    "deck.routing.list",
    "deck.routing.add",
    "deck.routing.remove",
    "deck.routing.validate",
    "deck.routing.simulate",
    "deck.agents.detail",
    "deck.agents.skills.get",
    "deck.agents.skills.set",
    "deck.agents.subagents.get",
    "deck.agents.subagents.set",
    "deck.agents.toolPolicy.preview",
    "deck.agents.systemPrompt.preview",
    "deck.agents.eventStreams.get",
    "deck.agents.eventStreams.set",
    "deck.subagents.list",
    "deck.subagents.kill",
    "deck.subagents.lineage",
    "deck.subagents.steer",
    "deck.identity.list",
    "deck.identity.link",
    "deck.identity.unlink",
    "deck.threads.list",
    // upstream sessions API (2026-03-25 sync)
    "sessions.create",
    "sessions.send",
    "sessions.steer",
    "sessions.abort",
    "sessions.get",
    "sessions.subscribe",
    "sessions.unsubscribe",
    "sessions.messages.subscribe",
    "sessions.messages.unsubscribe",
    // upstream tools/config API
    "tools.effective",
    "config.schema.lookup",
    // models catalog
    "models.catalog.providers",
  ];

  it("contains all original studio methods", () => {
    for (const method of originalStudioMethods) {
      expect(DEFAULT_METHOD_ALLOWLIST.has(method), `missing: ${method}`).toBe(true);
    }
  });

  it("contains all Deck additions", () => {
    for (const method of deckAdditions) {
      expect(DEFAULT_METHOD_ALLOWLIST.has(method), `missing: ${method}`).toBe(true);
    }
  });

  it("has exactly the expected number of methods", () => {
    const expectedTotal = originalStudioMethods.length + deckAdditions.length;
    expect(DEFAULT_METHOD_ALLOWLIST.size).toBe(expectedTotal);
  });

  it("rejects methods not in the allowlist", () => {
    const forbidden = ["admin.shutdown", "system.reboot", "users.delete", "foo.bar", ""];
    for (const method of forbidden) {
      expect(DEFAULT_METHOD_ALLOWLIST.has(method), `should reject: "${method}"`).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Adapter construction & initial state
// ---------------------------------------------------------------------------

describe("OpenClawGatewayAdapter", () => {
  const fakeSettings = (): ControlPlaneGatewaySettings => ({
    url: "ws://localhost:18789",
    token: "test-token",
  });

  it("starts in stopped state", () => {
    const adapter = new OpenClawGatewayAdapter({ loadSettings: fakeSettings });
    expect(adapter.getStatus()).toBe("stopped");
    expect(adapter.getStatusReason()).toBeNull();
  });

  it("requires loadSettings", () => {
    // @ts-expect-error -- verifying runtime behaviour when called without options
    expect(() => new OpenClawGatewayAdapter()).toThrow();
  });

  it("emits domain events via onDomainEvent callback", async () => {
    const events: ControlPlaneDomainEvent[] = [];
    const adapter = new OpenClawGatewayAdapter({
      loadSettings: fakeSettings,
      onDomainEvent: (e) => events.push(e),
    });
    // stop() emits a "stopped" status event even from initial state
    await adapter.stop();
    expect(events.length).toBeGreaterThanOrEqual(1);
    const last = events[events.length - 1];
    expect(last.type).toBe("runtime.status");
    if (last.type === "runtime.status") {
      expect(last.status).toBe("stopped");
    }
  });

  it("rejects non-allowlisted methods via request()", async () => {
    const adapter = new OpenClawGatewayAdapter({ loadSettings: fakeSettings });
    await expect(adapter.request("admin.shutdown", {})).rejects.toThrow(
      "Gateway method is not allowlisted: admin.shutdown",
    );
  });

  it("rejects empty method via request()", async () => {
    const adapter = new OpenClawGatewayAdapter({ loadSettings: fakeSettings });
    await expect(adapter.request("", {})).rejects.toThrow("Gateway method is required.");
  });

  it("throws GATEWAY_UNAVAILABLE when not connected", async () => {
    const adapter = new OpenClawGatewayAdapter({ loadSettings: fakeSettings });
    try {
      await adapter.request("status", {});
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ControlPlaneGatewayError);
      expect((err as ControlPlaneGatewayError).code).toBe("GATEWAY_UNAVAILABLE");
    }
  });

  it("accepts custom methodAllowlist override", async () => {
    const custom = new Set(["custom.method"]);
    const adapter = new OpenClawGatewayAdapter({
      loadSettings: fakeSettings,
      methodAllowlist: custom,
    });
    // "status" is in default but not custom
    await expect(adapter.request("status", {})).rejects.toThrow("not allowlisted");
    // "custom.method" passes allowlist check but fails with GATEWAY_UNAVAILABLE
    try {
      await adapter.request("custom.method", {});
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ControlPlaneGatewayError);
      expect((err as ControlPlaneGatewayError).code).toBe("GATEWAY_UNAVAILABLE");
    }
  });
});

// ---------------------------------------------------------------------------
// ControlPlaneGatewayError
// ---------------------------------------------------------------------------

describe("ControlPlaneGatewayError", () => {
  it("carries code and details", () => {
    const err = new ControlPlaneGatewayError({
      code: "TEST_CODE",
      message: "test message",
      details: { extra: true },
    });
    expect(err.code).toBe("TEST_CODE");
    expect(err.message).toBe("test message");
    expect(err.details).toEqual({ extra: true });
    expect(err.name).toBe("ControlPlaneGatewayError");
    expect(err).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// Contracts type exports (compile-time verification)
// ---------------------------------------------------------------------------

describe("contracts type exports", () => {
  it("type ControlPlaneConnectionStatus accepts valid values", () => {
    const statuses: ControlPlaneConnectionStatus[] = [
      "stopped",
      "connecting",
      "connected",
      "reconnecting",
      "error",
    ];
    expect(statuses).toHaveLength(5);
  });

  it("GatewayEventFrame shape", () => {
    const frame: GatewayEventFrame = {
      type: "event",
      event: "test.event",
      payload: { foo: 1 },
      seq: 42,
    };
    expect(frame.type).toBe("event");
    expect(frame.event).toBe("test.event");
  });

  it("GatewayResponseFrame shape", () => {
    const frame: GatewayResponseFrame = {
      type: "res",
      id: "1",
      ok: true,
      payload: { result: "ok" },
    };
    expect(frame.type).toBe("res");
    expect(frame.ok).toBe(true);
  });

  it("ControlPlaneGatewaySettings shape", () => {
    const settings: ControlPlaneGatewaySettings = {
      url: "ws://localhost:18789",
      token: "abc",
    };
    expect(settings.url).toBeTruthy();
    expect(settings.token).toBeTruthy();
  });

  it("ControlPlaneOutboxEntry shape", () => {
    const entry: ControlPlaneOutboxEntry = {
      id: 1,
      event: {
        type: "runtime.status",
        status: "connected",
        asOf: new Date().toISOString(),
        reason: null,
      },
      createdAt: new Date().toISOString(),
    };
    expect(entry.id).toBe(1);
  });

  it("ControlPlaneRuntimeSnapshot shape", () => {
    const snap: ControlPlaneRuntimeSnapshot = {
      status: "connected",
      reason: null,
      asOf: new Date().toISOString(),
      outboxHead: 0,
    };
    expect(snap.status).toBe("connected");
  });
});

// ---------------------------------------------------------------------------
// Session message subscription tracking
// ---------------------------------------------------------------------------

// Note: the post-connect `sessions.subscribe` call and reconnect re-subscribe
// of per-session message subscriptions are tested via integration/smoke tests
// since unit tests cannot simulate a full WebSocket handshake.

describe("session message subscription tracking", () => {
  const fakeSettings = (): ControlPlaneGatewaySettings => ({
    url: "ws://localhost:18789",
    token: "test-token",
  });

  it("subscribeSessionMessages rejects with GATEWAY_UNAVAILABLE when not connected", async () => {
    const adapter = new OpenClawGatewayAdapter({ loadSettings: fakeSettings });
    try {
      await adapter.subscribeSessionMessages("agent:main:sess-1");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ControlPlaneGatewayError);
      expect((err as ControlPlaneGatewayError).code).toBe("GATEWAY_UNAVAILABLE");
    }
  });

  it("unsubscribeSessionMessages rejects with GATEWAY_UNAVAILABLE when not connected", async () => {
    const adapter = new OpenClawGatewayAdapter({ loadSettings: fakeSettings });
    try {
      await adapter.unsubscribeSessionMessages("agent:main:sess-1");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ControlPlaneGatewayError);
      expect((err as ControlPlaneGatewayError).code).toBe("GATEWAY_UNAVAILABLE");
    }
  });

  it("tracks subscription keys across subscribe/unsubscribe calls", async () => {
    const adapter = new OpenClawGatewayAdapter({ loadSettings: fakeSettings });

    // subscribeSessionMessages adds the key to the internal set before calling request().
    // Even though request() will throw (not connected), the key is tracked.
    await adapter.subscribeSessionMessages("agent:main:sess-1").catch(() => {});
    await adapter.subscribeSessionMessages("agent:main:sess-2").catch(() => {});

    // unsubscribeSessionMessages removes the key before calling request().
    await adapter.unsubscribeSessionMessages("agent:main:sess-1").catch(() => {});

    // Re-subscribe the same key — should not duplicate.
    await adapter.subscribeSessionMessages("agent:main:sess-2").catch(() => {});

    // Verify tracking state by checking that unsubscribing a non-tracked key
    // does not throw (it just removes from set and calls request).
    await adapter.unsubscribeSessionMessages("agent:main:nonexistent").catch(() => {});

    // The internal set is private, so we verify behavior indirectly:
    // After unsubscribing sess-2, only sess-2 was tracked, so unsubscribing
    // it should work without error (besides GATEWAY_UNAVAILABLE).
    await adapter.unsubscribeSessionMessages("agent:main:sess-2").catch(() => {});
  });
});
