# Session-State Projection Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the existing session-scoped state implementation with the newly completed projection platform — specifically, handle `projection.gap` SSE events to trigger snapshot recovery, and activate the `visibilitychange` eviction trigger specified in the session-lifecycle spec.

**Architecture:** The SSE stream endpoint (`/api/stream`) already emits `projection.gap` events when outbox events are pruned. The client-side `useChatSSE` hook needs a new event branch that evicts stale cached sessions and refetches the active session's snapshot. A module-level in-flight guard prevents concurrent gap recovery. A `visibilitychange` listener in the same hook handles aggressive eviction when the tab goes hidden.

**Tech Stack:** TypeScript, React (hooks), Zustand, Vitest

---

## File Structure

| File                                                                           | Action | Responsibility                                                   |
| ------------------------------------------------------------------------------ | ------ | ---------------------------------------------------------------- |
| `dashboard/src/components/panels/chat/useChatSSE.ts`                           | Modify | Add `projection.gap` event handler + `visibilitychange` listener |
| `dashboard/src/components/panels/chat/__tests__/projection-gap.test.ts`        | Create | Unit tests for gap recovery handler                              |
| `dashboard/src/components/panels/chat/__tests__/useChatSSE-visibility.test.ts` | Create | Hook-level visibilitychange eviction tests                       |

---

### Task 1: projection.gap Event Handler

**实施描述:** Add `handleProjectionGap()` function in `useChatSSE.ts` with an in-flight guard to prevent concurrent recovery. Evicts stale cached sessions and refetches the active session's snapshot. Wire it into the SSE event switch as a new `projection.gap` branch.

**验收标准:**

- `projection.gap` SSE event triggers `evictStale(0)` on the store
- Active session's snapshot is refetched and applied (messages, approval, a2uiState)
- Non-active, non-streaming cached sessions whose `lastAccessedAt` is > 0ms ago are evicted from the Map
- No error thrown if no active session exists
- Streaming sessions are not interrupted
- Concurrent gap events are coalesced (in-flight guard prevents duplicate fetches)

**测试要求:**

- Test: gap event triggers evictStale and snapshot refetch
- Test: gap event with no active session is a safe no-op
- Test: gap event preserves streaming sessions
- Test: concurrent gap calls are coalesced (second call returns immediately)
- Test: snapshot fetch failure is handled gracefully

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

// Mock chat-api and history-normalize before any imports
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

// Dynamic imports — re-acquired after each vi.resetModules() so mock
// instances stay in sync with the modules the code under test uses.
let fetchChatSnapshot: typeof import("../chat-api").fetchChatSnapshot;
let normalizeHistoryMessages: typeof import("../history-normalize").normalizeHistoryMessages;
let handleProjectionGap: typeof import("../useChatSSE").handleProjectionGap;
let useChatStore: typeof import("@/stores/chat").useChatStore;

beforeEach(async () => {
  vi.resetModules();
  ({ fetchChatSnapshot } = await import("../chat-api"));
  ({ normalizeHistoryMessages } = await import("../history-normalize"));
  ({ handleProjectionGap } = await import("../useChatSSE"));
  ({ useChatStore } = await import("@/stores/chat"));
});

afterEach(() => {
  vi.restoreAllMocks();
});

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

  it("coalesces concurrent gap calls via in-flight guard", async () => {
    const store = useChatStore.getState();
    store.ensureSession("active-sess");
    store.setActiveSession("active-sess");
    useChatStore.setState({ activeAgentId: "main" });

    // Create a deferred promise so we can control resolution timing
    let resolve!: (v: unknown) => void;
    const deferred = new Promise((r) => {
      resolve = r;
    });
    vi.mocked(fetchChatSnapshot).mockReturnValue(deferred as ReturnType<typeof fetchChatSnapshot>);

    // Fire two concurrent calls
    const p1 = handleProjectionGap();
    const p2 = handleProjectionGap();

    // Second call should return immediately (in-flight guard)
    resolve({
      messages: [],
      meta: null,
      activeApproval: null,
      a2uiState: null,
    });
    await Promise.all([p1, p2]);

    // Only one fetch should have been made
    expect(fetchChatSnapshot).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && pnpm test -- src/components/panels/chat/__tests__/projection-gap.test.ts -v`
Expected: FAIL — `handleProjectionGap` is not exported from `useChatSSE`

- [ ] **Step 3: Implement handleProjectionGap + wire into SSE handler**

Modify `dashboard/src/components/panels/chat/useChatSSE.ts`:

**Add imports** at the top (after existing imports, `persistChatProjection` is already imported):

```typescript
import { fetchChatSnapshot } from "./chat-api";
import { normalizeHistoryMessages } from "./history-normalize";
```

**Add in-flight guard + `handleProjectionGap` function** after the `handleCanvasEvent` function (before `export function useChatSSE()`):

```typescript
// ---------------------------------------------------------------------------
// projection.gap recovery — in-flight guard prevents concurrent fetches
// ---------------------------------------------------------------------------

let _gapRecoveryInFlight = false;

/**
 * Handle a projection.gap SSE event — the server detected that the client
 * missed events from the outbox (e.g. due to pruning or long disconnect).
 *
 * Recovery: evict stale cached sessions (they may hold outdated state),
 * then refetch the active session's snapshot so the user sees current data.
 * An in-flight guard coalesces rapid consecutive gap events.
 *
 * @internal — exported for testing only
 */
export async function handleProjectionGap(): Promise<void> {
  if (_gapRecoveryInFlight) {
    return;
  }
  _gapRecoveryInFlight = true;
  try {
    const store = useChatStore.getState();

    // Evict non-active, non-streaming sessions — their cached state is
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
  } finally {
    _gapRecoveryInFlight = false;
  }
}
```

**Wire into SSE event switch** — add after the `canvas` handler block (before the closing `catch`), at approximately line 223:

```typescript
if (event.event === "projection.gap") {
  void handleProjectionGap();
  return;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd dashboard && pnpm test -- src/components/panels/chat/__tests__/projection-gap.test.ts -v`
Expected: PASS — all 6 tests green

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

- Test: visibilitychange hidden triggers evictStale with DEFAULT_EVICT_IDLE_MS
- Test: visibilitychange visible does NOT trigger evictStale

**依赖关系:** blockedBy Task 1 (both modify `useChatSSE.ts`)

**域标签:** `[frontend]`

**复杂度:** `simple`

**Files:**

- Modify: `dashboard/src/components/panels/chat/useChatSSE.ts:118-234`
- Create: `dashboard/src/components/panels/chat/__tests__/useChatSSE-visibility.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `dashboard/src/components/panels/chat/__tests__/useChatSSE-visibility.test.ts`:

```typescript
// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_EVICT_IDLE_MS } from "@/stores/chat-types";

// Mock deckStream to prevent actual SSE connection
vi.mock("@/lib/deck-client", () => ({
  deckStream: vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
  deckFetch: vi.fn().mockResolvedValue(new Response("{}", { status: 200 })),
}));

// Mock chat-api to prevent actual API calls
vi.mock("../chat-api", () => ({
  fetchChatSnapshot: vi.fn(),
  persistChatProjection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../history-normalize", () => ({
  normalizeHistoryMessages: vi.fn(() => []),
}));

let useChatSSE: typeof import("../useChatSSE").useChatSSE;
let useChatStore: typeof import("@/stores/chat").useChatStore;

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

beforeEach(async () => {
  vi.resetModules();
  ({ useChatSSE } = await import("../useChatSSE"));
  ({ useChatStore } = await import("@/stores/chat"));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useChatSSE visibility eviction", () => {
  it("calls evictStale(DEFAULT_EVICT_IDLE_MS) when page goes hidden", () => {
    const spy = vi.spyOn(useChatStore.getState(), "evictStale");
    const { unmount } = renderHook(() => useChatSSE());

    setVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));

    expect(spy).toHaveBeenCalledWith(DEFAULT_EVICT_IDLE_MS);
    unmount();
  });

  it("does NOT call evictStale when page becomes visible", () => {
    const spy = vi.spyOn(useChatStore.getState(), "evictStale");
    const { unmount } = renderHook(() => useChatSSE());

    setVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));

    expect(spy).not.toHaveBeenCalled();
    unmount();
  });

  it("removes listener on unmount", () => {
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const { unmount } = renderHook(() => useChatSSE());

    unmount();

    expect(removeSpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && pnpm test -- src/components/panels/chat/__tests__/useChatSSE-visibility.test.ts -v`
Expected: FAIL — evictStale not called (listener not yet implemented)

- [ ] **Step 3: Implement visibilitychange listener**

Modify `dashboard/src/components/panels/chat/useChatSSE.ts`.

**Add import** at the top (after existing imports):

```typescript
import { DEFAULT_EVICT_IDLE_MS } from "@/stores/chat-types";
```

**Add visibilitychange listener** inside the `useEffect(() => { ... }, [])`, before the `return` cleanup. Then replace the existing single-line cleanup with an expanded one:

Replace the existing cleanup return:

```typescript
return () => controller.abort();
```

With:

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

- [ ] **Step 4: Run test to verify it passes**

Run: `cd dashboard && pnpm test -- src/components/panels/chat/__tests__/useChatSSE-visibility.test.ts -v`
Expected: PASS — all 3 tests green

- [ ] **Step 5: Run full dashboard test suite**

Run: `cd dashboard && pnpm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
scripts/committer "[enhanced][codex-impl] feat(deck): add visibilitychange eviction trigger for session lifecycle" \
  dashboard/src/components/panels/chat/useChatSSE.ts \
  dashboard/src/components/panels/chat/__tests__/useChatSSE-visibility.test.ts
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
Expected: Clean (run `pnpm format:fix` if format issues found)

- [ ] **Step 3: Run build**

Run: `pnpm build`
Expected: Clean build, no warnings

- [ ] **Step 4: Run full test suite**

Run: `cd dashboard && pnpm test`
Expected: All tests pass

- [ ] **Step 5: Commit if any fixups needed**

Only if lint/format auto-fixes were applied:

```bash
scripts/committer "[enhanced][codex-impl] style(deck): lint and format fixes for projection alignment" \
  dashboard/src/components/panels/chat/useChatSSE.ts
```
