# Deck Projection Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generalize ProjectionStore from chat-local to domain-keyed platform API, extract approval into an independent domain, and add SSE replay gap detection.

**Architecture:** Add generic `getProjection<T>(domain, key)` / `setProjection<T>` / `clearProjection` methods to `ProjectionStore` with domain-aware storage key routing (chat domain uses legacy `chat_projection:` prefix for backward compatibility; new domains use `projection:{domain}:` prefix). Refactor `approval-bridge.ts` to write to the approval domain. Add transparent migration for legacy `activeApproval` embedded in chat blobs using a SQLite transaction. Enhance `getEventsSince()` to return `{ events, gapDetected }` and emit `projection.gap` SSE event. No new HTTP endpoints; no outbox schema changes.

**Tech Stack:** TypeScript, SQLite (sql.js), Vitest, Next.js App Router (server routes)

**OpenSpec:** `openspec/changes/deck-projection-platform/` (2 specs, 19 tasks)

**Key design decisions:**

- D1: Generic KV API, not event-sourced (Phase 2)
- D2: Approval is server-write-only (approval-bridge.ts only)
- D3: Gap signal only (no full catch-up protocol)
- D4: Internal server API only (no new HTTP endpoints)
- D5: Transaction-protected migration
- D6: Chat domain uses legacy `chat_projection:` key prefix for zero-migration backward compat; new domains use `projection:{domain}:` prefix. Phase 2 unifies.

---

## File Map

| File                                                  | Action | Responsibility                                                                                                                                                                                                       |
| ----------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dashboard/server/projection-store.ts`                | Modify | Add generic `getProjection/setProjection/clearProjection` with domain-aware key routing; add `getApprovalProjectionWithMigration`; add `getEventsSinceWithGap`; remove chat-specific wrappers after caller migration |
| `dashboard/server/approval-bridge.ts`                 | Modify | Replace `persistApprovalProjection` to use `setProjection("approval", ...)` / `clearProjection("approval", ...)`                                                                                                     |
| `dashboard/src/app/api/stream/route.ts`               | Modify | Use `getEventsSinceWithGap()`, emit `projection.gap` SSE event                                                                                                                                                       |
| `dashboard/src/app/api/chat/snapshot/route.ts`        | Modify | Read approval from `getApprovalProjectionWithMigration(key)`, read chat from `getProjection("chat", key)`                                                                                                            |
| `dashboard/src/app/api/chat/projection/route.ts`      | Modify | Migrate to `getProjection("chat", ...)` / `setProjection("chat", ...)`                                                                                                                                               |
| `dashboard/src/app/api/chat/sessions/clear/route.ts`  | Modify | Migrate `clearChatSessionProjection` → `clearProjection("chat", ...)`                                                                                                                                                |
| `dashboard/src/app/api/chat/sessions/reset/route.ts`  | Modify | Migrate `clearChatSessionProjection` → `clearProjection("chat", ...)`                                                                                                                                                |
| `dashboard/server/runtime.ts`                         | Modify | Migrate `clearChatSessionProjection` → `clearProjection("chat", ...)`                                                                                                                                                |
| `dashboard/server/__tests__/projection-store.test.ts` | Modify | Add tests for generic API, gap detection, migration                                                                                                                                                                  |
| `dashboard/server/__tests__/approval-bridge.test.ts`  | Modify | Update mocks, add approval domain tests                                                                                                                                                                              |
| `dashboard/src/app/api/chat/snapshot/route.test.ts`   | Modify | Update mock to use new API                                                                                                                                                                                           |

---

### Task 1: Generic Projection API [backend] [simple]

**covers:** OpenSpec 1.1, 1.2, 1.3
**blockedBy:** none

**Files:**

- Modify: `dashboard/server/projection-store.ts`
- Modify: `dashboard/server/__tests__/projection-store.test.ts`

- [ ] **Step 1: Write failing tests for generic projection CRUD**

Add to `dashboard/server/__tests__/projection-store.test.ts` after the "chat session projections" describe block:

```typescript
// ---------------------------------------------------------------------------
// generic projection API
// ---------------------------------------------------------------------------

describe("generic projection API", () => {
  it("returns null for non-existent projection", () => {
    expect(store.getProjection<{ x: number }>("myDomain", "missing")).toBeNull();
  });

  it("writes and reads a projection by domain and key", () => {
    store.setProjection("approval", "session-1", { id: "apr-1", toolName: "command" });
    expect(store.getProjection<{ id: string }>("approval", "session-1")).toEqual({
      id: "apr-1",
      toolName: "command",
    });
  });

  it("overwrites an existing projection", () => {
    store.setProjection("approval", "session-1", { v: 1 });
    store.setProjection("approval", "session-1", { v: 2 });
    expect(store.getProjection<{ v: number }>("approval", "session-1")).toEqual({ v: 2 });
  });

  it("clears a projection and returns true", () => {
    store.setProjection("approval", "session-1", { id: "apr-1" });
    expect(store.clearProjection("approval", "session-1")).toBe(true);
    expect(store.getProjection("approval", "session-1")).toBeNull();
  });

  it("returns false when clearing a non-existent projection", () => {
    expect(store.clearProjection("approval", "ghost")).toBe(false);
  });

  it("isolates projections across domains with the same key", () => {
    store.setProjection("chat", "session-1", { chat: true });
    store.setProjection("approval", "session-1", { approval: true });

    expect(store.getProjection<{ chat: boolean }>("chat", "session-1")).toEqual({ chat: true });
    expect(store.getProjection<{ approval: boolean }>("approval", "session-1")).toEqual({
      approval: true,
    });
  });

  it("chat domain uses legacy key prefix for backward compatibility", () => {
    store.setProjection("chat", "session-bc", { a2uiState: { visible: true } });
    // Verify it's stored under the legacy chat_projection: prefix
    const raw = store.getSetting("chat_projection:session-bc");
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toEqual({ a2uiState: { visible: true } });
  });

  it("non-chat domains use projection: prefix", () => {
    store.setProjection("approval", "session-ap", { id: "apr-x" });
    const raw = store.getSetting("projection:approval:session-ap");
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toEqual({ id: "apr-x" });
  });

  it("reads legacy chat data written by old chat-specific API", () => {
    // Write with legacy API
    store.setChatSessionProjection("session-legacy", { a2uiState: { url: "/test" } });
    // Read with generic API
    expect(store.getProjection("chat", "session-legacy")).toEqual({ a2uiState: { url: "/test" } });
  });

  it("handles empty key gracefully", () => {
    store.setProjection("chat", "", { x: 1 });
    expect(store.getProjection("chat", "")).toBeNull();
  });

  it("handles whitespace-only key gracefully", () => {
    store.setProjection("chat", "  ", { x: 1 });
    expect(store.getProjection("chat", "  ")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- dashboard/server/__tests__/projection-store.test.ts -t "generic projection API"`
Expected: FAIL — `store.getProjection is not a function`

- [ ] **Step 3: Implement generic projection methods**

In `dashboard/server/projection-store.ts`:

Add constant after `CHAT_SESSION_PROJECTION_PREFIX`:

```typescript
const PROJECTION_PREFIX = "projection:";
```

Add methods to `ProjectionStore` class, after the chat session projection methods, before the Maintenance section:

```typescript
  // -- Generic projection API -------------------------------------------------

  getProjection<T>(domain: string, key: string): T | null {
    const storageKey = this.projectionKey(domain, key);
    if (!storageKey) {
      return null;
    }
    const raw = this.getSetting(storageKey);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  setProjection<T>(domain: string, key: string, data: T): void {
    const storageKey = this.projectionKey(domain, key);
    if (!storageKey) {
      return;
    }
    this.setSetting(storageKey, JSON.stringify(data));
  }

  clearProjection(domain: string, key: string): boolean {
    const storageKey = this.projectionKey(domain, key);
    if (!storageKey) {
      return false;
    }
    return this.deleteSetting(storageKey);
  }

  private projectionKey(domain: string, key: string): string | null {
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      return null;
    }
    // Chat domain uses legacy prefix for backward compatibility with existing data.
    // New domains use the standard projection: prefix.
    if (domain === "chat") {
      return `${CHAT_SESSION_PROJECTION_PREFIX}${normalizedKey}`;
    }
    return `${PROJECTION_PREFIX}${domain}:${normalizedKey}`;
  }
```

- [ ] **Step 4: Run all projection-store tests**

Run: `pnpm test -- dashboard/server/__tests__/projection-store.test.ts`
Expected: ALL PASS (new generic API tests + existing chat tests both pass — backward compat verified)

- [ ] **Step 5: Commit**

```bash
scripts/committer "[enhanced][codex-impl] feat(deck): add generic domain-keyed projection API to ProjectionStore" \
  dashboard/server/projection-store.ts \
  dashboard/server/__tests__/projection-store.test.ts
```

---

### Task 2: Approval Projection Extraction [backend] [complex]

**covers:** OpenSpec 2.1, 2.2, 2.3, 2.4
**blockedBy:** Task 1

**Files:**

- Modify: `dashboard/server/approval-bridge.ts`
- Modify: `dashboard/server/__tests__/approval-bridge.test.ts`

- [ ] **Step 1: Update approval-bridge test helper and add domain tests**

In `dashboard/server/__tests__/approval-bridge.test.ts`, update `createMockRuntime`:

```typescript
function createMockRuntime(eventBus: EventBus): MockRuntime {
  const chatProjections = new Map<string, Record<string, unknown>>();
  const approvalProjections = new Map<string, Record<string, unknown>>();

  const setProjection = vi.fn((domain: string, key: string, data: Record<string, unknown>) => {
    const map = domain === "approval" ? approvalProjections : chatProjections;
    map.set(key, data);
  });
  const clearProjection = vi.fn((domain: string, key: string) => {
    const map = domain === "approval" ? approvalProjections : chatProjections;
    return map.delete(key);
  });

  // Legacy mocks (still needed by other runtime consumers)
  const getChatSessionProjection = vi.fn(
    (sessionKey: string) => chatProjections.get(sessionKey) ?? null,
  );
  const setChatSessionProjection = vi.fn(
    (sessionKey: string, projection: Record<string, unknown>) => {
      chatProjections.set(sessionKey, projection);
    },
  );
  const clearChatSessionProjection = vi.fn((sessionKey: string) =>
    chatProjections.delete(sessionKey),
  );

  return {
    setProjectionMock: setProjection,
    clearProjectionMock: clearProjection,
    runtime: {
      eventBus,
      adapter: {} as DeckRuntime["adapter"],
      gw: {} as DeckRuntime["gw"],
      db: {} as DeckRuntime["db"],
      store: {
        getChatSessionProjection,
        setChatSessionProjection,
        clearChatSessionProjection,
        setProjection,
        clearProjection,
      } as unknown as DeckRuntime["store"],
      rateLimiter: {} as DeckRuntime["rateLimiter"],
    },
  };
}
```

Add new describe block:

```typescript
describe("approval projection domain", () => {
  it("writes approval to the approval domain on exec.approval.requested", () => {
    const { runtime, setProjectionMock } = createMockRuntime(bus);
    initApprovalBridge(runtime);

    bus.broadcast("gateway.event", {
      type: "gateway.event",
      event: "exec.approval.requested",
      payload: {
        id: "apr-domain-1",
        request: {
          command: "npm install",
          agentId: "agent-x",
          sessionKey: "agent:main:main",
          runId: "run-1",
          cwd: "/workspace",
        },
        createdAtMs: 1000,
        expiresAtMs: 2000,
      },
    });

    expect(setProjectionMock).toHaveBeenCalledWith("approval", "agent:main:main", {
      id: "apr-domain-1",
      toolName: "command",
      command: "npm install",
      description: "/workspace",
    });
  });

  it("clears approval domain on exec.approval.resolved", () => {
    const { runtime, clearProjectionMock } = createMockRuntime(bus);
    initApprovalBridge(runtime);

    bus.broadcast("gateway.event", {
      type: "gateway.event",
      event: "exec.approval.requested",
      payload: {
        id: "apr-domain-2",
        request: { command: "echo hello", sessionKey: "session-2" },
        createdAtMs: 1000,
        expiresAtMs: 2000,
      },
    });

    bus.broadcast("gateway.event", {
      type: "gateway.event",
      event: "exec.approval.resolved",
      payload: { id: "apr-domain-2", decision: "allow-once" },
    });

    expect(clearProjectionMock).toHaveBeenCalledWith("approval", "session-2");
  });
});
```

- [ ] **Step 2: Run tests to verify new tests fail**

Run: `pnpm test -- dashboard/server/__tests__/approval-bridge.test.ts -t "approval projection domain"`
Expected: FAIL — `setProjectionMock` not called with expected domain-keyed args

- [ ] **Step 3: Refactor approval-bridge.ts to use generic projection API**

In `dashboard/server/approval-bridge.ts`, replace the `persistApprovalProjection` function:

```typescript
function persistApprovalProjection(
  runtime: DeckRuntime,
  sessionKey: string | undefined,
  activeApproval: {
    id: string;
    toolName: string;
    command?: string;
    description?: string;
  } | null,
): void {
  const normalized = sessionKey?.trim();
  if (!normalized) {
    return;
  }
  if (activeApproval) {
    runtime.store.setProjection("approval", normalized, activeApproval);
  } else {
    runtime.store.clearProjection("approval", normalized);
  }
}
```

Remove the import of `ChatSessionProjection`:

```typescript
// Remove this line:
// import type { ChatSessionProjection } from "./projection-store";
```

Keep only:

```typescript
import type { DeckRuntime } from "./runtime";
```

- [ ] **Step 4: Update existing test assertions to match new API**

In the existing test `"adds pending approval on exec.approval.requested gateway event"` (line ~99), update the assertion:

```typescript
expect(setProjectionMock).toHaveBeenCalledWith("approval", "agent:main:main", {
  id: "apr-1",
  toolName: "command",
  command: "rm -rf /",
});
```

Note: The bridge code sets `description: approval.cwd`. When `cwd` is `undefined` (as in this test), the in-memory object has `description: undefined`. Include it in the assertion:

```typescript
expect(setProjectionMock).toHaveBeenCalledWith("approval", "agent:main:main", {
  id: "apr-1",
  toolName: "command",
  command: "rm -rf /",
  description: undefined,
});
```

In the existing test `"removes pending approval on exec.approval.resolved gateway event"` (line ~144), update:

```typescript
expect(clearProjectionMock).toHaveBeenCalledWith("approval", "session-2");
```

- [ ] **Step 5: Run all approval-bridge tests**

Run: `pnpm test -- dashboard/server/__tests__/approval-bridge.test.ts`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
scripts/committer "[enhanced][codex-impl] refactor(deck): extract approval projection to independent domain" \
  dashboard/server/approval-bridge.ts \
  dashboard/server/__tests__/approval-bridge.test.ts
```

---

### Task 3: Legacy Data Migration [backend] [complex]

**covers:** OpenSpec 3.1, 3.2, 3.3
**blockedBy:** Task 2

**Files:**

- Modify: `dashboard/server/projection-store.ts`
- Modify: `dashboard/server/__tests__/projection-store.test.ts`

- [ ] **Step 1: Write failing tests for migration**

Add to `dashboard/server/__tests__/projection-store.test.ts`:

```typescript
// ---------------------------------------------------------------------------
// approval migration from legacy chat blob
// ---------------------------------------------------------------------------

describe("approval migration from legacy chat blob", () => {
  it("migrates activeApproval from chat blob to approval domain on first read", () => {
    // Seed legacy data: chat blob contains embedded activeApproval
    store.setChatSessionProjection("session-migrate", {
      a2uiState: { visible: true },
      activeApproval: {
        id: "apr-legacy",
        toolName: "command",
        command: "rm -rf /",
        description: "/tmp",
      },
    });

    // First read triggers migration
    const approval = store.getApprovalProjectionWithMigration("session-migrate");
    expect(approval).toEqual({
      id: "apr-legacy",
      toolName: "command",
      command: "rm -rf /",
      description: "/tmp",
    });

    // Chat blob no longer has activeApproval
    const chatBlob = store.getChatSessionProjection("session-migrate");
    expect(chatBlob).toEqual({ a2uiState: { visible: true } });
    expect(chatBlob?.activeApproval).toBeUndefined();

    // Approval domain now has the data directly
    expect(store.getProjection("approval", "session-migrate")).toEqual({
      id: "apr-legacy",
      toolName: "command",
      command: "rm -rf /",
      description: "/tmp",
    });
  });

  it("returns null when neither approval domain nor chat blob has approval", () => {
    store.setChatSessionProjection("session-no-approval", {
      a2uiState: { visible: false },
    });
    expect(store.getApprovalProjectionWithMigration("session-no-approval")).toBeNull();
  });

  it("reads from approval domain without migration when already populated", () => {
    store.setProjection("approval", "session-pre", { id: "apr-new", toolName: "command" });
    // Stale chat blob with different approval — should be ignored
    store.setChatSessionProjection("session-pre", {
      activeApproval: { id: "apr-stale", toolName: "command" },
    });

    expect(store.getApprovalProjectionWithMigration("session-pre")).toEqual({
      id: "apr-new",
      toolName: "command",
    });
    // Chat blob untouched
    expect(store.getChatSessionProjection("session-pre")?.activeApproval?.id).toBe("apr-stale");
  });

  it("preserves a2uiState in chat blob during migration", () => {
    const a2ui = { visible: true, url: "/canvas", surfaces: ["main"] };
    store.setChatSessionProjection("session-a2ui", {
      a2uiState: a2ui,
      activeApproval: { id: "apr-a2ui", toolName: "command" },
    });

    store.getApprovalProjectionWithMigration("session-a2ui");

    const chatBlob = store.getChatSessionProjection("session-a2ui");
    expect(chatBlob?.a2uiState).toEqual(a2ui);
    expect(chatBlob?.activeApproval).toBeUndefined();
  });

  it("clears chat blob entirely if only activeApproval was present", () => {
    store.setChatSessionProjection("session-only-approval", {
      activeApproval: { id: "apr-only", toolName: "command" },
    });

    store.getApprovalProjectionWithMigration("session-only-approval");

    expect(store.getChatSessionProjection("session-only-approval")).toBeNull();
  });

  it("returns null for empty/whitespace session key", () => {
    expect(store.getApprovalProjectionWithMigration("")).toBeNull();
    expect(store.getApprovalProjectionWithMigration("  ")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- dashboard/server/__tests__/projection-store.test.ts -t "approval migration"`
Expected: FAIL — `store.getApprovalProjectionWithMigration is not a function`

- [ ] **Step 3: Implement migration method**

Add to `ProjectionStore` class in `dashboard/server/projection-store.ts`, after the generic projection methods:

```typescript
  // -- Approval migration (legacy chat blob → approval domain) ----------------

  /**
   * Read approval projection with transparent migration from legacy chat blob.
   * If the approval domain is empty but the chat blob contains `activeApproval`,
   * atomically migrate it within a SQLite transaction (D5).
   */
  getApprovalProjectionWithMigration(
    sessionKey: string,
  ): ChatSessionProjection["activeApproval"] | null {
    const normalized = sessionKey.trim();
    if (!normalized) {
      return null;
    }

    // Fast path: approval domain already populated
    const existing = this.getProjection<NonNullable<ChatSessionProjection["activeApproval"]>>(
      "approval",
      normalized,
    );
    if (existing) {
      return existing;
    }

    // Check legacy chat blob for embedded activeApproval
    const chatBlob = this.getChatSessionProjection(normalized);
    if (!chatBlob?.activeApproval) {
      return null;
    }

    // Migrate atomically within a SQLite transaction
    const migrate = this.db.transaction(() => {
      // Re-read inside transaction to guard against concurrent writes
      const fresh = this.getChatSessionProjection(normalized);
      if (!fresh?.activeApproval) {
        return null;
      }

      const approval = fresh.activeApproval;

      // Write approval to its own domain
      this.setProjection("approval", normalized, approval);

      // Remove activeApproval from chat blob, preserve a2uiState
      if (fresh.a2uiState != null) {
        this.setChatSessionProjection(normalized, { a2uiState: fresh.a2uiState });
      } else {
        this.clearChatSessionProjection(normalized);
      }

      return approval;
    });

    return migrate();
  }
```

- [ ] **Step 4: Run migration tests**

Run: `pnpm test -- dashboard/server/__tests__/projection-store.test.ts -t "approval migration"`
Expected: ALL PASS

- [ ] **Step 5: Run full projection-store test suite**

Run: `pnpm test -- dashboard/server/__tests__/projection-store.test.ts`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
scripts/committer "[enhanced][codex-impl] feat(deck): add transaction-protected approval migration from legacy chat blob" \
  dashboard/server/projection-store.ts \
  dashboard/server/__tests__/projection-store.test.ts
```

---

### Task 4: Chat Caller Migration + Snapshot Update [backend] [simple]

**covers:** OpenSpec 4.1, 4.2, 4.3, snapshot approval read (2.3)
**blockedBy:** Task 3

**Files:**

- Modify: `dashboard/src/app/api/chat/projection/route.ts`
- Modify: `dashboard/src/app/api/chat/sessions/clear/route.ts`
- Modify: `dashboard/src/app/api/chat/sessions/reset/route.ts`
- Modify: `dashboard/src/app/api/chat/snapshot/route.ts`
- Modify: `dashboard/src/app/api/chat/snapshot/route.test.ts`
- Modify: `dashboard/server/runtime.ts`
- Modify: `dashboard/server/projection-store.ts` (remove chat wrappers)

- [ ] **Step 1: Migrate chat/projection/route.ts**

Replace the entire handler body. After approval extraction, the chat blob only contains `a2uiState`, simplifying the logic:

```typescript
import { getRuntime } from "@server/runtime";
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";

type ProjectionBody = {
  sessionKey?: string;
  a2uiState?: unknown;
};

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json().catch(() => null)) as ProjectionBody | null;
  const sessionKey = body?.sessionKey?.trim();

  if (!sessionKey) {
    return NextResponse.json({ error: "sessionKey is required" }, { status: 400 });
  }

  const runtime = getRuntime();
  if (!runtime) {
    return NextResponse.json({ error: "Gateway not configured" }, { status: 503 });
  }
  if (!body || !("a2uiState" in body)) {
    return NextResponse.json({ error: "a2uiState is required" }, { status: 400 });
  }

  if (body.a2uiState == null) {
    runtime.store.clearProjection("chat", sessionKey);
  } else {
    runtime.store.setProjection("chat", sessionKey, { a2uiState: body.a2uiState });
  }

  return NextResponse.json({ ok: true });
});
```

- [ ] **Step 2: Migrate sessions/clear/route.ts**

Replace line 19:

```typescript
getRuntime()?.store.clearProjection("chat", body.sessionKey);
```

- [ ] **Step 3: Migrate sessions/reset/route.ts**

Replace line 21:

```typescript
getRuntime()?.store.clearProjection("chat", body.sessionKey);
```

- [ ] **Step 4: Migrate runtime.ts**

At `dashboard/server/runtime.ts:124`, replace:

```typescript
store.clearChatSessionProjection(sessionKey);
```

With:

```typescript
store.clearProjection("chat", sessionKey);
```

- [ ] **Step 5: Update snapshot route to read from both domains**

In `dashboard/src/app/api/chat/snapshot/route.ts`, replace lines 71-92:

```typescript
const pendingApproval =
  getPendingApprovals().find((approval) => approval.sessionKey === sessionKey) ?? null;
const projectedApproval = runtime.store.getApprovalProjectionWithMigration(sessionKey);
const chatProjection = runtime.store.getProjection<{ a2uiState?: unknown }>("chat", sessionKey);

return NextResponse.json({
  messages,
  meta,
  activeApproval: pendingApproval
    ? {
        id: pendingApproval.id,
        toolName: "command",
        command: pendingApproval.command,
        description: pendingApproval.cwd,
      }
    : projectedApproval,
  a2uiState: chatProjection?.a2uiState ?? null,
});
```

Remove the `ChatSessionProjection` type if no longer needed (it may still be referenced by `getApprovalProjectionWithMigration` in projection-store.ts).

- [ ] **Step 6: Update snapshot route test**

In `dashboard/src/app/api/chat/snapshot/route.test.ts`, update the store mock:

```typescript
      store: {
        getProjection: vi.fn((domain: string) => {
          if (domain === "chat") {
            return { a2uiState: { visible: true } };
          }
          return null;
        }),
        getApprovalProjectionWithMigration: vi.fn(() => ({
          id: "apr-projected",
          toolName: "command",
          command: "ls -la",
          description: "/tmp",
        })),
      },
```

- [ ] **Step 7: Remove chat-specific wrappers from ProjectionStore**

In `dashboard/server/projection-store.ts`:

**Remove** these methods and helpers (all external callers are now migrated):

- `getChatSessionProjection` method
- `setChatSessionProjection` method
- `clearChatSessionProjection` method
- `chatSessionProjectionKey` private method
- `isObject` helper (only used by `getChatSessionProjection`)

**Keep:**

- `CHAT_SESSION_PROJECTION_PREFIX` constant (used by `projectionKey` for backward-compat routing)
- `ChatSessionProjection` type (used by `getApprovalProjectionWithMigration` return type)

**Update `getApprovalProjectionWithMigration`** to use the generic API (its internal calls to the removed methods must be replaced):

- `this.getChatSessionProjection(normalized)` → `this.getProjection<ChatSessionProjection>("chat", normalized)`
- `this.setChatSessionProjection(normalized, { a2uiState: fresh.a2uiState })` → `this.setProjection("chat", normalized, { a2uiState: fresh.a2uiState })`
- `this.clearChatSessionProjection(normalized)` → `this.clearProjection("chat", normalized)`

- [ ] **Step 8: Verify TypeScript compiles**

Run: `cd dashboard && pnpm tsgo`
Expected: Zero type errors. All callers now use the generic API.

- [ ] **Step 9: Run all server tests**

Run: `pnpm test -- dashboard/server/ dashboard/src/app/api/chat/`
Expected: ALL PASS

- [ ] **Step 10: Commit**

```bash
scripts/committer "[enhanced][codex-impl] refactor(deck): migrate all chat callers to generic projection API and remove wrappers" \
  dashboard/server/projection-store.ts \
  dashboard/server/runtime.ts \
  dashboard/src/app/api/chat/projection/route.ts \
  dashboard/src/app/api/chat/sessions/clear/route.ts \
  dashboard/src/app/api/chat/sessions/reset/route.ts \
  dashboard/src/app/api/chat/snapshot/route.ts \
  dashboard/src/app/api/chat/snapshot/route.test.ts
```

---

### Task 5: SSE Replay Gap Detection [backend] [complex]

**covers:** OpenSpec 5.1, 5.2, 5.3, 5.4
**blockedBy:** Task 1 (uses ProjectionStore)

**Files:**

- Modify: `dashboard/server/projection-store.ts`
- Modify: `dashboard/src/app/api/stream/route.ts`
- Modify: `dashboard/server/__tests__/projection-store.test.ts`

- [ ] **Step 1: Write failing tests for gap detection**

Add to `dashboard/server/__tests__/projection-store.test.ts`:

```typescript
// ---------------------------------------------------------------------------
// getEventsSinceWithGap — gap detection
// ---------------------------------------------------------------------------

describe("getEventsSinceWithGap", () => {
  it("returns gapDetected: false when lastId is within outbox range", () => {
    store.appendEvent("a", 1);
    store.appendEvent("b", 2);
    store.appendEvent("c", 3);

    const result = store.getEventsSinceWithGap(1);
    expect(result.gapDetected).toBe(false);
    expect(result.events).toHaveLength(2);
    expect(result.events[0].id).toBe(2);
    expect(result.events[1].id).toBe(3);
  });

  it("returns gapDetected: false for first connection (lastId = 0)", () => {
    store.appendEvent("a", 1);
    store.appendEvent("b", 2);

    const result = store.getEventsSinceWithGap(0);
    expect(result.gapDetected).toBe(false);
    expect(result.events).toHaveLength(2);
  });

  it("returns gapDetected: false for empty outbox", () => {
    const result = store.getEventsSinceWithGap(5);
    expect(result.gapDetected).toBe(false);
    expect(result.events).toHaveLength(0);
  });

  it("returns gapDetected: true when lastId is below minimum outbox id (pruned)", () => {
    // Insert an old event (will be pruned) and two recent ones
    db.prepare(
      "INSERT INTO outbox (event_type, payload, created_at) VALUES (?, ?, datetime('now', '-7200 seconds'))",
    ).run("old", '"old"');
    store.appendEvent("new-1", "data-1");
    store.appendEvent("new-2", "data-2");
    store.pruneEvents(60 * 60 * 1000);

    // Outbox now has ids 2,3 (id 1 pruned).
    // Per spec: lastId > 0 AND lastId < min(id) → gapDetected: true
    // lastId=1, min(id)=2 → gap (client's checkpoint has been pruned)
    const result = store.getEventsSinceWithGap(1);
    expect(result.gapDetected).toBe(true);
    expect(result.events).toHaveLength(2);
  });

  it("returns gapDetected: true when lastId is well below min outbox id", () => {
    // Start fresh with high IDs by inserting and pruning
    for (let i = 0; i < 5; i++) {
      store.appendEvent("fill", i);
    }
    // Manually delete low IDs to simulate pruning
    db.prepare("DELETE FROM outbox WHERE id <= 3").run();

    // Outbox now has ids 4, 5. Request from lastId=1.
    const result = store.getEventsSinceWithGap(1);
    expect(result.gapDetected).toBe(true);
    expect(result.events).toHaveLength(2);
    expect(result.events[0].id).toBe(4);
  });

  it("respects limit parameter", () => {
    for (let i = 0; i < 10; i++) {
      store.appendEvent("e", i);
    }

    const result = store.getEventsSinceWithGap(0, 3);
    expect(result.gapDetected).toBe(false);
    expect(result.events).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- dashboard/server/__tests__/projection-store.test.ts -t "getEventsSinceWithGap"`
Expected: FAIL — `store.getEventsSinceWithGap is not a function`

- [ ] **Step 3: Implement gap detection**

Add a new prepared statement and method to `ProjectionStore` in `dashboard/server/projection-store.ts`:

Add new lazy statement field:

```typescript
  private _selectMinId: Statement<[], { min_id: number | null }> | null = null;
```

Add getter:

```typescript
  private get selectMinIdStmt() {
    return (this._selectMinId ??= this.db.prepare(
      "SELECT MIN(id) AS min_id FROM outbox",
    ));
  }
```

Add the return type:

```typescript
export type EventsSinceResult = {
  events: OutboxEntry[];
  gapDetected: boolean;
};
```

Add method to the Outbox API section:

```typescript
  /**
   * Read outbox events with `id > lastId`, with gap detection.
   * Gap is detected when lastId > 0 and lastId < min(id) in outbox,
   * meaning events between the client's checkpoint and the current outbox
   * start have been pruned.
   */
  getEventsSinceWithGap(lastId: number, limit = 500): EventsSinceResult {
    const events = this.getEventsSince(lastId, limit);

    // First connection (lastId = 0) — never a gap per spec
    if (lastId <= 0) {
      return { events, gapDetected: false };
    }

    // Empty outbox — no gap (nothing to miss)
    const minRow = this.selectMinIdStmt.get() as { min_id: number | null } | undefined;
    const minId = minRow?.min_id;
    if (minId == null) {
      return { events, gapDetected: false };
    }

    // Gap: client's checkpoint is before the oldest surviving event
    const gapDetected = lastId < minId;
    return { events, gapDetected };
  }
```

- [ ] **Step 4: Run gap detection tests**

Run: `pnpm test -- dashboard/server/__tests__/projection-store.test.ts -t "getEventsSinceWithGap"`
Expected: ALL PASS

- [ ] **Step 5: Update SSE stream route to use gap detection**

In `dashboard/src/app/api/stream/route.ts`, modify the replay section (lines 131-137):

Replace:

```typescript
// Replay missed events from the durable outbox when available.
const missed =
  runtime?.store?.getEventsSince(lastEventId).map((entry) => toPersistedReplayEvent(entry)) ??
  bus.getEventsSince(lastEventId);
for (const event of missed) {
  controller.enqueue(encoder.encode(formatSSE(event)));
}
```

With:

```typescript
// Replay missed events from the durable outbox when available.
if (runtime?.store) {
  const { events, gapDetected } = runtime.store.getEventsSinceWithGap(lastEventId);
  if (gapDetected) {
    controller.enqueue(
      encoder.encode(
        `event: projection.gap\ndata: ${JSON.stringify({ reason: "events_pruned" })}\n\n`,
      ),
    );
  }
  for (const entry of events) {
    controller.enqueue(encoder.encode(formatSSE(toPersistedReplayEvent(entry))));
  }
} else {
  const missed = bus.getEventsSince(lastEventId);
  for (const event of missed) {
    controller.enqueue(encoder.encode(formatSSE(event)));
  }
}
```

- [ ] **Step 6: Run all projection-store and stream tests**

Run: `pnpm test -- dashboard/server/__tests__/projection-store.test.ts`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
scripts/committer "[enhanced][codex-impl] feat(deck): add SSE replay gap detection with projection.gap event" \
  dashboard/server/projection-store.ts \
  dashboard/server/__tests__/projection-store.test.ts \
  dashboard/src/app/api/stream/route.ts
```

---

### Task 6: Verification [test] [simple]

**covers:** OpenSpec 6.1, 6.2, 6.3, 6.4, 6.5
**blockedBy:** Task 4, Task 5

**Files:** none (verification only)

- [ ] **Step 1: TypeScript check**

Run: `pnpm tsgo`
Expected: Zero type errors

- [ ] **Step 2: Lint and format check**

Run: `pnpm check`
Expected: PASS (no lint or format errors)

- [ ] **Step 3: Run all server-side tests**

Run: `pnpm test -- dashboard/server/`
Expected: ALL PASS

- [ ] **Step 4: Run all chat route tests**

Run: `pnpm test -- dashboard/src/app/api/chat/`
Expected: ALL PASS

- [ ] **Step 5: Build check**

Run: `pnpm build`
Expected: Build succeeds

- [ ] **Step 6: Verify snapshot response shape unchanged**

The `/api/chat/snapshot` response must still return `{ messages, meta, activeApproval, a2uiState }`. This is verified by `dashboard/src/app/api/chat/snapshot/route.test.ts`. Confirm test assertions match the expected shape.

Run: `pnpm test -- dashboard/src/app/api/chat/snapshot/route.test.ts -v`
Expected: PASS with response shape `{ messages, meta, activeApproval, a2uiState }` asserted

- [ ] **Step 7: Fix any issues found**

If any verification step fails, fix the issue and re-run.

- [ ] **Step 8: Final commit (if fixes needed)**

```bash
scripts/committer "[enhanced][codex-impl] fix(deck): verification fixes for projection platform" \
  <affected-files>
```
