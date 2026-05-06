## Why

The Threads module has an active v2 handoff prototype and an existing
`frontend-new` implementation, but the head remediation matrix still classifies
it as only mock-functional with parity unreviewed. Existing evidence verifies
basic read-only list/detail behavior and a real empty state, yet it does not
meet the strengthened head standard: prototype-current visual parity, Deck
shell navigation from another module, all four theme/locale variants, safe child
surface interaction, representative real route evidence, BFF-only browser
transport, unexpected-error checks, and structured accepted exceptions.

Threads is the channel-to-agent binding registry. It must stay grounded in the
current contract chain: `GET /api/deck/threads` adapts Gateway
`deck.threads.list` and returns flat `DeckGoThreadEntry` records. The active
prototype includes useful product ideas such as a dense binding table, channel
and target filters, activity recency, detail tabs, raw payload, and mutation
dialogs, but current Gateway/Deck truth only supports read-only list/filter,
selection, copy, cross-panel navigation, and raw payload display.

## What Changes

- Reconcile the active Threads prototype at
  `deck-go/frontend-handoff/modules/threads/prototype.html` with contract truth
  from:
  - `contracts/source/deck-api.contract.ts`;
  - `contracts/source/deck-endpoints.contract.json`;
  - `frontend-handoff/modules/threads/api-usage.md`;
  - Go BFF inventory route and frontend `fetchThreads()` wrapper.
- Audit the current `frontend-new` Threads implementation against the active
  list/detail prototype, fixing deterministic visual, interaction, i18n,
  fixture, route-wrapper, or documentation drift when code truth supports it.
- Preserve supported product capabilities:
  - Binding list and filters through `agentId`, `channel`, and `status`;
  - Selected binding detail and relation summary;
  - Copy target session key;
  - Cross-panel navigation to Sessions/Agents or Chat-equivalent handoff only
    when an existing navigation helper supports it;
  - Raw `DeckGoThreadEntry` payload display;
  - Empty-valid real Gateway state.
- Preserve unsupported prototype assumptions as explicit exceptions:
  - unbind, rebind, rename;
  - per-thread recent activity and audit projections;
  - transcript and branch views;
  - mutation-backed fixture creation.
- Strengthen mock visual evidence with prototype-shaped dense thread fixtures,
  selected detail, filter states, copy feedback, raw payload, localized theme
  variants, and accepted exceptions.
- Strengthen real Gateway E2E with Chat -> Threads shell navigation, dark/en,
  dark/zh, light/en, light/zh, route-shape checks, empty-valid or real-row
  branch handling, BFF-only browser transport checks, unexpected-error checks,
  and skipped-safe notes for missing mutation/activity/audit contracts.
- Update Threads implementation notes, the remediation matrix, and head task
  `6.11` after evidence is recorded.

## Capabilities

### New Capabilities

- `frontend-threads-prototype-parity-remediation`: Defines Threads-specific
  prototype parity remediation, contract-truth calibration, real evidence
  policy, accepted exceptions, and archive criteria.

### Modified Capabilities

- `frontend-prototype-parity-remediation`: Adds a Threads row verdict and
  evidence status after this child archives.

## Impact

- Frontend:
  - `deck-go/frontend-new/src/components/panels/threads/`;
  - `deck-go/frontend-new/src/i18n/en.json`;
  - `deck-go/frontend-new/src/i18n/zh.json`;
  - `deck-go/frontend-new/src/api.ts` only if deterministic wrapper drift is
    found.
- E2E and mocks:
  - `deck-go/frontend-new/src/components/panels/threads/ThreadsPanel.test.tsx`;
  - `deck-go/test/e2e/threads-visual.spec.ts`;
  - `deck-go/test/e2e/threads-real-gateway.spec.ts`;
  - `deck-go/test/fixtures/mock-gateway.mjs`.
- Contracts:
  - no intended DTO expansion;
  - mutation, activity, audit, transcript, and branch surfaces remain deferred
    until Deck/Gateway contracts exist.
- Documentation and matrix:
  - `deck-go/frontend-handoff/modules/threads/implementation-notes.md`;
  - `deck-go/docs/project/frontend-prototype-remediation-matrix.md`.
- OpenSpec:
  - this child change;
  - governing head task `6.11`.
