## Why

Chat and Sessions are the primary operator workflow, but the head contract-chain
matrix still marks them as incomplete after the early pilot and Sessions real
verification work. Now that real seed evidence, list-query, live projection, and
safe mutation evidence contracts are archived, the module needs a focused
closure pass that maps chat/session reads, writes, streams, history, and
compaction claims to product-level Deck contracts and current Gateway truth.

## What Changes

- Re-audit current chat and sessions workflows against Gateway generated
  methods, Deck BFF routes, Deck DTOs, frontend facades, stream/live projection
  metadata, prior L2 evidence, and matrix gaps.
- Extend mutation evidence metadata for chat/session actions including session
  create/send/abort/steer, reset/clear/delete/patch, compact, compaction branch
  or restore, and projection persistence where those actions are production
  visible.
- Refactor chat/session frontend facades through shared mutation evidence
  helpers where the response DTO can be preserved.
- Keep destructive or operator-history-changing real mutations skipped-safe or
  handoff-blocked unless disposable session state is proven during
  implementation.
- Update Sessions handoff notes, the head contract-chain matrix, and head
  verification evidence so the module no longer depends on the platform-control
  list-query/live-projection/safe-mutation work.

## Capabilities

### New Capabilities

- `deck-go-sessions-chat-contract-completion`: Completes the chat/sessions
  module contract-chain by mapping visible product workflows to typed Gateway
  and Deck DTOs, list/query contracts, stream/live projection contracts, mutation
  evidence metadata, and bounded real/mock evidence.

### Modified Capabilities

- None.

## Impact

- Affected contract metadata:
  `deck-go/contracts/source/deck-mutations.contract.json` and generated
  mutation evidence docs/TypeScript metadata.
- Affected frontend: `frontend-new/src/api.ts`, chat/sessions focused tests, and
  mutation evidence helper usage where applicable.
- Affected docs/evidence: Sessions implementation notes, contract-chain audit
  matrix, generated matrix Markdown, and head proposal verification evidence.
- Backend changes are only in scope if exploration finds deterministic
  chat/session route, adapter, or DTO drift. No new Gateway APIs are introduced.
