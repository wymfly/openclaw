## Why

The Channels module already has useful BFF/Gateway wiring and a revised v2
handoff prototype, but the remediation head matrix still classifies it as mock
functional only and parity-unreviewed. Under the strengthened head standard,
Channels needs a child proposal that proves prototype alignment and real Gateway
readiness through shell navigation, theme/locale variants, child interactions,
and safe fixture attempts rather than relying on the prior real-contract pass.

## What Changes

- Reconcile the active Channels handoff prototype at
  `deck-go/frontend-handoff/modules/channels/prototype.html` with current
  contract truth from:
  - `contracts/source/deck-api.contract.ts`;
  - `contracts/source/deck-endpoints.contract.json`;
  - `contracts/source/deck-mutations.contract.json`;
  - `frontend-handoff/modules/channels/api-usage.md`;
  - the existing Go BFF channels routes and frontend wrappers.
- Audit the current `frontend-new` Channels implementation against the v2
  full-width list-to-detail prototype, fixing deterministic visual or
  interaction drift directly when contract truth supports the prototype.
- Preserve the existing BFF-only browser boundary for inventory, probe,
  throughput, logout, channel config patch, routing handoff, and WeCom access
  controls.
- Keep unsupported or unsafe prototype projections explicit:
  - first-class channel creation;
  - rich real throughput metrics;
  - normalized server-side `accountDiagnostics` / `wecomAccess` projections;
  - destructive logout and provider config mutations without disposable channel
    state.
- Strengthen mock evidence with prototype/current screenshots, representative
  list/detail/tab/dialog states, localized variant coverage, and a structured
  pass or accepted-exception verdict.
- Strengthen real Gateway E2E with shell navigation into Channels, dark/en and
  light/zh renders, search/filter/detail/tab interactions, BFF-only browser
  transport checks, unexpected error checks, route-shape checks, and safe
  run-scoped fixture attempts.
- Update the Channels handoff implementation notes, remediation matrix, and
  head task `5.6` after evidence is recorded.

## Capabilities

### New Capabilities

- `frontend-channels-prototype-parity-remediation`: Defines the
  Channels-specific prototype parity remediation, contract-calibration rules,
  real fixture policy, accepted exceptions, and archive criteria.

### Modified Capabilities

- `frontend-prototype-parity-remediation`: Adds a Channels row verdict and
  evidence status after this child archives.

## Impact

- Frontend:
  - `deck-go/frontend-new/src/components/panels/channels/`;
  - `deck-go/frontend-new/src/i18n/en.json`;
  - `deck-go/frontend-new/src/i18n/zh.json`.
- E2E and mocks:
  - `deck-go/frontend-new/src/components/panels/channels/ChannelsPanel.test.tsx`;
  - `deck-go/test/e2e/channels-visual.spec.ts`;
  - `deck-go/test/e2e/channels-real-gateway.spec.ts`;
  - shared E2E helpers only if deterministic evidence helpers are required.
- Backend/contracts:
  - no intended contract expansion; deterministic BFF or contract drift found
    during verification may be fixed in this child when Gateway truth supports
    the fix.
- Documentation and matrix:
  - `deck-go/frontend-handoff/modules/channels/implementation-notes.md`;
  - `deck-go/docs/project/frontend-prototype-remediation-matrix.md`.
- OpenSpec:
  - this child change;
  - governing head task `5.6`.
