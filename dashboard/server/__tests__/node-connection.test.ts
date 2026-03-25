import { EventEmitter } from "node:events";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebSocket } from "ws";
import { generateDeviceIdentity } from "../device-identity.js";
import type { DeviceIdentity } from "../device-identity.js";
import { EventBus } from "../event-bus.js";
import type { ServerEvent } from "../event-bus.js";
import { NodeConnection } from "../node-connection.js";

// ---------------------------------------------------------------------------
// Mock WebSocket
// ---------------------------------------------------------------------------

class MockWebSocket extends EventEmitter {
  static readonly OPEN = WebSocket.OPEN;
  static readonly CLOSED = WebSocket.CLOSED;
  readyState = WebSocket.OPEN;
  sent: string[] = [];
  closeCalled = false;
  terminateCalled = false;

  send(data: string, cb?: (err?: Error) => void): void {
    this.sent.push(data);
    cb?.();
  }

  close(_code?: number, _reason?: string): void {
    this.closeCalled = true;
    // Simulate async close event.
    queueMicrotask(() => this.emit("close"));
  }

  terminate(): void {
    this.terminateCalled = true;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SETTINGS = { url: "ws://localhost:18789", token: "test-token-123" };
const loadSettings = () => SETTINGS;

function createNodeConnection(
  overrides: {
    identity?: DeviceIdentity;
    eventBus?: EventBus;
    ws?: MockWebSocket;
  } = {},
) {
  const identity = overrides.identity ?? generateDeviceIdentity();
  const eventBus = overrides.eventBus ?? new EventBus();
  const mockWs = overrides.ws ?? new MockWebSocket();
  const conn = new NodeConnection({
    deviceIdentity: identity,
    eventBus,
    loadSettings,
    createWebSocket: () => mockWs as unknown as WebSocket,
  });
  return { conn, identity, eventBus, mockWs };
}

/**
 * Start the connection and complete the handshake by simulating
 * connect.challenge → connect response flow.
 */
async function startAndHandshake(conn: NodeConnection, mockWs: MockWebSocket): Promise<void> {
  const startP = conn.start();

  // Wait for event listeners to be attached.
  await new Promise((r) => queueMicrotask(r));

  // Emit connect.challenge.
  mockWs.emit(
    "message",
    JSON.stringify({ type: "event", event: "connect.challenge", payload: { nonce: "abc123" } }),
  );

  // Wait for connect frame to be sent.
  await new Promise((r) => queueMicrotask(r));

  // Find the connect request ID from the sent frame.
  const connectFrame = JSON.parse(mockWs.sent[mockWs.sent.length - 1]);

  // Emit successful hello-ok response.
  mockWs.emit(
    "message",
    JSON.stringify({ type: "res", id: connectFrame.id, ok: true, payload: {} }),
  );

  await startP;
}

/** Build a `node.invoke.request` event frame. */
function makeInvokeEvent(id: string, command: string, params?: unknown): string {
  const payload: Record<string, unknown> = {
    id,
    nodeId: "test-node",
    command,
  };
  if (params !== undefined) {
    payload.paramsJSON = JSON.stringify(params);
  }
  return JSON.stringify({
    type: "event",
    event: "node.invoke.request",
    payload,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("NodeConnection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 1. nodeId equals deviceIdentity.deviceId
  describe("getNodeId", () => {
    it("returns the deviceIdentity deviceId", () => {
      const { conn, identity } = createNodeConnection();
      expect(conn.getNodeId()).toBe(identity.deviceId);
    });
  });

  // 2. connect frame structure
  describe("connect frame", () => {
    it("sends correct connect frame with client.id, mode, device, caps, commands", async () => {
      const { conn, identity, mockWs } = createNodeConnection();
      const startP = conn.start();
      await vi.advanceTimersByTimeAsync(0);

      // Emit challenge.
      mockWs.emit(
        "message",
        JSON.stringify({ type: "event", event: "connect.challenge", payload: { nonce: "nonce1" } }),
      );
      await vi.advanceTimersByTimeAsync(0);

      // Parse the sent connect frame.
      expect(mockWs.sent.length).toBeGreaterThanOrEqual(1);
      const frame = JSON.parse(mockWs.sent[0]);

      expect(frame.type).toBe("req");
      expect(frame.method).toBe("connect");
      expect(frame.params.client.id).toBe("node-host");
      expect(frame.params.client.mode).toBe("node");
      expect(frame.params.client.displayName).toBe("Deck Dashboard");
      expect(frame.params.client.platform).toBe("node");
      expect(frame.params.role).toBe("node");
      expect(frame.params.scopes).toEqual([]);
      expect(frame.params.caps).toEqual(["canvas"]);
      expect(frame.params.commands).toHaveLength(6);
      expect(frame.params.commands[0].command).toBe("canvas.present");

      // Device identity is included.
      expect(frame.params.device).toBeDefined();
      expect(frame.params.device.id).toBe(identity.deviceId);
      expect(typeof frame.params.device.publicKey).toBe("string");
      expect(typeof frame.params.device.signature).toBe("string");
      expect(frame.params.device.nonce).toBe("nonce1");

      // Auth token.
      expect(frame.params.auth.token).toBe("test-token-123");

      // Complete handshake to avoid dangling promise.
      mockWs.emit("message", JSON.stringify({ type: "res", id: frame.id, ok: true, payload: {} }));
      await startP;
    });
  });

  // 3. canvas command → EventBus broadcast
  describe("canvas command → EventBus broadcast", () => {
    it("broadcasts a canvas event for non-eval commands", async () => {
      vi.useRealTimers();
      const { conn, eventBus, mockWs } = createNodeConnection();
      await startAndHandshake(conn, mockWs);

      const received: ServerEvent[] = [];
      eventBus.subscribe((e) => received.push(e));

      // Send a canvas.present invoke.
      mockWs.emit(
        "message",
        makeInvokeEvent("inv-1", "canvas.present", { url: "http://example.com" }),
      );
      await new Promise((r) => setTimeout(r, 10));

      expect(received.length).toBeGreaterThanOrEqual(1);
      const canvasEvent = received.find((e) => e.type === "canvas");
      expect(canvasEvent).toBeDefined();
      expect((canvasEvent!.data as Record<string, unknown>).action).toBe("present");
      expect((canvasEvent!.data as Record<string, unknown>).invokeId).toBe("inv-1");

      await conn.stop();
    });

    it("broadcasts a2ui_push action for canvas.a2ui.pushJSONL command", async () => {
      vi.useRealTimers();
      const { conn, eventBus, mockWs } = createNodeConnection();
      await startAndHandshake(conn, mockWs);

      const received: ServerEvent[] = [];
      eventBus.subscribe((e) => received.push(e));

      // Send a canvas.a2ui.pushJSONL invoke with JSONL data.
      const jsonlData = { lines: ['{"type":"text","text":"hello"}'] };
      mockWs.emit(
        "message",
        makeInvokeEvent("inv-a2ui-1", "canvas.a2ui.pushJSONL", jsonlData),
      );
      await new Promise((r) => setTimeout(r, 10));

      expect(received.length).toBeGreaterThanOrEqual(1);
      const canvasEvent = received.find((e) => e.type === "canvas");
      expect(canvasEvent).toBeDefined();
      expect((canvasEvent!.data as Record<string, unknown>).action).toBe("a2ui_push");
      expect((canvasEvent!.data as Record<string, unknown>).invokeId).toBe("inv-a2ui-1");
      expect((canvasEvent!.data as Record<string, unknown>).params).toEqual(jsonlData);

      // Should also send a success invoke result back.
      const resultFrames = mockWs.sent.slice(-1);
      const resultFrame = JSON.parse(resultFrames[0]);
      expect(resultFrame.method).toBe("node.invoke.result");
      expect(resultFrame.params.id).toBe("inv-a2ui-1");
      expect(resultFrame.params.ok).toBe(true);

      await conn.stop();
    });
  });

  // 4. canvas command → sends node.invoke.result
  describe("canvas command → sends node.invoke.result", () => {
    it("sends a success result for non-eval commands", async () => {
      vi.useRealTimers();
      const { conn, mockWs } = createNodeConnection();
      await startAndHandshake(conn, mockWs);

      const sentBefore = mockWs.sent.length;
      mockWs.emit("message", makeInvokeEvent("inv-2", "canvas.hide"));
      await new Promise((r) => setTimeout(r, 10));

      // Should have sent an additional frame (the result).
      const resultFrames = mockWs.sent.slice(sentBefore);
      expect(resultFrames.length).toBeGreaterThanOrEqual(1);

      const resultFrame = JSON.parse(resultFrames[resultFrames.length - 1]);
      expect(resultFrame.method).toBe("node.invoke.result");
      expect(resultFrame.params.id).toBe("inv-2");
      expect(resultFrame.params.ok).toBe(true);

      await conn.stop();
    });
  });

  // 5. eval + canvasSessionCount=0 → immediate error
  describe("eval with no canvas sessions", () => {
    it("sends an error result immediately when canvasSessionCount is 0", async () => {
      vi.useRealTimers();
      const { conn, mockWs } = createNodeConnection();
      await startAndHandshake(conn, mockWs);

      const sentBefore = mockWs.sent.length;
      mockWs.emit("message", makeInvokeEvent("inv-eval-1", "canvas.eval", { code: "1+1" }));
      await new Promise((r) => setTimeout(r, 10));

      const resultFrames = mockWs.sent.slice(sentBefore);
      expect(resultFrames.length).toBeGreaterThanOrEqual(1);

      const resultFrame = JSON.parse(resultFrames[resultFrames.length - 1]);
      expect(resultFrame.method).toBe("node.invoke.result");
      expect(resultFrame.params.ok).toBe(false);
      expect(resultFrame.params.error.code).toBe("UNAVAILABLE");
      expect(resultFrame.params.error.message).toContain("no canvas session");

      await conn.stop();
    });
  });

  // 6. eval + consumer present → creates pending
  describe("eval with canvas session", () => {
    it("creates a pending eval and broadcasts canvas event", async () => {
      vi.useRealTimers();
      const { conn, eventBus, mockWs } = createNodeConnection();
      await startAndHandshake(conn, mockWs);

      conn.registerCanvasSession();

      const received: ServerEvent[] = [];
      eventBus.subscribe((e) => received.push(e));

      // Send eval. Don't await the internal promise — it will be resolved by resolveEval.
      mockWs.emit("message", makeInvokeEvent("inv-eval-2", "canvas.eval", { code: "2+2" }));
      await new Promise((r) => setTimeout(r, 10));

      // EventBus should have received a canvas event.
      const canvasEvent = received.find((e) => e.type === "canvas");
      expect(canvasEvent).toBeDefined();
      expect((canvasEvent!.data as Record<string, unknown>).action).toBe("eval");
      expect((canvasEvent!.data as Record<string, unknown>).invokeId).toBe("inv-eval-2");

      // Resolve the eval to avoid timeout.
      conn.resolveEval("inv-eval-2", { result: 4 });
      await new Promise((r) => setTimeout(r, 10));

      await conn.stop();
    });
  });

  // 7. resolveEval → resolve promise + sends result
  describe("resolveEval success", () => {
    it("resolves the pending eval and sends invoke result", async () => {
      vi.useRealTimers();
      const { conn, mockWs } = createNodeConnection();
      await startAndHandshake(conn, mockWs);
      conn.registerCanvasSession();

      mockWs.emit("message", makeInvokeEvent("inv-eval-3", "canvas.eval", { code: "3+3" }));
      await new Promise((r) => setTimeout(r, 10));

      const sentBefore = mockWs.sent.length;
      const resolved = conn.resolveEval("inv-eval-3", { value: 6 });
      expect(resolved).toBe(true);

      // Wait for the async chain to complete.
      await new Promise((r) => setTimeout(r, 10));

      const resultFrames = mockWs.sent.slice(sentBefore);
      expect(resultFrames.length).toBeGreaterThanOrEqual(1);
      const resultFrame = JSON.parse(resultFrames[resultFrames.length - 1]);
      expect(resultFrame.method).toBe("node.invoke.result");
      expect(resultFrame.params.ok).toBe(true);
      expect(JSON.parse(resultFrame.params.payloadJSON)).toEqual({ value: 6 });

      await conn.stop();
    });
  });

  // 8. resolveEval unknown ID → false
  describe("resolveEval unknown ID", () => {
    it("returns false for unknown eval ID", () => {
      const { conn } = createNodeConnection();
      expect(conn.resolveEval("nonexistent", {})).toBe(false);
    });
  });

  // 9. eval timeout → reject + cleanup
  describe("eval timeout", () => {
    it("rejects the pending eval after timeout and sends error result", async () => {
      const { conn, mockWs } = createNodeConnection();

      // Use real timers for handshake, then switch to fake.
      vi.useRealTimers();
      await startAndHandshake(conn, mockWs);
      vi.useFakeTimers();

      conn.registerCanvasSession();

      mockWs.emit(
        "message",
        makeInvokeEvent("inv-eval-timeout", "canvas.eval", { code: "slow()" }),
      );
      await vi.advanceTimersByTimeAsync(0);

      const sentBefore = mockWs.sent.length;

      // Advance past eval timeout (10s).
      await vi.advanceTimersByTimeAsync(11_000);

      // Should have sent an error result.
      const resultFrames = mockWs.sent.slice(sentBefore);
      expect(resultFrames.length).toBeGreaterThanOrEqual(1);
      const resultFrame = JSON.parse(resultFrames[resultFrames.length - 1]);
      expect(resultFrame.method).toBe("node.invoke.result");
      expect(resultFrame.params.ok).toBe(false);
      expect(resultFrame.params.error.code).toBe("TIMEOUT");

      // Resolving after timeout should return false.
      expect(conn.resolveEval("inv-eval-timeout", {})).toBe(false);

      await conn.stop();
    });
  });

  // 10. stop() → rejects all pending evals
  describe("stop rejects pending evals", () => {
    it("rejects all pending evals on stop", async () => {
      vi.useRealTimers();
      const { conn, mockWs } = createNodeConnection();
      await startAndHandshake(conn, mockWs);
      conn.registerCanvasSession();

      const evalPromise = new Promise<void>((resolve) => {
        mockWs.emit("message", makeInvokeEvent("inv-eval-stop", "canvas.eval", { code: "x" }));
        setTimeout(() => {
          resolve();
        }, 10);
      });

      await evalPromise;

      // Stop should reject the pending eval.
      await conn.stop();

      // After stop, the eval should no longer be resolvable.
      expect(conn.resolveEval("inv-eval-stop", {})).toBe(false);
    });
  });

  // Canvas session reference counting
  describe("canvas session counting", () => {
    it("increments and decrements correctly", () => {
      const { conn } = createNodeConnection();
      expect(conn.getCanvasSessionCount()).toBe(0);

      conn.registerCanvasSession();
      expect(conn.getCanvasSessionCount()).toBe(1);

      conn.registerCanvasSession();
      expect(conn.getCanvasSessionCount()).toBe(2);

      conn.unregisterCanvasSession();
      expect(conn.getCanvasSessionCount()).toBe(1);

      conn.unregisterCanvasSession();
      expect(conn.getCanvasSessionCount()).toBe(0);

      // Should not go below 0.
      conn.unregisterCanvasSession();
      expect(conn.getCanvasSessionCount()).toBe(0);
    });
  });

  // Unknown command → error result
  describe("unknown canvas command", () => {
    it("sends error result for unsupported commands", async () => {
      vi.useRealTimers();
      const { conn, mockWs } = createNodeConnection();
      await startAndHandshake(conn, mockWs);

      const sentBefore = mockWs.sent.length;
      mockWs.emit("message", makeInvokeEvent("inv-unknown", "canvas.bogus"));
      await new Promise((r) => setTimeout(r, 10));

      const resultFrames = mockWs.sent.slice(sentBefore);
      expect(resultFrames.length).toBeGreaterThanOrEqual(1);
      const resultFrame = JSON.parse(resultFrames[resultFrames.length - 1]);
      expect(resultFrame.params.ok).toBe(false);
      expect(resultFrame.params.error.code).toBe("UNAVAILABLE");

      await conn.stop();
    });
  });

  // deviceToken caching from hello-ok
  describe("deviceToken caching", () => {
    it("stores deviceToken from hello-ok response", async () => {
      vi.useRealTimers();
      const identity = generateDeviceIdentity();
      const eventBus = new EventBus();
      const mockWs = new MockWebSocket();
      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          run: vi.fn(),
          get: vi.fn().mockReturnValue(undefined),
        }),
      };

      const conn = new NodeConnection({
        deviceIdentity: identity,
        eventBus,
        loadSettings,
        createWebSocket: () => mockWs as unknown as WebSocket,
        db: mockDb,
      });

      const startP = conn.start();
      await new Promise((r) => queueMicrotask(r));

      // Send challenge.
      mockWs.emit(
        "message",
        JSON.stringify({ type: "event", event: "connect.challenge", payload: { nonce: "n1" } }),
      );
      await new Promise((r) => queueMicrotask(r));

      // Get the connect request ID.
      const connectFrame = JSON.parse(mockWs.sent[0]);

      // Send hello-ok with deviceToken.
      mockWs.emit(
        "message",
        JSON.stringify({
          type: "res",
          id: connectFrame.id,
          ok: true,
          payload: { auth: { deviceToken: "dt-abc-123" } },
        }),
      );

      await startP;

      // Verify storeDeviceToken was called.
      const updateCall = mockDb.prepare.mock.calls.find(
        (c: string[]) => typeof c[0] === "string" && c[0].includes("UPDATE"),
      );
      expect(updateCall).toBeDefined();

      await conn.stop();
    });
  });
});
