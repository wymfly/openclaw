## Why

The Gateway module has an active high-fidelity handoff prototype and an existing
`frontend-new` implementation, but the head remediation matrix still records
only mock-functional evidence and pending strict parity. The existing real
Gateway test proves important route shapes, but it does not yet satisfy the
strengthened head standard: Deck shell navigation, dark/English, dark/Chinese,
light/English, light/Chinese variants, all meaningful safe child surfaces, and
representative real product evidence through the BFF/Gateway chain.

Gateway is mostly read-only but includes a safety-gated `gateway.batch` surface.
This pass must prove that production keeps the browser BFF-only, exposes only
read-only batch methods in bundled mode, locks unsafe or remote-mode execution,
and records projection limitations honestly.

## What Changes

- Reconcile the active Gateway prototype at
  `deck-go/frontend-handoff/modules/gateway/prototype.html` with current
  contract truth from:
  - `contracts/source/deck-api.contract.ts`;
  - `contracts/source/deck-endpoints.contract.json`;
  - `contracts/source/deck-mutations.contract.json`;
  - `contracts/source/deck-list-queries.contract.json`;
  - `contracts/source/deck-api-dynamic-surfaces.contract.json`;
  - `frontend-handoff/modules/gateway/api-usage.md`;
  - Go BFF Gateway/runtime/monitor/activity routes and frontend wrappers.
- Audit current `frontend-new` Gateway implementation against the active
  control-plane prototype, fixing deterministic visual, interaction, i18n,
  projection, fixture, route-wrapper, batch-gating, or documentation drift when
  code truth supports it.
- Preserve supported product capabilities:
  - runtime mode and capability summary;
  - Gateway health, status, and describe;
  - channel and heartbeat rails;
  - Methods & Events explorer;
  - bundled-only read-only batch console;
  - Activity and monitor projections;
  - refresh and not-configured states.
- Strengthen mock visual evidence with prototype/current screenshots, describe
  explorer, batch console, activity tab, remote/locked or disabled states where
  mock supports them, localized theme variants, and a structured pass or
  accepted-exception verdict.
- Strengthen real Gateway E2E with Chat -> Gateway shell navigation,
  dark/English, dark/Chinese, light/English, and light/Chinese variants,
  health/status/describe route-shape checks, safe read-only
  `gateway.describe` batch proof, monitor/activity projection proof,
  BFF-only browser transport checks, unexpected error checks, and explicit
  skipped-safe handling for mutating or remote batch work.
- Update Gateway implementation notes, the remediation matrix, and head task
  `6.5` after evidence is recorded.

## Capabilities

### New Capabilities

- `frontend-gateway-prototype-parity-remediation`: Defines Gateway-specific
  prototype parity remediation, runtime-mode product-contract calibration,
  read-only batch fixture policy, accepted exceptions, and archive criteria.

### Modified Capabilities

- `frontend-prototype-parity-remediation`: Adds a Gateway row verdict and
  evidence status after this child archives.

## Impact

- Frontend:
  - `deck-go/frontend-new/src/components/panels/gateway/`;
  - `deck-go/frontend-new/src/i18n/en.json`;
  - `deck-go/frontend-new/src/i18n/zh.json`;
  - `deck-go/frontend-new/src/api.ts` only if deterministic wrapper drift is
    found.
- E2E and mocks:
  - `deck-go/frontend-new/src/components/panels/gateway/GatewayPanel.test.tsx`;
  - `deck-go/test/e2e/gateway-visual.spec.ts`;
  - `deck-go/test/e2e/gateway-real-gateway.spec.ts`;
  - `deck-go/test/fixtures/mock-gateway.mjs` only if prototype-shaped Gateway
    mock density or batch behavior is incomplete.
- Contracts:
  - no intended DTO expansion;
  - mutation-evidence policy is expected to keep `gateway.batch` skipped-safe
    for arbitrary/mutating calls while allowing bounded read-only batch
    evidence.
- Documentation and matrix:
  - `deck-go/frontend-handoff/modules/gateway/implementation-notes.md`;
  - `deck-go/docs/project/frontend-prototype-remediation-matrix.md`.
- OpenSpec:
  - this child change;
  - governing head task `6.5`.
