# Deck Projection Platform Design

> Date: 2026-04-04 (revised per Codex review)
> Status: Draft
> Track: A + B (Core Platform + Session Runtime)
> Phase: 1 (Platform Kernel)
> Program ref: `docs/plans/2026-04-03-deck-web-replacement-matrix.md` — "Replay / Projection Model"

## Problem Statement

Deck's projection infrastructure (SQLite projection store, EventBus, outbox) is currently chat-local. The `ProjectionStore` exposes only `getChatSessionProjection()` / `setChatSessionProjection()`, hardcoded to a single domain with `chat_projection:` key prefix. The approval state is embedded inside the chat projection blob, written by the server-side `approval-bridge.ts` — not independently addressable.

The SSE replay path already uses durable outbox storage as its primary replay source (`stream/route.ts:132` calls `runtime.store.getEventsSince(lastEventId)`), with the 100-entry in-memory ring buffer as fallback only when the store is unavailable. The real gap in the current replay mechanism is: `getEventsSince()` returns at most 500 entries with no overflow/gap signal — if the client's `lastEventId` has been pruned, there is no indication that events were lost.

The Deck Web Replacement Program requires projection to be a platform-level capability usable by multiple modules. Phase 1 gate criterion: "projection model can be shared by at least 2 modules."

## Design Decisions

| Decision                 | Choice                                                    | Rationale                                                                                                              |
| ------------------------ | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Validation module        | Approval (extracted from chat)                            | Already embedded in chat projection via approval-bridge.ts; lowest extraction cost; proves independent domain usage    |
| Generalization strategy  | Typed KV for Phase 1, event-sourced for Phase 2           | Phase 1 gate only requires multi-module sharing, not full event sourcing                                               |
| Catch-up mechanism       | Phase 1: gap signal only; Phase 2: full catch-up protocol | SSE already has durable outbox replay; Phase 1 adds gap detection, Phase 2 adds domain-filtered catch-up               |
| Frontend consumption     | No changes in Phase 1                                     | Projection store is internal server API; no new HTTP endpoints; frontend continues using existing SSE + snapshot paths |
| Approval write authority | Server-only (approval-bridge.ts)                          | Approval is Gateway-event-derived state; must not become client-writable                                               |

## 1. Projection Store Generalization

### Current State

`projection-store.ts` has two dedicated methods:

- `getChatSessionProjection(sessionKey)` → `{a2uiState, activeApproval}`
- `setChatSessionProjection(sessionKey, data)`

Storage: SQLite `settings` table with `key/value/updated_at` columns. Key format: `chat_projection:{sessionKey}`.

The `settings` table has no `eventId` or version column. Projection writes and outbox appends are not transactional.

### Generalized API

```typescript
interface ProjectionStore {
  // Generic projection CRUD (new)
  getProjection<T>(domain: string, key: string): T | null;
  setProjection<T>(domain: string, key: string, data: T): void;
  clearProjection(domain: string, key: string): void;

  // Existing outbox (unchanged)
  appendEvent(type: string, payload: unknown): number;
  pruneEvents(olderThanMs: number): void;

  // Existing replay (enhanced with gap signal)
  getEventsSince(lastId: number): { events: OutboxEntry[]; gapDetected: boolean };
}
```

Storage key format: `projection:{domain}:{key}`.

No new HTTP endpoints. The generic API is an internal server-side interface consumed by Deck route handlers and the approval bridge.

### Migration

Existing chat callers switch to `getProjection("chat", sessionKey)`. The chat-specific methods become thin wrappers that delegate to the generic API during transition, then are removed.

### Concurrency Note

The existing `setChatSessionProjection` is a read-modify-write without transaction protection. The generalized `setProjection` must use a SQLite transaction for the migration fallback path (Section 3) to avoid overwriting concurrent A2UI updates when migrating approval data.

## 2. Approval Projection Extraction (Server-Side)

### Current Structure

Approval state is embedded inside `ChatSessionProjection`:

```typescript
type ChatSessionProjection = {
  a2uiState?: unknown;
  activeApproval?: { id: string; toolName: string; ... } | null;
};
```

**Write path**: `approval-bridge.ts:persistApprovalProjection()` does a read-modify-write of the entire chat projection blob to update `activeApproval`. This couples approval lifecycle to the chat projection.

**Read paths**:

- `/api/chat/snapshot` reads chat projection and includes `activeApproval` in the response
- `/api/approvals/pending` reads from `approval-bridge.ts`'s in-memory `pendingMap` — an entirely separate data source

### Extraction

1. **Split storage**: Remove `activeApproval` from `projection:chat:{sessionKey}`. Create independent `projection:approval:{sessionKey}`. Chat projection retains only `a2uiState`.

2. **Write path** (server-only):
   - `approval-bridge.ts:persistApprovalProjection()` → refactored to call `setProjection("approval", sessionKey, approvalData)` instead of embedding in chat projection blob
   - `dispatchA2UIEvent()` path → calls `setProjection("chat", sessionKey, { a2uiState })` (no change in shape, only in key prefix)

3. **Read paths**:
   - `/api/chat/snapshot` reads `getProjection("approval", sessionKey)` separately and merges into the snapshot response (same response shape to frontend — no breaking change)
   - `/api/approvals/pending` continues reading from in-memory `pendingMap` (unchanged — this is the live authority, projection is for recovery)

4. **No new HTTP endpoints**: Approval projection is written and read entirely server-side. There is no `POST /api/projection/approval/` endpoint. Approval remains a server-derived state from Gateway events.

### Data Migration

On first read of `getProjection("approval", key)`: if result is null, check `getProjection("chat", key)` for a legacy `activeApproval` field. If found, migrate it to the approval domain and remove from the chat blob. This must be wrapped in a SQLite transaction to prevent concurrent A2UI writes from being lost.

### What This Proves

The same projection store supports two independent domains (chat and approval), each with its own storage key space, write authority, and lifecycle. The approval bridge writes to `projection:approval:*` while the chat SSE dispatcher writes to `projection:chat:*` — proving the store is genuinely shared infrastructure, not a single-domain wrapper.

## 3. SSE Replay Gap Signal

### Current Problem

`getEventsSince(lastId)` returns up to 500 entries. If the client's `lastEventId` has been pruned (older than the 7-day retention window), the function silently returns whatever events exist starting from `id > lastId` — the client has no way to know events were lost.

### Minimal Fix

Enhance `getEventsSince()` to detect the gap:

```typescript
getEventsSince(lastId: number): { events: OutboxEntry[]; gapDetected: boolean }
```

`gapDetected` is true when `lastId > 0` and `lastId < min(id) in outbox`. This means events between the client's checkpoint and the oldest surviving event have been pruned.

### SSE Stream Integration

`/api/stream` route already calls `store.getEventsSince(lastEventId)`. After this change, when `gapDetected` is true, the stream emits a special event:

```
event: projection.gap
data: {"reason":"events_pruned","lastKnownId":12345}
```

Frontend SSE handlers can react to this event by triggering a full snapshot refresh. This is a non-breaking addition — existing handlers ignore unknown event types.

### What Does Not Change

- EventBus ring buffer: unchanged
- SSE stream endpoint behavior: unchanged (additive event type only)
- Outbox schema: unchanged (no new columns or indexes)
- Frontend reconnect logic: unchanged (gap event is informational; full handling in Phase 2)

## 4. Scope Boundary

### Phase 1 Deliverables (This Design)

| Component                       | Deliverable                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| ProjectionStore generalization  | `getProjection<T>` / `setProjection<T>` / `clearProjection` (internal server API)    |
| Approval server-side extraction | `approval-bridge.ts` writes to independent `projection:approval:*` domain            |
| Chat migration                  | Existing chat-specific projection calls refactored to generic API                    |
| SSE replay gap signal           | `getEventsSince()` returns `gapDetected`; `/api/stream` emits `projection.gap` event |
| Data migration                  | One-time fallback migration of `activeApproval` from chat to approval domain         |
| Concurrency fix                 | Transaction protection for migration read-modify-write path                          |

### Phase 1 Gate Verification

- Projection store shared by chat + approval (2 independent domains, independent write authorities)
- Recovery gap is detectable (gapDetected signal)
- Authoritative contract established (typed generic projection API with domain separation)

### Explicitly Deferred to Phase 2 (with rationale)

| Deferred Item                                                            | Rationale                                                                                                                             | Phase 2 Entry Point                                                      |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Generic HTTP endpoints (`/api/projection/{domain}/{key}`)                | Phase 1 only needs internal server API; HTTP endpoints add surface area without current consumers                                     | When a frontend module needs direct projection access                    |
| Outbox `domain` column + filtered catch-up (`events-since?domains=`)     | Requires schema migration + index; current `getEventsSince` by ID is sufficient for gap detection                                     | When domain-specific catch-up is needed (3+ domains)                     |
| Frontend `lastEventId` tracking in shared transport layer (`deckStream`) | Belongs in shared transport (deck-client.ts), not chat store; requires coordinating 4 SSE hook consumers                              | When designing unified SSE recovery protocol                             |
| Event-sourced projection (reducer auto-compute)                          | Needs more module experience to determine correct reducer patterns                                                                    | When 3+ domains exist and event replay becomes the primary recovery path |
| `useProjection()` unified frontend hook                                  | Premature abstraction; wait for 3+ consumers                                                                                          | When Sessions/Logs joins as third projection domain                      |
| Domain registry / mapped types for compile-time safety                   | Current `getProjection<T>(domain: string, key: string)` allows type misuse; mapped type registry needed for safety                    | When the number of domains justifies the complexity                      |
| EventBus ring buffer replacement                                         | SSE already uses durable outbox as primary replay; ring buffer is fallback only                                                       | Only if outbox-based replay proves insufficient                          |
| Approvals panel migration to projection platform                         | Current `/api/approvals/pending` reads from in-memory pendingMap; migrating to projection read path proves true cross-module adoption | Phase 2 runtime-core validation                                          |

## File Change Inventory

### New Files

None. Phase 1 is entirely internal refactoring.

### Modified Files

| File                                           | Change                                                                                                                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dashboard/server/projection-store.ts`         | Add generic `getProjection`/`setProjection`/`clearProjection`; enhance `getEventsSince` with `gapDetected`; keep chat-specific methods as thin wrappers during transition |
| `dashboard/server/approval-bridge.ts`          | `persistApprovalProjection()` writes to `projection:approval:{sessionKey}` instead of embedding in chat projection blob                                                   |
| `dashboard/src/app/api/chat/snapshot/route.ts` | Read approval from `getProjection("approval", sessionKey)` instead of from chat projection                                                                                |
| `dashboard/src/app/api/stream/route.ts`        | Emit `projection.gap` event when `gapDetected` is true                                                                                                                    |
| `dashboard/server/runtime.ts`                  | No structural changes; approval-bridge already initialized here                                                                                                           |

### Files NOT Changed (Contrary to Original Design)

| File                                                 | Why Not                                                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `dashboard/server/event-bus.ts`                      | No outbox schema changes in Phase 1; `appendEvent` unchanged                                            |
| `dashboard/src/stores/chat-dispatchers.ts`           | Approval dispatch is frontend Zustand mutation only; projection persistence stays in approval-bridge.ts |
| `dashboard/src/stores/chat.ts`                       | No lastEventId tracking in Phase 1 (deferred to shared transport layer in Phase 2)                      |
| `dashboard/src/components/panels/chat/useChatSSE.ts` | No reconnect catch-up logic in Phase 1 (deferred to Phase 2)                                            |
| `dashboard/src/lib/deck-client.ts`                   | Shared transport layer changes deferred to Phase 2                                                      |
