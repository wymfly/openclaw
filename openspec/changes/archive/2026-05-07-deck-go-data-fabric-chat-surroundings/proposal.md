## Why

Phase 4 of the Data Fabric program needs to close the gap left intentionally by
the live-workbench migration: the Chat transcript stream stays specialized, but
Chat still owns surrounding server-state lifecycles for session inventory,
snapshot refresh, history recovery, command discovery, subscription selection,
and sidebar session mutations.

This is necessary now because Chat is the primary operator workflow. Repeated
navigation, command registry refresh, projection-gap recovery, and real Gateway
evidence should use the same Data Fabric contract chain as the rest of
`frontend-new` without destabilizing the streaming transcript path.

## What Changes

- Add Data Fabric boundaries for Chat surroundings:
  - `chat`: snapshot refresh, session-event subscription mutation,
    projection persistence/metadata boundaries where safe.
  - `commands`: Gateway-backed `deck.commands.discover` command discovery,
    command registry freshness, and live invalidation.
- Reuse the existing `sessions` and `approvals` Data Fabric modules for
  Chat-adjacent session list, previews, detail/history, compaction metadata,
  and approval queue data instead of creating parallel Chat-only caches.
- Migrate `ChatPanel`, `SessionSidebar`, and `use-command-discovery` away from
  component-owned or hook-owned server fetch lifecycles for the scoped data.
- Keep Chat transcript streaming, stream dispatch/reducer state, message input
  send/abort/steer execution, canvas command queue, artifact rendering, and
  transcript block rendering specialized. They may use Data Fabric invalidation
  for authoritative refresh, but streaming bytes do not move into query cache.
- Replace raw frontend `deckFetch` command discovery with an API facade and
  Data Fabric query hook while keeping browser traffic behind deck-go backend
  routes.
- Respect current contract sources:
  - `deck-go/contracts/source/deck-api.contract.ts`
  - `deck-go/contracts/source/deck-endpoints.contract.json`
  - `deck-go/contracts/source/deck-streams.contract.json`
  - `deck-go/contracts/source/deck-live-projections.contract.json`
  - `deck-go/contracts/source/deck-list-queries.contract.json`
  - `deck-go/contracts/source/deck-mutations.contract.json`
  - `deck-go/contracts/source/deck-route-governance.contract.json`
  - generated Gateway protocol types for `deck.commands.discover`,
    `sessions.*`, and `chat.history`
- Keep mutation semantics conservative: no automatic mutation retry, no offline
  queue, no invented optimistic update, and no generated `patchStrategy` or
  `patchKeys` dependency.
- Provide focused tests plus L4 mock-functional and L5 real-gateway evidence
  for Chat surroundings, with the standard two-attempt circuit breaker for real
  stack environment/startup failures.

## Capabilities

### New Capabilities

- `deck-go-data-fabric-chat-surroundings`: Data Fabric module boundaries,
  freshness, projection invalidation, mutation safety, and verification
  requirements for Chat-adjacent server state while preserving specialized
  transcript streaming.

### Modified Capabilities

- `deck-go-data-fabric-foundation`: Clarify that stream-owned renderers may use
  Data Fabric for authoritative refresh/read-model boundaries without moving
  stream bytes into query cache.
- `deck-go-live-projection-subscription-contract`: Add Data Fabric invalidation
  expectations for `command-discovery` and `chat-session` projection metadata.
- `frontend-new-workspace`: Extend the Data Fabric panel protocol to the Chat
  surroundings touched in this change.

## Impact

- Frontend Data Fabric:
  - `deck-go/frontend-new/src/data/modules/chat/`
  - `deck-go/frontend-new/src/data/modules/commands/`
  - existing `deck-go/frontend-new/src/data/modules/sessions/`
  - existing `deck-go/frontend-new/src/data/modules/approvals/`
- Frontend Chat code:
  - `deck-go/frontend-new/src/components/panels/chat/ChatPanel.tsx`
  - `deck-go/frontend-new/src/components/panels/chat/SessionSidebar.tsx`
  - `deck-go/frontend-new/src/hooks/use-command-discovery.ts`
  - `deck-go/frontend-new/src/components/panels/chat/chat-api.ts`
  - targeted Chat tests under
    `deck-go/frontend-new/src/components/panels/chat/__tests__/`
- API facade:
  - `deck-go/frontend-new/src/api.ts` may add typed wrappers for command
    discovery or Chat-adjacent BFF calls when a current hook uses raw
    `deckFetch`.
- E2E evidence:
  - `deck-go/test/e2e/chat-visual.spec.ts`
  - `deck-go/test/e2e/chat-real-gateway.spec.ts`
  - `deck-go/test/e2e/chat-command-real-gateway.spec.ts`
  - session/approval E2E specs may be reused only for shared boundary evidence.
- Contract checks:
  - `cd deck-go && make contract-gate` unless the implementation proves no
    source or generated contract surface changed; `make frontend-build` remains
    mandatory.
