## Why

Routing, Identity, and Threads are visible product modules with existing
Gateway-backed read paths and prior real read-path evidence, but the head
contract-chain matrix still marks them degraded. The current code truth shows
that routing and identity writes already have config-write safety contracts,
while the frontend facades still return generic records or bypass mutation
evidence. Threads is currently a read-only projection and should not claim
mutation or live-refresh capability.

This child proposal closes the deterministic contract-chain drift for these
three tightly related modules without adding new Gateway APIs.

## What Changes

- Re-audit Routing, Identity, and Threads workflows against current Gateway
  schemas/method metadata, Deck BFF routes, Deck-facing DTOs, frontend facades,
  prior L1/L2 evidence, and module handoff notes.
- Add Deck-facing identity mutation response DTOs where frontend facades still
  return generic records.
- Add mutation evidence rows for identity link/unlink, routing add/remove, and
  routing DM-scope patch actions.
- Route representative Routing and Identity action facades through shared
  mutation evidence helpers while preserving BFF-only browser transport.
- Keep routing validation/simulation and thread listing as read/advisory
  workflows, not product mutations.
- Update Routing, Identity, and Threads implementation notes, the contract-chain
  audit matrix, generated matrix Markdown, and head verification evidence.

## Capabilities

### New Capabilities

- `deck-go-routing-identity-threads-contract-completion`: Completes the
  Routing/Identity/Threads contract-chain by aligning config-write safety,
  mutation evidence, product read/advisory semantics, and remaining unsupported
  thread/live-refresh gaps.

### Modified Capabilities

- None.

## Impact

- Affected contract metadata:
  `deck-go/contracts/source/deck-api.contract.ts`,
  `deck-go/contracts/source/deck-mutations.contract.json`, and generated Deck
  API / mutation evidence artifacts.
- Affected frontend: `frontend-new/src/api.ts`, API type shims, focused API and
  mutation-evidence tests, and the Routing panel DM-scope facade call.
- Affected docs/evidence: Routing, Identity, and Threads implementation notes,
  contract-chain audit matrix, generated matrix Markdown, and head proposal
  verification evidence.
- No new Gateway methods, thread mutations, route history store, first-class
  routing reorder method, or live thread refresh contract are introduced.
