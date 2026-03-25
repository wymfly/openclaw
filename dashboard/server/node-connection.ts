/**
 * NodeConnection — Canvas virtual node for Deck Server.
 *
 * Opens a second WebSocket to the Gateway as a "node" role client,
 * registering canvas capabilities. The Gateway sends `node.invoke.request`
 * events for canvas commands; this module handles them and relays results
 * back via `node.invoke.result` requests.
 *
 * Protocol references:
 *   - src/node-host/runner.ts  — upstream node-host GatewayClient usage
 *   - src/node-host/invoke.ts  — handleInvoke + sendInvokeResult formats
 *   - src/gateway/node-registry.ts — nodeRegistry.invoke() send/receive
 */
import { WebSocket } from "ws";
import type {
  ControlPlaneGatewaySettings,
  GatewayEventFrame,
  GatewayResponseFrame,
} from "./contracts";
import {
  buildV3SignaturePayload,
  signPayload,
  publicKeyToBase64Url,
  loadDeviceToken,
  storeDeviceToken,
  type DeviceIdentity,
  type DbLike,
} from "./device-identity";
import type { EventBus } from "./event-bus";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONNECT_TIMEOUT_MS = 8_000;
const EVAL_TIMEOUT_MS = 10_000;
const CONNECT_PROTOCOL = 3;

const NODE_CLIENT_ID = "node-host";
const NODE_CLIENT_MODE = "node";
const NODE_CLIENT_PLATFORM = "web";

/** Canvas commands the node advertises (Gateway expects string[]). */
const NODE_CANVAS_COMMANDS: string[] = [
  "canvas.present",
  "canvas.hide",
  "canvas.navigate",
  "canvas.eval",
  "canvas.a2ui.pushJSONL",
  "canvas.a2ui.reset",
];

/** Map canvas command names to EventBus action strings. */
const COMMAND_ACTION_MAP: Record<string, string> = {
  "canvas.present": "present",
  "canvas.hide": "hide",
  "canvas.navigate": "navigate",
  "canvas.eval": "eval",
  "canvas.a2ui.pushJSONL": "a2ui_push",
  "canvas.a2ui.reset": "a2ui_reset",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

type PendingEval = {
  invokeId: string;
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export type NodeConnectionOptions = {
  deviceIdentity: DeviceIdentity;
  eventBus: EventBus;
  loadSettings: () => ControlPlaneGatewaySettings;
  createWebSocket?: (url: string) => WebSocket;
  db?: DbLike;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object");

// ---------------------------------------------------------------------------
// NodeConnection
// ---------------------------------------------------------------------------

export class NodeConnection {
  private ws: WebSocket | null = null;
  private stopping = false;
  private nextReqId = 1;
  private connectRequestId: string | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private pending = new Map<string, PendingRequest>();
  private pendingEvals = new Map<string, PendingEval>();
  private canvasSessionCount = 0;

  private readonly deviceIdentity: DeviceIdentity;
  private readonly eventBus: EventBus;
  private readonly loadSettings: () => ControlPlaneGatewaySettings;
  private readonly createWebSocket: (url: string) => WebSocket;
  private readonly db: DbLike | undefined;

  constructor(options: NodeConnectionOptions) {
    this.deviceIdentity = options.deviceIdentity;
    this.eventBus = options.eventBus;
    this.loadSettings = options.loadSettings;
    this.createWebSocket = options.createWebSocket ?? ((url) => new WebSocket(url));
    this.db = options.db;
  }

  /** The node ID is the device identity's deterministic device ID. */
  getNodeId(): string {
    return this.deviceIdentity.deviceId;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Open a WebSocket to the Gateway, complete the connect handshake,
   * and begin listening for `node.invoke.request` events.
   */
  async start(): Promise<void> {
    this.stopping = false;
    await this.connect();
  }

  /** Gracefully close the WebSocket and reject all pending evals. */
  async stop(): Promise<void> {
    this.stopping = true;

    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }

    // Reject all pending evals.
    for (const [id, entry] of this.pendingEvals) {
      clearTimeout(entry.timer);
      entry.reject(new Error("NodeConnection stopped."));
      this.pendingEvals.delete(id);
    }

    // Reject all pending requests.
    this.rejectPending("NodeConnection stopped.");

    const ws = this.ws;
    this.ws = null;
    this.connectRequestId = null;

    if (ws && ws.readyState === WebSocket.OPEN) {
      await new Promise<void>((resolve) => {
        ws.once("close", () => resolve());
        ws.close(1000, "node stopping");
      });
    } else {
      ws?.terminate();
    }
  }

  // -------------------------------------------------------------------------
  // Canvas session reference counting
  // -------------------------------------------------------------------------

  registerCanvasSession(): void {
    this.canvasSessionCount += 1;
  }

  unregisterCanvasSession(): void {
    this.canvasSessionCount = Math.max(0, this.canvasSessionCount - 1);
  }

  getCanvasSessionCount(): number {
    return this.canvasSessionCount;
  }

  // -------------------------------------------------------------------------
  // Eval resolution
  // -------------------------------------------------------------------------

  /**
   * Resolve a pending eval by its eval ID.
   * Returns `true` if the eval was found and resolved, `false` otherwise.
   */
  resolveEval(evalId: string, result: unknown): boolean {
    const entry = this.pendingEvals.get(evalId);
    if (!entry) {
      return false;
    }
    clearTimeout(entry.timer);
    this.pendingEvals.delete(evalId);
    entry.resolve(result);
    return true;
  }

  // -------------------------------------------------------------------------
  // Send invoke result
  // -------------------------------------------------------------------------

  /**
   * Send a `node.invoke.result` request back to the Gateway.
   * This is a fire-and-forget best-effort delivery.
   */
  sendInvokeResult(
    invokeId: string,
    ok: boolean,
    payload?: { data?: unknown; error?: { code: string; message: string } },
  ): void {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const params: Record<string, unknown> = {
      id: invokeId,
      nodeId: this.getNodeId(),
      ok,
    };

    if (ok && payload?.data !== undefined) {
      params.payloadJSON = JSON.stringify(payload.data);
    }
    if (!ok && payload?.error) {
      params.error = payload.error;
    }

    const frame = {
      type: "req",
      id: String(this.nextReqId++),
      method: "node.invoke.result",
      params,
    };

    try {
      ws.send(JSON.stringify(frame));
    } catch {
      // Best-effort; ignore send failures.
    }
  }

  // -------------------------------------------------------------------------
  // Connection lifecycle (private)
  // -------------------------------------------------------------------------

  private async connect(): Promise<void> {
    const settings = this.loadSettings();
    const ws = this.createWebSocket(settings.url);
    this.ws = ws;

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const settle = (fn: () => void) => {
        if (settled) {
          return;
        }
        settled = true;
        if (this.connectTimer) {
          clearTimeout(this.connectTimer);
          this.connectTimer = null;
        }
        fn();
      };

      this.connectTimer = setTimeout(() => {
        settle(() => {
          ws.close(1011, "connect timeout");
          reject(new Error("Node connect timed out."));
        });
      }, CONNECT_TIMEOUT_MS);

      ws.on("open", () => {
        // WebSocket is open; wait for connect.challenge event.
      });

      ws.on("message", (raw: Buffer | string) => {
        const text = typeof raw === "string" ? raw : raw.toString("utf-8");
        const parsed = this.parseFrame(text);
        if (!parsed) {
          return;
        }

        if (parsed.type === "event") {
          if (parsed.event === "connect.challenge") {
            const challengePayload = parsed.payload as { nonce?: unknown } | undefined;
            const nonce =
              challengePayload && typeof challengePayload.nonce === "string"
                ? challengePayload.nonce
                : null;
            this.sendConnectRequest(settings.token, nonce);
            return;
          }

          // After connection is established, handle node invoke events.
          if (parsed.event === "node.invoke.request" && settled) {
            void this.handleCanvasInvoke(parsed.payload);
          }
          return;
        }

        // Response frame.
        if (!this.handleResponseFrame(parsed)) {
          return;
        }

        if (parsed.id === this.connectRequestId) {
          if (parsed.ok) {
            // Cache deviceToken from hello-ok response.
            if (this.db && parsed.payload) {
              const helloPayload = parsed.payload as { auth?: { deviceToken?: string } };
              if (typeof helloPayload.auth?.deviceToken === "string") {
                storeDeviceToken(this.db, helloPayload.auth.deviceToken);
              }
            }
            settle(() => resolve());
            return;
          }
          const code = (parsed.error as { code?: string })?.code ?? "CONNECT_FAILED";
          const message = (parsed.error as { message?: string })?.message ?? "Connect failed.";
          settle(() => {
            ws.close(1011, "connect failed");
            reject(new Error(`Node connect rejected: ${code} ${message}`));
          });
        }
      });

      ws.on("close", () => {
        if (this.stopping) {
          return;
        }
        if (!settled) {
          settle(() => reject(new Error("Node connection closed during connect.")));
        }
      });

      ws.on("error", (error) => {
        if (this.stopping) {
          return;
        }
        if (!settled) {
          settle(() =>
            reject(
              new Error(
                `Node connection error: ${error instanceof Error ? error.message : "unknown"}`,
              ),
            ),
          );
        }
      });
    });
  }

  private sendConnectRequest(token: string, nonce: string | null): void {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN || this.connectRequestId) {
      return;
    }

    const id = String(this.nextReqId++);
    this.connectRequestId = id;
    const deviceId = this.deviceIdentity.deviceId;

    let device: Record<string, unknown> | undefined;
    if (nonce) {
      const signedAt = Date.now();
      const payload = buildV3SignaturePayload({
        deviceId,
        clientId: NODE_CLIENT_ID,
        clientMode: NODE_CLIENT_MODE,
        role: "node",
        scopes: [],
        signedAtMs: signedAt,
        token,
        nonce,
        platform: NODE_CLIENT_PLATFORM,
        deviceFamily: "",
      });
      device = {
        id: deviceId,
        publicKey: publicKeyToBase64Url(this.deviceIdentity.publicKeyPem),
        signature: signPayload(this.deviceIdentity.privateKeyPem, payload),
        signedAt,
        nonce,
      };
    }

    const auth: Record<string, string> = { token };
    if (this.db) {
      const cachedToken = loadDeviceToken(this.db);
      if (cachedToken) {
        auth.deviceToken = cachedToken;
      }
    }

    const connectFrame = {
      type: "req",
      id,
      method: "connect",
      params: {
        minProtocol: CONNECT_PROTOCOL,
        maxProtocol: CONNECT_PROTOCOL,
        client: {
          id: NODE_CLIENT_ID,
          displayName: "Deck Dashboard",
          version: "dev",
          platform: NODE_CLIENT_PLATFORM,
          mode: NODE_CLIENT_MODE,
        },
        auth,
        ...(device ? { device } : {}),
        role: "node",
        scopes: [],
        caps: ["canvas"],
        commands: NODE_CANVAS_COMMANDS,
      },
    };

    try {
      ws.send(JSON.stringify(connectFrame));
    } catch {
      this.connectRequestId = null;
    }
  }

  // -------------------------------------------------------------------------
  // Canvas invoke handling
  // -------------------------------------------------------------------------

  private async handleCanvasInvoke(payload: unknown): Promise<void> {
    if (!isObject(payload)) {
      return;
    }

    const invokeId = typeof payload.id === "string" ? payload.id.trim() : "";
    const command = typeof payload.command === "string" ? payload.command.trim() : "";
    if (!invokeId || !command) {
      return;
    }

    const paramsJSON = typeof payload.paramsJSON === "string" ? payload.paramsJSON : null;
    const action = COMMAND_ACTION_MAP[command];

    if (!action) {
      // Unknown command — send error result.
      this.sendInvokeResult(invokeId, false, {
        error: { code: "UNAVAILABLE", message: `unsupported canvas command: ${command}` },
      });
      return;
    }

    let params: unknown = null;
    if (paramsJSON) {
      try {
        params = JSON.parse(paramsJSON);
      } catch {
        this.sendInvokeResult(invokeId, false, {
          error: { code: "INVALID_REQUEST", message: "invalid paramsJSON" },
        });
        return;
      }
    }

    // Eval commands require at least one canvas session consumer.
    if (action === "eval") {
      if (this.canvasSessionCount <= 0) {
        this.sendInvokeResult(invokeId, false, {
          error: { code: "UNAVAILABLE", message: "no canvas session connected" },
        });
        return;
      }

      // Create a pending eval and broadcast the event.
      const evalPromise = new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pendingEvals.delete(invokeId);
          reject(new Error("eval timed out"));
        }, EVAL_TIMEOUT_MS);

        this.pendingEvals.set(invokeId, {
          invokeId,
          resolve,
          reject,
          timer,
        });
      });

      this.eventBus.broadcast("canvas", {
        action,
        evalId: invokeId,
        javaScript: isObject(params) ? params.javaScript : undefined,
        params,
      });

      try {
        const result = await evalPromise;
        this.sendInvokeResult(invokeId, true, { data: { result } });
      } catch (err) {
        const message = err instanceof Error ? err.message : "eval failed";
        this.sendInvokeResult(invokeId, false, {
          error: { code: "TIMEOUT", message },
        });
      }
      return;
    }

    // Non-eval commands: broadcast and immediately acknowledge.
    this.eventBus.broadcast("canvas", {
      action,
      invokeId,
      params,
    });

    this.sendInvokeResult(invokeId, true, { data: { ok: true } });
  }

  // -------------------------------------------------------------------------
  // Frame parsing (mirrors gateway-adapter.ts)
  // -------------------------------------------------------------------------

  private parseFrame(raw: string): GatewayEventFrame | GatewayResponseFrame | null {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
    if (!isObject(parsed) || typeof parsed.type !== "string") {
      return null;
    }
    if (parsed.type === "event" && typeof parsed.event === "string") {
      return parsed as GatewayEventFrame;
    }
    if (parsed.type === "res" && typeof parsed.id === "string") {
      return parsed as GatewayResponseFrame;
    }
    return null;
  }

  private handleResponseFrame(frame: GatewayResponseFrame): boolean {
    const pending = this.pending.get(frame.id);
    if (!pending) {
      return true;
    }
    clearTimeout(pending.timer);
    this.pending.delete(frame.id);
    if (frame.ok) {
      pending.resolve(frame.payload);
    } else {
      pending.reject(new Error(frame.error?.message ?? "Gateway request failed."));
    }
    return true;
  }

  private rejectPending(message: string): void {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error(message));
    }
    this.pending.clear();
  }
}
