# Deck Projection Platform Design

> Date: 2026-04-04
> Status: Draft
> Track: A + B (Core Platform + Session Runtime)
> Phase: 1 (Platform Kernel)
> Program ref: `docs/plans/2026-04-03-deck-web-replacement-matrix.md` — "Replay / Projection Model"

## Problem Statement

Deck's projection infrastructure (SQLite projection store, EventBus, outbox) is currently chat-local. The `ProjectionStore` exposes only `getChatSessionProjection()` / `setChatSessionProjection()`, hardcoded to a single domain. The API endpoints (`/api/chat/snapshot`, `/api/chat/projection`) are chat-specific. The SSE catch-up mechanism relies on a 100-entry in-memory ring buffer that silently drops events on overflow.

The Deck Web Replacement Program requires projection to be a platform-level capability usable by multiple modules. Phase 1 gate criterion: "projection model can be shared by at least 2 modules."

## Design Decisions

| Decision                | Choice                                             | Rationale                                                                                      |
| ----------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Validation module       | Approval (extracted from chat)                     | Already embedded in chat SessionState; lowest extraction cost; proves independent domain usage |
| Generalization strategy | Typed KV for Phase 1, event-sourced for Phase 2    | Phase 1 gate only requires multi-module sharing, not full event sourcing                       |
| Catch-up mechanism      | Minimal: outbox query via API, no EventBus changes | Satisfies closure standard "Recovery" without deep SSE/EventBus refactor                       |
| Frontend consumption    | No unified hook in Phase 1                         | Premature abstraction; each module manages its own consumption pattern                         |

## 1. Projection Store Generalization

### Current State

`projection-store.ts` has two dedicated methods:

- `getChatSessionProjection(sessionKey)` → `{a2uiState, activeApproval}`
- `setChatSessionProjection(sessionKey, data)`

Storage key: `chat_projection:{sessionKey}` in SQLite settings table.

### Generalized API

```typescript
interface ProjectionStore {
  // Generic projection CRUD
  getProjection<T>(domain: string, key: string): T | null;
  setProjection<T>(domain: string, key: string, data: T): void;
  clearProjection(domain: string, key: string): void;

  // Catch-up query
  getEventsSince(lastId: number, domains?: string[]): OutboxEntry[];

  // Outbox write (existing, enhanced with domain)
  appendEvent(type: string, payload: unknown, domain?: string): number;
  pruneEvents(olderThanMs: number): void;
}
```

Storage key format: `projection:{domain}:{key}`.

### Migration

Existing chat callers switch to `getProjection("chat", sessionKey)`. The chat-specific methods become thin wrappers that delegate to the generic API, then are removed once all callers are migrated.

## 2. Generic Projection API Endpoints

### New Endpoints

```
GET  /api/projection/{domain}/{key}
     Response: { data: T, eventId: number }
     eventId = outbox event ID at last projection update

POST /api/projection/{domain}/{key}
     Body: { data: T }
     Writes projection + appends outbox event
     Response: { eventId: number }

GET  /api/projection/events-since?lastId={id}&domains={csv}
     Response: OutboxEntry[]
     Used by frontend SSE reconnect for catch-up
```

### Relationship to Existing Endpoints

- `/api/chat/snapshot` — **kept**. It is an aggregation endpoint (Gateway history + local projection + session meta), not a pure projection endpoint. Internally refactored to call `getProjection("chat", sessionKey)` instead of the chat-specific method.
- `/api/chat/projection` — **deprecated**. Replaced by `POST /api/projection/chat/{sessionKey}`. A redirect adapter is added for transition.

### Approval Endpoints

```
GET  /api/projection/approval/{sessionKey}
     Returns activeApproval projection for a session

POST /api/projection/approval/{sessionKey}
     Written by SSE event dispatcher on approval events
```

These are Deck routes (not Gateway RPC), so no gateway-allowlist update is needed.

## 3. Approval Projection Extraction

### Current Structure

`activeApproval` is nested inside `ChatSessionProjection`:

```typescript
type ChatSessionProjection = {
  a2uiState: A2UIState | null;
  activeApproval: ApprovalRequest | null;
};
```

`dispatchApproval()` in `chat-dispatchers.ts` updates both the chat Zustand store and the chat projection.

### Extraction

1. **Split storage**: Remove `activeApproval` from `projection:chat:{sessionKey}`. Create independent `projection:approval:{sessionKey}`. Chat projection retains only `a2uiState`.

2. **Write path**:
   - `dispatchApproval()` → `setProjection("approval", sessionKey, approvalData)` + update chat store's `activeApproval` field
   - `dispatchA2UIEvent()` → `setProjection("chat", sessionKey, { a2uiState })` (unchanged)

3. **Read path**:
   - `/api/chat/snapshot` aggregates from `getProjection("approval", sessionKey)` instead of reading from chat projection
   - `/api/projection/approval/{sessionKey}` available for independent consumption

4. **Data migration**: On first access, if `projection:approval:{key}` is empty but `projection:chat:{key}` contains `activeApproval`, auto-migrate and clear the old field. One-time fallback logic inside `getProjection`.

### What This Proves

The same projection store supports two independent domains (chat and approval), each with its own storage, read/write paths, and lifecycle. This satisfies the Phase 1 gate requirement of "multi-module shared projection model."

## 4. Catch-up Minimal Fix

### Current Problem

SSE reconnect uses EventBus in-memory ring buffer (100 entries). Overflow = silent data loss, requiring full page refresh.

### Mechanism

1. **Frontend tracks `lastEventId`**: Each SSE event payload includes the outbox `eventId` (already available: `appendEvent` returns auto-incrementing ID). Frontend stores `lastEventId` in session store or localStorage.

2. **Reconnect catch-up**: After SSE reconnects, frontend calls `GET /api/projection/events-since?lastId={lastEventId}&domains=chat,approval` to retrieve missed outbox events.

3. **Frontend replay**: Catch-up events are dispatched through the same dispatcher functions (`dispatchChatEvent`, `dispatchApproval`, etc.) as normal SSE events.

4. **Fallback**: If the gap is too large (events pruned beyond the 7-day window), the API returns `{ gapTooLarge: true }` and frontend executes a full snapshot refresh.

### What Does Not Change

- EventBus ring buffer: unchanged (continues to serve realtime broadcast)
- SSE stream endpoint (`/api/stream`): unchanged
- Only the reconnect path gains an additional outbox query step

### Outbox Domain Tagging

`appendEvent(type, payload)` gains an optional `domain` parameter for domain-filtered catch-up queries. Existing callers that omit `domain` default to `"system"`.

## 5. Scope Boundary

### Phase 1 Deliverables (This Design)

| Component                       | Deliverable                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------ |
| ProjectionStore generalization  | `getProjection<T>` / `setProjection<T>` / `clearProjection` + `getEventsSince` |
| Generic API endpoints           | `GET/POST /api/projection/{domain}/{key}` + `GET /api/projection/events-since` |
| Approval independent projection | Extracted from chat projection, independent domain, with data migration        |
| Catch-up minimal fix            | Frontend lastEventId tracking, outbox catch-up on reconnect                    |
| Outbox enhancement              | `appendEvent` gains `domain` parameter                                         |
| Chat migration                  | Existing chat-specific calls refactored to use generic API                     |

### Phase 1 Gate Verification

- Projection store shared by chat + approval (2 domains)
- Recovery path defined (catch-up via outbox)
- Authoritative contract established (typed projection API + domain registration)

### Explicitly Deferred (Phase 2+)

| Deferred Item                                   | Rationale                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------- |
| Event-sourced projection (reducer auto-compute) | Needs more module experience to determine correct reducer patterns  |
| `useProjection()` unified frontend hook         | Premature abstraction; wait for 3+ consumers in Phase 2             |
| EventBus ring buffer replacement                | Catch-up already solved via outbox; ring buffer issue deprioritized |
| Sessions/Logs projection                        | Phase 2 runtime-core scope                                          |
| Projection schema versioning                    | Too few domains in Phase 1 to justify migration tooling             |

## File Change Inventory

### New Files

| File                                                       | Purpose                          |
| ---------------------------------------------------------- | -------------------------------- |
| `dashboard/src/app/api/projection/[domain]/[key]/route.ts` | Generic projection CRUD endpoint |
| `dashboard/src/app/api/projection/events-since/route.ts`   | Catch-up query endpoint          |

### Modified Files

| File                                                 | Change                                                                  |
| ---------------------------------------------------- | ----------------------------------------------------------------------- |
| `dashboard/server/projection-store.ts`               | Add generic API; keep chat wrapper as migration bridge                  |
| `dashboard/server/event-bus.ts`                      | `appendEvent` gains `domain` parameter                                  |
| `dashboard/src/app/api/chat/snapshot/route.ts`       | Internal: call generic API instead of chat-specific method              |
| `dashboard/src/app/api/chat/projection/route.ts`     | Redirect to generic endpoint or deprecation adapter                     |
| `dashboard/src/stores/chat-dispatchers.ts`           | Approval write path uses independent domain                             |
| `dashboard/src/stores/chat.ts`                       | Add lastEventId tracking                                                |
| `dashboard/src/components/panels/chat/useChatSSE.ts` | Reconnect catch-up logic                                                |
| `dashboard/server/runtime.ts`                        | Projection domain event routing (approval events → approval projection) |
