# Deck Upstream Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate openclaw-deck to natively use upstream `sessions.*` API, dual-layer event architecture, `tools.effective`, and `config.schema.lookup`.

**Architecture:** 5 modules in dependency order. Module 0 (infrastructure) unblocks all. Module 1 (chat core) is highest value. Modules 2-4 are parallelizable after Module 0.

**Tech Stack:** Next.js 15, TypeScript, Zustand, next-intl, shadcn/ui, WebSocket (server-side), SSE (client-side)

**Skill dependencies:**
| Domain | Skills | Load strategy |
|--------|--------|--------------|
| `[frontend]` | frontend-design, shadcn-ui, superpowers:test-driven-development | Session first-load |
| `[backend]` | superpowers:test-driven-development | Session first-load |

**Design spec:** `docs/plans/2026-03-25-deck-upstream-sync-design.md`

---

## File Structure

### New files

| File                                                  | Responsibility                           |
| ----------------------------------------------------- | ---------------------------------------- |
| `dashboard/src/app/api/chat/sessions/create/route.ts` | `sessions.create` API route              |
| `dashboard/src/app/api/deck/tools-effective/route.ts` | `tools.effective` API route              |
| `dashboard/src/app/api/config/schema-lookup/route.ts` | `config.schema.lookup` API route         |
| `dashboard/src/hooks/useSessionEvents.ts`             | Frontend hook for Layer 2 session events |

### Notes

- TTS `edge` → `microsoft` rename: **no dashboard references exist** (verified via grep). No task needed.
- `sessions.patch` is already in the allowlist (no addition needed for fastMode toggle in Task 7).
- `chat-abort.ts` is a client-side AbortController manager, NOT a gateway caller. The gateway abort call lives in `dashboard/src/app/api/chat/abort/route.ts`.

### Modified files (by module)

| File                                                            | Module | Changes                                            |
| --------------------------------------------------------------- | ------ | -------------------------------------------------- |
| `dashboard/server/gateway-allowlist.ts`                         | 0      | Add 11 new RPC methods                             |
| `dashboard/server/gateway-adapter.ts`                           | 0      | Post-connect session subscription + reconnect hook |
| `dashboard/server/event-bus.ts`                                 | 0      | Add 3 new event types                              |
| `dashboard/server/run-event-pipeline.ts`                        | 0      | Classify 3 new event types                         |
| `dashboard/src/i18n/zh.json`                                    | 0      | New keys for lifecycle/steer/tools                 |
| `dashboard/src/i18n/en.json`                                    | 0      | Mirror zh.json keys                                |
| `dashboard/src/app/api/chat/send/route.ts`                      | 1      | Switch to `sessions.steer`                         |
| `dashboard/src/stores/chat-types.ts`                            | 1      | Extend SessionState/SessionMeta                    |
| `dashboard/src/stores/chat.ts`                                  | 1      | Remove client-side key generation                  |
| `dashboard/src/stores/chat-dispatchers.ts`                      | 1      | Process `session-state` events                     |
| `dashboard/src/app/api/chat/abort/route.ts`                     | 1      | Switch to `sessions.abort`                         |
| `dashboard/src/components/panels/chat/MessageInput.tsx`         | 1      | First-message creates session                      |
| `dashboard/src/components/panels/chat/RunStatusBar.tsx`         | 1      | Show lifecycle status                              |
| `dashboard/src/stores/sessions.ts`                              | 2      | Event-driven incremental updates                   |
| `dashboard/src/components/panels/sessions/SessionDetail.tsx`    | 2      | New fields display                                 |
| `dashboard/src/components/panels/sessions/SessionList.tsx`      | 2      | Status badges                                      |
| `dashboard/src/components/panels/sessions/ContextHealthBar.tsx` | 2      | Real-time contextTokens                            |
| `dashboard/src/components/panels/sessions/SessionExport.tsx`    | 2      | Paginated history export                           |
| `dashboard/src/stores/deck-agents.ts`                           | 3      | Add fetchEffectiveTools                            |
| `dashboard/src/components/panels/agents/tabs/ToolPolicyViz.tsx` | 3      | Effective tools view                               |
| `dashboard/src/stores/config.ts`                                | 4      | Add lookupSchema with cache                        |
| `dashboard/src/components/panels/config-editor/SectionNav.tsx`  | 4      | Lazy-load on expand                                |
| `dashboard/src/components/panels/config-editor/SchemaForm.tsx`  | 4      | Use hint for controls                              |

## File Cross Matrix

| File                          |  T0   |  T1   |  T2   |  T3   |  T4   |  T5   |  T6   |  T7   |  T8   |  T9   |
| ----------------------------- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| gateway-allowlist.ts          | **W** |       |       |       |       |       |       |       |       |       |
| gateway-adapter.ts            |       | **W** |       |       |       |       |       |       |       |       |
| event-bus.ts                  |       | **W** |       |       |       |       |       |       |       |       |
| run-event-pipeline.ts         |       |       | **W** |       |       |       |       |       |       |       |
| zh.json / en.json             |       |       |       | **W** |       |       |   W   |       |   W   |   W   |
| chat/send/route.ts            |       |       |       |       | **W** |       |       |       |       |       |
| chat/sessions/create/route.ts |       |       |       |       | **W** |       |       |       |       |       |
| chat-types.ts                 |       |       |       |       |       | **W** |       |       |       |       |
| chat.ts                       |       |       |       |       |       | **W** |       |       |       |       |
| chat-dispatchers.ts           |       |       |       |       |       |       | **W** |       |       |       |
| chat/abort/route.ts           |       |       |       |       |       |       | **W** |       |       |       |
| MessageInput.tsx              |       |       |       |       |       |       | **W** |       |       |       |
| RunStatusBar.tsx              |       |       |       |       |       |       | **W** |       |       |       |
| sessions.ts (store)           |       |       |       |       |       |       |       | **W** |       |       |
| SessionDetail.tsx             |       |       |       |       |       |       |       | **W** |       |       |
| deck-agents.ts                |       |       |       |       |       |       |       |       | **W** |       |
| ToolPolicyViz.tsx             |       |       |       |       |       |       |       |       | **W** |       |
| config.ts (store)             |       |       |       |       |       |       |       |       |       | **W** |
| SectionNav.tsx                |       |       |       |       |       |       |       |       |       | **W** |

No file conflicts between tasks — safe for parallel execution of T7-T9 after T6.

## Team Suggestion

**Matched collaboration patterns:** cross_domain_parallel + multi_module_coord

**Suggested roles:**

- **infra-dev** (opus): Tasks 0-3 [backend infrastructure]
- **chat-dev** (opus): Tasks 4-6 [chat core migration]
- **panel-dev** (opus): Tasks 7-9 [sessions/tools/config panels]
- Task 0-3 serial (infra), then Task 4-6 serial (chat), then Tasks 7-9 parallel (panels)

**Expected advantage:** Panel work (T7-9) has zero file overlap and can run in parallel after chat core lands.

---

## Task 0: Gateway Allowlist Update

**Files:**

- Modify: `dashboard/server/gateway-allowlist.ts`

- [ ] **Step 1: Add new RPC methods to allowlist**

```typescript
// After the "deck.threads" section, add:
// --- upstream sessions API ---
"sessions.create",
"sessions.send",
"sessions.steer",
"sessions.abort",
"sessions.get",
"sessions.subscribe",
"sessions.unsubscribe",
"sessions.messages.subscribe",
"sessions.messages.unsubscribe",
// --- upstream tools/config API ---
"tools.effective",
"config.schema.lookup",
```

- [ ] **Step 2: Run type check**

Run: `cd dashboard && npx tsc --noEmit`
Expected: PASS (no type errors from this change)

- [ ] **Step 3: Commit**

```bash
scripts/committer "[enhanced] feat(deck): add upstream sessions/tools/config methods to gateway allowlist" dashboard/server/gateway-allowlist.ts
```

---

## Task 1: Gateway Adapter Session Subscription

**Files:**

- Modify: `dashboard/server/gateway-adapter.ts`
- Test: `dashboard/server/__tests__/gateway-adapter.test.ts`

- [ ] **Step 1: Write failing test for post-connect subscription**

In `gateway-adapter.test.ts`, add a test that verifies `sessions.subscribe` is called after successful connect:

```typescript
it("calls sessions.subscribe after successful connect", async () => {
  // After adapter connects, verify that a request with method "sessions.subscribe" was sent
  const frames = getSentFrames();
  const subscribeFrame = frames.find((f) => f.method === "sessions.subscribe");
  expect(subscribeFrame).toBeDefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npx vitest run server/__tests__/gateway-adapter.test.ts -t "sessions.subscribe"`
Expected: FAIL

- [ ] **Step 3: Implement post-connect subscription**

In `gateway-adapter.ts`, after the connect settles successfully (around line 357 where `resolve()` is called), add:

```typescript
// After successful connect, subscribe to session events
this.request("sessions.subscribe", {}).catch(() => {
  // Non-fatal: session events won't arrive but core functionality works
});
```

- [ ] **Step 4: Add reconnection re-subscription**

In `scheduleReconnect` flow — after `this.start()` resolves in the reconnect timer callback (line 422), the connect flow already re-runs which will trigger the post-connect subscription again. Verify this is the case.

For `sessions.messages.subscribe`, add a `Set<string>` field `activeMessageSubscriptions` to track which session keys have message subscriptions. After reconnect, re-subscribe all:

```typescript
private activeMessageSubscriptions = new Set<string>();

// Public method for consumers to subscribe to session messages
async subscribeSessionMessages(key: string): Promise<void> {
  this.activeMessageSubscriptions.add(key);
  await this.request("sessions.messages.subscribe", { key });
}

async unsubscribeSessionMessages(key: string): Promise<void> {
  this.activeMessageSubscriptions.delete(key);
  await this.request("sessions.messages.unsubscribe", { key });
}
```

In the post-connect subscription block, re-subscribe all tracked keys:

```typescript
for (const key of this.activeMessageSubscriptions) {
  this.request("sessions.messages.subscribe", { key }).catch(() => {});
}
```

- [ ] **Step 5: Run tests**

Run: `cd dashboard && npx vitest run server/__tests__/gateway-adapter.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
scripts/committer "[enhanced] feat(deck): auto-subscribe to session events on gateway connect" dashboard/server/gateway-adapter.ts dashboard/server/__tests__/gateway-adapter.test.ts
```

---

## Task 2: Session Event Routing

Session events (Layer 2) bypass RunEventPipeline — they are NOT stored in run_events. Route directly from gateway-adapter to EventBus → SSE stream.

**Files:**

- Modify: `dashboard/server/event-bus.ts`
- Modify: `dashboard/server/gateway-adapter.ts`
- Test: `dashboard/server/run-event-pipeline.test.ts`

- [ ] **Step 1: Add new event types to EventBus**

In `event-bus.ts`, extend `DeckEventType`:

```typescript
export type DeckEventType =
  | "runtime.status"
  | "gateway.event"
  | "chat"
  | "agent"
  | "agent.updated"
  | "gateway.health"
  | "notification.toast"
  // P1 additions
  | "log.entry"
  | "activity.event"
  // P2 additions
  | "approval.pending"
  | "approval.resolved"
  | "budget.warn"
  | "budget.over"
  | "alert.fired"
  | "webhook.delivery"
  | "cron.run.complete"
  // Upstream session events (Layer 2)
  | "session-state"
  | "session-msg"
  | "session-tool";
```

- [ ] **Step 2: Write failing test for new event classification**

In `run-event-pipeline.test.ts`, add tests:

```typescript
describe("session event classification", () => {
  it("classifies sessions.changed as session-state", () => {
    const result = classifyEvent("sessions.changed", {
      sessionKey: "agent:main:dashboard:123",
      reason: "send",
      ts: Date.now(),
    });
    expect(result).toBe("session-state");
  });

  it("classifies session.message as session-msg", () => {
    const result = classifyEvent("session.message", {
      sessionKey: "agent:main:dashboard:123",
      message: {},
    });
    expect(result).toBe("session-msg");
  });

  it("classifies session.tool as session-tool", () => {
    const result = classifyEvent("session.tool", {
      runId: "run-1",
      stream: "tool",
    });
    expect(result).toBe("session-tool");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run server/run-event-pipeline.test.ts -t "session event"`
Expected: FAIL

- [ ] **Step 4: Extend classifyEvent to handle new event types**

In `run-event-pipeline.ts`, update `classifyEvent` signature and add cases:

```typescript
export function classifyEvent(
  eventType: "chat" | "agent" | "sessions.changed" | "session.message" | "session.tool",
  payload: unknown,
): RunEventStream | null {
  // New session events — pass through as-is (not stored in run_events, forwarded via SSE)
  if (eventType === "sessions.changed") return "session-state" as RunEventStream;
  if (eventType === "session.message") return "session-msg" as RunEventStream;
  if (eventType === "session.tool") return "session-tool" as RunEventStream;

  // existing classification...
```

Also extend `RunEventStream` type:

```typescript
export type RunEventStream =
  | "model"
  | "tool_call"
  | "file_op"
  | "subagent"
  | "system"
  | "compaction"
  | "session-state"
  | "session-msg"
  | "session-tool";
```

- [ ] **Step 5: Ensure the EventBus dispatches these from gateway events**

In `gateway-adapter.ts` `emitEvent` method, the `gateway.event` type already passes through all events. The SSE `/api/stream` route needs to forward these new types. Verify the stream route handles them by checking `dashboard/src/app/api/stream/route.ts` — it should forward all EventBus events to EventSource. If it filters by event type, add the three new types.

- [ ] **Step 6: Run tests**

Run: `cd dashboard && npx vitest run server/run-event-pipeline.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
scripts/committer "[enhanced] feat(deck): extend SSE pipeline for session-state/msg/tool events" dashboard/server/event-bus.ts dashboard/server/run-event-pipeline.ts dashboard/server/run-event-pipeline.test.ts
```

---

## Task 3: i18n Keys

**Files:**

- Modify: `dashboard/src/i18n/zh.json`
- Modify: `dashboard/src/i18n/en.json`

- [ ] **Step 1: Add session lifecycle keys**

In both `zh.json` and `en.json`, add under `"sessions"` namespace:

```json
"statusIdle": "空闲" / "Idle",
"statusRunning": "运行中" / "Running",
"statusDone": "已完成" / "Done",
"statusFailed": "失败" / "Failed",
"statusKilled": "已中止" / "Killed",
"statusTimeout": "超时" / "Timeout",
"fastMode": "快速模式" / "Fast Mode",
"subagentRole": "子代理角色" / "Subagent Role",
"subagentRoleOrchestrator": "编排器" / "Orchestrator",
"subagentRoleLeaf": "叶子节点" / "Leaf",
"subagentControlScope": "控制范围" / "Control Scope",
"subagentControlScopeChildren": "子级" / "Children",
"subagentControlScopeNone": "无" / "None",
"spawnedWorkspaceDir": "工作区目录" / "Workspace Dir",
"parentSession": "父会话" / "Parent Session",
"childSessions": "子会话" / "Child Sessions",
"startedAt": "开始时间" / "Started At",
"endedAt": "结束时间" / "Ended At",
"runtimeMs": "运行时长" / "Runtime",
"interruptedRun": "已中断当前运行" / "Interrupted active run"
```

- [ ] **Step 2: Add tools.effective keys**

Under `"agents"` namespace:

```json
"effectiveTools": "生效工具" / "Effective Tools",
"toolAllowed": "已允许" / "Allowed",
"toolDenied": "已拒绝" / "Denied",
"toolSource": "来源" / "Source"
```

- [ ] **Step 3: Add config lookup keys**

Under `"config"` namespace:

```json
"schemaLookupFallback": "配置查询不可用，使用完整加载" / "Schema lookup unavailable, using full load"
```

- [ ] **Step 4: Commit**

```bash
scripts/committer "[enhanced] feat(deck): add i18n keys for session lifecycle, tools.effective, config lookup" dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
```

---

## Task 4: Chat Send/Create API Routes

**Files:**

- Modify: `dashboard/src/app/api/chat/send/route.ts`
- Create: `dashboard/src/app/api/chat/sessions/create/route.ts`

- [ ] **Step 1: Create sessions/create route**

```typescript
/**
 * POST /api/chat/sessions/create — Create a new session via Gateway.
 */
import { NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as {
    agentId?: string;
    message?: string;
    model?: string;
    label?: string;
    parentSessionKey?: string;
  };

  return gatewayRequest("sessions.create", {
    ...(body.agentId ? { agentId: body.agentId } : {}),
    ...(body.message?.trim() ? { message: body.message } : {}),
    ...(body.model?.trim() ? { model: body.model } : {}),
    ...(body.label?.trim() ? { label: body.label } : {}),
    ...(body.parentSessionKey?.trim() ? { parentSessionKey: body.parentSessionKey } : {}),
  });
});
```

- [ ] **Step 2: Migrate chat/send to sessions.steer**

Replace the body of `dashboard/src/app/api/chat/send/route.ts`:

```typescript
/**
 * POST /api/chat/send — Send a message via sessions.steer (safe for idle and running).
 *
 * Gateway contract (`SessionsSendParamsSchema`):
 *   { key, message, thinking?, attachments?, timeoutMs?, idempotencyKey? }
 */
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as {
    message?: string;
    sessionKey?: string;
    thinking?: string;
    idempotencyKey?: string;
    attachments?: Array<{
      type?: string;
      mimeType?: string;
      fileName?: string;
      content: string;
    }>;
  };

  if (!body.message?.trim() && (!body.attachments || body.attachments.length === 0)) {
    return Response.json({ error: "message or attachment required" }, { status: 400 });
  }
  if (!body.sessionKey?.trim()) {
    return Response.json({ error: "sessionKey is required" }, { status: 400 });
  }

  const idempotencyKey = body.idempotencyKey?.trim() || randomUUID();

  return gatewayRequest("sessions.steer", {
    key: body.sessionKey,
    message: body.message ?? "",
    thinking: body.thinking ?? undefined,
    idempotencyKey,
    ...(body.attachments && body.attachments.length > 0 ? { attachments: body.attachments } : {}),
  });
});
```

Key change: `chat.send` → `sessions.steer`, `sessionKey` param → `key` param.

- [ ] **Step 3: Run type check**

Run: `cd dashboard && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
scripts/committer "[enhanced] feat(deck): migrate chat send to sessions.steer, add sessions/create route" dashboard/src/app/api/chat/send/route.ts dashboard/src/app/api/chat/sessions/create/route.ts
```

---

## Task 5: Chat Store Type Extensions

**Files:**

- Modify: `dashboard/src/stores/chat-types.ts`

- [ ] **Step 1: Extend SessionState with lifecycle fields**

Replace the `status` field and add new fields:

```typescript
export interface SessionState {
  messages: ChatMessage[];
  isStreaming: boolean;
  /** Session lifecycle status from Gateway. Replaces old "idle"|"active" enum. */
  status: "idle" | "running" | "done" | "failed" | "killed" | "timeout";
  streamingRunId: string | null;
  error: string | null;
  toolProgress: Record<string, ToolProgress>;
  activeApproval: ApprovalRequest | null;
  runMetadata: Record<string, RunMetadata>;
  a2uiState: A2UIState | null;
  lastAccessedAt: number;
  // New lifecycle fields
  startedAt?: number;
  endedAt?: number;
  runtimeMs?: number;
  fastMode?: boolean;
}
```

- [ ] **Step 2: Extend SessionMeta with snapshot fields**

```typescript
export interface SessionMeta {
  key: string;
  agentId: string;
  title?: string;
  updatedAt: number;
  lastMessagePreview?: string;
  // New fields from sessions.changed snapshots
  status?: string;
  model?: string;
  totalTokens?: number;
  estimatedCostUsd?: number;
  parentSessionKey?: string;
  childSessions?: string[];
  contextTokens?: number;
  // Subagent fields (loaded via sessions.list, not events)
  subagentRole?: "orchestrator" | "leaf";
  subagentControlScope?: "children" | "none";
  spawnedWorkspaceDir?: string;
}
```

- [ ] **Step 3: Update createEmptySessionState**

Change the default `status` from `"idle"` (the old enum) — confirm the `createEmptySessionState` function sets `status: "idle"`. Find it and update if the old value was `"active"`.

- [ ] **Step 4: Fix all consumers of `status: "active"`**

Search dashboard for `=== "active"` or `status: "active"` and update to `=== "running"`.

Run: `grep -r '"active"' dashboard/src/stores/ dashboard/src/components/ --include='*.ts' --include='*.tsx' | grep status`

Update each match.

- [ ] **Step 5: Run type check**

Run: `cd dashboard && npx tsc --noEmit`
Expected: PASS (or existing errors only)

- [ ] **Step 6: Commit**

```bash
scripts/committer "[enhanced] feat(deck): extend SessionState/SessionMeta with lifecycle and subagent fields" dashboard/src/stores/chat-types.ts
```

---

## Task 6: Chat Core — Store + Dispatchers + Components

**Files:**

- Modify: `dashboard/src/stores/chat.ts`
- Modify: `dashboard/src/stores/chat-dispatchers.ts`
- Modify: `dashboard/src/app/api/chat/abort/route.ts`
- Modify: `dashboard/src/components/panels/chat/MessageInput.tsx`
- Modify: `dashboard/src/components/panels/chat/RunStatusBar.tsx`
- Modify: `dashboard/src/i18n/zh.json` (if missed in Task 3)
- Modify: `dashboard/src/i18n/en.json` (if missed in Task 3)

- [ ] **Step 1: Remove client-side sessionKey generation from chat.ts**

Find where `sessionKey` is generated (pattern: `agent:${agentId}:web-${Date.now()}`). Remove that logic. The `ensureSession` function should only accept keys from the Gateway (via `sessions.create`).

- [ ] **Step 2: Add session-state event dispatcher in chat-dispatchers.ts**

Add a handler for `session-state` events from SSE:

```typescript
export function dispatchSessionStateEvent(payload: Record<string, unknown>): void {
  const sessionKey = typeof payload.sessionKey === "string" ? payload.sessionKey : "";
  if (!sessionKey) return;

  const store = useChatStore.getState();
  const session = store.sessions.get(sessionKey);
  if (!session) return;

  // Update lifecycle status from sessions.changed event
  const phase = typeof payload.phase === "string" ? payload.phase : undefined;
  const reason = typeof payload.reason === "string" ? payload.reason : undefined;

  if (phase === "start" || reason === "send" || reason === "steer") {
    store.setStreaming(sessionKey, true, payload.runId as string | undefined);
  }
  if (phase === "end") {
    store.setStreaming(sessionKey, false);
  }
  if (phase === "error") {
    store.setStreaming(sessionKey, false);
    store.setSessionError(sessionKey, "Run failed");
  }

  // Update lifecycle metadata
  if (typeof payload.startedAt === "number") session.startedAt = payload.startedAt;
  if (typeof payload.endedAt === "number") session.endedAt = payload.endedAt;
  if (typeof payload.runtimeMs === "number") session.runtimeMs = payload.runtimeMs;
  if (typeof payload.status === "string") {
    // Map Gateway status to SessionState status
    const mapped = payload.status as SessionState["status"];
    if (["idle", "running", "done", "failed", "killed", "timeout"].includes(mapped)) {
      // Update via store setter
    }
  }
}
```

- [ ] **Step 3: Migrate abort route to sessions.abort**

In `dashboard/src/app/api/chat/abort/route.ts`, change `chat.abort` to `sessions.abort` and `sessionKey` param to `key`:

```typescript
return gatewayRequest("sessions.abort", {
  key: body.sessionKey,
  runId: body.runId ?? undefined,
});
```

Note: `chat-abort.ts` (client-side AbortController manager) stays unchanged — it manages fetch cancellation, not gateway RPC.

- [ ] **Step 4: Update MessageInput.tsx for create-then-send flow**

In `MessageInput.tsx`, when sending the first message to a new session:

```typescript
// If no activeSessionKey, create session first
if (!activeSessionKey) {
  const createRes = await fetch("/api/chat/sessions/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId, message: text, model }),
  });
  const data = await createRes.json();
  if (data.key) {
    setActiveSession(data.key);
    // Message was already sent via sessions.create's message param
    return;
  }
}

// Existing session — send via sessions.steer
const res = await fetch("/api/chat/send", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ sessionKey: activeSessionKey, message: text, thinking, attachments }),
});
```

- [ ] **Step 5: Update RunStatusBar.tsx to show lifecycle status**

Add status badge that reflects `session.status`:

```typescript
const statusColors: Record<string, string> = {
  idle: "var(--neutral-muted)",
  running: "var(--primary)",
  done: "var(--success)",
  failed: "var(--destructive)",
  killed: "var(--warning)",
  timeout: "var(--warning)",
};
```

Use `t("sessions.statusRunning")` etc. for labels.

- [ ] **Step 6: Add session-state event listener to existing SSE hook**

The existing `useChatSSE` hook creates the `EventSource` instance. Rather than creating a separate hook with a separate EventSource (which doesn't work — EventSource is local to useChatSSE), extend `useChatSSE` to also listen for `session-state` events:

In `dashboard/src/components/panels/chat/useChatSSE.ts` (or wherever the EventSource is created), add:

```typescript
source.addEventListener("session-state", (e) => {
  const payload = JSON.parse(e.data);
  dispatchSessionStateEvent(payload);
});
```

Also create `dashboard/src/hooks/useSessionEvents.ts` as a **re-export convenience** that wraps the dispatch function for use in non-chat panels (Sessions panel, Monitor panel):

```typescript
import { useEffect } from "react";
import { useEventBus } from "@/lib/event-bus-client";
import { dispatchSessionStateEvent } from "@/stores/chat-dispatchers";

/** Subscribe to session-state events for non-chat panels. */
export function useSessionEvents() {
  const events = useEventBus();
  useEffect(() => {
    const unsub = events.subscribe("session-state", (e) => {
      dispatchSessionStateEvent(e.data as Record<string, unknown>);
    });
    return unsub;
  }, [events]);
}
```

- [ ] **Step 7: Run type check and verify**

Run: `cd dashboard && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 8: Manual smoke test**

Start dev environment: `scripts/dev/deck-dev.sh`

1. Open Chat panel, send a message → should create session via `sessions.create`
2. Send follow-up → should use `sessions.steer`
3. Click stop during active run → should call `sessions.abort`
4. RunStatusBar should show "Running" during active run, "Done" after completion

- [ ] **Step 9: Commit**

```bash
scripts/committer "[enhanced] feat(deck): migrate chat core to sessions.create/steer/abort API" \
  dashboard/src/stores/chat.ts \
  dashboard/src/stores/chat-dispatchers.ts \
  dashboard/src/app/api/chat/abort/route.ts \
  dashboard/src/components/panels/chat/MessageInput.tsx \
  dashboard/src/components/panels/chat/RunStatusBar.tsx \
  dashboard/src/hooks/useSessionEvents.ts
```

---

## Task 7: Sessions Panel Enhancement

**Files:**

- Modify: `dashboard/src/stores/sessions.ts`
- Modify: `dashboard/src/components/panels/sessions/SessionDetail.tsx`
- Modify: `dashboard/src/components/panels/sessions/SessionList.tsx`
- Modify: `dashboard/src/components/panels/sessions/ContextHealthBar.tsx`
- Modify: `dashboard/src/components/panels/sessions/SessionExport.tsx`

- [ ] **Step 1: Add event-driven updates to sessions store**

In `sessions.ts`, add a handler for `session-state` events:

```typescript
applySessionChangedEvent: (payload: Record<string, unknown>) => {
  const key = payload.sessionKey as string;
  if (!key) return;
  set((state) => {
    const sessions = [...state.sessions];
    const idx = sessions.findIndex(s => s.key === key);
    const patch: Partial<SessionMeta> = {
      updatedAt: (payload.ts as number) ?? Date.now(),
      ...(typeof payload.status === "string" ? { status: payload.status } : {}),
      ...(typeof payload.model === "string" ? { model: payload.model } : {}),
      ...(typeof payload.totalTokens === "number" ? { totalTokens: payload.totalTokens } : {}),
      ...(typeof payload.estimatedCostUsd === "number" ? { estimatedCostUsd: payload.estimatedCostUsd } : {}),
      ...(typeof payload.contextTokens === "number" ? { contextTokens: payload.contextTokens } : {}),
    };
    if (idx >= 0) {
      sessions[idx] = { ...sessions[idx], ...patch };
    } else if (payload.reason === "create") {
      sessions.unshift({ key, agentId: extractAgentId(key) ?? "main", ...patch });
    }
    return { sessions };
  });
},
```

- [ ] **Step 2: Add status badges to SessionList**

Show colored badge per session based on `meta.status`:

- `running` → blue pulse
- `done` → green
- `failed` → red
- `killed`/`timeout` → amber

Use `t("sessions.statusRunning")` etc.

- [ ] **Step 3: Add new fields to SessionDetail**

Add sections for: lifecycle times, fastMode toggle, model selector, subagent info (conditional), parent/child navigation.

For `fastMode` toggle: call `sessions.patch` via gateway:

```typescript
const toggleFastMode = async () => {
  await fetch("/api/deck/proxy", {
    method: "POST",
    body: JSON.stringify({
      method: "sessions.patch",
      params: { key: sessionKey, fastMode: !currentFastMode },
    }),
  });
};
```

- [ ] **Step 4: Update ContextHealthBar for real-time contextTokens**

Instead of polling, read `contextTokens` from the session meta (updated by `session-state` events).

- [ ] **Step 5: Enhance SessionExport with paginated history**

Add export function using `sessions-history-http`:

```typescript
async function exportSessionHistory(key: string): Promise<unknown[]> {
  const allMessages: unknown[] = [];
  let cursor: string | undefined;
  do {
    const params = new URLSearchParams({ limit: "1000" });
    if (cursor) params.set("cursor", cursor);
    const res = await fetch(`/api/sessions/${encodeURIComponent(key)}/history?${params}`);
    const data = await res.json();
    allMessages.push(...data.messages);
    cursor = data.hasMore ? data.nextCursor : undefined;
  } while (cursor);
  return allMessages;
}
```

- [ ] **Step 6: Run type check**

Run: `cd dashboard && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
scripts/committer "[enhanced] feat(deck): sessions panel real-time updates, lifecycle fields, paginated export" \
  dashboard/src/stores/sessions.ts \
  dashboard/src/components/panels/sessions/SessionDetail.tsx \
  dashboard/src/components/panels/sessions/SessionList.tsx \
  dashboard/src/components/panels/sessions/ContextHealthBar.tsx \
  dashboard/src/components/panels/sessions/SessionExport.tsx
```

---

## Task 8: Agent Tools Effective Integration

**Files:**

- Create: `dashboard/src/app/api/deck/tools-effective/route.ts`
- Modify: `dashboard/src/stores/deck-agents.ts`
- Modify: `dashboard/src/components/panels/agents/tabs/ToolPolicyViz.tsx`
- Modify: `dashboard/src/i18n/zh.json`
- Modify: `dashboard/src/i18n/en.json`

- [ ] **Step 1: Create API route**

```typescript
import { NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as {
    agentId?: string;
    sessionKey?: string;
  };
  return gatewayRequest("tools.effective", {
    ...(body.agentId ? { agentId: body.agentId } : {}),
    ...(body.sessionKey ? { sessionKey: body.sessionKey } : {}),
  });
});
```

- [ ] **Step 2: Add fetchEffectiveTools to deck-agents store**

```typescript
fetchEffectiveTools: async (agentId: string, sessionKey?: string) => {
  set({ effectiveToolsLoading: true });
  try {
    const res = await fetch("/api/deck/tools-effective", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, sessionKey }),
    });
    const data = await res.json();
    set({ effectiveTools: data.groups ?? [], effectiveToolsLoading: false });
  } catch {
    set({ effectiveToolsLoading: false });
  }
},
```

- [ ] **Step 3: Add Effective Tools tab/section to ToolPolicyViz**

Add a collapsible section or tab showing the effective tools grouped by source. Each tool shows: name, allowed/denied badge, source label.

```tsx
{
  groups.map((group) => (
    <div key={group.name}>
      <h4>{group.name}</h4>
      {group.tools.map((tool) => (
        <div key={tool.id} className="flex items-center gap-2">
          <span>{tool.name}</span>
          <Badge variant={tool.allowed ? "default" : "destructive"}>
            {tool.allowed ? t("agents.toolAllowed") : t("agents.toolDenied")}
          </Badge>
          <span className="text-muted-foreground text-xs">{tool.source}</span>
        </div>
      ))}
    </div>
  ));
}
```

- [ ] **Step 4: Run type check**

Run: `cd dashboard && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
scripts/committer "[enhanced] feat(deck): integrate tools.effective API into agent ToolPolicyViz" \
  dashboard/src/app/api/deck/tools-effective/route.ts \
  dashboard/src/stores/deck-agents.ts \
  dashboard/src/components/panels/agents/tabs/ToolPolicyViz.tsx \
  dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
```

---

## Task 9: Config Schema Lookup Integration

**Files:**

- Create: `dashboard/src/app/api/config/schema-lookup/route.ts`
- Modify: `dashboard/src/stores/config.ts`
- Modify: `dashboard/src/components/panels/config-editor/SectionNav.tsx`
- Modify: `dashboard/src/components/panels/config-editor/SchemaForm.tsx`
- Modify: `dashboard/src/i18n/zh.json`
- Modify: `dashboard/src/i18n/en.json`

- [ ] **Step 1: Create API route**

```typescript
import { NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as { path?: string };
  if (!body.path?.trim()) {
    return Response.json({ error: "path is required" }, { status: 400 });
  }
  return gatewayRequest("config.schema.lookup", { path: body.path });
});
```

- [ ] **Step 2: Add lookupSchema action to config store**

```typescript
private schemaCache = new Map<string, SchemaLookupResult>();
private lookupFallbackMode = false;

lookupSchema: async (path: string) => {
  if (get().lookupFallbackMode) return null;
  const cached = get().schemaCache.get(path);
  if (cached) return cached;

  try {
    const res = await fetch("/api/config/schema-lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    if (!res.ok) throw new Error("lookup failed");
    const data = await res.json();
    set((state) => {
      const cache = new Map(state.schemaCache);
      cache.set(path, data);
      return { schemaCache: cache };
    });
    return data;
  } catch {
    set({ lookupFallbackMode: true });
    return null;
  }
},
```

- [ ] **Step 3: Update SectionNav for lazy loading**

Replace eager tree loading with on-expand lookup:

```typescript
const handleExpand = async (path: string) => {
  const result = await lookupSchema(path);
  if (result) {
    // Populate children from result.children
    setChildren(path, result.children);
  } else {
    // Fallback: use full schema tree (already loaded)
  }
};
```

- [ ] **Step 4: Update SchemaForm to use hints**

When rendering a field, check if `hint` is available from the lookup result:

```typescript
if (hint?.inputType === "password") return <PasswordField ... />;
if (hint?.inputType === "file") return <FilePathField ... />;
if (hint?.enum) return <SelectField options={hint.enum} ... />;
```

- [ ] **Step 5: Run type check**

Run: `cd dashboard && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
scripts/committer "[enhanced] feat(deck): integrate config.schema.lookup with lazy loading and fallback" \
  dashboard/src/app/api/config/schema-lookup/route.ts \
  dashboard/src/stores/config.ts \
  dashboard/src/components/panels/config-editor/SectionNav.tsx \
  dashboard/src/components/panels/config-editor/SchemaForm.tsx \
  dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
```

---

## Task 10: Integration Verification

**Files:** None (verification only)

- [ ] **Step 1: Run full type check**

Run: `cd dashboard && npx tsc --noEmit`
Expected: PASS (zero new errors)

- [ ] **Step 2: Run existing tests**

Run: `cd dashboard && npx vitest run`
Expected: All existing tests pass

- [ ] **Step 3: Manual smoke test with live Gateway**

Start: `scripts/dev/deck-dev.sh`

Verify:

1. Chat: create session → sends message → streaming works → steer during run → abort works
2. Sessions panel: real-time status badges update on send/complete/abort
3. Session detail: shows lifecycle times, fastMode toggle works, subagent fields visible for subagent sessions
4. Agent tools: ToolPolicyViz shows effective tools tab
5. Config: SectionNav lazy-loads children on expand, falls back gracefully if lookup fails

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
scripts/committer "[enhanced] fix(deck): integration fixes for upstream sync" <files>
```
