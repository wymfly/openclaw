# Session-Scoped State Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Dashboard chat Zustand store from a flat structure to a `Map<sessionKey, SessionState>` architecture, enabling session-scoped state isolation, stable SSE connections, background session tracking, and LRU eviction.

**Architecture:** Single Zustand store with `Map<string, SessionState>` for all session data. Single EventSource connection (empty deps) with client-side dispatcher routing events by `payload.sessionKey`. Module-level `Map<string, AbortController>` for async cancellation. Gradual migration via compatibility bridge.

**Tech Stack:** React 19, Zustand, TypeScript, Next.js 16 App Router, Vitest

**Design Spec:** `docs/superpowers/specs/2026-03-21-session-scoped-state-design.md`
**OpenSpec:** `openspec/changes/session-scoped-state/`

---

## File Structure

| File                                                                | Responsibility                                                                                                      | Action  |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------- |
| `dashboard/src/stores/chat-types.ts`                                | SessionState, ToolProgress, ApprovalRequest, A2UIState, SessionMeta, ChatStore interface, ContentBlock, ChatMessage | Create  |
| `dashboard/src/stores/chat-abort.ts`                                | Module-level AbortController Map + getSessionAbort/abortSession                                                     | Create  |
| `dashboard/src/stores/chat-hooks.ts`                                | Fine-grained selector hooks (useSessionMessages, etc.)                                                              | Create  |
| `dashboard/src/stores/chat.ts`                                      | Zustand store with Map<string, SessionState> + all actions                                                          | Rewrite |
| `dashboard/src/components/panels/chat/useChatSSE.ts`                | useSSEConnection hook + dispatcher functions                                                                        | Rewrite |
| `dashboard/src/components/panels/chat/ChatPanel.tsx`                | Remove manual useEffect history loading, use setActiveSession                                                       | Modify  |
| `dashboard/src/components/panels/chat/MessageList.tsx`              | Migrate to useSessionMessages()                                                                                     | Modify  |
| `dashboard/src/components/panels/chat/MessageInput.tsx`             | Migrate to useSessionStreaming(), pass sessionKey to send                                                           | Modify  |
| `dashboard/src/components/panels/chat/SessionSidebar.tsx`           | Remove clearMessages, use useSessionMetaList + useSessionIndicator                                                  | Modify  |
| `dashboard/src/components/panels/chat/ApprovalDialog.tsx`           | Migrate to useSessionApproval()                                                                                     | Modify  |
| `dashboard/src/stores/__tests__/chat-store.test.ts`                 | Store unit tests                                                                                                    | Create  |
| `dashboard/src/stores/__tests__/chat-abort.test.ts`                 | AbortController unit tests                                                                                          | Create  |
| `dashboard/src/components/panels/chat/__tests__/dispatcher.test.ts` | SSE dispatcher unit tests                                                                                           | Create  |

---

### Task 1: Types + AbortController module

**Context:** Pure type definitions and a standalone utility module. No existing code changes, zero risk.

**Files:**

- Create: `dashboard/src/stores/chat-types.ts`
- Create: `dashboard/src/stores/chat-abort.ts`

**Skills:** `superpowers:test-driven-development`

- [ ] **Step 1: Create chat-types.ts**

Extract existing types (`ContentBlock`, `ChatMessage`, `SessionInfo`) from `dashboard/src/stores/chat.ts` and add new types. The existing `SessionInfo` maps to our `SessionMeta`. Add `SessionState`, `ToolProgress`, `ApprovalRequest`, `A2UIState`. Define the `ChatStore` interface with all session-scoped actions.

Key types to define:

```typescript
// Re-export existing types
export type ContentBlock = /* existing 6-variant union */;
export type ChatMessage = /* existing interface */;

// New types
export interface SessionState {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingRunId: string | null;
  error: string | null;
  toolProgress: Record<string, ToolProgress>;
  activeApproval: ApprovalRequest | null;
  a2uiState: A2UIState | null;
  status: 'active' | 'idle';
  lastAccessedAt: number;
}

export interface SessionMeta {
  key: string;
  agentId: string;
  title?: string;
  updatedAt: number;
  lastMessagePreview?: string;
}

export const MAX_CACHED_SESSIONS = 20;
export const DEFAULT_EVICT_IDLE_MS = 5 * 60 * 1000;

export function createEmptySessionState(): SessionState { /* ... */ }
```

- [ ] **Step 2: Create chat-abort.ts**

```typescript
const sessionAbortControllers = new Map<string, AbortController>();

export function getSessionAbort(sessionKey: string): AbortController {
  let ctrl = sessionAbortControllers.get(sessionKey);
  if (!ctrl) {
    ctrl = new AbortController();
    sessionAbortControllers.set(sessionKey, ctrl);
  }
  return ctrl;
}

export function abortSession(sessionKey: string): void {
  sessionAbortControllers.get(sessionKey)?.abort();
  sessionAbortControllers.delete(sessionKey);
}
```

- [ ] **Step 3: Write AbortController tests**

Create `dashboard/src/stores/__tests__/chat-abort.test.ts`:

- `getSessionAbort` returns same instance for same key
- `getSessionAbort` returns different instances for different keys
- `abortSession` aborts the controller and removes it
- `getSessionAbort` after `abortSession` returns a new (non-aborted) instance

- [ ] **Step 4: Run tests**

Run: `cd dashboard && npx vitest run src/stores/__tests__/chat-abort.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```
[enhanced] feat(deck): add session-scoped state types + AbortController module
```

---

### Task 2: Rewrite chat store with Map + compatibility bridge

**Context:** Core rewrite. The existing `chat.ts` has a flat state (single `messages[]`, single `isStreaming`). Replace with `Map<string, SessionState>`. Add compatibility bridge so un-migrated components continue to work during Tasks 3-5.

**Files:**

- Rewrite: `dashboard/src/stores/chat.ts`
- Create: `dashboard/src/stores/__tests__/chat-store.test.ts`

**Skills:** `superpowers:test-driven-development`

**Critical contract — immutable Map updates:** Every action that modifies a SessionState MUST create `new Map(state.sessions)` + spread the SessionState object, then `set({ sessions: newMap })`. Direct mutation silently bypasses Zustand's shallow equality.

- [ ] **Step 1: Write store tests — ensureSession**

Test: creates new SessionState when key absent, returns existing and updates lastAccessedAt when present.

- [ ] **Step 2: Write store tests — addMessage (idempotent)**

Test: adds message to correct session, is no-op when message.id already exists, does not affect other sessions.

- [ ] **Step 3: Write store tests — setMessages (history-then-append)**

Test: replaces all messages when session is empty. When session has SSE messages (id = runId format), appends them after history messages.

- [ ] **Step 4: Write store tests — setStreaming + status transitions**

Test: `setStreaming(key, true, runId)` sets `status: 'active'` + `streamingRunId`. `setStreaming(key, false)` sets `status: 'idle'` + `streamingRunId: null`.

- [ ] **Step 5: Write store tests — setActiveSession**

Test: sets `activeSessionKey`, updates `lastAccessedAt` on cache hit. Note: `evictStale` wiring tested in Task 7 after lifecycle management is complete.

- [ ] **Step 6: Write store tests — evictStale**

Test: active sessions never evicted, activeSessionKey never evicted, stale idle sessions evicted, Map reference changes (immutability check).

- [ ] **Step 6.1: Write store tests — removeSession**

Test: `removeSession(key)` calls `abortSession(key)`, removes entry from sessions Map, removes matching entry from sessionMeta array.

- [ ] **Step 6.2: Write store tests — setSessionMeta / refreshSessionMeta**

Test: `setSessionMeta(meta)` replaces the sessionMeta array. Note: current store uses `setSessions` for sidebar — this becomes `setSessionMeta` in the new API.

- [ ] **Step 7: Write store tests — immutable Map updates**

Test: after `addMessage`, `Object.is(oldSessions, newSessions)` is `false` (new Map reference). Same for `updateStreamingBlocks`, `setStreaming`, `evictStale`.

- [ ] **Step 8: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/stores/__tests__/chat-store.test.ts`
Expected: FAIL (store not yet rewritten)

- [ ] **Step 9: Rewrite chat.ts**

Implement the full store. Key structure:

```typescript
import { create } from "zustand";
import {
  type SessionState,
  type ChatStore,
  createEmptySessionState,
  MAX_CACHED_SESSIONS,
  DEFAULT_EVICT_IDLE_MS,
} from "./chat-types";
import { getSessionAbort, abortSession } from "./chat-abort";

export const useChatStore = create<ChatStore>((set, get) => ({
  sessions: new Map<string, SessionState>(),
  activeSessionKey: null,
  activeAgentId: null,
  sessionMeta: [],

  ensureSession(key) {
    /* new Map + createEmptySessionState */
  },
  addMessage(sessionKey, msg) {
    /* idempotent, new Map + new SessionState */
  },
  setMessages(sessionKey, msgs) {
    /* history-then-append strategy */
  },
  updateStreamingBlocks(sessionKey, runId, blocks) {
    /* ... */
  },
  // ... all actions per design spec

  // Compatibility bridge (removed in Task 6)
}));

// Bridge for un-migrated components
export function getActiveSession() {
  /* ... */
}
```

Ensure `clearMessages`, `setIsStreaming`, `messages`, `isStreaming` remain accessible via the bridge during transition.

Key actions to implement explicitly:

- `ensureSession`, `addMessage` (idempotent), `updateStreamingBlocks`, `finalizeStreamingMessage`, `replaceMessageContent`
- `setMessages` (history-then-append), `setStreaming` (+ status transition), `setError`
- `setActiveSession` (cache hit vs rehydrate — evictStale wiring deferred to Task 7)
- `updateToolProgress`, `setActiveApproval`, `setA2UIState`, `setActiveAgent`
- `removeSession` (abortSession + delete from Map + delete from sessionMeta)
- `setSessionMeta` / `refreshSessionMeta` (rename from old `setSessions`)
- Compatibility bridge: `getActiveSession()`, old-style `messages`/`isStreaming` accessors

- [ ] **Step 10: Run tests**

Run: `cd dashboard && npx vitest run src/stores/__tests__/chat-store.test.ts`
Expected: PASS

- [ ] **Step 11: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit`
Expected: Errors in consuming components (expected — they use old API), but store itself compiles.

- [ ] **Step 12: Commit**

```
[enhanced] feat(deck): rewrite chat store with Map<sessionKey, SessionState>
```

---

### Task 3: Rewrite SSE dispatcher

**Context:** Current `useChatSSE.ts` uses closures + `activeSessionId` in deps array, causing EventSource reconnection on session switch. Replace with `useSSEConnection` (empty deps) + standalone dispatcher functions.

**Files:**

- Rewrite: `dashboard/src/components/panels/chat/useChatSSE.ts`
- Create: `dashboard/src/components/panels/chat/__tests__/dispatcher.test.ts`

**Skills:** `superpowers:test-driven-development`

**Critical contracts — field names:**

- SSE chat event uses `payload.state` (not `payload.type`) for delta/final/error/aborted. See `src/gateway/protocol/schema/logs-chat.ts:69-74`.
- Text extraction: payload has no `text` field. Use `extractTextFromMessage(payload.message)` (see current `useChatSSE.ts`) to extract text from the `message` object.
- Error field: `payload.errorMessage` (not `payload.message`). See `ChatEventSchema` line 76 and current `useChatSSE.ts:195`.
- History reload: use `limit=5` (not `limit=1`) because the last message may be a user message; we need to scan back to find the assistant message to replace. See current `useChatSSE.ts:87`.

- [ ] **Step 1: Write dispatcher tests — first-delta vs subsequent-delta**

Test: when `session.streamingRunId !== payload.runId`, calls `addMessage`. When equal, calls `updateStreamingBlocks`. Use `useChatStore.getState()` / `useChatStore.setState()` directly in tests.

- [ ] **Step 2: Write dispatcher tests — final triggers reloadFullContent**

Test: on `state: 'final'`, calls `finalizeStreamingMessage` + `setStreaming(key, false)`. Mock `reloadFullContent` to verify it's called with correct args.

- [ ] **Step 3: Write dispatcher tests — cross-session routing**

Test: events for session A update session A, events for session B update session B, neither affects the other.

- [ ] **Step 4: Write dispatcher tests — agent/approval/a2ui event routing**

Test: `dispatchAgentEvent` routes to correct session's `updateToolProgress`. `dispatchApproval` routes to correct session's `setActiveApproval`. `dispatchA2UIEvent` routes to correct session's `setA2UIState`.

- [ ] **Step 5: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/components/panels/chat/__tests__/dispatcher.test.ts`
Expected: FAIL

- [ ] **Step 6: Implement dispatcher functions**

Create standalone functions (not hooks):

```typescript
export function dispatchChatEvent(payload: ChatSSEPayload) {
  const sessionKey = payload.sessionKey;
  if (!sessionKey) return;
  const store = useChatStore.getState();
  store.ensureSession(sessionKey);

  switch (
    payload.state // ← 注意: state, 不是 type
  ) {
    case "delta": {
      // 用 extractTextFromMessage(payload.message) 提取文本
      // first-delta vs subsequent-delta logic
    }
    case "final": {
      // 用 extractTextFromMessage(payload.message) 提取文本
      // finalize + reloadFullContent
    }
    case "error": {
      // 用 payload.errorMessage（不是 payload.message）
      store.setError(sessionKey, payload.errorMessage);
      store.setStreaming(sessionKey, false);
    }
    case "aborted": {
      /* setStreaming(false) */
    }
  }
}
```

- [ ] **Step 7: Implement useSSEConnection hook**

```typescript
export function useSSEConnection() {
  useEffect(() => {
    const es = new EventSource("/api/stream");
    es.addEventListener("chat", (e) => dispatchChatEvent(JSON.parse(e.data)));
    es.addEventListener("agent", (e) => dispatchAgentEvent(JSON.parse(e.data)));
    es.addEventListener("approval.pending", (e) => dispatchApproval(JSON.parse(e.data)));
    es.addEventListener("approval.resolved", () => {
      /* clear active approval */
    });
    es.addEventListener("a2ui", (e) => dispatchA2UIEvent(JSON.parse(e.data)));
    return () => es.close();
  }, []); // ← empty deps: survives session switches
}
```

- [ ] **Step 8: Implement reloadFullContent**

Use `getSessionAbort(sessionKey).signal`, query `?sessionKey=${sessionKey}&limit=5` (need to scan back past user messages to find the assistant message), 2 retries, double-check session still in Map before `replaceMessageContent`.

- [ ] **Step 9: Run tests**

Run: `cd dashboard && npx vitest run src/components/panels/chat/__tests__/dispatcher.test.ts`
Expected: PASS

- [ ] **Step 10: Commit**

```
[enhanced] feat(deck): rewrite SSE dispatcher with session-scoped routing
```

---

### Task 4: Selector hooks

**Context:** Fine-grained hooks that subscribe to specific fields of a specific session. Prevents cross-session re-renders.

**Files:**

- Create: `dashboard/src/stores/chat-hooks.ts`

- [ ] **Step 1: Implement selector hooks**

```typescript
import { useChatStore } from "./chat";

export function useSessionMessages(sessionKey?: string): ChatMessage[] {
  return useChatStore((s) => {
    const key = sessionKey ?? s.activeSessionKey;
    return key ? (s.sessions.get(key)?.messages ?? []) : [];
  });
}

export function useSessionStreaming(sessionKey?: string) {
  return useChatStore((s) => {
    const key = sessionKey ?? s.activeSessionKey;
    const session = key ? s.sessions.get(key) : undefined;
    return { isStreaming: session?.isStreaming ?? false, runId: session?.streamingRunId ?? null };
  });
}

// useSessionToolProgress, useSessionApproval, useActiveSessionKey,
// useSessionMetaList — same pattern

export function useSessionIndicator(key: string) {
  return useChatStore((s) => {
    const session = s.sessions.get(key);
    if (!session) return "none" as const;
    if (session.activeApproval) return "approval" as const;
    if (session.isStreaming) return "streaming" as const;
    if (session.a2uiState) return "canvas" as const;
    return "idle" as const;
  });
}
```

- [ ] **Step 2: Write selector hooks isolation test**

Create `dashboard/src/stores/__tests__/chat-hooks.test.ts`:

- Verify `useSessionMessages('A')` does not re-render when session B's messages change
- Verify `useSessionIndicator` returns correct values for approval/streaming/canvas/idle/none states

- [ ] **Step 3: Run tests**

Run: `cd dashboard && npx vitest run src/stores/__tests__/chat-hooks.test.ts`
Expected: PASS

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```
[enhanced] feat(deck): add session-scoped selector hooks
```

---

### Task 5: Migrate consuming components

**Context:** Replace direct store access with selector hooks. One component at a time, verify after each.

**Files:**

- Modify: `dashboard/src/components/panels/chat/ChatPanel.tsx`
- Modify: `dashboard/src/components/panels/chat/MessageList.tsx`
- Modify: `dashboard/src/components/panels/chat/MessageInput.tsx`
- Modify: `dashboard/src/components/panels/chat/SessionSidebar.tsx`
- Modify: `dashboard/src/components/panels/chat/ApprovalDialog.tsx`

- [ ] **Step 1: Migrate ChatPanel.tsx**

Remove `useEffect([activeSessionId])` that calls `clearMessages()` + fetches history. Replace with `useSSEConnection()` call (from Task 3). `setActiveSession(key)` now handles everything internally (eviction, cache hit / rehydrate).

Key changes:

- Remove `clearMessages()` import and calls
- Remove history-loading useEffect
- Add `useSSEConnection()` call
- Use `useActiveSessionKey()` instead of `useChatStore(s => s.activeSessionId)`

- [ ] **Step 2: Migrate MessageList.tsx**

Replace `useChatStore(s => s.messages)` with `useSessionMessages()`.
Replace `useChatStore(s => s.isStreaming)` with `useSessionStreaming()`.

- [ ] **Step 3: Migrate MessageInput.tsx**

Replace `useChatStore(s => s.isStreaming)` with `useSessionStreaming()`.
Pass `activeSessionKey` to the send action. Attachments stay as component-local state.

- [ ] **Step 4: Migrate SessionSidebar.tsx**

Remove `clearMessages()` from `handleSelect`. Replace `useChatStore(s => s.sessions)` (old `SessionInfo[]`) with `useSessionMetaList()` (new `SessionMeta[]` — same shape, renamed). Add `useSessionIndicator(key)` for status badges. The `handleSelect` now just calls `setActiveSession(key)`.

**Rename alert:** The old store field `sessions: SessionInfo[]` is now `sessionMeta: SessionMeta[]`. The old `setSessions` action is now `setSessionMeta`. Update all references in SessionSidebar.

- [ ] **Step 5: Migrate ApprovalDialog.tsx**

Replace `useChatStore(s => s.activeApproval)` with `useSessionApproval()`.

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit`
Expected: PASS (zero errors)

- [ ] **Step 7: Commit**

```
[enhanced] refactor(deck): migrate chat components to session-scoped hooks
```

---

### Task 6: Cleanup — remove compatibility bridge + old API

**Context:** All components now use the new API. Remove the bridge and old flat fields.

**Files:**

- Modify: `dashboard/src/stores/chat.ts`
- Modify: `dashboard/src/stores/chat-types.ts` (if bridge types exist)

- [ ] **Step 1: Remove getActiveSession() bridge**

Delete the `getActiveSession()` export and any compatibility shims. Search for any remaining callers:

```
rg "getActiveSession|clearMessages|setIsStreaming" dashboard/src/
```

Fix any remaining references.

- [ ] **Step 2: Update toUiMessage for globally unique IDs**

Change message ID format from `hist-${index}` to `${sessionKey}:${msg.timestamp}:${index}` in `ChatPanel.tsx`'s `toUiMessage` function.

- [ ] **Step 3: Verify TypeScript compiles + run all existing tests**

Run: `cd dashboard && npx tsc --noEmit && npx vitest run`
Expected: PASS

- [ ] **Step 4: Commit**

```
[enhanced] refactor(deck): remove compatibility bridge, clean up old flat store API
```

---

### Task 7: Session lifecycle management

**Context:** Implement LRU eviction with natural triggers and visibilitychange listener.

**Files:**

- Modify: `dashboard/src/stores/chat.ts` (evictStale already stubbed in Task 2, now wire triggers)
- Modify: `dashboard/src/components/panels/chat/ChatPanel.tsx` (visibilitychange listener)

- [ ] **Step 1: Wire evictStale trigger in setStreaming (active→idle)**

In `setStreaming(sessionKey, false)`, after setting `status: 'idle'`, call `get().evictStale()`.

- [ ] **Step 2: Wire ensureSession threshold trigger**

In `ensureSession(key)`, if `sessions.size >= MAX_CACHED_SESSIONS`, call `evictStale()` first.

- [ ] **Step 3: Add visibilitychange listener in ChatPanel**

```typescript
useEffect(() => {
  const handler = () => {
    if (document.visibilityState === "hidden") {
      useChatStore.getState().evictStale();
    }
  };
  document.addEventListener("visibilitychange", handler);
  return () => document.removeEventListener("visibilitychange", handler);
}, []);
```

- [ ] **Step 4: Run all tests**

Run: `cd dashboard && npx vitest run`
Expected: PASS

- [ ] **Step 6: Commit**

```
[enhanced] feat(deck): add session lifecycle management — eviction triggers + indicator hook
```

---

### Task 8: Integration verification

**Context:** All code changes complete. Run full verification suite.

**Files:** None (verification only)

- [ ] **Step 1: TypeScript check**

Run: `cd dashboard && npx tsc --noEmit`
Expected: zero errors

- [ ] **Step 2: Lint**

Run: `pnpm check`
Expected: PASS

- [ ] **Step 3: Run all dashboard tests**

Run: `cd dashboard && npx vitest run`
Expected: all tests pass (existing + new)

- [ ] **Step 4: Commit any lint fixes**

```
[enhanced] fix(deck): lint/format fixes for session-scoped state
```
