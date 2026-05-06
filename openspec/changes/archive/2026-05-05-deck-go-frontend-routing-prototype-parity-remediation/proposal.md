## Why

The Routing module has an active v2 handoff prototype and an existing
`frontend-new` implementation, but the head remediation matrix still classifies
it as only mock-functional with parity unreviewed. Existing evidence verifies
basic list/simulate/remove-shape behavior, yet it does not meet the strengthened
head standard: prototype-current visual parity, Deck shell navigation from
another module, all four theme/locale variants, safe child surface interaction,
representative real route evidence, safe run-scoped mutation fixture attempts,
BFF-only browser transport, and structured accepted exceptions.

Routing is Deck's agent route-binding workbench. It must stay grounded in the
current typed contract chain: list bindings, validate draft, add/remove
bindings with `configHash`, simulate inbound traffic, patch DM scope through the
config patch path, and activity-feed projection.

## What Changes

- Reconcile the active Routing prototype at
  `deck-go/frontend-handoff/modules/routing/prototype.html` with contract truth
  from:
  - `contracts/source/deck-api.contract.ts`;
  - `contracts/source/deck-endpoints.contract.json`;
  - `contracts/source/deck-mutations.contract.json`;
  - `frontend-handoff/modules/routing/api-usage.md`;
  - `frontend-handoff/modules/routing/api-discrepancy.md`;
  - Go BFF routing/config routes and frontend API wrappers.
- Audit the current `frontend-new` Routing implementation against the active
  queue/detail workbench prototype, fixing deterministic visual, interaction,
  i18n, fixture, route-wrapper, mutation-evidence, or documentation drift when
  code truth supports it.
- Preserve supported product capabilities:
  - Binding list and filters;
  - Selected binding detail and navigation affordances;
  - Validate draft;
  - Add binding with base hash;
  - Remove binding with base hash;
  - Move binding as remove+add workaround;
  - Simulate route;
  - Patch DM scope through config patch;
  - Routing-relevant activity projection;
  - Confirmation gates for hash-affecting mutations.
- Strengthen mock visual evidence with prototype/current screenshots, queue
  state, selected binding, add draft, remove confirmation, DM scope confirmation,
  simulation result, activity, localized theme variants, and accepted
  exceptions.
- Strengthen real Gateway E2E with Chat -> Routing shell navigation, dark/en,
  dark/zh, light/en, light/zh, route-shape checks, safe run-scoped add/remove or
  skipped-safe evidence, BFF-only browser transport checks, unexpected-error
  checks, and environment circuit-break evidence when the real stack has no
  reversible routing config fixture.
- Update Routing implementation notes, the remediation matrix, and head task
  `6.9` after evidence is recorded.

## Capabilities

### New Capabilities

- `frontend-routing-prototype-parity-remediation`: Defines Routing-specific
  prototype parity remediation, contract-truth calibration, real evidence
  policy, accepted exceptions, and archive criteria.

### Modified Capabilities

- `frontend-prototype-parity-remediation`: Adds a Routing row verdict and
  evidence status after this child archives.

## Impact

- Frontend:
  - `deck-go/frontend-new/src/components/panels/routing/`;
  - `deck-go/frontend-new/src/i18n/en.json`;
  - `deck-go/frontend-new/src/i18n/zh.json`;
  - `deck-go/frontend-new/src/api.ts` only if deterministic wrapper drift is
    found.
- E2E and mocks:
  - `deck-go/frontend-new/src/components/panels/routing/RoutingPanel.test.tsx`;
  - `deck-go/test/e2e/routing-visual.spec.ts`;
  - `deck-go/test/e2e/routing-real-gateway.spec.ts`;
  - `deck-go/test/fixtures/mock-gateway.mjs` only if prototype-shaped routing
    fixture behavior is incomplete.
- Contracts:
  - no intended DTO expansion;
  - reorder remains remove+add unless Gateway exposes a first-class action.
- Documentation and matrix:
  - `deck-go/frontend-handoff/modules/routing/implementation-notes.md`;
  - `deck-go/docs/project/frontend-prototype-remediation-matrix.md`.
- OpenSpec:
  - this child change;
  - governing head task `6.9`.
