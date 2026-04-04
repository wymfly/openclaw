## Context

Deck's projection infrastructure consists of three components:

1. **ProjectionStore** (`dashboard/server/projection-store.ts`) — SQLite-backed KV store using a `settings` table (`key/value/updated_at`). Currently exposes only `getChatSessionProjection()` / `setChatSessionProjection()` with hardcoded `chat_projection:` key prefix.

2. **EventBus** (`dashboard/server/event-bus.ts`) — In-memory pub/sub with a 100-entry ring buffer fallback. The primary SSE replay path uses the durable outbox (`runtime.store.getEventsSince(lastEventId)` in `stream/route.ts:132`), not the ring buffer.

3. **Approval Bridge** (`dashboard/server/approval-bridge.ts`) — Listens for Gateway `exec.approval.*` events, maintains an in-memory `pendingMap`, and persists `activeApproval` inside the chat projection blob via `persistApprovalProjection()`. This couples approval lifecycle to the chat domain.

The SSE replay gap: `getEventsSince()` returns up to 500 entries with no overflow signal. If the client's `lastEventId` has been pruned (7-day retention), events are silently lost.

The Deck Web Replacement Program Phase 1 gate requires the projection model to be shared by at least 2 modules.

## Goals / Non-Goals

**Goals:**

- Generalize ProjectionStore into a domain-keyed platform API usable by chat, approval, and future domains
- Extract approval from the chat projection blob into an independent domain with server-only write authority
- Add gap detection to SSE replay so clients know when events have been pruned
- Maintain backward compatibility: no breaking changes to frontend snapshot/SSE response shapes

**Non-Goals:**

- Generic HTTP projection endpoints (Phase 2 — no current frontend consumers)
- Outbox `domain` column or domain-filtered catch-up queries (Phase 2 — requires schema migration)
- Frontend `lastEventId` tracking or unified `useProjection()` hook (Phase 2 — belongs in shared transport layer)
- Event-sourced projection with reducer auto-compute (Phase 2 — needs more domain experience)
- Approvals panel migration to projection read path (Phase 2 — runtime-core validation)
- Domain registry / mapped types for compile-time safety (Phase 2 — too few domains to justify)

## Decisions

### D1: Generic KV API (not event-sourced)

Phase 1 uses typed KV projection (`getProjection<T>(domain, key)` / `setProjection<T>`). Event-sourced projection (reducers computing state from event log) is deferred to Phase 2.

**Alternative considered**: Full event-sourcing from day 1. Rejected because Phase 1 gate only requires multi-module sharing, and we lack experience with enough domains to design correct reducer patterns.

### D2: Approval remains server-derived (not client-writable)

Approval projection is written exclusively by `approval-bridge.ts` (server-side). No `POST /api/projection/approval/` endpoint is exposed.

**Alternative considered**: Client-writable projection endpoint for all domains. Rejected per Codex review: approval is Gateway-event-derived state; making it client-writable would create last-writer-wins conflicts in multi-tab scenarios and degrade the server-side source of truth.

### D3: Gap signal (not full catch-up protocol)

Phase 1 adds `gapDetected` boolean to `getEventsSince()` and emits `projection.gap` SSE event. Phase 2 adds domain-filtered catch-up with outbox schema changes.

**Alternative considered**: Full catch-up protocol with outbox `domain` column in Phase 1. Rejected because it requires schema migration + index, and the current ID-based `getEventsSince` is sufficient for gap detection.

### D4: Internal server API only (no new HTTP endpoints)

Phase 1 projection API is consumed only by Deck route handlers and approval-bridge. No new REST endpoints.

**Alternative considered**: Public HTTP CRUD endpoints from day 1. Rejected because no frontend module currently needs direct projection access. Adding HTTP surface without consumers is premature.

### D5: Transaction-protected migration

The legacy data migration (extracting `activeApproval` from chat blob to approval domain) uses a SQLite transaction to prevent concurrent A2UI writes from being overwritten.

**Alternative considered**: Non-transactional migration with retry. Rejected because the read-modify-write pattern on the chat blob is already known to have concurrency issues per Codex review.

## Risks / Trade-offs

- **[Type safety gap]** `getProjection<T>(domain: string, key: string)` allows arbitrary `T` with any `domain` string — the compiler cannot catch misuse. → Mitigation: Acceptable for Phase 1 with 2 domains; Phase 2 adds domain registry with mapped types.
- **[Migration timing]** The one-time approval migration runs on first read, which could briefly slow the first `/api/chat/snapshot` call after deployment. → Mitigation: Migration is a single SQLite transaction on a small JSON blob; sub-millisecond.
- **[Gap event is informational only]** Phase 1 emits `projection.gap` but no frontend handler consumes it yet. → Mitigation: Existing handlers ignore unknown event types (non-breaking); Phase 2 adds handler.
- **[Approval dual read path]** `/api/approvals/pending` continues reading from in-memory `pendingMap` while `/api/chat/snapshot` reads from projection store. Two data sources for the same conceptual state. → Mitigation: `pendingMap` is the live authority for active sessions; projection is the recovery authority for cold start. Phase 2 unifies.
