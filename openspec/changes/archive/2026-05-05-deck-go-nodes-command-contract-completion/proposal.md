## Why

Nodes already has production UI, typed Gateway method coverage, and safe real
read-path evidence, but the head matrix still marks it degraded because the
row predates current typed `node.invoke` and `node.pending.enqueue` envelopes.
Product-visible node actions also are not recorded in mutation evidence.

This child proposal closes the deterministic Nodes contract-chain drift against
existing Gateway support without adding new Gateway APIs.

## What Changes

- Re-audit Nodes workflows against current Gateway node schemas/method metadata,
  generated Gateway artifacts, Deck BFF routes, Deck-facing DTOs, frontend
  facades, prior L1/L2 evidence, and handoff notes.
- Treat current typed `node.invoke` and `node.pending.enqueue` outer envelopes
  as Gateway truth while keeping command-specific `payload` content explicitly
  dynamic.
- Add Deck-facing action response DTOs where current facades still return
  generic records.
- Add mutation evidence rows for node rename, node invoke, pending enqueue, and
  pairing request/approve/reject/verify actions.
- Route representative Nodes action facades through shared mutation evidence
  helpers without changing BFF transport boundaries.
- Update Nodes implementation notes, the contract-chain audit matrix, generated
  matrix Markdown, and head verification evidence.

## Capabilities

### New Capabilities

- `deck-go-nodes-command-contract-completion`: Completes the Nodes module
  contract-chain by mapping inventory, describe, rename, invoke, pending work,
  and pairing actions to typed Gateway/Deck outer envelopes plus explicit
  dynamic-payload or skipped-safe evidence.

### Modified Capabilities

- None.

## Impact

- Affected contract metadata:
  `deck-go/contracts/source/deck-api.contract.ts`,
  `deck-go/contracts/source/deck-mutations.contract.json`, and generated
  Deck API / mutation evidence artifacts.
- Affected frontend: `frontend-new/src/api.ts`, API type shims, Nodes/API
  focused tests, and mutation evidence helper coverage.
- Affected docs/evidence: Nodes implementation notes, contract-chain audit
  matrix, generated matrix Markdown, and head proposal verification evidence.
- No new Gateway node methods, command-specific schemas, QR/token UX, bulk
  actions, or audit feed projections are introduced.
