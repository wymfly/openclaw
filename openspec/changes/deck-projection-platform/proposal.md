## Why

Deck's projection store (`ProjectionStore`) is hardcoded to a single chat domain — `getChatSessionProjection()` / `setChatSessionProjection()` with a `chat_projection:` key prefix. The approval state is embedded inside the chat projection blob, written by `approval-bridge.ts`, making it impossible for other modules to independently manage their own projection state. The Deck Web Replacement Program requires projection to be a platform-level capability shared by multiple modules (Phase 1 gate: "at least 2 modules").

## What Changes

- Generalize `ProjectionStore` from chat-specific methods to a typed generic KV API: `getProjection<T>(domain, key)` / `setProjection<T>(domain, key, data)` / `clearProjection(domain, key)`
- Extract approval projection from the chat blob into an independent `projection:approval:{sessionKey}` domain, with server-side write authority remaining in `approval-bridge.ts`
- Migrate existing chat projection callers to the generic API (`projection:chat:{sessionKey}`)
- Add gap detection to `getEventsSince()` so SSE reconnect can detect when events have been pruned
- Emit `projection.gap` SSE event when gap is detected, enabling frontend to trigger full snapshot refresh
- One-time data migration with transaction protection for legacy chat projections containing `activeApproval`

## Capabilities

### New Capabilities

- `projection-store-platform`: Generic projection store API with domain-based key separation, replacing chat-specific methods
- `projection-gap-detection`: SSE replay gap signal when outbox events have been pruned beyond client's checkpoint

### Modified Capabilities

(none — no existing spec-level requirements are changing)

## Impact

- **Server files**: `projection-store.ts` (generic API), `approval-bridge.ts` (write to approval domain), `stream/route.ts` (gap event emission), `chat/snapshot/route.ts` (read from separate domains)
- **No new HTTP endpoints**: All changes are internal server API; frontend consumes via existing SSE + snapshot paths
- **No schema migration**: Uses existing SQLite `settings` table with new key prefix convention
- **No breaking changes**: Chat projection response shape preserved; approval data transparently migrated
