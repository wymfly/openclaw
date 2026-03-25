# Deck Canvas Virtual Node Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Deck Web Dashboard independently support Canvas rendering by registering as a virtual canvas node with the Gateway, receiving `node.invoke.request` events via a second WebSocket connection, and forwarding them to the browser via SSE for iframe rendering.

**Architecture:** Deck Server opens a second WebSocket to Gateway as a canvas-capable node (dual-connection model). The node connection uses the same protocol as `src/node-host/runner.ts`: connect challenge → device identity signature → event-based `node.invoke.request` → `request "node.invoke.result"` response. Canvas commands are broadcast through the existing EventBus/SSE pipeline and consumed by a always-mounted listener in useChatSSE.

**Tech Stack:** TypeScript, WebSocket (ws), Next.js API Routes, Zustand, SSE (EventSource), Ed25519 device identity

**Skill dependencies:**

| Domain     | Skills                              | Loading            |
| ---------- | ----------------------------------- | ------------------ |
| [backend]  | superpowers:test-driven-development | session first-load |
| [frontend] | superpowers:test-driven-development | session first-load |

**Design spec:** `docs/plans/2026-03-25-deck-canvas-virtual-node-design.md`

**Task dependencies:**

```
Task 0 (protocol probe)
    ↓
Task 1 (EventBus + runtime) ─┐
Task 2 (NodeConnection)      ├─> Task 3 (adapter integration) ─> Task 4 (eval-result route)
Task 5 (UI store)             │                                        │
Task 6 (A2UIBridge eval)      │                                        │
Task 7 (iframe bridge eval)  ─┘                                        │
                                                                        ↓
                                                            Task 8 (canvas SSE in useChatSSE)
                                                                        ↓
                                                            Task 9 (CanvasPanel real-time)
                                                                        ↓
                                                            Task 10 (integration test)
                                                            Task 11 (final verification)
```

**Protocol reference files** (implementers must read):

- `src/gateway/client.ts` — GatewayClient connect frame structure (lines 420-466)
- `src/node-host/runner.ts` — node-host usage of GatewayClient (lines 177-218)
- `src/node-host/invoke.ts` — node.invoke.request handling + node.invoke.result response (lines 417-609)
- `src/gateway/node-registry.ts` — nodeRegistry.register() + invoke() (lines 43-160)
- `src/gateway/protocol/client-info.ts` — GATEWAY_CLIENT_IDS / MODES enums
- `src/gateway/protocol/schema/frames.ts` — ConnectParamsSchema
- `dashboard/server/gateway-adapter.ts` — existing operator connection pattern
- `dashboard/server/device-identity.ts` — Ed25519 device identity

---

## File Structure

### New files

| File                                                 | Responsibility                                                                                                                                                             |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dashboard/server/node-connection.ts`                | Second WebSocket to Gateway as canvas node: connect challenge, device identity auth, `node.invoke.request` event handling, `node.invoke.result` response, eval pending map |
| `dashboard/server/__tests__/node-connection.test.ts` | Unit + integration tests                                                                                                                                                   |
| `dashboard/src/app/api/deck/canvas/route.ts`         | POST: eval-result callback + canvas session register/unregister                                                                                                            |

### Modified files

| File                                                   | Change                                                   |
| ------------------------------------------------------ | -------------------------------------------------------- |
| `dashboard/server/event-bus.ts`                        | Add `"canvas"` to `DeckEventType`                        |
| `dashboard/server/runtime.ts`                          | Add `"canvas"` to `VALID_DECK_EVENTS`                    |
| `dashboard/server/gateway-adapter.ts`                  | Start/stop NodeConnection on operator connect/disconnect |
| `dashboard/src/components/panels/chat/useChatSSE.ts`   | Add canvas event dispatch (always-mounted)               |
| `dashboard/src/components/panels/chat/a2ui-bridge.ts`  | Add `eval(js, evalId)` method                            |
| `dashboard/src/app/api/canvas/[...path]/route.ts`      | Extend injected bridge script for `a2ui:eval`            |
| `dashboard/src/components/panels/chat/CanvasPanel.tsx` | Wire real-time canvas rendering (when mounted)           |
| `dashboard/src/stores/ui.ts`                           | Add `canvasVisible` / `canvasMode` / `setCanvasVisible`  |
| `dashboard/src/i18n/zh.json`                           | Add canvas i18n keys under `"chat"` namespace            |
| `dashboard/src/i18n/en.json`                           | Add canvas i18n keys under `"chat"` namespace            |

---

### Task 0: Protocol probe — verify node connection with real Gateway

**Files:** None (exploratory, no committed code)

**Purpose:** Before writing production code, verify core protocol assumptions with a live Gateway. This eliminates the #1 risk (protocol mismatch) upfront.

- [ ] **Step 1: Start Gateway from local source**

```bash
scripts/dev/deck-dev.sh gateway
```

- [ ] **Step 2: Write a throwaway probe script**

Create `/tmp/deck-node-probe.ts` (not committed):

```typescript
import { WebSocket } from "ws";
import crypto from "node:crypto";

// 1. Connect to Gateway, wait for connect.challenge
// 2. Send connect frame with:
//    - client.id = "node-host"
//    - client.mode = "node"
//    - role = "node" (or omit to test default)
//    - caps = ["canvas"]
//    - commands = ["canvas.present", ...]
//    - device identity from dashboard SQLite
// 3. Verify: hello-ok response (confirms auth + pairing)
// 4. Wait for any event frames
// 5. Log everything
```

- [ ] **Step 3: Run probe and verify**

Run: `bun /tmp/deck-node-probe.ts`

Verify:

- hello-ok response received (connection accepted)
- No pairing prompt required (local + no Origin → silent auto-pair)
- nodeId in hello-ok or visible in `node.list` from operator connection

- [ ] **Step 4: Test node.invoke round-trip**

From another terminal, use the operator connection to send a test invoke:

```bash
# Via Deck's existing API or direct Gateway RPC
# Verify the probe script receives event "node.invoke.request"
# Verify probe can send request "node.invoke.result" back
```

- [ ] **Step 5: Document findings**

Record any protocol differences from design spec assumptions. Update design spec if needed.

- [ ] **Step 6: Clean up probe script**

```bash
rm /tmp/deck-node-probe.ts
```

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

In `dashboard/server/runtime.ts`, add to the set (after `"cron.run.complete"`):

```typescript
  "cron.run.complete",
  // Canvas virtual node
  "canvas",
]);
```

- [ ] **Step 3: Add canvas broadcast test**

In `dashboard/server/__tests__/event-bus.test.ts`, add:

```typescript
it("broadcasts canvas events", () => {
  const bus = new EventBus();
  const received: ServerEvent[] = [];
  bus.subscribe((e) => received.push(e));
  bus.broadcast("canvas", { action: "a2ui_push", jsonl: "{}" });
  expect(received).toHaveLength(1);
  expect(received[0].type).toBe("canvas");
  expect((received[0].data as Record<string, unknown>).action).toBe("a2ui_push");
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

### Task 2: Create NodeConnection module

**Files:**

- Create: `dashboard/server/node-connection.ts`
- Create: `dashboard/server/__tests__/node-connection.test.ts`

**Depends on:** Task 0 (protocol knowledge), Task 1

**Protocol model** (from `src/node-host/runner.ts` + `src/gateway/node-registry.ts`):

- Gateway sends **event** `node.invoke.request` to node
- Node responds via **request** `node.invoke.result`
- Connect frame: `client.id = "node-host"`, `client.mode = "node"`, `device.id = deviceIdentity.deviceId`

- [ ] **Step 1: Write tests**

Create `dashboard/server/__tests__/node-connection.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NodeConnection } from "../node-connection.js";

describe("NodeConnection", () => {
  // Protocol tests
  it("derives nodeId from deviceIdentity.deviceId");
  it("buildConnectFrame has client.id=node-host, client.mode=node, caps=[canvas]");
  it("buildConnectFrame has device.id = deviceIdentity.deviceId (not customized)");
  it("buildConnectFrame includes device identity signature");

  // Command dispatch tests
  it("onEvent node.invoke.request with canvas command → broadcasts to EventBus");
  it("onEvent node.invoke.request → sends node.invoke.result request back");
  it("maps canvas.a2ui.pushJSONL command to a2ui_push action");
  it("maps canvas.present command to present action");

  // Eval tests
  it("canvas.eval with canvasSessionActive=false → immediate error result");
  it("canvas.eval with active session → creates pending entry + broadcasts");
  it("resolveEval with valid evalId → resolves promise, removes from pending");
  it("resolveEval with unknown evalId → returns false");
  it("eval timeout → rejects promise, removes from pending, sends error result");

  // Lifecycle tests
  it("stop() rejects all pending evals");
  it("stop() closes WebSocket");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && pnpm vitest run server/__tests__/node-connection.test.ts`
Expected: FAIL (module doesn't exist)

- [ ] **Step 3: Implement NodeConnection**

Create `dashboard/server/node-connection.ts`. Key design:

```typescript
import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import type { DeviceIdentity } from "./device-identity";
import {
  buildV3SignaturePayload,
  signPayload,
  publicKeyToBase64Url,
  loadDeviceToken,
  storeDeviceToken,
  type DbLike,
} from "./device-identity";
import { getEventBus } from "./event-bus";

// Protocol constants — match src/gateway/protocol/client-info.ts
const NODE_CLIENT_ID = "node-host"; // GATEWAY_CLIENT_IDS.NODE_HOST
const NODE_CLIENT_MODE = "node"; // GATEWAY_CLIENT_MODES.NODE
const NODE_PLATFORM = "web";
const CONNECT_PROTOCOL = 3;
const CONNECT_TIMEOUT_MS = 8_000;
const EVAL_TIMEOUT_MS = 10_000;

const CANVAS_COMMANDS = [
  "canvas.present",
  "canvas.hide",
  "canvas.navigate",
  "canvas.eval",
  "canvas.a2ui.pushJSONL",
  "canvas.a2ui.reset",
] as const;

// Command-to-action mapping for EventBus
const COMMAND_ACTION_MAP: Record<string, string> = {
  "canvas.present": "present",
  "canvas.hide": "hide",
  "canvas.navigate": "navigate",
  "canvas.eval": "eval",
  "canvas.a2ui.pushJSONL": "a2ui_push",
  "canvas.a2ui.reset": "a2ui_reset",
};
```

**Core class structure:**

```typescript
export class NodeConnection {
  private ws: WebSocket | null = null;
  private nodeId: string; // = deviceIdentity.deviceId
  private pendingEvals = new Map<string, PendingEval>();
  private canvasSessionCount = 0; // reference count from browser tabs
  private nextReqId = 1;
  // ... constructor, start, stop, resolveEval, registerCanvas, unregisterCanvas

  // Event handler — called when Gateway sends event frames
  private handleEvent(event: string, payload: unknown): void {
    if (event === "node.invoke.request") {
      this.handleCanvasInvoke(payload);
    }
  }

  // Canvas invoke handler — broadcast to EventBus + send result
  private handleCanvasInvoke(payload: NodeInvokePayload): void {
    const action = COMMAND_ACTION_MAP[payload.command];
    if (!action) {
      this.sendInvokeResult(payload.id, false, { error: "unsupported command" });
      return;
    }

    if (payload.command === "canvas.eval") {
      // Special: async eval with browser round-trip
      if (this.canvasSessionCount === 0) {
        this.sendInvokeResult(payload.id, false, { error: "no active browser session" });
        return;
      }
      const evalId = randomUUID();
      // Create pending, broadcast, timeout...
      return;
    }

    // Non-eval: broadcast and respond immediately
    const bus = getEventBus();
    const params = payload.paramsJSON ? JSON.parse(payload.paramsJSON) : {};
    bus.broadcast("canvas", { action, params });
    this.sendInvokeResult(payload.id, true, { ok: true });
  }

  // Send node.invoke.result as a request (not response!)
  private sendInvokeResult(invokeId: string, ok: boolean, payload: unknown): void {
    // ws.send JSON { type: "req", id: nextReqId++, method: "node.invoke.result", params: { id: invokeId, nodeId, ok, payload/error } }
  }
}
```

**Connect frame** follows `src/gateway/client.ts:443-466` pattern:

- `client.id = "node-host"` (from `GATEWAY_CLIENT_IDS` enum)
- `client.mode = "node"`
- `device.id = deviceIdentity.deviceId` (crypto-derived, not customizable)
- `caps: ["canvas"]`, `commands: [...]`
- Device signature via `buildV3SignaturePayload` + `signPayload`

**nodeId**: equals `deviceIdentity.deviceId` — Gateway derives it from `device.id ?? client.id`.

- [ ] **Step 4: Run tests**

Run: `cd dashboard && pnpm vitest run server/__tests__/node-connection.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/server/node-connection.ts dashboard/server/__tests__/node-connection.test.ts
git commit -m "[enhanced] feat(deck): add NodeConnection for canvas virtual node"
```

---

### Task 3: Integrate NodeConnection into gateway-adapter lifecycle

**Files:**

- Modify: `dashboard/server/gateway-adapter.ts`

**Depends on:** Task 2

- [ ] **Step 1: Read gateway-adapter.ts connect/disconnect/reconnect flow**

Key locations:

- Constructor: `~line 152-161` (device identity load)
- Connect success: `~line 357` (`this.updateStatus("connected", null)`)
- WebSocket close handler: `~line 371-388` (triggers reconnect)
- `stop()`: `~line 185-209`

- [ ] **Step 2: Add NodeConnection field and initialization**

```typescript
import { NodeConnection } from "./node-connection";

// In class, add field:
private nodeConnection: NodeConnection | null = null;

// In constructor, after device identity load (~line 158-160):
if (this.db && this.deviceIdentity) {
  this.nodeConnection = new NodeConnection({
    deviceIdentity: this.deviceIdentity,
    db: this.db,
    loadSettings: () => this.loadSettings(),
  });
}

// Add getter:
getNodeConnection(): NodeConnection | null {
  return this.nodeConnection;
}
```

- [ ] **Step 3: Start NodeConnection on every operator connect success**

After `this.updateStatus("connected", null)` (~line 357):

```typescript
// Start canvas node connection (runs on every connect including reconnects)
if (this.nodeConnection) {
  void this.nodeConnection.start().catch((err) => {
    console.error("[NodeConnection] failed to start:", err);
  });
}
```

- [ ] **Step 4: Stop NodeConnection on operator disconnect**

In WebSocket `close` handler (~line 371), before `this.scheduleReconnect()`:

```typescript
if (this.nodeConnection) {
  void this.nodeConnection.stop().catch(() => {});
}
```

In `stop()` method (~line 185), before closing operator WS:

```typescript
if (this.nodeConnection) {
  await this.nodeConnection.stop();
}
```

- [ ] **Step 5: Run gateway-adapter tests**

Run: `cd dashboard && pnpm vitest run server/__tests__/gateway-adapter.test.ts`
Expected: Existing tests PASS (NodeConnection is null when no db)

- [ ] **Step 6: Commit**

```bash
git add dashboard/server/gateway-adapter.ts
git commit -m "[enhanced] feat(deck): integrate NodeConnection lifecycle with gateway-adapter"
```

---

### Task 4: Create canvas API route (eval-result + session register)

**Files:**

- Create: `dashboard/src/app/api/deck/canvas/route.ts`

**Depends on:** Task 3

- [ ] **Step 1: Create route handler**

```typescript
import { NextResponse } from "next/server";
import { getRuntime } from "@server/runtime";

export async function POST(request: Request): Promise<Response> {
  const runtime = getRuntime();
  if (!runtime) {
    return NextResponse.json({ error: "runtime not initialized" }, { status: 503 });
  }

  const nodeConn = runtime.adapter.getNodeConnection();
  if (!nodeConn) {
    return NextResponse.json({ error: "node connection unavailable" }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const { action } = body as { action?: string };

  // Canvas session register/unregister (for eval active-session check)
  if (action === "register") {
    nodeConn.registerCanvasSession();
    return NextResponse.json({ ok: true });
  }
  if (action === "unregister") {
    nodeConn.unregisterCanvasSession();
    return NextResponse.json({ ok: true });
  }

  // Eval result callback
  const { evalId, result } = body as { evalId?: string; result?: unknown };
  if (typeof evalId !== "string" || !evalId) {
    return NextResponse.json({ error: "evalId required" }, { status: 400 });
  }

  const resolved = nodeConn.resolveEval(evalId, result);
  if (!resolved) {
    return NextResponse.json({ error: "evalId not found or already consumed" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify tsc**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: No errors in canvas route

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/api/deck/canvas/route.ts
git commit -m "[enhanced] feat(deck): add canvas eval-result and session register API route"
```

---

### Task 5: Add canvas UI state to store

**Files:**

- Modify: `dashboard/src/stores/ui.ts`

No dependencies.

- [ ] **Step 1: Add canvas state**

In `UIState` interface:

```typescript
canvasVisible: boolean;
canvasMode: "idle" | "active";
setCanvasVisible: (visible: boolean) => void;
```

In store defaults:

```typescript
canvasVisible: false,
canvasMode: "idle",
setCanvasVisible: (visible) => set({
  canvasVisible: visible,
  canvasMode: visible ? "active" : "idle",
}),
```

- [ ] **Step 2: Verify tsc**

Run: `cd dashboard && pnpm tsc --noEmit`
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

- [ ] **Step 1: Add eval callback map and message handler**

In `A2UIBridge` class, add field:

```typescript
private evalCallbacks = new Map<string, (result: unknown) => void>();
```

In `attach()` method's switch block, add case:

```typescript
case "a2ui:eval-result":
  if (e.data.evalId && this.evalCallbacks.has(e.data.evalId)) {
    this.evalCallbacks.get(e.data.evalId)!(e.data.result);
    this.evalCallbacks.delete(e.data.evalId);
  }
  break;
```

- [ ] **Step 2: Add eval method**

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

- [ ] **Step 3: Clean up on detach**

In `detach()`, add: `this.evalCallbacks.clear();`

- [ ] **Step 4: Verify tsc**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/panels/chat/a2ui-bridge.ts
git commit -m "[enhanced] feat(deck): add eval method to A2UIBridge"
```

---

### Task 7: Extend iframe bridge script for `a2ui:eval`

**Files:**

- Modify: `dashboard/src/app/api/canvas/[...path]/route.ts`

No dependencies.

- [ ] **Step 1: Read the existing BRIDGE_SCRIPT constant**

Read `dashboard/src/app/api/canvas/[...path]/route.ts` fully. Find the `BRIDGE_SCRIPT` string that gets injected into HTML responses. Understand what message types it currently handles.

- [ ] **Step 2: Add eval handler to BRIDGE_SCRIPT**

In the bridge script's message event listener, add handling for `a2ui:eval`:

```javascript
case "a2ui:eval":
  try {
    const result = eval(e.data.javaScript);
    window.parent.postMessage(
      { type: "a2ui:eval-result", evalId: e.data.evalId, result },
      "*"
    );
  } catch (err) {
    window.parent.postMessage(
      { type: "a2ui:eval-result", evalId: e.data.evalId, result: null, error: String(err) },
      "*"
    );
  }
  break;
```

- [ ] **Step 3: Verify tsc**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add "dashboard/src/app/api/canvas/[...path]/route.ts"
git commit -m "[enhanced] feat(deck): extend iframe bridge script for a2ui:eval"
```

---

### Task 8: Add canvas event dispatch to useChatSSE (always-mounted)

**Files:**

- Modify: `dashboard/src/components/panels/chat/useChatSSE.ts`
- Modify: `dashboard/src/i18n/zh.json`
- Modify: `dashboard/src/i18n/en.json`

**Depends on:** Tasks 5, 6

**Critical design decision:** Canvas event listener MUST be in an always-mounted component. `CanvasPanel` is only mounted when `rightPanelMode === "canvas"`, so a `canvas.present` event would be missed if the panel is hidden. `useChatSSE` runs in `ChatPanel` which is always mounted when the chat panel is active.

- [ ] **Step 1: Read useChatSSE.ts fully**

Understand how it creates EventSource, dispatches chat/agent events. The hook attaches event listeners to the shared `/api/stream` EventSource.

- [ ] **Step 2: Add canvas event listener**

In `useChatSSE`, add a listener for the `"canvas"` event type:

```typescript
es.addEventListener("canvas", (e: MessageEvent) => {
  try {
    const data = JSON.parse(e.data);
    dispatchCanvasEvent(data);
  } catch {
    // ignore parse errors
  }
});
```

Create `dispatchCanvasEvent` in `chat-dispatchers.ts` or inline:

```typescript
function dispatchCanvasEvent(data: {
  action: string;
  params?: unknown;
  evalId?: string;
  javaScript?: string;
}) {
  const { setCanvasVisible } = useUIStore.getState();
  switch (data.action) {
    case "present":
      setCanvasVisible(true);
      // Store present params (url, placement) in chat store for CanvasPanel to consume
      useChatStore.getState().setA2UIState(activeSessionKey, { visible: true });
      break;
    case "hide":
      setCanvasVisible(false);
      useChatStore.getState().setA2UIState(activeSessionKey, { visible: false });
      break;
    // navigate, a2ui_push, a2ui_reset, eval — stored in a canvas event queue
    // consumed by CanvasPanel when mounted
    default:
      useChatStore.getState().appendCanvasCommand(data);
      break;
  }
}
```

Note: The exact mechanism for passing non-present/hide events to CanvasPanel (which handles iframe interaction) depends on the existing chat store patterns. Read the store to determine best approach — likely a `canvasCommandQueue` in the store that CanvasPanel consumes.

- [ ] **Step 3: Register/unregister canvas session on mount**

In `useChatSSE` or in `ChatPanel`, add lifecycle calls:

```typescript
useEffect(() => {
  fetch("/api/deck/canvas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "register" }),
  });
  return () => {
    fetch("/api/deck/canvas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unregister" }),
    });
  };
}, []);
```

- [ ] **Step 4: Add i18n keys under "chat" namespace**

Check existing keys in CanvasPanel (`canvasLoading`, `canvasError`, `canvasRetry`, `canvasEmpty`, `canvasCollapse`, `debugTitle`). Add any missing canvas keys to both `zh.json` and `en.json` under `"chat"`:

```json
"canvasConnected": "Canvas 已连接" / "Canvas connected",
"canvasDisconnected": "Canvas 未连接" / "Canvas disconnected"
```

Only add keys that don't already exist. Do NOT create a separate `"canvas"` namespace.

- [ ] **Step 5: Verify tsc**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/components/panels/chat/useChatSSE.ts dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
git commit -m "[enhanced] feat(deck): add canvas event dispatch to useChatSSE"
```

---

### Task 9: Wire CanvasPanel for real-time canvas rendering

**Files:**

- Modify: `dashboard/src/components/panels/chat/CanvasPanel.tsx`
- Modify: `dashboard/src/components/panels/chat/ChatPanel.tsx` (if needed for layout)

**Depends on:** Tasks 6, 7, 8

- [ ] **Step 1: Read CanvasPanel.tsx and ChatPanel.tsx fully**

Understand:

- How CanvasPanel currently replays history A2UI events
- How ChatPanel controls `rightPanelMode` (which determines CanvasPanel visibility)
- Where `canvasVisible` from ui.ts should be wired to show/hide CanvasPanel

- [ ] **Step 2: Consume canvas command queue**

In CanvasPanel, add a `useEffect` that reads from the canvas command queue (set up in Task 8) and executes each command via the A2UIBridge:

```typescript
// Pseudo-code — exact implementation depends on store shape from Task 8
useEffect(
  () => {
    const commands = useChatStore.getState().getAndClearCanvasCommands();
    for (const cmd of commands) {
      switch (cmd.action) {
        case "navigate":
          if (iframeRef.current && cmd.params?.url) {
            iframeRef.current.src = `/api/canvas/${cmd.params.url}`;
          }
          break;
        case "eval":
          if (bridgeRef.current && cmd.evalId && cmd.javaScript) {
            bridgeRef.current.eval(cmd.javaScript, cmd.evalId).then((result) => {
              fetch("/api/deck/canvas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ evalId: cmd.evalId, result }),
              });
            });
          }
          break;
        case "a2ui_push":
          if (bridgeRef.current && cmd.params?.jsonl) {
            bridgeRef.current.pushMessages([cmd.params.jsonl]);
            setState("ready");
          }
          break;
        case "a2ui_reset":
          bridgeRef.current?.reset();
          setState("empty");
          break;
      }
    }
  },
  [
    /* subscribe to canvas command queue changes */
  ],
);
```

- [ ] **Step 3: Wire canvasVisible to ChatPanel layout**

In ChatPanel, read `canvasVisible` from ui store. When true, set `rightPanelMode` to `"canvas"` so CanvasPanel mounts. This may already work via the existing `a2uiState.visible` mechanism — verify and wire accordingly.

- [ ] **Step 4: Verify tsc**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/panels/chat/CanvasPanel.tsx dashboard/src/components/panels/chat/ChatPanel.tsx
git commit -m "[enhanced] feat(deck): wire CanvasPanel for real-time canvas rendering"
```

---

### Task 10: Integration tests

**Files:**

- Modify: `dashboard/server/__tests__/node-connection.test.ts`

**Depends on:** Tasks 2-4

- [ ] **Step 1: Add protocol integration tests**

Tests using a mock WebSocket server:

1. Simulate Gateway connect.challenge → verify NodeConnection sends correct connect frame (client.id, mode, device.id, caps, commands, device signature)
2. Simulate Gateway hello-ok → verify connection established
3. Simulate Gateway event `node.invoke.request` with `canvas.a2ui.pushJSONL` → verify EventBus receives canvas event AND NodeConnection sends `node.invoke.result` request
4. Simulate eval round-trip: invoke.request → pending created → resolveEval called → verify invoke.result sent with payload
5. Verify stop() during pending eval: pending rejected, WebSocket closed

- [ ] **Step 2: Run tests**

Run: `cd dashboard && pnpm vitest run server/__tests__/node-connection.test.ts`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add dashboard/server/__tests__/node-connection.test.ts
git commit -m "[enhanced] test(deck): add protocol integration tests for canvas node connection"
```

---

### Task 11: Final verification

- [ ] **Step 1: Full type check**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: Zero errors for all dashboard files

- [ ] **Step 2: Run all dashboard tests**

Run: `cd dashboard && pnpm vitest run`
Expected: All PASS

- [ ] **Step 3: Manual smoke test**

Start dev environment: `scripts/dev/deck-dev.sh`

Verify in browser:

1. Gateway status shows "已连接"
2. In Gateway panel or console, verify Deck node appears in node list
3. (If possible) trigger a canvas command and verify CanvasPanel renders

- [ ] **Step 4: Commit if fixes needed**

```bash
git add -A dashboard/
git commit -m "[enhanced] fix(deck): resolve issues from canvas virtual node verification"
```
