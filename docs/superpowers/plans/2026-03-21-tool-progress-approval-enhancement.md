# Tool Progress + Approval Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the `toolProgress` and `activeApproval` slots in the session-scoped state infrastructure with real data and UI, enabling real-time tool execution tracking and session-aware approval routing.

**Architecture:** Two orthogonal features built on the Proposal 1 session-scoped state infrastructure. Tool Progress enhances `dispatchAgentEvent` to also update `toolProgress` records on each phase transition, then renders them via a new `ToolProgressBar` component. Approval Enhancement fixes the server-side `approval-bridge.ts` to extract and forward `sessionKey` from Gateway events, adds session indicator dots in the sidebar, and restores pending approvals on page refresh.

**Tech Stack:** TypeScript, Zustand (session-scoped Map store), React, next-intl, Vitest

---

## File Structure

| File                                                                              | Action | Responsibility                                                                        |
| --------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------- |
| `dashboard/server/approval-bridge.ts`                                             | Modify | Extract `sessionKey` from Gateway `request` object, include in broadcast              |
| `dashboard/src/components/panels/chat/useChatSSE.ts`                              | Modify | Enhance `dispatchAgentEvent` to update `toolProgress` on start/result/error phases    |
| `dashboard/src/components/panels/chat/ToolProgressBar.tsx`                        | Create | Collapsible bar showing running tool names + elapsed time                             |
| `dashboard/src/components/panels/chat/ChatPanel.tsx`                              | Modify | Wire `ToolProgressBar` above `ApprovalDialog`, add approval refresh-recovery on mount |
| `dashboard/src/components/panels/chat/SessionSidebar.tsx`                         | Modify | Add session indicator dot using `useSessionIndicator` hook                            |
| `dashboard/src/i18n/zh.json`                                                      | Modify | Add translation keys for tool progress + indicator labels                             |
| `dashboard/src/i18n/en.json`                                                      | Modify | Add English translation keys                                                          |
| `dashboard/src/components/panels/chat/__tests__/tool-progress-dispatcher.test.ts` | Create | Tests for dispatchAgentEvent toolProgress updates                                     |
| `dashboard/server/__tests__/approval-bridge.test.ts`                              | Modify | Add test for sessionKey extraction                                                    |

---

### Task 1: Server — Approval Bridge sessionKey Passthrough

**[backend]**

**Context:** The Gateway broadcasts `exec.approval.requested` events with `{ id, request: { command, sessionKey, agentId, ... }, createdAtMs, expiresAtMs }`. The `approval-bridge.ts` currently extracts `command`, `commandArgv`, `agentId`, `cwd` from `request` but ignores `sessionKey`. This means `dispatchApproval` on the client receives no `sessionKey` and silently drops the event (`if (!sessionKey) return`).

**Files:**

- Modify: `dashboard/server/approval-bridge.ts`
- Modify: `dashboard/server/__tests__/approval-bridge.test.ts`

- [ ] **Step 1: Write failing test — sessionKey is forwarded in approval.pending broadcast**

In `dashboard/server/__tests__/approval-bridge.test.ts`, add a new test inside the `describe("initApprovalBridge", ...)` block. The test must call `initApprovalBridge(createMockRuntime(bus))` before broadcasting (following the existing test pattern):

```typescript
it("forwards sessionKey from request in approval.pending broadcast", () => {
  const runtime = createMockRuntime(bus);
  initApprovalBridge(runtime);

  const events: Array<{ type: string; data: unknown }> = [];
  bus.subscribe((e) => {
    if (e.type === "approval.pending") events.push(e);
  });

  bus.broadcast("gateway.event", {
    type: "gateway.event",
    event: "exec.approval.requested",
    payload: {
      id: "ap-sk-1",
      request: {
        command: "ls",
        agentId: "main",
        sessionKey: "agent:main:web-123",
      },
      createdAtMs: Date.now(),
      expiresAtMs: Date.now() + 300_000,
    },
  });

  expect(events).toHaveLength(1);
  const data = events[0].data as Record<string, unknown>;
  expect(data.id).toBe("ap-sk-1");
  expect(data.sessionKey).toBe("agent:main:web-123");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npx vitest run server/__tests__/approval-bridge.test.ts --reporter=verbose`
Expected: FAIL — `data.sessionKey` is `undefined`

- [ ] **Step 3: Add sessionKey to PendingApproval type and extraction logic**

In `dashboard/server/approval-bridge.ts`:

1. Add `sessionKey` to `PendingApproval` interface:

```typescript
export interface PendingApproval {
  id: string;
  command: string;
  commandArgv?: string[];
  agentId?: string;
  sessionKey?: string; // ← ADD THIS
  cwd?: string;
  createdAtMs: number;
  expiresAtMs: number;
}
```

2. In the `exec.approval.requested` handler, extract `sessionKey` from `request`:

```typescript
const approval: PendingApproval = {
  id: typeof innerPayload.id === "string" ? innerPayload.id : "",
  command: typeof request.command === "string" ? request.command : "",
  commandArgv: Array.isArray(request.commandArgv) ? (request.commandArgv as string[]) : undefined,
  agentId: typeof request.agentId === "string" ? request.agentId : undefined,
  sessionKey: typeof request.sessionKey === "string" ? request.sessionKey : undefined, // ← ADD THIS
  cwd: typeof request.cwd === "string" ? request.cwd : undefined,
  createdAtMs: Number(innerPayload.createdAtMs ?? Date.now()),
  expiresAtMs: Number(innerPayload.expiresAtMs ?? Date.now() + 300_000),
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd dashboard && npx vitest run server/__tests__/approval-bridge.test.ts --reporter=verbose`
Expected: ALL PASS

- [ ] **Step 5: Also forward sessionKey in approval.resolved broadcast**

In the `exec.approval.resolved` handler, the code already spreads `...innerPayload`. But the resolved event from Gateway includes `id` and potentially `request`. Check: the current spread `{ id, ...innerPayload }` should already include any extra fields. No change needed if Gateway includes sessionKey in resolved events.

However, the client `dispatchApprovalResolved` only needs `sessionKey` to find the right session. Currently the resolved event may not carry sessionKey. Add a lookup from the `pendingMap` before deleting:

```typescript
} else if (innerEvent === "exec.approval.resolved" && innerPayload) {
  const id = typeof innerPayload.id === "string" ? innerPayload.id : "";
  if (id) {
    const pending = pendingMap.get(id);
    const sessionKey = pending?.sessionKey;
    pendingMap.delete(id);
    eventBus.broadcast("approval.resolved", { id, sessionKey, ...innerPayload });
  }
}
```

- [ ] **Step 6: Add test for resolved event including sessionKey**

```typescript
it("includes sessionKey from pending map in approval.resolved broadcast", () => {
  const runtime = createMockRuntime(bus);
  initApprovalBridge(runtime);

  // First, create a pending approval with sessionKey
  bus.broadcast("gateway.event", {
    type: "gateway.event",
    event: "exec.approval.requested",
    payload: {
      id: "ap-resolve-sk",
      request: { command: "rm -rf /tmp/test", sessionKey: "agent:main:web-456" },
      createdAtMs: Date.now(),
      expiresAtMs: Date.now() + 300_000,
    },
  });

  const events: Array<{ type: string; data: unknown }> = [];
  bus.subscribe((e) => {
    if (e.type === "approval.resolved") events.push(e);
  });

  bus.broadcast("gateway.event", {
    type: "gateway.event",
    event: "exec.approval.resolved",
    payload: { id: "ap-resolve-sk" },
  });

  expect(events).toHaveLength(1);
  const data = events[0].data as Record<string, unknown>;
  expect(data.sessionKey).toBe("agent:main:web-456");
});
```

- [ ] **Step 7: Run all approval-bridge tests**

Run: `cd dashboard && npx vitest run server/__tests__/approval-bridge.test.ts --reporter=verbose`
Expected: ALL PASS

- [ ] **Step 8: Commit**

```bash
git add dashboard/server/approval-bridge.ts dashboard/server/__tests__/approval-bridge.test.ts
git commit -m "[enhanced] feat(deck): forward sessionKey in approval-bridge broadcasts"
```

---

### Task 2: Dispatcher — Enhance dispatchAgentEvent for Tool Progress Tracking

**[frontend]**

**Context:** `dispatchAgentEvent` in `useChatSSE.ts` currently only handles `phase === "start"` to append a `tool_use` content block to the streaming message. It ignores other phases. To fill the `toolProgress` slot, it must also call `updateToolProgress()` on each phase:

- `start` → create entry with status `"running"`
- `result` / `complete` → update to `"completed"` with `completedAt`
- `error` → update to `"error"` with `completedAt`

The store action `updateToolProgress(sessionKey, toolUseId, progress)` already exists (see `dashboard/src/stores/chat.ts:232`). The `ToolProgress` type has fields: `toolUseId`, `name`, `status`, `startedAt`, `completedAt?`.

**Files:**

- Modify: `dashboard/src/components/panels/chat/useChatSSE.ts` (lines 229-279, `dispatchAgentEvent`)
- Create: `dashboard/src/components/panels/chat/__tests__/tool-progress-dispatcher.test.ts`

- [ ] **Step 1: Write failing tests for tool progress dispatching**

Create `dashboard/src/components/panels/chat/__tests__/tool-progress-dispatcher.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore } from "@/stores/chat";
import { dispatchAgentEvent } from "../useChatSSE";

describe("dispatchAgentEvent — toolProgress", () => {
  const SESSION = "agent:main:tp-test";

  beforeEach(() => {
    // Reset store to clean state
    useChatStore.setState({
      sessions: new Map(),
      activeSessionKey: null,
      activeAgentId: null,
      sessionMeta: [],
    });
    // Pre-create session with a streaming message so agent events have a target
    useChatStore.getState().ensureSession(SESSION);
    useChatStore.getState().setStreaming(SESSION, true, "run-1");
    useChatStore.getState().addMessage(SESSION, {
      id: "run-1",
      role: "assistant",
      content: [{ type: "text", text: "thinking..." }],
      timestamp: Date.now(),
      streaming: true,
    });
  });

  it("creates toolProgress entry on phase=start", () => {
    dispatchAgentEvent({
      sessionKey: SESSION,
      stream: "tool",
      data: { phase: "start", name: "bash", toolCallId: "tc-1" },
    });

    const session = useChatStore.getState().sessions.get(SESSION);
    expect(session?.toolProgress["tc-1"]).toBeDefined();
    expect(session?.toolProgress["tc-1"].name).toBe("bash");
    expect(session?.toolProgress["tc-1"].status).toBe("running");
    expect(session?.toolProgress["tc-1"].startedAt).toBeGreaterThan(0);
  });

  it("updates toolProgress to completed on phase=result", () => {
    // Start first
    dispatchAgentEvent({
      sessionKey: SESSION,
      stream: "tool",
      data: { phase: "start", name: "bash", toolCallId: "tc-2" },
    });
    // Then result
    dispatchAgentEvent({
      sessionKey: SESSION,
      stream: "tool",
      data: { phase: "result", name: "bash", toolCallId: "tc-2" },
    });

    const session = useChatStore.getState().sessions.get(SESSION);
    expect(session?.toolProgress["tc-2"].status).toBe("completed");
    expect(session?.toolProgress["tc-2"].completedAt).toBeGreaterThan(0);
  });

  it("updates toolProgress to error on phase=error", () => {
    dispatchAgentEvent({
      sessionKey: SESSION,
      stream: "tool",
      data: { phase: "start", name: "bash", toolCallId: "tc-3" },
    });
    dispatchAgentEvent({
      sessionKey: SESSION,
      stream: "tool",
      data: { phase: "error", name: "bash", toolCallId: "tc-3" },
    });

    const session = useChatStore.getState().sessions.get(SESSION);
    expect(session?.toolProgress["tc-3"].status).toBe("error");
  });

  it("ignores events without toolCallId", () => {
    dispatchAgentEvent({
      sessionKey: SESSION,
      stream: "tool",
      data: { phase: "start", name: "bash" },
    });

    const session = useChatStore.getState().sessions.get(SESSION);
    expect(Object.keys(session?.toolProgress ?? {})).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/components/panels/chat/__tests__/tool-progress-dispatcher.test.ts --reporter=verbose`
Expected: FAIL — `toolProgress["tc-1"]` is `undefined` (only the tool_use block gets appended, no toolProgress update)

- [ ] **Step 3: Enhance dispatchAgentEvent to update toolProgress**

In `dashboard/src/components/panels/chat/useChatSSE.ts`, modify `dispatchAgentEvent`:

```typescript
export function dispatchAgentEvent(payload: AgentEventPayload): void {
  const sessionKey = payload.sessionKey;
  if (!sessionKey) {
    return;
  }

  try {
    const stream = payload.stream;
    const data = payload.data;
    if (stream !== "tool" || !data) {
      return;
    }

    const toolName = data.name;
    const toolCallId = data.toolCallId;
    if (!toolName || !toolCallId) {
      return;
    }

    const phase = data.phase;

    // Update toolProgress record for ALL phases
    if (phase === "start") {
      useChatStore.getState().ensureSession(sessionKey);
      useChatStore.getState().updateToolProgress(sessionKey, toolCallId, {
        toolUseId: toolCallId,
        name: toolName,
        status: "running",
        startedAt: Date.now(),
      });
    } else if (phase === "result" || phase === "complete") {
      useChatStore.getState().updateToolProgress(sessionKey, toolCallId, {
        status: "completed",
        completedAt: Date.now(),
      });
    } else if (phase === "error") {
      useChatStore.getState().updateToolProgress(sessionKey, toolCallId, {
        status: "error",
        completedAt: Date.now(),
      });
    }

    // Only append tool_use block on start phase (existing behavior)
    if (phase !== "start") {
      return;
    }

    // Single getState() read for both streamingRunId and message lookup
    const sess = useChatStore.getState().sessions.get(sessionKey);
    const streamingRunId = sess?.streamingRunId;
    if (!streamingRunId || !sess) {
      return;
    }

    const block: ContentBlock = {
      type: "tool_use",
      id: toolCallId,
      name: toolName,
      input: data.args ?? {},
    };

    const msg = sess.messages.find((m) => m.id === streamingRunId);
    if (!msg) {
      return;
    }
    useChatStore
      .getState()
      .updateStreamingBlocks(sessionKey, streamingRunId, [...msg.content, block]);
  } catch {
    // Ignore malformed payloads
  }
}
```

Key changes from existing code:

- Moved `toolCallId` check up alongside `toolName` check (was only used later for block.id)
- Added `updateToolProgress` calls for start/result/error phases **before** the block-append logic
- `ensureSession` only called on `start` phase (other phases target existing sessions)
- Removed the fallback `data.toolCallId ?? \`tool-${Date.now()}\`` — toolCallId is now required
- `phase: "update"` is intentionally NOT tracked in toolProgress — only `start`/`result`/`complete`/`error` trigger state transitions. The `update` phase carries progress info that could be added later, but for now no toolProgress mutation occurs on update events.

**Note on existing tests:** The test in `dispatcher.test.ts` named "ignores non-start phases" will still pass (no block appended), but its semantics shift — non-start phases now update toolProgress even though they don't append blocks. The test assertion (`expect(msg.content).toHaveLength(1)`) remains correct.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/components/panels/chat/__tests__/tool-progress-dispatcher.test.ts --reporter=verbose`
Expected: ALL PASS

- [ ] **Step 5: Also run existing dispatcher tests to verify no regression**

Run: `cd dashboard && npx vitest run src/components/panels/chat/__tests__/dispatcher.test.ts --reporter=verbose`
Expected: ALL PASS (the existing agent event test uses `toolCallId: "tc-123"`, which passes the new guard)

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/components/panels/chat/useChatSSE.ts dashboard/src/components/panels/chat/__tests__/tool-progress-dispatcher.test.ts
git commit -m "[enhanced] feat(deck): track tool progress in session state via dispatchAgentEvent"
```

---

### Task 3: UI — ToolProgressBar Component + ChatPanel Integration

**[frontend]**

**Context:** With `toolProgress` now populated by the dispatcher, we need a UI component to render it. The design calls for a collapsible bar above the message input showing currently running tools with their names and elapsed time. Completed tools fade out after a short delay.

The `useSessionToolProgress()` hook (from `dashboard/src/stores/chat-hooks.ts:57`) returns `Record<string, ToolProgress>`.

**Files:**

- Create: `dashboard/src/components/panels/chat/ToolProgressBar.tsx`
- Modify: `dashboard/src/components/panels/chat/ChatPanel.tsx`

**Skills:** `frontend-design`, `ui-ux-pro-max`

- [ ] **Step 1: Create ToolProgressBar component**

Create `dashboard/src/components/panels/chat/ToolProgressBar.tsx`:

```tsx
"use client";

import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useSessionToolProgress } from "@/stores/chat-hooks";
import type { ToolProgress } from "@/stores/chat-types";

/** How long (ms) a completed tool stays visible before fading. */
const COMPLETED_VISIBLE_MS = 3_000;

function ElapsedTime({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  if (elapsed < 1) return null;
  return (
    <span className="text-[10px] text-[var(--text-secondary)] tabular-nums ml-auto">
      {elapsed}s
    </span>
  );
}

function ToolEntry({ tool }: { tool: ToolProgress }) {
  const isRunning = tool.status === "running";
  const isError = tool.status === "error";

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-0.5 text-xs rounded-md transition-opacity",
        isRunning
          ? "text-[var(--text-primary)]"
          : isError
            ? "text-[var(--danger)] opacity-70"
            : "text-[var(--success)] opacity-70",
      )}
    >
      {isRunning ? (
        <Loader2 size={12} className="animate-spin shrink-0 text-[var(--accent)]" />
      ) : isError ? (
        <XCircle size={12} className="shrink-0" />
      ) : (
        <CheckCircle2 size={12} className="shrink-0" />
      )}
      <code className="font-mono text-[11px] truncate max-w-[160px]">{tool.name}</code>
      {isRunning && <ElapsedTime startedAt={tool.startedAt} />}
    </div>
  );
}

export function ToolProgressBar() {
  const t = useTranslations("chat");
  const toolProgress = useSessionToolProgress();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  // Auto-hide completed tools after delay
  useEffect(() => {
    const entries = Object.values(toolProgress);
    const completedNotHidden = entries.filter(
      (tp) => tp.status !== "running" && !hiddenIds.has(tp.toolUseId),
    );

    if (completedNotHidden.length === 0) return;

    const timer = setTimeout(() => {
      setHiddenIds((prev) => {
        const next = new Set(prev);
        for (const tp of completedNotHidden) {
          next.add(tp.toolUseId);
        }
        return next;
      });
    }, COMPLETED_VISIBLE_MS);

    return () => clearTimeout(timer);
  }, [toolProgress, hiddenIds]);

  // Filter to visible tools
  const visibleTools = Object.values(toolProgress).filter((tp) => !hiddenIds.has(tp.toolUseId));

  if (visibleTools.length === 0) return null;

  const runningCount = visibleTools.filter((tp) => tp.status === "running").length;

  return (
    <div className="mx-4 my-1 px-2 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
      <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)] mb-1">
        <Loader2 size={10} className={cn("shrink-0", runningCount > 0 && "animate-spin")} />
        <span>
          {runningCount > 0 ? t("toolsRunning", { count: runningCount }) : t("toolsCompleted")}
        </span>
      </div>
      <div className="space-y-0.5">
        {visibleTools.map((tool) => (
          <ToolEntry key={tool.toolUseId} tool={tool} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire ToolProgressBar into ChatPanel**

In `dashboard/src/components/panels/chat/ChatPanel.tsx`, add the import and render above ApprovalDialog:

Add import:

```typescript
import { ToolProgressBar } from "./ToolProgressBar";
```

In the JSX, insert between `<MessageList />` and the approval dialog:

```tsx
<ArtifactContext.Provider value={{ onOpenArtifact: setActiveArtifact }}>
  <MessageList />
</ArtifactContext.Provider>
<ToolProgressBar />
{activeApproval && (
  <ApprovalDialog
    approval={activeApproval}
    onResolve={(id, decision) => void handleResolveApproval(id, decision)}
  />
)}
<MessageInput />
```

- [ ] **Step 3: Run TypeScript check**

Run: `cd dashboard && npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/panels/chat/ToolProgressBar.tsx dashboard/src/components/panels/chat/ChatPanel.tsx
git commit -m "[enhanced] feat(deck): add ToolProgressBar component with auto-hide"
```

---

### Task 4: UI — Session Indicator Dots in SessionSidebar

**[frontend]**

**Context:** The `useSessionIndicator(key)` hook already exists in `dashboard/src/stores/chat-hooks.ts:128` and returns `"approval" | "streaming" | "canvas" | "idle" | "none"`. Priority: approval > streaming > canvas > idle > none. Currently this hook is unused. This task adds visual indicator dots next to each session in the sidebar.

**Files:**

- Modify: `dashboard/src/components/panels/chat/SessionSidebar.tsx`

**Skills:** `frontend-design`

- [ ] **Step 1: Add indicator dot rendering**

In `dashboard/src/components/panels/chat/SessionSidebar.tsx`:

1. Add import for `useSessionIndicator`:

```typescript
import {
  useActiveSessionKey,
  useSessionMetaList,
  useSessionIndicator,
  type SessionIndicator,
} from "@/stores/chat-hooks";
```

2. Create a small component for the indicator dot (before `SessionSidebar`):

```tsx
const INDICATOR_STYLES: Record<SessionIndicator, string> = {
  approval: "bg-[var(--warning)] shadow-[0_0_4px_var(--warning)]",
  streaming: "bg-[var(--accent)] animate-pulse",
  canvas: "bg-[var(--success)]",
  idle: "",
  none: "",
};

function SessionDot({ sessionKey }: { sessionKey: string }) {
  const indicator = useSessionIndicator(sessionKey);
  if (indicator === "idle" || indicator === "none") return null;
  return (
    <span
      className={cn("w-1.5 h-1.5 rounded-full shrink-0", INDICATOR_STYLES[indicator])}
      aria-hidden
    />
  );
}
```

3. In the session list item JSX, add the dot after the title/time block:

```tsx
<div className="flex flex-col items-start min-w-0">
  <span className="truncate w-full text-left font-medium">{session.title || session.key}</span>
  <span className="text-[10px] text-[var(--text-secondary)] mt-0.5">
    {formatTime(session.updatedAt)}
  </span>
</div>;

{
  /* Session status indicator */
}
<SessionDot sessionKey={session.key} />;

{
  /* Delete on hover */
}
```

- [ ] **Step 2: Add cn import if not already present (it is)**

Verify `cn` is already imported from `@/lib/utils` — it is (line 15 in the existing file).

- [ ] **Step 3: Run TypeScript check**

Run: `cd dashboard && npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/panels/chat/SessionSidebar.tsx
git commit -m "[enhanced] feat(deck): add session indicator dots in sidebar"
```

---

### Task 5: Approval Refresh-Recovery on Mount

**[frontend]**

**Context:** When the user refreshes the page, any pending approval that arrived via SSE is lost from client state. The server-side `approval-bridge.ts` maintains an in-memory `pendingMap`. The existing endpoint `GET /api/approvals/pending` returns the current pending approvals. This task adds a mount-time fetch to restore them.

Now that `PendingApproval` includes `sessionKey` (Task 1), the client can route restored approvals to the correct session.

**Files:**

- Modify: `dashboard/src/components/panels/chat/ChatPanel.tsx`

- [ ] **Step 1: Add refresh-recovery effect**

In `ChatPanel.tsx`, add an effect that fetches pending approvals on mount and dispatches them to the correct sessions:

```typescript
import { dispatchApproval } from "./useChatSSE";
```

Add this effect after the existing session load effects:

```typescript
// Restore pending approvals on mount (refresh recovery)
useEffect(() => {
  void fetch("/api/approvals/pending")
    .then((r) => r.json())
    .then((data: { pending?: Array<Record<string, unknown>> }) => {
      const pending = data.pending;
      if (!Array.isArray(pending)) return;
      for (const approval of pending) {
        // PendingApproval has `command` but not `toolName`;
        // dispatchApproval falls back: toolName ?? command ?? "unknown"
        dispatchApproval({
          sessionKey: (approval.sessionKey as string) ?? "",
          id: (approval.id as string) ?? "",
          command: (approval.command as string) ?? "",
        });
      }
    })
    .catch(() => {});
}, []);
```

This reuses the existing `dispatchApproval` function which handles `ensureSession` + `setActiveApproval` internally.

- [ ] **Step 2: Run TypeScript check**

Run: `cd dashboard && npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/panels/chat/ChatPanel.tsx
git commit -m "[enhanced] feat(deck): restore pending approvals on mount via refresh-recovery"
```

---

### Task 6: i18n Strings + Final Integration Verification

**[frontend]**

**Context:** All user-visible text must use `useTranslations()` per dashboard CLAUDE.md. This task adds the translation keys used by `ToolProgressBar` and verifies the full integration.

**Files:**

- Modify: `dashboard/src/i18n/zh.json` (under `"chat"` namespace)
- Modify: `dashboard/src/i18n/en.json` (under `"chat"` namespace)

- [ ] **Step 1: Read current i18n files to find the chat section**

Read `dashboard/src/i18n/zh.json` and `dashboard/src/i18n/en.json` to locate the `"chat"` key and existing entries.

- [ ] **Step 2: Add translation keys**

In the `"chat"` section of both files, add:

**zh.json:**

```json
"toolsRunning": "{count} 个工具执行中",
"toolsCompleted": "工具执行完成"
```

**en.json:**

```json
"toolsRunning": "{count} tools running",
"toolsCompleted": "Tools completed"
```

- [ ] **Step 3: Run TypeScript check**

Run: `cd dashboard && npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 4: Run all related tests**

Run: `cd dashboard && npx vitest run src/components/panels/chat/__tests__/ server/__tests__/approval-bridge.test.ts --reporter=verbose`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
git commit -m "[enhanced] feat(deck): add i18n strings for tool progress and approval features"
```

---

## Dependencies

```
Task 1 (approval-bridge)  ─────────────────────┐
                                                ├──→ Task 5 (refresh-recovery, needs sessionKey)
Task 2 (dispatcher) ───→ Task 3 (ToolProgressBar)
                                                ├──→ Task 4 (indicator dots, independent)
                                                └──→ Task 6 (i18n + verification, last)
```

- Tasks 1 and 2 are independent of each other and could run in parallel
- Task 3 depends on Task 2 (needs toolProgress data)
- Task 4 is independent of Tasks 1-3 (uses existing hook)
- Task 5 depends on Task 1 (needs sessionKey in PendingApproval)
- Task 6 is last (needs all other tasks complete)

## Key Contracts

| Source                                                   | Field                                   | Consumer                                        |
| -------------------------------------------------------- | --------------------------------------- | ----------------------------------------------- |
| Gateway WS `exec.approval.requested`                     | `request.sessionKey`                    | `approval-bridge.ts` → SSE → `dispatchApproval` |
| Gateway WS `agent` event                                 | `data.phase` (`start`/`result`/`error`) | `dispatchAgentEvent` → `updateToolProgress`     |
| `useChatStore.getState().sessions.get(key).toolProgress` | `Record<string, ToolProgress>`          | `useSessionToolProgress()` → `ToolProgressBar`  |
| `useSessionIndicator(key)`                               | `"approval" \| "streaming" \| ...`      | `SessionDot` in `SessionSidebar`                |
