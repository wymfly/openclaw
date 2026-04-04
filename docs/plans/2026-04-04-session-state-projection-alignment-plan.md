# Session-State Projection Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the existing session-scoped state implementation with the newly completed projection platform — specifically, handle `projection.gap` SSE events to trigger snapshot recovery, and activate the `visibilitychange` eviction trigger specified in the session-lifecycle spec.

**Architecture:** The SSE stream endpoint (`/api/stream`) already emits `projection.gap` events when outbox events are pruned. The client-side `useChatSSE` hook needs a new event branch that evicts stale cached sessions and refetches the active session's snapshot. A `visibilitychange` listener in the same hook handles aggressive eviction when the tab goes hidden.

**Tech Stack:** TypeScript, React (hooks), Zustand, Vitest

---

## File Structure

| File                                                                    | Action | Responsibility                                                   |
| ----------------------------------------------------------------------- | ------ | ---------------------------------------------------------------- |
| `dashboard/src/components/panels/chat/useChatSSE.ts`                    | Modify | Add `projection.gap` event handler + `visibilitychange` listener |
| `dashboard/src/components/panels/chat/__tests__/projection-gap.test.ts` | Create | Unit tests for gap recovery handler                              |
| `dashboard/src/stores/__tests__/chat-store.test.ts`                     | Modify | Add eviction trigger tests                                       |

---

### Task 1: projection.gap Event Handler

**实施描述:** Add `handleProjectionGap()` function in `useChatSSE.ts` that evicts stale cached sessions and refetches the active session's snapshot. Wire it into the SSE event switch as a new `projection.gap` branch.

**验收标准:**

- `projection.gap` SSE event triggers `evictStale(0)` on the store
- Active session's snapshot is refetched and applied (messages, approval, a2uiState)
- Non-active cached sessions are evicted from the Map
- No error thrown if no active session exists
- Streaming sessions are not interrupted

**测试要求:**

- Test: gap event triggers evictStale and snapshot refetch
- Test: gap event with no active session is a safe no-op
- Test: gap event preserves streaming sessions

**依赖关系:** 无

**域标签:** `[frontend]`

**复杂度:** `complex`

**Files:**

- Modify: `dashboard/src/components/panels/chat/useChatSSE.ts:1-234`
- Create: `dashboard/src/components/panels/chat/__tests__/projection-gap.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `dashboard/src/components/panels/chat/__tests__/projection-gap.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock chat-api before importing the module under test
vi.mock("../chat-api", () => ({
  fetchChatSnapshot: vi.fn(),
  persistChatProjection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../history-normalize", () => ({
  normalizeHistoryMessages: vi.fn((sessionKey: string, msgs: unknown[]) =>
    msgs.map((m, i) => ({
      id: `${sessionKey}:0:${i}`,
      role: (m as { role?: string }).role ?? "user",
      content: [{ type: "text", text: "normalized" }],
      timestamp: Date.now(),
    })),
  ),
}));

import { fetchChatSnapshot } from "../chat-api";
import { normalizeHistoryMessages } from "../history-normalize";

// Reset zustand store between tests
let useChatStore: typeof import("@/stores/chat").useChatStore;

beforeEach(async () => {
  vi.resetModules();
  // Re-import fresh store
  const chatMod = await import("@/stores/chat");
  useChatStore = chatMod.useChatStore;

  // Re-import to get handleProjectionGap with fresh store reference
  const sseMod = await import("../useChatSSE");
  handleProjectionGap = sseMod.handleProjectionGap;
});

afterEach(() => {
  vi.restoreAllMocks();
});

let handleProjectionGap: typeof import("../useChatSSE").handleProjectionGap;

describe("handleProjectionGap", () => {
  it("evicts stale sessions and refetches active session snapshot", async () => {
    const store = useChatStore.getState();
    store.ensureSession("active-sess");
    store.ensureSession("stale-sess");
    store.setActiveSession("active-sess");
    useChatStore.setState({ activeAgentId: "main" });

    vi.mocked(fetchChatSnapshot).mockResolvedValue({
      messages: [{ role: "assistant", content: "hello", timestamp: 1000 }],
      meta: null,
      activeApproval: null,
      a2uiState: null,
    });

    const evictSpy = vi.spyOn(useChatStore.getState(), "evictStale");

    await handleProjectionGap();

    expect(evictSpy).toHaveBeenCalledWith(0);
    expect(fetchChatSnapshot).toHaveBeenCalledWith({
      sessionKey: "active-sess",
      agentId: "main",
    });
    expect(normalizeHistoryMessages).toHaveBeenCalledWith("active-sess", expect.any(Array));
  });

  it("is a safe no-op when no active session", async () => {
    // No active session set
    await handleProjectionGap();

    expect(fetchChatSnapshot).not.toHaveBeenCalled();
  });

  it("does not interrupt streaming sessions", async () => {
    const store = useChatStore.getState();
    store.ensureSession("streaming-sess");
    store.setStreaming("streaming-sess", true, "run-1");
    store.ensureSession("active-sess");
    store.setActiveSession("active-sess");
    useChatStore.setState({ activeAgentId: "main" });

    vi.mocked(fetchChatSnapshot).mockResolvedValue({
      messages: [],
      meta: null,
      activeApproval: null,
      a2uiState: null,
    });

    await handleProjectionGap();

    // Streaming session should survive eviction
    expect(useChatStore.getState().sessions.has("streaming-sess")).toBe(true);
    expect(useChatStore.getState().sessions.get("streaming-sess")?.isStreaming).toBe(true);
  });

  it("applies approval and a2uiState from snapshot", async () => {
    const store = useChatStore.getState();
    store.ensureSession("active-sess");
    store.setActiveSession("active-sess");
    useChatStore.setState({ activeAgentId: "main" });

    const mockApproval = {
      sessionKey: "active-sess",
      id: "approval-1",
      toolName: "command",
    };
    const mockA2UI = { visible: true, url: "http://localhost:3001" };

    vi.mocked(fetchChatSnapshot).mockResolvedValue({
      messages: [],
      meta: null,
      activeApproval: mockApproval,
      a2uiState: mockA2UI,
    });

    await handleProjectionGap();

    const session = useChatStore.getState().sessions.get("active-sess");
    expect(session?.activeApproval).toEqual(mockApproval);
    expect(session?.a2uiState).toMatchObject({ visible: true, url: "http://localhost:3001" });
  });

  it("handles snapshot fetch failure gracefully", async () => {
    const store = useChatStore.getState();
    store.ensureSession("active-sess");
    store.setActiveSession("active-sess");
    useChatStore.setState({ activeAgentId: "main" });

    vi.mocked(fetchChatSnapshot).mockRejectedValue(new Error("Network error"));

    // Should not throw
    await expect(handleProjectionGap()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && pnpm test -- src/components/panels/chat/__tests__/projection-gap.test.ts -v`
Expected: FAIL — `handleProjectionGap` is not exported from `useChatSSE`

- [ ] **Step 3: Implement handleProjectionGap + wire into SSE handler**

Modify `dashboard/src/components/panels/chat/useChatSSE.ts`:

**Add imports** at the top (after existing imports):

```typescript
import { fetchChatSnapshot, persistChatProjection } from "./chat-api";
import { normalizeHistoryMessages } from "./history-normalize";
```

Note: `persistChatProjection` is already imported. Only add `fetchChatSnapshot` and the `normalizeHistoryMessages` import.

**Add `handleProjectionGap` function** after the `handleCanvasEvent` function (before `export function useChatSSE()`):

```typescript
/**
 * Handle a projection.gap SSE event — the server detected that the client
 * missed events from the outbox (e.g. due to pruning or long disconnect).
 *
 * Recovery: evict all stale cached sessions (they may hold outdated state),
 * then refetch the active session's snapshot so the user sees current data.
 *
 * @internal — exported for testing
 */
export async function handleProjectionGap(): Promise<void> {
  const store = useChatStore.getState();

  // Evict all non-active, non-streaming sessions — their cached state is
  // potentially stale after the gap. They will be refetched on next access.
  store.evictStale(0);

  const { activeSessionKey, activeAgentId } = store;
  if (!activeSessionKey) {
    return;
  }

  // Skip refetch if the active session is currently streaming — SSE events
  // are the source of truth during streaming, and reloadFullContent handles
  // the final sync.
  const session = store.sessions.get(activeSessionKey);
  if (session?.isStreaming) {
    return;
  }

  try {
    const snapshot = await fetchChatSnapshot({
      sessionKey: activeSessionKey,
      agentId: activeAgentId ?? undefined,
    });
    const msgs = normalizeHistoryMessages(activeSessionKey, snapshot.messages);

    // Re-read store — state may have changed during the async fetch
    const currentStore = useChatStore.getState();
    const currentMessages = currentStore.sessions.get(activeSessionKey)?.messages ?? [];

    // Preserve locally-added messages for brand-new sessions
    if (!(msgs.length === 0 && currentMessages.length > 0)) {
      currentStore.setMessages(activeSessionKey, msgs);
    }

    currentStore.setActiveApproval(activeSessionKey, snapshot.activeApproval);
    currentStore.setA2UIState(activeSessionKey, snapshot.a2uiState);
  } catch {
    // Snapshot fetch failed — non-critical, user can manually refresh
  }
}
```

**Wire into SSE event switch** — add after the `canvas` handler block (before the catch):

```typescript
if (event.event === "projection.gap") {
  void handleProjectionGap();
  return;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd dashboard && pnpm test -- src/components/panels/chat/__tests__/projection-gap.test.ts -v`
Expected: PASS — all 5 tests green

- [ ] **Step 5: Run full dashboard test suite**

Run: `cd dashboard && pnpm test`
Expected: All existing tests pass (no regressions)

- [ ] **Step 6: Commit**

```bash
scripts/committer "[enhanced][codex-impl] feat(deck): add projection.gap SSE handler for gap recovery" \
  dashboard/src/components/panels/chat/useChatSSE.ts \
  dashboard/src/components/panels/chat/__tests__/projection-gap.test.ts
```

---

### Task 2: visibilitychange Eviction Trigger

**实施描述:** Add a `visibilitychange` event listener inside the existing `useChatSSE` hook's `useEffect`. When the page transitions to `hidden`, call `evictStale(DEFAULT_EVICT_IDLE_MS)` to aggressively clean up idle sessions. This satisfies the session-lifecycle spec requirement for natural eviction triggers.

**验收标准:**

- `visibilitychange` → `hidden` calls `evictStale(DEFAULT_EVICT_IDLE_MS)` on the store
- Listener is added on mount, removed on unmount (no leak)
- Active and streaming sessions are never evicted
- No-op when page becomes `visible` again

**测试要求:**

- Test: visibilitychange hidden triggers evictStale
- Test: visibilitychange visible does NOT trigger evictStale

**依赖关系:** 无（Task 1 已完成时更好，但可独立）

**域标签:** `[frontend]`

**复杂度:** `simple`

**Files:**

- Modify: `dashboard/src/components/panels/chat/useChatSSE.ts:118-234`
- Modify: `dashboard/src/stores/__tests__/chat-store.test.ts`

- [ ] **Step 1: Write the failing test**

Add to the end of `dashboard/src/stores/__tests__/chat-store.test.ts`:

```typescript
// ---------------------------------------------------------------------------
// visibilitychange eviction integration
// ---------------------------------------------------------------------------

describe("evictStale with immediate threshold", () => {
  it("evicts all idle non-active sessions when called with threshold 0", () => {
    vi.useFakeTimers();
    const store = useChatStore.getState();
    store.ensureSession("active-sess");
    store.setActiveSession("active-sess");
    store.ensureSession("idle-1");
    store.ensureSession("idle-2");

    // Advance time so idle sessions are stale even with threshold 0
    vi.advanceTimersByTime(1);

    useChatStore.getState().evictStale(0);

    // Active session preserved
    expect(useChatStore.getState().sessions.has("active-sess")).toBe(true);
    // Idle sessions evicted (threshold 0: now - lastAccessedAt > 0 is true after 1ms)
    expect(useChatStore.getState().sessions.has("idle-1")).toBe(false);
    expect(useChatStore.getState().sessions.has("idle-2")).toBe(false);

    vi.useRealTimers();
  });

  it("preserves streaming sessions even with threshold 0", () => {
    vi.useFakeTimers();
    const store = useChatStore.getState();
    store.ensureSession("streaming-sess");
    store.setStreaming("streaming-sess", true, "run-1");
    store.setActiveSession("other-sess");

    vi.advanceTimersByTime(1);

    useChatStore.getState().evictStale(0);

    expect(useChatStore.getState().sessions.has("streaming-sess")).toBe(true);

    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run test to verify it passes (or identify threshold behavior)**

Run: `cd dashboard && pnpm test -- src/stores/__tests__/chat-store.test.ts -t "evictStale with immediate threshold" -v`
Expected: PASS (these test existing evictStale behavior)

- [ ] **Step 3: Implement visibilitychange listener**

Modify `dashboard/src/components/panels/chat/useChatSSE.ts`.

**Add import** at the top:

```typescript
import { DEFAULT_EVICT_IDLE_MS } from "@/stores/chat-types";
```

**Add visibilitychange listener** inside the `useEffect(() => { ... }, [])`, before the `return () => controller.abort()` line:

```typescript
// Aggressively evict idle sessions when the page goes hidden to free memory.
const onVisibilityChange = () => {
  if (document.visibilityState === "hidden") {
    useChatStore.getState().evictStale(DEFAULT_EVICT_IDLE_MS);
  }
};
document.addEventListener("visibilitychange", onVisibilityChange);

return () => {
  controller.abort();
  document.removeEventListener("visibilitychange", onVisibilityChange);
};
```

Note: replace the existing `return () => controller.abort();` with the expanded cleanup above.

- [ ] **Step 4: Run full dashboard test suite**

Run: `cd dashboard && pnpm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
scripts/committer "[enhanced][codex-impl] feat(deck): add visibilitychange eviction trigger for session lifecycle" \
  dashboard/src/components/panels/chat/useChatSSE.ts \
  dashboard/src/stores/__tests__/chat-store.test.ts
```

---

### Task 3: Type-check and Lint Verification

**实施描述:** Run `tsc --noEmit` and `pnpm check` from the project root to verify no type errors or lint violations were introduced.

**验收标准:**

- `tsc --noEmit` passes with 0 errors
- `pnpm check` (lint + format) passes
- `pnpm build` passes

**测试要求:** Build + type-check

**依赖关系:** Task 1, Task 2

**域标签:** `[test]`

**复杂度:** `simple`

- [ ] **Step 1: Run type-check**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Run lint/format**

Run: `pnpm check`
Expected: Clean

- [ ] **Step 3: Run build**

Run: `pnpm build`
Expected: Clean build, no warnings

- [ ] **Step 4: Run full test suite**

Run: `cd dashboard && pnpm test`
Expected: All tests pass

- [ ] **Step 5: Commit if any fixups needed**

```bash
# Only if lint/format auto-fixes were applied:
scripts/committer "[enhanced][codex-impl] style(deck): lint and format fixes for projection alignment" \
  <changed-files>
```
