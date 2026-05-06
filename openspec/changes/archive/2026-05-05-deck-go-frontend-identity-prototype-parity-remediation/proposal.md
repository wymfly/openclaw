## Why

The Identity module has an active v2 handoff prototype and an existing
`frontend-new` implementation, but the head remediation matrix still records
only mock-functional evidence and unreviewed parity. The current real Gateway
test proves basic route shapes, but it does not yet satisfy the strengthened
head standard: Deck shell navigation, all four theme/locale variants, safe child
surface interaction, representative real route evidence, BFF-only transport,
and explicit accepted exceptions for unsupported prototype capabilities.

Identity is not a SaaS user profile surface. It is the canonical-to-channel-peer
registry backed by `deck.identity.list`, `deck.identity.link`, and
`deck.identity.unlink`. This pass must keep the UI grounded in that contract
truth while proving the product flow is usable with mock and real Gateway
evidence.

## What Changes

- Reconcile the active Identity prototype at
  `deck-go/frontend-handoff/modules/identity/prototype.html` with current
  contract truth from:
  - `contracts/source/deck-api.contract.ts`;
  - `contracts/source/deck-endpoints.contract.json`;
  - `contracts/source/deck-mutations.contract.json`;
  - `contracts/source/deck-api-dynamic-surfaces.contract.json`;
  - `frontend-handoff/modules/identity/api-usage.md`;
  - Go BFF identity routes and frontend wrappers.
- Audit the current `frontend-new` Identity implementation against the active
  two-pane registry prototype, fixing deterministic visual, interaction, i18n,
  fixture, route-wrapper, mutation-evidence, or documentation drift when code
  truth supports it.
- Preserve supported product capabilities:
  - canonical list and selected detail;
  - channel peer list;
  - baseHash optimistic concurrency guard;
  - link and unlink peer mutations;
  - agent identity hint for `main`;
  - raw payload disclosure;
  - unsupported-state affordances for create, rename, delete, activity, and
    recent mutation audit.
- Strengthen mock visual evidence with prototype/current screenshots, canonical
  search/selection, raw payload, link dialog, link mutation, unsupported actions,
  localized theme variants, and structured accepted exceptions.
- Strengthen real Gateway E2E with Chat -> Identity shell navigation,
  dark/English, dark/Chinese, light/English, light/Chinese variants,
  identity list route-shape checks, optional run-scoped link/unlink fixture when
  `configHash` is available, agent identity route shape, BFF-only browser
  transport checks, unexpected error checks, and explicit skipped-safe handling
  for unsupported create/rename/delete/activity/audit workflows.
- Update Identity implementation notes, the remediation matrix, and head task
  `6.6` after evidence is recorded.

## Capabilities

### New Capabilities

- `frontend-identity-prototype-parity-remediation`: Defines Identity-specific
  prototype parity remediation, contract-truth calibration, safe real fixture
  policy, accepted exceptions, and archive criteria.

### Modified Capabilities

- `frontend-prototype-parity-remediation`: Adds an Identity row verdict and
  evidence status after this child archives.

## Impact

- Frontend:
  - `deck-go/frontend-new/src/components/panels/identity/`;
  - `deck-go/frontend-new/src/i18n/en.json`;
  - `deck-go/frontend-new/src/i18n/zh.json`;
  - `deck-go/frontend-new/src/api.ts` only if deterministic wrapper drift is
    found.
- E2E and mocks:
  - `deck-go/frontend-new/src/components/panels/identity/IdentityPanel.test.tsx`;
  - `deck-go/test/e2e/identity-visual.spec.ts`;
  - `deck-go/test/e2e/identity-real-gateway.spec.ts`;
  - `deck-go/test/fixtures/mock-gateway.mjs` only if prototype-shaped identity
    fixture density or mutation behavior is incomplete.
- Contracts:
  - no intended DTO expansion;
  - mutation-evidence policy should remain config-write-safety governed for
    link/unlink and skipped-safe for unsupported prototype actions.
- Documentation and matrix:
  - `deck-go/frontend-handoff/modules/identity/implementation-notes.md`;
  - `deck-go/docs/project/frontend-prototype-remediation-matrix.md`.
- OpenSpec:
  - this child change;
  - governing head task `6.6`.
