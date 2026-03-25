# Deck Canvas Virtual Node Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Deck Web Dashboard independently support Canvas rendering by registering as a virtual canvas node with the Gateway, receiving `node.invoke` canvas commands via a second WebSocket connection, and forwarding them to the browser via SSE for iframe rendering.

**Architecture:** Deck Server opens a second WebSocket to Gateway as a canvas-capable node (dual-connection model). Canvas commands arrive via `node.invoke`, get broadcast through the existing EventBus/SSE pipeline, and are consumed by CanvasPanel in the browser. The eval action uses a request-response pattern with crypto nonce-based eval-result callback.

**Tech Stack:** TypeScript, WebSocket (ws), Next.js API Routes, Zustand, SSE (EventSource), Ed25519 device identity

**Skill dependencies:**

| Domain | Skills | Loading |
|--------|--------|---------|
| [backend] | superpowers:test-driven-development | session first-load |
| [frontend] | superpowers:test-driven-development | session first-load |

**Task dependencies:**

```
Task 1 (EventBus + runtime) ─┐
Task 2 (NodeConnection)     ─┼─> Task 3 (adapter integration) ─> Task 4 (eval-result route)
Task 5 (UI store)            ┘                                       │
Task 6 (A2UI Bridge eval)   ─────────────────────────────────────────┤
                                                                      v
                                                          Task 7 (CanvasPanel frontend)
                                                                      │
                                                          Task 8 (integration test)
                                                          Task 9 (final verification)
```

**Spec divergence note:** Design spec says `POST /api/deck/canvas/eval-result`; this plan simplifies to `POST /api/deck/canvas` (single route file). Functionally identical.

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `dashboard/server/node-connection.ts` | Second WebSocket to Gateway as canvas node: connect, register, receive `node.invoke`, dispatch to EventBus, eval pending map |
| `dashboard/server/__tests__/node-connection.test.ts` | Unit + integration tests for node-connection |
| `dashboard/server/sse-counter.ts` | Extracted SSE connection counter (shared between `stream/route.ts` and `node-connection.ts`) |
| `dashboard/src/app/api/deck/canvas/route.ts` | POST endpoint for eval-result callback (nonce validation) |

### Modified files

| File | Change |
|------|--------|
| `dashboard/server/event-bus.ts` | Add `"canvas"` to `DeckEventType` union |
| `dashboard/server/runtime.ts` | Add `"canvas"` to `VALID_DECK_EVENTS` set |
| `dashboard/server/gateway-adapter.ts` | Create/start/stop NodeConnection on operator connect/disconnect/reconnect |
| `dashboard/src/app/api/stream/route.ts` | Import `getSSECounter` from shared `sse-counter.ts` |
| `dashboard/src/stores/ui.ts` | Add `canvasVisible`, `canvasMode`, `setCanvasVisible` |
| `dashboard/src/components/panels/chat/a2ui-bridge.ts` | Add `eval(js): Promise<unknown>` method |
| `dashboard/src/components/panels/chat/CanvasPanel.tsx` | Add real-time canvas SSE event listener (via existing useChatSSE pattern, not new EventSource) |
| `dashboard/src/i18n/zh.json` | Add canvas keys under `"chat"` namespace |
| `dashboard/src/i18n/en.json` | Add canvas keys under `"chat"` namespace |

---

### Task 1: Add `"canvas"` event type to EventBus and runtime

**Files:**
- Modify: `dashboard/server/event-bus.ts:16-34`
- Modify: `dashboard/server/runtime.ts:74-92`
- Test: `dashboard/server/__tests__/event-bus.test.ts`

- [ ] **Step 1: Add `"canvas"` to `DeckEventType` union**

In `dashboard/server/event-bus.ts`, add after `"cron.run.complete"`:

```typescript
  | "cron.run.complete"
  // Canvas virtual node
  | "canvas";
```

- [ ] **Step 2: Add `"canvas"` to `VALID_DECK_EVENTS` in runtime.ts**

In `dashboard/server/runtime.ts`, add to the `VALID_DECK_EVENTS` set (after `"cron.run.complete"`):

```typescript
  "cron.run.complete",
  // Canvas virtual node
  "canvas",
]);
```

- [ ] **Step 3: Add EventBus canvas broadcast test**

In `dashboard/server/__tests__/event-bus.test.ts`, add a test:

```typescript
it("broadcasts canvas events", () => {
  const bus = new EventBus();
  const received: ServerEvent[] = [];
  bus.subscribe((e) => received.push(e));
  bus.broadcast("canvas", { action: "a2ui_push", jsonl: "{}" });
  expect(received).toHaveLength(1);
  expect(received[0].type).toBe("canvas");
  expect((received[0].data as any).action).toBe("a2ui_push");
});
```

- [ ] **Step 4: Run tests**

Run: `cd dashboard && pnpm vitest run server/__tests__/event-bus.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/server/event-bus.ts dashboard/server/runtime.ts dashboard/server/__tests__/event-bus.test.ts
git commit -m "[enhanced] feat(deck): add canvas event type to EventBus and runtime"
```

---

### Task 2: Extract SSE counter to shared module + create NodeConnection

**Files:**
- Create: `dashboard/server/sse-counter.ts`
- Modify: `dashboard/src/app/api/stream/route.ts`
- Create: `dashboard/server/node-connection.ts`
- Create: `dashboard/server/__tests__/node-connection.test.ts`

**Depends on:** Task 1

- [ ] **Step 1: Extract SSE counter**

Create `dashboard/server/sse-counter.ts`:

```typescript
const COUNTER_KEY = "__openclawDeckSSECounter__";

type SSECounter = { count: number };

export function getSSECounter(): SSECounter {
  const g = globalThis as unknown as Record<string, SSECounter | undefined>;
  if (!g[COUNTER_KEY]) {
    g[COUNTER_KEY] = { count: 0 };
  }
  return g[COUNTER_KEY];
}
```

Update `dashboard/src/app/api/stream/route.ts`: remove the local `getSSECounter`/`COUNTER_KEY`/`SSECounter` definitions and replace with:

```typescript
import { getSSECounter } from "@server/sse-counter";
```

- [ ] **Step 2: Write NodeConnection tests**

Create `dashboard/server/__tests__/node-connection.test.ts` with tests:

1. `generateNodeId()` produces `deck-{first8chars}` from deviceId
2. `buildConnectFrame()` has correct structure: `caps` and `commands` at top level, `client.mode === "node"`, `device.id` matches `client.id`
3. `handleNodeInvoke("canvas.a2ui.pushJSONL", ...)` broadcasts to EventBus
4. `handleNodeInvoke("canvas.eval", ...)` with `sseConsumerCount === 0` responds with error immediately
5. `handleNodeInvoke("canvas.eval", ...)` with consumers creates pending entry with evalId
6. `resolveEval(validId, result)` resolves promise, returns true, removes from pending
7. `resolveEval(invalidId, result)` returns false
8. eval timeout rejects promise and cleans up pending
9. `stop()` rejects all pending evals

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd dashboard && pnpm vitest run server/__tests__/node-connection.test.ts`
Expected: FAIL (module doesn't exist)

- [ ] **Step 4: Implement NodeConnection**

Create `dashboard/server/node-connection.ts`:

```typescript
import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import type { DeviceIdentity } from "./device-identity";
import {
  buildV3SignaturePayload,
  signPayload,
  publicKeyToBase64Url,
  loadDeviceToken,
  type DbLike,
} from "./device-identity";
import { getEventBus } from "./event-bus";
import { getSSECounter } from "./sse-counter";

const CONNECT_PROTOCOL = 3;
const CONNECT_TIMEOUT_MS = 8_000;
const EVAL_TIMEOUT_MS = 10_000;

const CANVAS_CAPS = ["canvas"] as const;
const CANVAS_COMMANDS = [
  "canvas.present",
  "canvas.hide",
  "canvas.navigate",
  "canvas.eval",
  "canvas.a2ui.pushJSONL",
  "canvas.a2ui.reset",
] as const;

type PendingEval = {
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export interface NodeConnectionOptions {
  deviceIdentity: DeviceIdentity;
  db?: DbLike;
  loadSettings: () => { url: string; token: string };
  createWebSocket?: (url: string) => WebSocket;
}

export class NodeConnection {
  private ws: WebSocket | null = null;
  private connectRequestId: string | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private nextRequestNumber = 1;
  private readonly nodeId: string;
  private readonly deviceIdentity: DeviceIdentity;
  private readonly db: DbLike | undefined;
  private readonly pendingEvals = new Map<string, PendingEval>();
  private readonly loadSettings: () => { url: string; token: string };
  private readonly createWs: (url: string) => WebSocket;
  private stopping = false;

  constructor(options: NodeConnectionOptions) {
    this.deviceIdentity = options.deviceIdentity;
    this.db = options.db;
    this.nodeId = `deck-${options.deviceIdentity.deviceId.slice(0, 8)}`;
    this.loadSettings = options.loadSettings;
    this.createWs = options.createWebSocket ?? ((url) => new WebSocket(url));
  }

  getNodeId(): string { return this.nodeId; }

  async start(): Promise<void> {
    this.stopping = false;
    const settings = this.loadSettings();
    const ws = this.createWs(settings.url);
    this.ws = ws;

    await new Promise<void>((resolve, reject) => {
      this.connectTimer = setTimeout(() => {
        ws.close(1011, "node connect timeout");
        reject(new Error("Node connection timed out"));
      }, CONNECT_TIMEOUT_MS);

      ws.on("open", () => {
        // Wait for connect.challenge, then send connect frame
      });

      ws.on("message", (raw: Buffer | string) => {
        const text = typeof raw === "string" ? raw : raw.toString("utf-8");
        this.handleMessage(text, resolve, reject);
      });

      ws.on("error", (err) => {
        if (!this.stopping) reject(err);
      });

      ws.on("close", () => {
        if (this.connectTimer) {
          clearTimeout(this.connectTimer);
          this.connectTimer = null;
        }
      });
    });
  }

  async stop(): Promise<void> {
    this.stopping = true;
    // Reject all pending evals
    for (const [id, pending] of this.pendingEvals) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Node connection stopped"));
      this.pendingEvals.delete(id);
    }
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    const ws = this.ws;
    this.ws = null;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close(1000, "node stopping");
    } else {
      ws?.terminate();
    }
  }

  resolveEval(evalId: string, result: unknown): boolean {
    const pending = this.pendingEvals.get(evalId);
    if (!pending) return false;
    clearTimeout(pending.timer);
    this.pendingEvals.delete(evalId);
    pending.resolve(result);
    return true;
  }

  private handleMessage(text: string, onConnect?: (v: void) => void, onReject?: (e: Error) => void): void {
    let parsed: any;
    try { parsed = JSON.parse(text); } catch { return; }

    // Handle connect.challenge
    if (parsed.type === "event" && parsed.event === "connect.challenge") {
      this.sendConnectFrame(this.loadSettings().token, parsed.payload?.nonce ?? null);
      return;
    }

    // Handle connect response
    if (parsed.type === "res" && parsed.id === this.connectRequestId) {
      if (this.connectTimer) {
        clearTimeout(this.connectTimer);
        this.connectTimer = null;
      }
      if (parsed.ok) {
        onConnect?.();
      } else {
        onReject?.(new Error(`Node connect rejected: ${parsed.error?.message ?? "unknown"}`));
      }
      return;
    }

    // Handle node.invoke requests from Gateway
    if (parsed.type === "req" && parsed.method === "node.invoke") {
      this.handleNodeInvoke(parsed.id, parsed.params?.command, parsed.params?.params ?? {});
      return;
    }
  }

  private handleNodeInvoke(reqId: string, command: string, params: Record<string, unknown>): void {
    const bus = getEventBus();

    if (command === "canvas.eval") {
      const consumers = getSSECounter().count;
      if (consumers === 0) {
        this.respond(reqId, false, { error: "no active browser session" });
        return;
      }
      const evalId = randomUUID();
      const evalPromise = new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pendingEvals.delete(evalId);
          reject(new Error("eval timeout"));
        }, EVAL_TIMEOUT_MS);
        this.pendingEvals.set(evalId, { resolve, reject, timer });
      });

      bus.broadcast("canvas", {
        action: "eval",
        evalId,
        javaScript: params.javaScript,
      });

      evalPromise
        .then((result) => this.respond(reqId, true, { result }))
        .catch((err) => this.respond(reqId, false, { error: err.message }));
      return;
    }

    // Non-eval canvas commands: broadcast and respond immediately
    const action = command.replace("canvas.", "").replace(".pushJSONL", "_push");
    bus.broadcast("canvas", { action, params });
    this.respond(reqId, true, { ok: true });
  }

  private sendConnectFrame(token: string, nonce: string | null): void {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const id = String(this.nextRequestNumber++);
    this.connectRequestId = id;

    const signedAt = Date.now();
    const payload = buildV3SignaturePayload({
      deviceId: this.deviceIdentity.deviceId,
      clientId: this.nodeId,
      clientMode: "node",
      role: "node",
      scopes: [],
      signedAtMs: signedAt,
      token,
      nonce: nonce ?? "",
      platform: "web",
      deviceFamily: "",
    });

    const auth: Record<string, string> = { token };
    if (this.db) {
      const cached = loadDeviceToken(this.db);
      if (cached) auth.deviceToken = cached;
    }

    const frame = {
      type: "req",
      id,
      method: "connect",
      params: {
        minProtocol: CONNECT_PROTOCOL,
        maxProtocol: CONNECT_PROTOCOL,
        client: {
          id: this.nodeId,
          displayName: "Deck Dashboard",
          version: "dev",
          platform: "web",
          mode: "node",
        },
        auth,
        device: {
          id: this.nodeId,
          publicKey: publicKeyToBase64Url(this.deviceIdentity.publicKeyPem),
          signature: signPayload(this.deviceIdentity.privateKeyPem, payload),
          signedAt,
          nonce,
        },
        caps: [...CANVAS_CAPS],
        commands: [...CANVAS_COMMANDS],
      },
    };
    ws.send(JSON.stringify(frame));
  }

  private respond(reqId: string, ok: boolean, payload?: unknown): void {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "res", id: reqId, ok, payload }));
  }
}
```

- [ ] **Step 5: Run tests**

Run: `cd dashboard && pnpm vitest run server/__tests__/node-connection.test.ts`
Expected: All PASS

- [ ] **Step 6: Verify SSE stream route still works**

Run: `cd dashboard && pnpm vitest run --reporter=verbose 2>&1 | head -50`
Expected: No regressions from SSE counter extraction

- [ ] **Step 7: Commit**

```bash
git add dashboard/server/sse-counter.ts dashboard/server/node-connection.ts dashboard/server/__tests__/node-connection.test.ts dashboard/src/app/api/stream/route.ts
git commit -m "[enhanced] feat(deck): add NodeConnection and extract SSE counter"
```

---

### Task 3: Integrate NodeConnection into gateway-adapter lifecycle

**Files:**
- Modify: `dashboard/server/gateway-adapter.ts`

**Depends on:** Task 2

- [ ] **Step 1: Add NodeConnection field and initialization**

In `OpenClawGatewayAdapter`, add private field:

```typescript
private nodeConnection: NodeConnection | null = null;
```

In constructor, after device identity load (~line 158-160):

```typescript
if (this.db && this.deviceIdentity) {
  this.nodeConnection = new NodeConnection({
    deviceIdentity: this.deviceIdentity,
    db: this.db,
    loadSettings: () => this.loadSettings(),
  });
}
```

Add getter:

```typescript
getNodeConnection(): NodeConnection | null {
  return this.nodeConnection;
}
```

Import at top:

```typescript
import { NodeConnection } from "./node-connection";
```

- [ ] **Step 2: Start NodeConnection after operator connects**

In the connect response handler (~line 357, after `this.updateStatus("connected", null)`), add:

```typescript
// Start canvas node connection (lifecycle bound to operator)
if (this.nodeConnection) {
  void this.nodeConnection.start().catch((err) => {
    console.error("[NodeConnection] failed to start:", err);
  });
}
```

This code runs on **every** successful connect (including reconnects), not just the first connect, because `this.connect()` is called by both `start()` and `scheduleReconnect()`.

- [ ] **Step 3: Stop NodeConnection on operator disconnect**

In the WebSocket `close` handler (~line 371-388), before `this.scheduleReconnect()`, add:

```typescript
// Stop node connection — will be restarted on reconnect
if (this.nodeConnection) {
  void this.nodeConnection.stop().catch(() => {});
}
```

Also in the `stop()` method (~line 185), before closing operator WS:

```typescript
if (this.nodeConnection) {
  await this.nodeConnection.stop();
}
```

- [ ] **Step 4: Run gateway-adapter tests**

Run: `cd dashboard && pnpm vitest run server/__tests__/gateway-adapter.test.ts`
Expected: Existing tests PASS (NodeConnection is null when no db in test environment)

- [ ] **Step 5: Commit**

```bash
git add dashboard/server/gateway-adapter.ts
git commit -m "[enhanced] feat(deck): integrate NodeConnection lifecycle with gateway-adapter"
```

---

### Task 4: Create eval-result API route

**Files:**
- Create: `dashboard/src/app/api/deck/canvas/route.ts`

**Depends on:** Task 3

- [ ] **Step 1: Create route handler**

```typescript
import { NextResponse } from "next/server";
import { getRuntime } from "@server/runtime";

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const { evalId, result } = body as { evalId?: string; result?: unknown };
  if (typeof evalId !== "string" || !evalId) {
    return NextResponse.json({ error: "evalId required" }, { status: 400 });
  }

  const runtime = getRuntime();
  const nodeConn = runtime.adapter.getNodeConnection();
  if (!nodeConn) {
    return NextResponse.json({ error: "node connection unavailable" }, { status: 503 });
  }

  const resolved = nodeConn.resolveEval(evalId, result);
  if (!resolved) {
    return NextResponse.json({ error: "evalId not found or already consumed" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify tsc**

Run: `cd dashboard && pnpm tsc --noEmit 2>&1 | grep canvas`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/api/deck/canvas/route.ts
git commit -m "[enhanced] feat(deck): add canvas eval-result API route"
```

---

### Task 5: Add canvas UI state to store

**Files:**
- Modify: `dashboard/src/stores/ui.ts`

No dependencies.

- [ ] **Step 1: Add canvas state**

In `UIState` interface, add:

```typescript
canvasVisible: boolean;
canvasMode: "idle" | "active";
setCanvasVisible: (visible: boolean) => void;
```

In store defaults:

```typescript
canvasVisible: false,
canvasMode: "idle",
setCanvasVisible: (visible) => set({ canvasVisible: visible, canvasMode: visible ? "active" : "idle" }),
```

- [ ] **Step 2: Verify tsc**

Run: `cd dashboard && pnpm tsc --noEmit 2>&1 | grep ui.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/stores/ui.ts
git commit -m "[enhanced] feat(deck): add canvas visibility state to UI store"
```

---

### Task 6: Add `eval()` method to A2UIBridge

**Files:**
- Modify: `dashboard/src/components/panels/chat/a2ui-bridge.ts`

No dependencies.

- [ ] **Step 1: Add eval message types to bridge listener**

In `A2UIBridge.attach()`, add a case in the `switch (e.data?.type)` block:

```typescript
case "a2ui:eval-result":
  if (e.data.evalId && this.evalCallbacks?.has(e.data.evalId)) {
    this.evalCallbacks.get(e.data.evalId)!(e.data.result);
    this.evalCallbacks.delete(e.data.evalId);
  }
  break;
```

- [ ] **Step 2: Add eval method and pending map**

Add private field:

```typescript
private evalCallbacks = new Map<string, (result: unknown) => void>();
```

Add public method:

```typescript
eval(javaScript: string, evalId: string): Promise<unknown> {
  return new Promise((resolve) => {
    this.evalCallbacks.set(evalId, resolve);
    this.iframe?.contentWindow?.postMessage(
      { type: "a2ui:eval", evalId, javaScript },
      this.iframeOrigin,
    );
  });
}
```

Note: The iframe's A2UI bridge script must also handle `a2ui:eval` messages and respond with `a2ui:eval-result`. The existing canvas proxy at `/api/canvas/[...path]/route.ts` injects a bridge script into HTML responses — this script should be extended to handle eval. This is part of the existing bridge infrastructure; the exact iframe-side handler depends on what the injected bridge script already supports.

- [ ] **Step 3: Clean up eval callbacks on detach**

In `detach()`, add:

```typescript
this.evalCallbacks.clear();
```

- [ ] **Step 4: Verify tsc**

Run: `cd dashboard && pnpm tsc --noEmit 2>&1 | grep a2ui-bridge`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/panels/chat/a2ui-bridge.ts
git commit -m "[enhanced] feat(deck): add eval method to A2UIBridge"
```

---

### Task 7: Add real-time canvas event handling to CanvasPanel

**Files:**
- Modify: `dashboard/src/components/panels/chat/CanvasPanel.tsx`
- Modify: `dashboard/src/i18n/zh.json`
- Modify: `dashboard/src/i18n/en.json`

**Depends on:** Tasks 5 and 6

- [ ] **Step 1: Read CanvasPanel.tsx and useChatSSE.ts fully**

Understand the existing SSE subscription pattern. Key question: does `useChatSSE` already handle generic event types, or does it only handle `chat`/`agent` events? If it only handles specific types, CanvasPanel should add its own listener to the **same shared EventSource** (not create a new one).

Read `dashboard/src/components/panels/chat/useChatSSE.ts` to understand the SSE pattern.

- [ ] **Step 2: Add canvas SSE event listener to CanvasPanel**

Add a `useEffect` that listens for `canvas` events from the SSE stream. Reuse the existing EventSource from `useChatSSE` or the shared `/api/stream` endpoint. **Do not create a new EventSource** — subscribe to `canvas` event type on the existing one:

```typescript
useEffect(() => {
  // Reuse existing EventSource or create shared ref
  const handleCanvasEvent = (e: MessageEvent) => {
    const data = JSON.parse(e.data);
    const bridge = bridgeRef.current;
    switch (data.action) {
      case "present":
        useUIStore.getState().setCanvasVisible(true);
        break;
      case "hide":
        useUIStore.getState().setCanvasVisible(false);
        break;
      case "navigate":
        if (iframeRef.current && data.params?.url) {
          iframeRef.current.src = `/api/canvas/${data.params.url}`;
        }
        break;
      case "eval":
        if (bridge && data.evalId && data.javaScript) {
          bridge.eval(data.javaScript, data.evalId).then((result) => {
            fetch("/api/deck/canvas", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ evalId: data.evalId, result }),
            });
          });
        }
        break;
      case "a2ui_push":
        if (bridge && data.params?.jsonl) {
          bridge.pushMessages([data.params.jsonl]);
          setState("ready");
        }
        break;
      case "a2ui_reset":
        if (bridge) {
          bridge.reset();
          setState("empty");
        }
        break;
    }
  };
  // Subscribe to existing EventSource's "canvas" event type
  // ...
  return () => { /* cleanup */ };
}, []);
```

- [ ] **Step 3: Integrate canvasVisible into ChatPanel layout**

Read `dashboard/src/components/panels/chat/RightPanel.tsx` to understand split-pane layout. When `canvasVisible === true`, show CanvasPanel in the right split pane (same slot as ArtifactPanel).

- [ ] **Step 4: Add i18n keys under `"chat"` namespace**

In `zh.json`, under `"chat"`:

```json
"canvasTitle": "Canvas",
"canvasIdle": "Canvas 空闲",
"canvasNodeId": "节点 ID",
"canvasConnected": "Canvas 已连接",
"canvasDisconnected": "Canvas 未连接"
```

In `en.json`, under `"chat"`:

```json
"canvasTitle": "Canvas",
"canvasIdle": "Canvas idle",
"canvasNodeId": "Node ID",
"canvasConnected": "Canvas connected",
"canvasDisconnected": "Canvas disconnected"
```

- [ ] **Step 5: Run tsc**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: Zero errors for dashboard files

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/components/panels/chat/CanvasPanel.tsx dashboard/src/components/panels/chat/RightPanel.tsx dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
git commit -m "[enhanced] feat(deck): add real-time canvas event handling to CanvasPanel"
```

---

### Task 8: Integration tests

**Files:**
- Modify: `dashboard/server/__tests__/node-connection.test.ts`

**Depends on:** Tasks 2-4

- [ ] **Step 1: Add integration-level test**

Add tests that:
1. Create a mock WebSocket server simulating Gateway connect.challenge + connect response
2. Verify NodeConnection sends correct connect frame with `caps: ["canvas"]`, `commands: [...]`, `client.mode: "node"`
3. Simulate Gateway sending `node.invoke` with `canvas.a2ui.pushJSONL` → verify EventBus receives canvas event
4. Simulate eval round-trip: send invoke → verify pending entry → call resolveEval → verify respond sent
5. Verify stop() during pending eval rejects cleanly

- [ ] **Step 2: Run tests**

Run: `cd dashboard && pnpm vitest run server/__tests__/node-connection.test.ts`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add dashboard/server/__tests__/node-connection.test.ts
git commit -m "[enhanced] test(deck): add integration tests for canvas node connection"
```

---

### Task 9: Final verification

- [ ] **Step 1: Full type check**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: Zero errors for all dashboard files

- [ ] **Step 2: Run all dashboard tests**

Run: `cd dashboard && pnpm vitest run`
Expected: All PASS

- [ ] **Step 3: Commit if fixes needed**

```bash
git add -A dashboard/
git commit -m "[enhanced] fix(deck): resolve type/test issues in canvas virtual node"
```
