## Why

The Nodes module has an active v2 handoff prototype and an existing
`frontend-new` implementation, but the governing remediation matrix still
classifies it as only mock-functional with parity unreviewed. Existing evidence
verifies useful route shapes and BFF-only transport, yet it does not meet the
strengthened head standard: prototype-current visual parity, Deck shell
navigation from another module, all four theme/locale variants, safe child
surface interaction, representative real route evidence, run-scoped or
skipped-safe real fixture policy, and structured accepted exceptions.

Nodes is Deck's device trust and remote-control workbench. It must remain
grounded in current Gateway/BFF contract truth: node inventory, node detail,
pairing list/actions, rename, invoke, pending work, dynamic envelopes, and
safe handling for non-disposable real device mutations.

## What Changes

- Reconcile the active Nodes prototype at
  `deck-go/frontend-handoff/modules/nodes/prototype.html` with contract truth
  from:
  - `contracts/source/deck-api.contract.ts`;
  - `contracts/source/deck-endpoints.contract.json`;
  - `contracts/source/deck-mutations.contract.json`;
  - `contracts/source/deck-api-dynamic-surfaces.contract.json`;
  - `frontend-handoff/modules/nodes/api-usage.md`;
  - Go BFF node routes and frontend API wrappers.
- Audit the current `frontend-new` Nodes implementation against the active
  two-pane device trust / remote-control prototype, fixing deterministic
  visual, interaction, i18n, fixture, route-wrapper, mutation-evidence, or
  documentation drift when code truth supports it.
- Preserve supported product capabilities:
  - Node inventory and selected detail;
  - Pairing request list and approve/reject/request/verify affordances;
  - Rename;
  - Invoke dynamic-envelope command;
  - Pending work dynamic-envelope enqueue;
  - Orphan pairing selection without `node.describe`;
  - Confirmation gates for all mutating actions.
- Strengthen mock visual evidence with prototype/current screenshots, selected
  node state, repair pairing state, invoke result, pending-work result, confirm
  rows, localized theme variants, and accepted exceptions.
- Strengthen real Gateway E2E with Chat -> Nodes shell navigation, dark/en,
  dark/zh, light/en, light/zh, route-shape checks, safe read/list evidence,
  skipped-safe non-disposable mutation evidence, BFF-only browser transport
  checks, unexpected-error checks, and environment circuit-break evidence when
  the real stack has no paired devices.
- Update Nodes implementation notes, the remediation matrix, and head task
  `6.8` after evidence is recorded.

## Capabilities

### New Capabilities

- `frontend-nodes-prototype-parity-remediation`: Defines Nodes-specific
  prototype parity remediation, contract-truth calibration, real evidence
  policy, accepted exceptions, and archive criteria.

### Modified Capabilities

- `frontend-prototype-parity-remediation`: Adds a Nodes row verdict and
  evidence status after this child archives.

## Impact

- Frontend:
  - `deck-go/frontend-new/src/components/panels/nodes/`;
  - `deck-go/frontend-new/src/i18n/en.json`;
  - `deck-go/frontend-new/src/i18n/zh.json`;
  - `deck-go/frontend-new/src/api.ts` only if deterministic wrapper drift is
    found.
- E2E and mocks:
  - `deck-go/frontend-new/src/components/panels/nodes/NodesPanel.test.tsx`;
  - `deck-go/test/e2e/nodes-visual.spec.ts`;
  - `deck-go/test/e2e/nodes-real-gateway.spec.ts`;
  - `deck-go/test/fixtures/mock-gateway.mjs` only if prototype-shaped node
    fixture behavior is incomplete.
- Contracts:
  - no intended DTO expansion;
  - command-specific invoke payloads and pending-work payload leaves remain
    dynamic until Gateway provides typed schemas.
- Documentation and matrix:
  - `deck-go/frontend-handoff/modules/nodes/implementation-notes.md`;
  - `deck-go/docs/project/frontend-prototype-remediation-matrix.md`.
- OpenSpec:
  - this child change;
  - governing head task `6.8`.
