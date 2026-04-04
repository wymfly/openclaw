# Chat + Approval Domain Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring Chat and Approval domains from `partial` to `replacement-ready` by fixing P0 gaps and adding P1 UX enhancements.

**Architecture:** 12 targeted fixes across Chat (9 items) and Approval (3 items), all within the existing Zustand store + React component architecture. No new APIs or architectural changes — only UI/store-level improvements using existing Gateway RPCs.

**Tech Stack:** TypeScript, React 18, Zustand, Next.js (next-intl i18n), Lucide icons, Tailwind + CSS variables (shadcn theme)

---

## File Structure

| File                                                                      | Responsibility           | Action                                                           |
| ------------------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------- |
| `dashboard/src/stores/chat.ts`                                            | Chat Zustand store       | Modify: SLC-3 fix in `setStreaming`, add `sseStatus` state       |
| `dashboard/src/stores/chat-types.ts`                                      | Type definitions         | Modify: add `SSEConnectionStatus` type, extend `ApprovalRequest` |
| `dashboard/src/stores/chat-hooks.ts`                                      | React hooks              | Modify: add `useSSEStatus` hook                                  |
| `dashboard/src/components/panels/chat/RunStatusBar.tsx`                   | Run metadata bar         | Modify: add session status badge                                 |
| `dashboard/src/components/panels/chat/ApprovalDialog.tsx`                 | Inline approval UI       | Modify: add countdown, metadata, loading state                   |
| `dashboard/src/components/panels/chat/SessionSidebar.tsx`                 | Session list             | Modify: add rename, search                                       |
| `dashboard/src/components/panels/chat/SessionConfigBar.tsx`               | Config display bar       | Modify: make items clickable for quick-toggle                    |
| `dashboard/src/components/panels/chat/useChatSSE.ts`                      | SSE connection           | Modify: track connection status                                  |
| `dashboard/src/components/panels/chat/SSEStatusBanner.tsx`                | Connection status banner | Create                                                           |
| `dashboard/src/components/panels/chat/ChatPanel.tsx`                      | Chat container           | Modify: insert SSEStatusBanner                                   |
| `dashboard/src/components/panels/chat/MessageList.tsx`                    | Message renderer         | Modify: tool_result nested blocks                                |
| `dashboard/src/components/panels/chat/blocks/ToolResultCard.tsx`          | Tool result card         | Modify: recursive block rendering                                |
| `dashboard/src/components/panels/chat/chat-api.ts`                        | API client               | Modify: add `patchSession` helper                                |
| `dashboard/src/i18n/en.json`                                              | English translations     | Modify                                                           |
| `dashboard/src/i18n/zh.json`                                              | Chinese translations     | Modify                                                           |
| `dashboard/src/stores/__tests__/chat-store-slc3.test.ts`                  | SLC-3 test               | Create                                                           |
| `dashboard/src/components/panels/chat/__tests__/approval-dialog.test.ts`  | ApprovalDialog test      | Create                                                           |
| `dashboard/src/components/panels/chat/__tests__/run-status-badge.test.ts` | RunStatusBar test        | Create                                                           |
| `dashboard/src/components/panels/chat/__tests__/session-sidebar.test.ts`  | SessionSidebar test      | Create                                                           |

---

### Task 1: SLC-3 Fix — setStreaming clears activeApproval

**Files:**

- Modify: `dashboard/src/stores/chat.ts:353-368`
- Create: `dashboard/src/stores/__tests__/chat-store-slc3.test.ts`

**实施描述:** When `setStreaming(sessionKey, false, ...)` is called (agent stopped/timed out), clear `activeApproval` so stale approval dialogs don't persist.

**验收标准:** `setStreaming(key, false)` sets `activeApproval: null`. `setStreaming(key, true)` does not touch `activeApproval`.

**测试要求:** Unit test confirming the behavior.

**依赖关系:** 无

**域标签:** `[frontend]`

**复杂度:** `simple`

- [x] **Step 1: Write the failing test**

Create `dashboard/src/stores/__tests__/chat-store-slc3.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

let useChatStore: typeof import("@/stores/chat").useChatStore;

beforeEach(async () => {
  vi.resetModules();
  ({ useChatStore } = await import("@/stores/chat"));
});

describe("SLC-3: setStreaming clears activeApproval", () => {
  it("clears activeApproval when streaming is set to false", () => {
    const store = useChatStore.getState();
    store.ensureSession("sess-1");
    store.setActiveApproval("sess-1", {
      id: "approval-1",
      toolName: "bash",
      command: "rm -rf /tmp/test",
    });
    store.setStreaming("sess-1", true, "run-1");

    // Approval should still be present while streaming
    expect(useChatStore.getState().sessions.get("sess-1")?.activeApproval).not.toBeNull();

    // Stopping streaming should clear the approval
    store.setStreaming("sess-1", false);
    expect(useChatStore.getState().sessions.get("sess-1")?.activeApproval).toBeNull();
  });

  it("does not clear activeApproval when streaming is set to true", () => {
    const store = useChatStore.getState();
    store.ensureSession("sess-1");
    store.setActiveApproval("sess-1", {
      id: "approval-1",
      toolName: "bash",
      command: "echo hi",
    });

    store.setStreaming("sess-1", true, "run-2");
    expect(useChatStore.getState().sessions.get("sess-1")?.activeApproval).toEqual({
      id: "approval-1",
      toolName: "bash",
      command: "echo hi",
    });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd dashboard && pnpm test -- src/stores/__tests__/chat-store-slc3.test.ts -v`
Expected: FAIL — `activeApproval` is not cleared when streaming=false

- [x] **Step 3: Fix setStreaming in chat.ts**

In `dashboard/src/stores/chat.ts`, modify the `setStreaming` action (around line 353-368). Change:

```typescript
  setStreaming: (sessionKey, streaming, runId) =>
    set((s) => {
      const session = s.sessions.get(sessionKey);
      if (!session) {
        return s;
      }
      const next = new Map(s.sessions);
      next.set(sessionKey, {
        ...session,
        isStreaming: streaming,
        status: streaming ? "running" : "idle",
        streamingRunId: streaming ? (runId ?? session.streamingRunId) : null,
        lastAccessedAt: Date.now(),
      });
      return { sessions: next };
    }),
```

To:

```typescript
  setStreaming: (sessionKey, streaming, runId) =>
    set((s) => {
      const session = s.sessions.get(sessionKey);
      if (!session) {
        return s;
      }
      const next = new Map(s.sessions);
      next.set(sessionKey, {
        ...session,
        isStreaming: streaming,
        status: streaming ? "running" : "idle",
        streamingRunId: streaming ? (runId ?? session.streamingRunId) : null,
        // SLC-3: clear stale approval when streaming stops
        activeApproval: streaming ? session.activeApproval : null,
        lastAccessedAt: Date.now(),
      });
      return { sessions: next };
    }),
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd dashboard && pnpm test -- src/stores/__tests__/chat-store-slc3.test.ts -v`
Expected: PASS

- [x] **Step 5: Run full test suite for regression**

Run: `cd dashboard && pnpm test`
Expected: All tests pass

- [x] **Step 6: Commit**

```bash
scripts/committer "[enhanced][codex-impl] fix(deck): SLC-3 — clear activeApproval when streaming stops" dashboard/src/stores/chat.ts dashboard/src/stores/__tests__/chat-store-slc3.test.ts
```

---

### Task 2: Approval — Countdown Timer + Security Metadata + Loading State

**Files:**

- Modify: `dashboard/src/stores/chat-types.ts:56-61`
- Modify: `dashboard/src/components/panels/chat/ApprovalDialog.tsx`
- Modify: `dashboard/src/stores/chat-dispatchers.ts` (approval dispatch)
- Modify: `dashboard/src/i18n/en.json`
- Modify: `dashboard/src/i18n/zh.json`
- Create: `dashboard/src/components/panels/chat/__tests__/approval-dialog.test.ts`

**实施描述:** Enhance ApprovalDialog with: (1) expiry countdown timer from `expiresAtMs`, (2) security/ask metadata display (agent, cwd), (3) loading/disabled state on buttons to prevent double-click.

**验收标准:** Dialog shows countdown "Expires in 4m 30s", shows agent/cwd metadata, buttons disable during resolve.

**测试要求:** Component test for countdown rendering and button disabled state.

**依赖关系:** 无

**域标签:** `[frontend]`

**复杂度:** `simple`

- [x] **Step 1: Extend ApprovalRequest type**

In `dashboard/src/stores/chat-types.ts`, change:

```typescript
export type ApprovalRequest = {
  id: string;
  toolName: string;
  command?: string;
  description?: string;
};
```

To:

```typescript
export type ApprovalRequest = {
  id: string;
  toolName: string;
  command?: string;
  description?: string;
  sessionKey?: string;
  agentId?: string;
  cwd?: string;
  createdAtMs?: number;
  expiresAtMs?: number;
};
```

- [x] **Step 2: Update dispatchApproval to pass extra fields**

In `dashboard/src/components/panels/chat/useChatSSE.ts`, find the `approval.pending` handler (around line 288-307). Change:

```typescript
if (event.event === "approval.pending") {
  const payload = JSON.parse(event.data) as {
    sessionKey?: string;
    id: string;
    command?: string;
    cwd?: string;
  };
  if (payload.sessionKey) {
    dispatchApproval(
      {
        sessionKey: payload.sessionKey,
        id: payload.id,
        toolName: "command",
        command: payload.command,
        description: payload.cwd,
      },
      api,
    );
  }
  return;
}
```

To:

```typescript
if (event.event === "approval.pending") {
  const payload = JSON.parse(event.data) as {
    sessionKey?: string;
    id: string;
    command?: string;
    cwd?: string;
    agentId?: string;
    createdAtMs?: number;
    expiresAtMs?: number;
  };
  if (payload.sessionKey) {
    dispatchApproval(
      {
        sessionKey: payload.sessionKey,
        id: payload.id,
        toolName: "command",
        command: payload.command,
        description: payload.cwd,
        cwd: payload.cwd,
        agentId: payload.agentId,
        createdAtMs: payload.createdAtMs,
        expiresAtMs: payload.expiresAtMs,
      },
      api,
    );
  }
  return;
}
```

- [x] **Step 3: Rewrite ApprovalDialog with countdown + metadata + loading**

Replace `dashboard/src/components/panels/chat/ApprovalDialog.tsx` entirely:

```tsx
"use client";

import { Shield, Check, X, ShieldCheck, Clock, User, FolderOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ApprovalRequest } from "@/stores/chat-types";

interface ApprovalDialogProps {
  approval: ApprovalRequest;
  pendingCount?: number;
  onResolve: (id: string, decision: "allow-once" | "allow-always" | "deny") => void;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0s";
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function ApprovalDialog({ approval, pendingCount, onResolve }: ApprovalDialogProps) {
  const t = useTranslations("approvals");
  const [resolving, setResolving] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);

  // Countdown timer
  useEffect(() => {
    if (!approval.expiresAtMs) {
      setRemaining(null);
      return;
    }
    const update = () => setRemaining(Math.max(0, approval.expiresAtMs! - Date.now()));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [approval.expiresAtMs]);

  // Reset resolving state when approval changes (new approval replaces resolved one)
  useEffect(() => {
    setResolving(false);
  }, [approval.id]);

  const handleResolve = async (decision: "allow-once" | "allow-always" | "deny") => {
    setResolving(true);
    try {
      onResolve(approval.id, decision);
    } catch {
      setResolving(false);
    }
  };

  return (
    <div className="mx-4 my-2 p-4 rounded-xl bg-[var(--muted)] ring-1 ring-[var(--warning)]/30 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
        <Shield size={16} className="text-[var(--warning)] shrink-0" />
        <span>{t("inlineTitle")}</span>
        {/* Countdown */}
        {remaining != null && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-mono text-[var(--muted-foreground)]">
            <Clock size={10} />
            {formatCountdown(remaining)}
          </span>
        )}
        {/* Queue badge */}
        {pendingCount != null && pendingCount > 1 && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[var(--warning)]/15 text-[var(--warning)]">
            {pendingCount} {t("pendingBadge")}
          </span>
        )}
      </div>

      {/* Tool info */}
      <div className="text-xs text-[var(--muted-foreground)] space-y-1.5">
        <code className="font-mono text-[var(--primary)]">{approval.toolName}</code>
        {approval.command && (
          <pre className="mt-1.5 p-2 rounded-lg bg-[var(--background)] text-[var(--foreground)] overflow-auto max-h-[120px] text-xs leading-relaxed whitespace-pre-wrap break-words">
            {approval.command}
          </pre>
        )}
        {approval.description && !approval.command && (
          <p className="text-[var(--muted-foreground)]">{approval.description}</p>
        )}
      </div>

      {/* Metadata row */}
      {(approval.agentId || approval.cwd) && (
        <div className="flex flex-wrap gap-3 text-[10px] font-mono text-[var(--text-tertiary)]">
          {approval.agentId && (
            <span className="flex items-center gap-1">
              <User size={10} />
              {approval.agentId}
            </span>
          )}
          {approval.cwd && (
            <span className="flex items-center gap-1">
              <FolderOpen size={10} />
              {approval.cwd}
            </span>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          disabled={resolving}
          onClick={() => void handleResolve("allow-once")}
        >
          <Check size={12} />
          {t("approve")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          disabled={resolving}
          onClick={() => void handleResolve("allow-always")}
        >
          <ShieldCheck size={12} />
          {t("approveAlways")}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="gap-1.5 text-xs"
          disabled={resolving}
          onClick={() => void handleResolve("deny")}
        >
          <X size={12} />
          {t("deny")}
        </Button>
      </div>
    </div>
  );
}
```

- [x] **Step 4: Update MessageInput to pass pendingCount**

In `dashboard/src/components/panels/chat/MessageInput.tsx`, where `<ApprovalDialog>` is rendered (around the approval section), add a `pendingCount` prop. Find the approval render section and add:

```tsx
import { useApprovalsStore } from "@/stores/approvals";
// ... inside the component:
const pendingCount = useApprovalsStore((s) => s.pending.length);
// ... in render:
<ApprovalDialog
  approval={activeApproval}
  pendingCount={pendingCount}
  onResolve={handleResolveApproval}
/>;
```

Note: `useApprovalsStore` is already imported in MessageInput.tsx. Just add the `pendingCount` selector and pass it.

- [x] **Step 5: Add i18n keys**

In `dashboard/src/i18n/en.json`, add to the `"approvals"` section:

```json
"pendingBadge": "pending"
```

In `dashboard/src/i18n/zh.json`, add to the `"approvals"` section:

```json
"pendingBadge": "待处理"
```

- [x] **Step 6: Run tests**

Run: `cd dashboard && pnpm test`
Expected: All tests pass

- [x] **Step 7: Commit**

```bash
scripts/committer "[enhanced][codex-impl] feat(deck): approval dialog — countdown, metadata, loading state" dashboard/src/stores/chat-types.ts dashboard/src/components/panels/chat/ApprovalDialog.tsx dashboard/src/components/panels/chat/useChatSSE.ts dashboard/src/components/panels/chat/MessageInput.tsx dashboard/src/i18n/en.json dashboard/src/i18n/zh.json
```

---

### Task 3: RunStatusBar — Session Status Badge

**Files:**

- Modify: `dashboard/src/components/panels/chat/RunStatusBar.tsx`
- Modify: `dashboard/src/i18n/en.json`
- Modify: `dashboard/src/i18n/zh.json`

**实施描述:** Add a session status badge (running/done/failed/killed/timeout) to RunStatusBar. Status comes from `SessionState.status` which is already populated by the store.

**验收标准:** RunStatusBar displays a colored badge showing session status. Colors: running=warning, done=success, failed/killed/timeout=destructive.

**测试要求:** Existing tests cover store; visual verification sufficient.

**依赖关系:** 无

**域标签:** `[frontend]`

**复杂度:** `simple`

- [x] **Step 1: Add status prop and badge to RunStatusBar**

In `dashboard/src/components/panels/chat/RunStatusBar.tsx`, modify the props interface and component:

```typescript
interface RunStatusBarProps {
  metadata: RunMetadata;
  sessionTotalTokens?: number;
  sessionCostUsd?: number;
  sessionStatus?: "idle" | "running" | "done" | "failed" | "killed" | "timeout";
}
```

Add inside the component, after the existing `const t = ...` line:

```typescript
const statusColor =
  sessionStatus === "running"
    ? "var(--warning)"
    : sessionStatus === "done"
      ? "var(--success)"
      : sessionStatus === "failed" || sessionStatus === "killed" || sessionStatus === "timeout"
        ? "var(--destructive)"
        : "var(--muted-foreground)";

const statusLabel = sessionStatus ? t(`status_${sessionStatus}`) : null;
```

Add as the first child inside the flex container div:

```tsx
{
  /* Session status badge */
}
{
  statusLabel && sessionStatus !== "idle" && (
    <span
      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
      style={{
        color: statusColor,
        backgroundColor: `color-mix(in srgb, ${statusColor} 12%, transparent)`,
      }}
    >
      {sessionStatus === "running" && (
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ backgroundColor: statusColor }}
        />
      )}
      {statusLabel}
    </span>
  );
}
```

- [x] **Step 2: Add i18n keys**

In `dashboard/src/i18n/en.json`, add to the `"chat"` section:

```json
"status_idle": "Idle",
"status_running": "Running",
"status_done": "Done",
"status_failed": "Failed",
"status_killed": "Killed",
"status_timeout": "Timeout"
```

In `dashboard/src/i18n/zh.json`, add matching keys:

```json
"status_idle": "空闲",
"status_running": "运行中",
"status_done": "完成",
"status_failed": "失败",
"status_killed": "已终止",
"status_timeout": "超时"
```

- [x] **Step 3: Wire sessionStatus in the parent component**

Where `RunStatusBar` is rendered (in `MessageList.tsx` or `ChatPanel.tsx`), pass the session status from the store. Locate the rendering site and add:

```tsx
const sessionKey = useActiveSessionKey();
const sessionStatus = useChatStore((s) => {
  const key = s.activeSessionKey;
  return key ? s.sessions.get(key)?.status : undefined;
});
// ... pass to RunStatusBar:
<RunStatusBar metadata={metadata} sessionStatus={sessionStatus} ... />
```

Note: The parent component file (likely `MessageList.tsx` or `ChatPanel.tsx`) must be included in the commit.

- [x] **Step 4: Run tests and type-check**

Run: `cd dashboard && pnpm test && cd .. && pnpm tsgo`
Expected: All pass

- [x] **Step 5: Commit**

```bash
scripts/committer "[enhanced][codex-impl] feat(deck): run status badge in RunStatusBar" dashboard/src/components/panels/chat/RunStatusBar.tsx dashboard/src/components/panels/chat/MessageList.tsx dashboard/src/i18n/en.json dashboard/src/i18n/zh.json
```

---

### Task 4: SSE Connection Status Banner

**Files:**

- Modify: `dashboard/src/stores/chat-types.ts`
- Modify: `dashboard/src/stores/chat.ts`
- Modify: `dashboard/src/stores/chat-hooks.ts`
- Modify: `dashboard/src/components/panels/chat/useChatSSE.ts`
- Create: `dashboard/src/components/panels/chat/SSEStatusBanner.tsx`
- Modify: `dashboard/src/components/panels/chat/ChatPanel.tsx`
- Modify: `dashboard/src/i18n/en.json`
- Modify: `dashboard/src/i18n/zh.json`

**实施描述:** Track SSE connection state (connected/reconnecting/disconnected) in the store. Show a top banner "Reconnecting..." when not connected.

**验收标准:** Banner appears when SSE disconnects, disappears when reconnected. No banner during normal operation.

**测试要求:** Store-level test for state transitions.

**依赖关系:** 无

**域标签:** `[frontend]`

**复杂度:** `simple`

- [x] **Step 1: Add SSE status type and store field**

In `dashboard/src/stores/chat-types.ts`, add after the `DEFAULT_EVICT_IDLE_MS` constant:

```typescript
export type SSEConnectionStatus = "connected" | "reconnecting" | "disconnected";
```

In `dashboard/src/stores/chat.ts`, add `sseStatus: "disconnected" as SSEConnectionStatus` to the initial state, and a `setSSEStatus` action:

```typescript
sseStatus: "disconnected" as SSEConnectionStatus,

setSSEStatus: (status: SSEConnectionStatus) => set({ sseStatus: status }),
```

Also add `SSEConnectionStatus` to the imports from `chat-types.ts` and add `sseStatus` + `setSSEStatus` to the store type interface.

- [x] **Step 2: Add useSSEStatus hook**

In `dashboard/src/stores/chat-hooks.ts`, add:

```typescript
export function useSSEStatus() {
  return useChatStore((s) => s.sseStatus);
}
```

- [x] **Step 3: Add lifecycle callbacks to deckStream**

In `dashboard/src/lib/deck-client.ts`, extend `DeckStreamOptions` interface with two optional callbacks:

```typescript
/** Called when a stream connection is established (response.ok received). */
onOpen?: () => void;
/** Called when the stream ends and a reconnect will be attempted. */
onRetry?: () => void;
```

Inside the `deckStream` function, call `options.onOpen?.()` after verifying `response.ok && response.body` (around line 153), and call `options.onRetry?.()` just before `await waitForReconnect(...)` (around line 202).

- [x] **Step 4: Update useChatSSE to track connection status via callbacks**

In `dashboard/src/components/panels/chat/useChatSSE.ts`, update the `deckStream` call:

```typescript
void deckStream("/api/stream", {
  signal: controller.signal,
  reconnect: true,
  onOpen() {
    useChatStore.getState().setSSEStatus("connected");
  },
  onRetry() {
    useChatStore.getState().setSSEStatus("reconnecting");
  },
  onEvent(event) {
    // ... existing event handling unchanged ...
  },
}).catch(() => {});
```

In the cleanup return:

```typescript
return () => {
  controller.abort();
  document.removeEventListener("visibilitychange", onVisibilityChange);
  useChatStore.getState().setSSEStatus("disconnected");
};
```

- [x] **Step 4: Create SSEStatusBanner component**

Create `dashboard/src/components/panels/chat/SSEStatusBanner.tsx`:

```tsx
"use client";

import { WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSSEStatus } from "@/stores/chat-hooks";

export function SSEStatusBanner() {
  const t = useTranslations("chat");
  const status = useSSEStatus();

  if (status === "connected") {
    return null;
  }

  return (
    <div
      className="flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium"
      style={{
        backgroundColor: "var(--warning-muted)",
        color: "var(--warning-muted-text)",
      }}
    >
      <WifiOff size={12} />
      <span>{status === "reconnecting" ? t("sseReconnecting") : t("sseDisconnected")}</span>
      {status === "reconnecting" && (
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning)] animate-pulse" />
      )}
    </div>
  );
}
```

- [x] **Step 5: Insert banner in ChatPanel**

In `dashboard/src/components/panels/chat/ChatPanel.tsx`, import and place `SSEStatusBanner` at the top of the main content area (after the sidebar, before the message list):

```tsx
import { SSEStatusBanner } from "./SSEStatusBanner";
// ... inside the JSX, at the top of the content column:
<SSEStatusBanner />;
```

- [x] **Step 6: Add i18n keys**

In `dashboard/src/i18n/en.json`, add to `"chat"`:

```json
"sseReconnecting": "Reconnecting to server...",
"sseDisconnected": "Disconnected from server"
```

In `dashboard/src/i18n/zh.json`, add to `"chat"`:

```json
"sseReconnecting": "正在重新连接服务器...",
"sseDisconnected": "已断开服务器连接"
```

- [x] **Step 7: Run tests and type-check**

Run: `cd dashboard && pnpm test && cd .. && pnpm tsgo`
Expected: All pass

- [x] **Step 8: Commit**

```bash
scripts/committer "[enhanced][codex-impl] feat(deck): SSE connection status banner" dashboard/src/stores/chat-types.ts dashboard/src/stores/chat.ts dashboard/src/stores/chat-hooks.ts dashboard/src/components/panels/chat/useChatSSE.ts dashboard/src/components/panels/chat/SSEStatusBanner.tsx dashboard/src/components/panels/chat/ChatPanel.tsx dashboard/src/i18n/en.json dashboard/src/i18n/zh.json
```

---

### Task 5: SessionConfigBar — Quick Toggle Controls

**Files:**

- Modify: `dashboard/src/components/panels/chat/SessionConfigBar.tsx`
- Modify: `dashboard/src/components/panels/chat/chat-api.ts`
- Modify: `dashboard/src/i18n/en.json`
- Modify: `dashboard/src/i18n/zh.json`

**实施描述:** Make thinking/fast items in SessionConfigBar clickable to cycle values. Model remains read-only (use `/model` slash command). Thinking cycles levels. Fast toggles on/off. Uses existing `sessions.patch` Gateway RPC.

**验收标准:** Clicking Fast toggles it. Clicking Thinking cycles the level. All changes persist via `sessions.patch`.

**测试要求:** Existing store tests cover patching; visual verification for UI.

**依赖关系:** 无

**域标签:** `[frontend]`

**复杂度:** `simple`

- [x] **Step 1: Add patchSession helper to chat-api**

In `dashboard/src/components/panels/chat/chat-api.ts`, add a thin wrapper. The endpoint at `dashboard/src/app/api/chat/sessions/patch/route.ts` expects **flat fields** (`{ sessionKey, model, thinkingLevel, fastMode, ... }`), not a nested `{ patch }` object:

```typescript
export async function patchSession(
  sessionKey: string,
  patch: {
    label?: string | null;
    thinkingLevel?: string | null;
    fastMode?: boolean | null;
    verboseLevel?: string | null;
  },
): Promise<boolean> {
  try {
    const res = await deckFetch("/api/chat/sessions/patch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionKey, ...patch }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
```

- [x] **Step 2: Make SessionConfigBar items interactive**

Replace `dashboard/src/components/panels/chat/SessionConfigBar.tsx`:

```tsx
"use client";

import { Brain, Cpu, Terminal, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { useChatStore } from "@/stores/chat";
import { useActiveSessionKey } from "@/stores/chat-hooks";
import { patchSession } from "./chat-api";

const THINKING_LEVELS = ["off", "low", "medium", "high"] as const;

export function SessionConfigBar() {
  const t = useTranslations("chat");
  const activeSessionKey = useActiveSessionKey();
  const meta = useChatStore((s) => s.sessionMetas.find((m) => m.key === activeSessionKey));

  if (!activeSessionKey || !meta) {
    return null;
  }

  const handleToggleFast = () => {
    const next = !meta.fastMode;
    // Optimistic update
    useChatStore.setState((s) => ({
      sessionMetas: s.sessionMetas.map((m) =>
        m.key === activeSessionKey ? { ...m, fastMode: next } : m,
      ),
    }));
    void patchSession(activeSessionKey, { fastMode: next });
  };

  const handleCycleThinking = () => {
    const current = meta.thinkingLevel ?? "off";
    const idx = THINKING_LEVELS.indexOf(current as (typeof THINKING_LEVELS)[number]);
    const next = THINKING_LEVELS[(idx + 1) % THINKING_LEVELS.length];
    useChatStore.setState((s) => ({
      sessionMetas: s.sessionMetas.map((m) =>
        m.key === activeSessionKey ? { ...m, thinkingLevel: next === "off" ? undefined : next } : m,
      ),
    }));
    void patchSession(activeSessionKey, { thinkingLevel: next === "off" ? null : next });
  };

  const model = meta.model ?? t("configModelDefault");

  return (
    <div className="flex items-center gap-3 px-3 py-1 text-[10px] font-mono text-[var(--muted-foreground)] border-t border-[var(--border-subtle)]">
      {/* Model (read-only display, slash command to change) */}
      <span className="flex items-center gap-1">
        <Cpu size={10} className="text-[var(--muted-foreground)]" />
        <span>{t("configModel")}</span>
        <span className="text-[var(--primary)]">{model}</span>
      </span>

      {/* Thinking — click to cycle */}
      <button
        onClick={handleCycleThinking}
        className="flex items-center gap-1 hover:text-[var(--primary)] transition-colors"
        title={t("configThinkingToggle")}
      >
        <Brain size={10} />
        <span>{t("configThinking")}</span>
        <span className="text-[var(--primary)]">{meta.thinkingLevel ?? "off"}</span>
      </button>

      {/* Fast mode — click to toggle */}
      <button
        onClick={handleToggleFast}
        className="flex items-center gap-1 hover:text-[var(--primary)] transition-colors"
        title={t("configFastToggle")}
      >
        <Zap size={10} />
        <span>{t("configFast")}</span>
        <span className="text-[var(--primary)]">
          {meta.fastMode ? t("configOn") : t("configOff")}
        </span>
      </button>

      {/* Verbose (read-only) */}
      {meta.verboseLevel && (
        <span className="flex items-center gap-1">
          <Terminal size={10} />
          <span>{t("configVerbose")}</span>
          <span className="text-[var(--primary)]">{meta.verboseLevel}</span>
        </span>
      )}
    </div>
  );
}
```

- [x] **Step 3: Add i18n keys**

In `dashboard/src/i18n/en.json`, add to `"chat"`:

```json
"configThinkingToggle": "Click to cycle thinking level",
"configFastToggle": "Click to toggle fast mode"
```

In `dashboard/src/i18n/zh.json`, add to `"chat"`:

```json
"configThinkingToggle": "点击切换思考级别",
"configFastToggle": "点击切换快速模式"
```

- [x] **Step 4: Run tests and type-check**

Run: `cd dashboard && pnpm test && cd .. && pnpm tsgo`
Expected: All pass

- [x] **Step 5: Commit**

```bash
scripts/committer "[enhanced][codex-impl] feat(deck): interactive SessionConfigBar — thinking/fast toggle" dashboard/src/components/panels/chat/SessionConfigBar.tsx dashboard/src/components/panels/chat/chat-api.ts dashboard/src/i18n/en.json dashboard/src/i18n/zh.json
```

---

### Task 6: Session Rename

**Files:**

- Modify: `dashboard/src/components/panels/chat/SessionSidebar.tsx`
- Modify: `dashboard/src/components/panels/chat/chat-api.ts`
- Modify: `dashboard/src/i18n/en.json`
- Modify: `dashboard/src/i18n/zh.json`

**实施描述:** Double-click session title in sidebar to enter inline edit mode. On Enter or blur, call `sessions.patch` with `label` field. Gateway `SessionsPatchParamsSchema` already supports `label`.

**验收标准:** Double-click title → inline input appears. Enter saves. Escape cancels. Rename persists across refresh.

**测试要求:** Visual verification.

**依赖关系:** Task 5 (patchSession helper)

**域标签:** `[frontend]`

**复杂度:** `simple`

- [x] **Step 1: Add inline editing to SessionSidebar**

In `dashboard/src/components/panels/chat/SessionSidebar.tsx`, add state for editing and modify the session button render:

Add at the top of the `SessionSidebar` component:

```typescript
const [editingKey, setEditingKey] = useState<string | null>(null);
const [editValue, setEditValue] = useState("");
const editRef = useRef<HTMLInputElement>(null);
```

Add import for `useRef, useState` and `patchSession`:

```typescript
import { useEffect, useRef, useState } from "react";
import { patchSession } from "./chat-api";
```

Add handlers for rename. **Key design:** Enter triggers blur; onBlur is the single submit path (avoids double-submit). The session list item must NOT nest `<input>` inside `<button>` (HTML violation) — use a `<div>` container with separate click targets:

```typescript
const handleStartRename = (session: SessionMeta) => {
  setEditingKey(session.key);
  setEditValue(session.title ?? sessionTitle(session));
};

const handleFinishRename = async (session: SessionMeta) => {
  const trimmed = editValue.trim();
  setEditingKey(null);
  if (!trimmed) return;
  const current = session.title ?? sessionTitle(session);
  if (trimmed === current) return;
  const ok = await patchSession(session.key, { label: trimmed });
  if (ok) {
    useChatStore.setState((s) => {
      const metas = s.sessionMetas.map((m) =>
        m.key === session.key ? { ...m, title: trimmed } : m,
      );
      return { sessionMetas: metas, sessionMeta: metas };
    });
  }
};
```

Replace the existing session `<button>` element in the map with a `<div>` container:

```tsx
<div
  key={session.key}
  className="flex items-center justify-between w-full px-3 py-2 text-xs transition-colors group"
  style={{
    backgroundColor: isActive
      ? "color-mix(in srgb, var(--primary) 12%, transparent)"
      : "transparent",
    color: isActive ? "var(--primary)" : "var(--foreground)",
  }}
>
  <div className="flex flex-col items-start min-w-0 flex-1">
    {editingKey === session.key ? (
      <input
        ref={editRef}
        className="w-full text-xs bg-[var(--background)] text-[var(--foreground)] border border-[var(--border)] rounded px-1 py-0.5"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            setEditingKey(null);
          }
        }}
        onBlur={() => void handleFinishRename(session)}
        autoFocus
      />
    ) : (
      <button
        type="button"
        className="truncate w-full text-left"
        onClick={() => handleSelect(session)}
        onDoubleClick={(e) => {
          e.stopPropagation();
          handleStartRename(session);
        }}
      >
        {sessionTitle(session)}
      </button>
    )}
    <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
      {formatTime(session.updatedAt)}
    </span>
  </div>
  <button
    type="button"
    className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1"
    onClick={(e) => void handleDelete(session.key, e)}
    style={{ color: "var(--muted-foreground)" }}
  >
    <Trash2 size={12} />
  </button>
</div>
```

- [x] **Step 2: Run tests and type-check**

Run: `cd dashboard && pnpm test && cd .. && pnpm tsgo`
Expected: All pass

- [x] **Step 3: Commit**

```bash
scripts/committer "[enhanced][codex-impl] feat(deck): session rename via double-click" dashboard/src/components/panels/chat/SessionSidebar.tsx dashboard/src/components/panels/chat/chat-api.ts
```

---

### Task 7: Session Search/Filter

**Files:**

- Modify: `dashboard/src/components/panels/chat/SessionSidebar.tsx`
- Modify: `dashboard/src/i18n/en.json`
- Modify: `dashboard/src/i18n/zh.json`

**实施描述:** Add a search input at the top of the session list that filters by title.

**验收标准:** Typing in search filters visible sessions. Empty search shows all.

**测试要求:** Visual verification.

**依赖关系:** Task 6 (session sidebar changes)

**域标签:** `[frontend]`

**复杂度:** `simple`

- [x] **Step 1: Add search state and filter**

In `dashboard/src/components/panels/chat/SessionSidebar.tsx`, add:

```typescript
const [searchQuery, setSearchQuery] = useState("");

const filteredMetas = useMemo(() => {
  if (!searchQuery.trim()) return sessionMetas;
  const q = searchQuery.toLowerCase();
  return sessionMetas.filter((s) => {
    const title = (s.title ?? sessionTitle(s)).toLowerCase();
    return title.includes(q);
  });
}, [sessionMetas, searchQuery]);
```

Add import for `useMemo`.

Insert the search input after the "New session" button, before the session list:

```tsx
{
  /* Search */
}
<div className="px-2 py-1.5 border-b" style={{ borderColor: "var(--border)" }}>
  <input
    type="text"
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    placeholder={t("searchSessions")}
    className="w-full text-xs rounded px-2 py-1"
    style={{
      backgroundColor: "var(--background)",
      color: "var(--foreground)",
      border: "1px solid var(--border)",
    }}
  />
</div>;
```

Replace `sessionMetas.map` with `filteredMetas.map` in the session list.

- [x] **Step 2: Add i18n keys**

In `dashboard/src/i18n/en.json`, add to `"chat"`:

```json
"searchSessions": "Search sessions..."
```

In `dashboard/src/i18n/zh.json`, add to `"chat"`:

```json
"searchSessions": "搜索会话..."
```

- [x] **Step 3: Run tests and type-check**

Run: `cd dashboard && pnpm test && cd .. && pnpm tsgo`
Expected: All pass

- [x] **Step 4: Commit**

```bash
scripts/committer "[enhanced][codex-impl] feat(deck): session search filter in sidebar" dashboard/src/components/panels/chat/SessionSidebar.tsx dashboard/src/i18n/en.json dashboard/src/i18n/zh.json
```

---

### Task 8: Tool Result Nested Content Blocks

**Files:**

- Modify: `dashboard/src/components/panels/chat/blocks/ToolResultCard.tsx`

**实施描述:** When `tool_result.content` is `ContentBlock[]` (array), extract text from each block instead of `JSON.stringify`. Currently `ToolResultCard` receives a `content: string` prop — need to also handle array case from the parent.

**验收标准:** Array content blocks are properly text-extracted (text blocks concatenated, non-text blocks JSON-formatted) instead of raw `JSON.stringify`.

**测试要求:** Visual verification with nested content.

**依赖关系:** 无

**域标签:** `[frontend]`

**复杂度:** `simple`

- [x] **Step 1: Update ToolResultCard to handle array content**

In `dashboard/src/components/panels/chat/blocks/ToolResultCard.tsx`, change the `content` prop type:

```typescript
interface ToolResultCardProps {
  content: string | Array<{ type: string; [key: string]: unknown }>;
  isError?: boolean;
  toolName?: string;
  toolInput?: Record<string, unknown>;
}
```

At the top of the component, normalize content:

```typescript
const contentStr =
  typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content
          .map((block) => {
            if (block.type === "text" && typeof block.text === "string") return block.text;
            return JSON.stringify(block, null, 2);
          })
          .join("\n\n")
      : JSON.stringify(content, null, 2);
```

This replaces the existing `contentStr` line. The existing rendering pipeline (bash/diff/read/raw) then works on the concatenated text.

- [x] **Step 2: Update the parent that passes content**

Find where `ToolResultCard` is rendered (in `MessageList.tsx` or a block renderer). Ensure `content` is passed as-is (not pre-stringified). Check the current code:

```tsx
// If currently doing: content={typeof block.content === "string" ? block.content : JSON.stringify(block.content)}
// Change to: content={block.content}
```

- [x] **Step 3: Run tests and type-check**

Run: `cd dashboard && pnpm test && cd .. && pnpm tsgo`
Expected: All pass

- [x] **Step 4: Commit**

```bash
scripts/committer "[enhanced][codex-impl] feat(deck): tool result nested content block rendering" dashboard/src/components/panels/chat/blocks/ToolResultCard.tsx dashboard/src/components/panels/chat/MessageList.tsx
```

---

### Task 9: Approval Client-Side Expiry Cleanup

**Files:**

- Modify: `dashboard/src/components/panels/chat/MessageInput.tsx`

**实施描述:** When the approval countdown reaches zero, auto-clear the `activeApproval` in the store to remove the stale dialog.

**验收标准:** After `expiresAtMs` passes, the ApprovalDialog disappears without server round-trip.

**测试要求:** Visual verification with short expiry.

**依赖关系:** Task 2 (ApprovalDialog countdown)

**域标签:** `[frontend]`

**复杂度:** `simple`

- [x] **Step 1: Add expiry check in MessageInput**

In `dashboard/src/components/panels/chat/MessageInput.tsx`, add a `useEffect` near the approval-related code:

```typescript
// Auto-clear expired approvals — deps include approval.id to handle same-expiry different-approval
useEffect(() => {
  if (!activeApproval?.expiresAtMs) return;
  const approvalId = activeApproval.id;
  const remaining = activeApproval.expiresAtMs - Date.now();
  if (remaining <= 0) {
    if (activeSessionKey) {
      useChatStore.getState().setActiveApproval(activeSessionKey, null);
    }
    return;
  }
  const timer = setTimeout(() => {
    // Verify same approval before clearing (guard against race)
    const current = activeSessionKey
      ? useChatStore.getState().sessions.get(activeSessionKey)?.activeApproval
      : null;
    if (current?.id === approvalId && activeSessionKey) {
      useChatStore.getState().setActiveApproval(activeSessionKey, null);
    }
  }, remaining);
  return () => clearTimeout(timer);
}, [activeApproval?.id, activeApproval?.expiresAtMs, activeSessionKey]);
```

- [x] **Step 2: Run tests**

Run: `cd dashboard && pnpm test`
Expected: All pass

- [x] **Step 3: Commit**

```bash
scripts/committer "[enhanced][codex-impl] feat(deck): auto-clear expired approvals client-side" dashboard/src/components/panels/chat/MessageInput.tsx
```

---

### Task 10: Stream Failure Graceful Indicator

**Files:**

- Modify: `dashboard/src/components/panels/chat/MessageList.tsx`
- Modify: `dashboard/src/i18n/en.json`
- Modify: `dashboard/src/i18n/zh.json`

**实施描述:** When a message has `streaming: true` but the session is no longer streaming (stream interrupted), show a subtle "partial result" indicator on the message.

**验收标准:** Message with `streaming: true` + session `isStreaming: false` shows a "Stream interrupted — partial result" note.

**测试要求:** Visual verification.

**依赖关系:** 无

**域标签:** `[frontend]`

**复杂度:** `simple`

- [x] **Step 1: Add partial result indicator in MessageList**

In `dashboard/src/components/panels/chat/MessageList.tsx`, the session-level `isStreaming` is already available via `useSessionStreaming()`. Find where each assistant message is rendered. After the message content block, add:

```tsx
{
  /* Partial result indicator — message was streaming but session stopped */
}
{
  message.streaming && !sessionIsStreaming && (
    <div className="flex items-center gap-1 mt-1 text-[10px] text-[var(--warning-muted-text)]">
      <span className="text-[var(--warning)]">!</span>
      <span>{t("partialResult")}</span>
    </div>
  );
}
```

Where `sessionIsStreaming` is the session-level streaming state (from the store hook already in MessageList scope), and `message.streaming` is the per-message flag. If the message rendering happens in a child component, pass `sessionIsStreaming` as a prop.

- [x] **Step 2: Add i18n keys**

In `dashboard/src/i18n/en.json`, add to `"chat"`:

```json
"partialResult": "Stream interrupted — partial result"
```

In `dashboard/src/i18n/zh.json`, add to `"chat"`:

```json
"partialResult": "流中断 — 部分结果"
```

- [x] **Step 3: Run tests**

Run: `cd dashboard && pnpm test`
Expected: All pass

- [x] **Step 4: Commit**

```bash
scripts/committer "[enhanced][codex-impl] feat(deck): partial result indicator for interrupted streams" dashboard/src/components/panels/chat/MessageList.tsx dashboard/src/i18n/en.json dashboard/src/i18n/zh.json
```

---

### Task 11: Type-Check, Lint, Full Test Suite

**Files:**

- No new files

**实施描述:** Run full verification suite to confirm no regressions.

**验收标准:** `tsc --noEmit` zero errors, `pnpm check` passes, `pnpm test` all green.

**测试要求:** Full suite.

**依赖关系:** All previous tasks

**域标签:** `[test]`

**复杂度:** `simple`

- [x] **Step 1: Type check**

Run: `pnpm tsgo`
Expected: Zero errors

- [x] **Step 2: Lint and format**

Run: `pnpm check`
Expected: All pass

- [x] **Step 3: Full test suite**

Run: `cd dashboard && pnpm test`
Expected: All pass (895+ tests)

- [x] **Step 4: Commit if any format fixes needed**

```bash
pnpm format:fix
scripts/committer "[enhanced][codex-impl] style(deck): format fixes" <changed-files>
```

---

### Task 12: Update Replacement Matrix

**Files:**

- Modify: `docs/plans/2026-04-03-deck-web-replacement-matrix.md`

**实施描述:** Update Chat and Approval rows to `replacement-ready` with notes.

**验收标准:** Matrix reflects new status.

**测试要求:** None.

**依赖关系:** Task 11

**域标签:** `[docs]`

**复杂度:** `simple`

- [x] **Step 1: Update matrix**

In `docs/plans/2026-04-03-deck-web-replacement-matrix.md`, change:

Chat row: `partial` → `replacement-ready`
Notes: `Phase 2 P0+P1 complete: status badge, SSE banner, config toggles, session rename/search, stream failure indicator, nested tool results`

Approval row: `partial` → `replacement-ready`
Notes: `Phase 2 P0+P1 complete: SLC-3 fix, countdown timer, security metadata, loading state, client-side expiry cleanup`

- [x] **Step 2: Commit**

```bash
scripts/committer "[enhanced][codex-finish] docs(deck): update matrix — Chat + Approval now replacement-ready" docs/plans/2026-04-03-deck-web-replacement-matrix.md
```
