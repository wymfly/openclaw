import { describe, it, expect, vi } from "vitest";
import {
  SubscriptionManager,
  classifyError,
  computeReconnectDelay,
  type SubscriptionManagerOptions,
  type SubscriptionError,
  type SubscriptionState,
} from "../subscription-manager";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockSendRpc() {
  return vi.fn((_method: string, _params: Record<string, unknown>) =>
    Promise.resolve(undefined as unknown),
  );
}

function createManager(
  overrides?: Partial<{
    sendRpc: ReturnType<typeof createMockSendRpc>;
    maxConsecutiveFailures: number;
  }>,
) {
  const sendRpc = overrides?.sendRpc ?? createMockSendRpc();
  const onStateChange = vi.fn<(state: SubscriptionState, prev: SubscriptionState) => void>();
  const onFatal = vi.fn<(error: SubscriptionError) => void>();
  const onReconnectScheduled = vi.fn<(delayMs: number) => void>();
  const mgr = new SubscriptionManager({
    sendRpc,
    onStateChange: onStateChange as SubscriptionManagerOptions["onStateChange"],
    onFatal: onFatal as SubscriptionManagerOptions["onFatal"],
    onReconnectScheduled:
      onReconnectScheduled as SubscriptionManagerOptions["onReconnectScheduled"],
    maxConsecutiveFailures: overrides?.maxConsecutiveFailures ?? 5,
  });
  return { mgr, sendRpc, onStateChange, onFatal, onReconnectScheduled };
}

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

describe("SubscriptionManager — state machine", () => {
  it("starts in IDLE state", () => {
    const { mgr } = createManager();
    expect(mgr.state).toBe("IDLE");
  });

  it("transitions IDLE → CONNECTING on connect()", () => {
    const { mgr, onStateChange } = createManager();
    mgr.connect();
    expect(mgr.state).toBe("CONNECTING");
    expect(onStateChange).toHaveBeenCalledWith("CONNECTING", "IDLE");
  });

  it("transitions CONNECTING → ACTIVE on handleOpen()", () => {
    const { mgr, onStateChange } = createManager();
    mgr.connect();
    mgr.handleOpen();
    expect(mgr.state).toBe("ACTIVE");
    expect(onStateChange).toHaveBeenCalledWith("ACTIVE", "CONNECTING");
  });

  it("resets consecutive failures on handleOpen()", () => {
    const { mgr } = createManager();
    mgr.connect();
    // Simulate a transient error to bump failure count
    mgr.handleClose(1006, "abnormal");
    expect(mgr.failures).toBe(1);
    // Reconnect and open
    mgr.connect();
    mgr.handleOpen();
    expect(mgr.failures).toBe(0);
  });

  it("transitions ACTIVE → RECONNECTING on transient close", () => {
    const { mgr, onStateChange } = createManager();
    mgr.connect();
    mgr.handleOpen();
    mgr.handleClose(1006, "abnormal");
    expect(mgr.state).toBe("RECONNECTING");
    expect(onStateChange).toHaveBeenCalledWith("RECONNECTING", "ACTIVE");
  });

  it("transitions to ERROR on fatal error", () => {
    const { mgr, onFatal } = createManager();
    mgr.connect();
    mgr.handleOpen();
    mgr.handleError(Object.assign(new Error("not found"), { code: "METHOD_NOT_FOUND" }));
    expect(mgr.state).toBe("ERROR");
    expect(onFatal).toHaveBeenCalledWith(
      expect.objectContaining({ severity: "fatal", code: "METHOD_NOT_FOUND" }),
    );
  });

  it("transitions to IDLE on disconnect()", () => {
    const { mgr } = createManager();
    mgr.connect();
    mgr.handleOpen();
    mgr.disconnect();
    expect(mgr.state).toBe("IDLE");
    expect(mgr.failures).toBe(0);
  });

  it("ignores handleClose when in IDLE state", () => {
    const { mgr, onStateChange } = createManager();
    mgr.handleClose(1000, "normal");
    expect(mgr.state).toBe("IDLE");
    expect(onStateChange).not.toHaveBeenCalled();
  });

  it("is a no-op to connect() when already ACTIVE", () => {
    const { mgr, onStateChange } = createManager();
    mgr.connect();
    mgr.handleOpen();
    onStateChange.mockClear();
    mgr.connect();
    expect(mgr.state).toBe("ACTIVE");
    expect(onStateChange).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Reference counting
// ---------------------------------------------------------------------------

describe("SubscriptionManager — reference counting", () => {
  it("sends subscribe RPC on first subscription", async () => {
    const { mgr, sendRpc } = createManager();
    mgr.connect();
    mgr.handleOpen();
    await mgr.subscribeSession("sess-1");
    expect(sendRpc).toHaveBeenCalledWith("sessions.messages.subscribe", { key: "sess-1" });
  });

  it("does not send duplicate RPC for same session", async () => {
    const { mgr, sendRpc } = createManager();
    mgr.connect();
    mgr.handleOpen();
    await mgr.subscribeSession("sess-1");
    await mgr.subscribeSession("sess-1");
    expect(sendRpc).toHaveBeenCalledTimes(1);
    expect(mgr.getActiveSubscriptions().get("sess-1")).toBe(2);
  });

  it("sends unsubscribe RPC only when refcount reaches zero", async () => {
    const { mgr, sendRpc } = createManager();
    mgr.connect();
    mgr.handleOpen();
    await mgr.subscribeSession("sess-1");
    await mgr.subscribeSession("sess-1");
    sendRpc.mockClear();

    // First unsubscribe — refcount goes to 1, no RPC
    await mgr.unsubscribeSession("sess-1");
    expect(sendRpc).not.toHaveBeenCalled();
    expect(mgr.getActiveSubscriptions().get("sess-1")).toBe(1);

    // Second unsubscribe — refcount goes to 0, sends RPC
    await mgr.unsubscribeSession("sess-1");
    expect(sendRpc).toHaveBeenCalledWith("sessions.messages.unsubscribe", { key: "sess-1" });
    expect(mgr.getActiveSubscriptions().has("sess-1")).toBe(false);
  });

  it("does not send subscribe RPC when not ACTIVE", async () => {
    const { mgr, sendRpc } = createManager();
    // Still IDLE
    await mgr.subscribeSession("sess-1");
    expect(sendRpc).not.toHaveBeenCalled();
    // But tracks the subscription for resubscribeAll
    expect(mgr.getActiveSubscriptions().has("sess-1")).toBe(true);
  });

  it("tracks activeCount correctly", async () => {
    const { mgr } = createManager();
    mgr.connect();
    mgr.handleOpen();
    await mgr.subscribeSession("a");
    await mgr.subscribeSession("b");
    expect(mgr.activeCount).toBe(2);
    await mgr.unsubscribeSession("a");
    expect(mgr.activeCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Lifecycle subscription
// ---------------------------------------------------------------------------

describe("SubscriptionManager — lifecycle subscription", () => {
  it("subscribes to sessions.subscribe on subscribeLifecycle()", async () => {
    const { mgr, sendRpc } = createManager();
    mgr.connect();
    mgr.handleOpen();
    await mgr.subscribeLifecycle();
    expect(sendRpc).toHaveBeenCalledWith("sessions.subscribe", {});
    expect(mgr.isLifecycleSubscribed).toBe(true);
  });

  it("is idempotent — second call does not re-send", async () => {
    const { mgr, sendRpc } = createManager();
    mgr.connect();
    mgr.handleOpen();
    await mgr.subscribeLifecycle();
    sendRpc.mockClear();
    await mgr.subscribeLifecycle();
    expect(sendRpc).not.toHaveBeenCalled();
  });

  it("resubscribeAll re-sends lifecycle + per-session subscriptions", async () => {
    const { mgr, sendRpc } = createManager();
    mgr.connect();
    mgr.handleOpen();
    await mgr.subscribeLifecycle();
    await mgr.subscribeSession("sess-1");
    await mgr.subscribeSession("sess-2");
    sendRpc.mockClear();

    // Simulate reconnect
    mgr.handleClose(1006, "abnormal");
    mgr.connect();
    mgr.handleOpen();
    await mgr.resubscribeAll();

    expect(sendRpc).toHaveBeenCalledWith("sessions.subscribe", {});
    expect(sendRpc).toHaveBeenCalledWith("sessions.messages.subscribe", { key: "sess-1" });
    expect(sendRpc).toHaveBeenCalledWith("sessions.messages.subscribe", { key: "sess-2" });
  });
});

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

describe("classifyError", () => {
  it("classifies WS close 1006 as transient", () => {
    const result = classifyError({ type: "close", code: 1006 });
    expect(result.severity).toBe("transient");
    expect(result.code).toBe("WS_CLOSE_1006");
  });

  it("classifies WS close 1000 as transient", () => {
    const result = classifyError({ type: "close", code: 1000 });
    expect(result.severity).toBe("transient");
  });

  it("classifies WS close 1001 as transient", () => {
    const result = classifyError({ type: "close", code: 1001 });
    expect(result.severity).toBe("transient");
  });

  it("classifies METHOD_NOT_FOUND as fatal", () => {
    const err = Object.assign(new Error("not found"), { code: "METHOD_NOT_FOUND" });
    const result = classifyError(err);
    expect(result.severity).toBe("fatal");
    expect(result.code).toBe("METHOD_NOT_FOUND");
  });

  it("classifies UNAUTHORIZED as fatal", () => {
    const err = Object.assign(new Error("unauthorized"), { code: "UNAUTHORIZED" });
    const result = classifyError(err);
    expect(result.severity).toBe("fatal");
  });

  it("classifies NOT_PAIRED as fatal", () => {
    const err = Object.assign(new Error("not paired"), { code: "NOT_PAIRED" });
    const result = classifyError(err);
    expect(result.severity).toBe("fatal");
  });

  it("classifies INTERNAL_ERROR as transient", () => {
    const err = Object.assign(new Error("internal"), { code: "INTERNAL_ERROR" });
    const result = classifyError(err);
    expect(result.severity).toBe("transient");
  });

  it("classifies GATEWAY_UNAVAILABLE as transient", () => {
    const result = classifyError(new Error("GATEWAY_UNAVAILABLE"));
    expect(result.severity).toBe("transient");
    expect(result.code).toBe("GATEWAY_UNAVAILABLE");
  });

  it("classifies unknown errors as transient", () => {
    const result = classifyError(new Error("something weird"));
    expect(result.severity).toBe("transient");
    expect(result.code).toBe("UNKNOWN");
  });
});

// ---------------------------------------------------------------------------
// Consecutive failure escalation
// ---------------------------------------------------------------------------

describe("SubscriptionManager — consecutive failure escalation", () => {
  it("escalates to fatal after maxConsecutiveFailures transient errors", () => {
    const { mgr, onFatal, onReconnectScheduled } = createManager({ maxConsecutiveFailures: 3 });
    mgr.connect();
    mgr.handleOpen();

    // 3 consecutive failures WITHOUT successful reconnects between them
    // (handleOpen resets the counter, so we must not call it)
    mgr.handleClose(1006, "abnormal"); // failure 1
    expect(mgr.state).toBe("RECONNECTING");
    expect(onReconnectScheduled).toHaveBeenCalledTimes(1);

    mgr.connect(); // attempt reconnect but fail again before handleOpen
    mgr.handleClose(1006, "abnormal"); // failure 2
    expect(mgr.state).toBe("RECONNECTING");
    expect(onReconnectScheduled).toHaveBeenCalledTimes(2);

    mgr.connect();
    mgr.handleClose(1006, "abnormal"); // failure 3 → escalated to fatal
    expect(mgr.state).toBe("ERROR");
    expect(onFatal).toHaveBeenCalledWith(
      expect.objectContaining({ severity: "fatal", code: "MAX_RECONNECT_FAILURES" }),
    );
  });
});

// ---------------------------------------------------------------------------
// Reconnect backoff
// ---------------------------------------------------------------------------

describe("computeReconnectDelay", () => {
  it("returns base delay on first attempt", () => {
    // With jitter=0 for predictable test
    const delay = computeReconnectDelay(0, 1000, 30000, 0);
    expect(delay).toBe(1000);
  });

  it("doubles delay on each attempt", () => {
    const d1 = computeReconnectDelay(1, 1000, 30000, 0);
    const d2 = computeReconnectDelay(2, 1000, 30000, 0);
    const d3 = computeReconnectDelay(3, 1000, 30000, 0);
    expect(d1).toBe(2000);
    expect(d2).toBe(4000);
    expect(d3).toBe(8000);
  });

  it("caps at maxMs", () => {
    const delay = computeReconnectDelay(10, 1000, 30000, 0);
    expect(delay).toBe(30000);
  });

  it("applies jitter within ±20%", () => {
    const results = new Set<number>();
    for (let i = 0; i < 50; i++) {
      results.add(computeReconnectDelay(0, 1000, 30000, 0.2));
    }
    for (const d of results) {
      expect(d).toBeGreaterThanOrEqual(800);
      expect(d).toBeLessThanOrEqual(1200);
    }
    // Should have some variance (not all identical)
    expect(results.size).toBeGreaterThan(1);
  });

  it("schedules reconnect on transient error", () => {
    const { mgr, onReconnectScheduled } = createManager();
    mgr.connect();
    mgr.handleOpen();
    mgr.handleClose(1006, "abnormal");
    expect(onReconnectScheduled).toHaveBeenCalledTimes(1);
    const delay = onReconnectScheduled.mock.calls[0][0];
    expect(delay).toBeGreaterThanOrEqual(800);
    expect(delay).toBeLessThanOrEqual(1200);
  });
});
