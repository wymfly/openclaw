## Why

The Usage module has an active handoff prototype and an existing
`frontend-new` implementation, but the head remediation matrix still classifies
it as mock-functional with prototype parity unreviewed. Earlier evidence
verified the real read-only contract chain at a coarse level, yet it predates
the strengthened remediation standard: prototype-current visual parity, Deck
shell navigation from another module, all four theme/locale variants, safe
child-surface interaction, representative route-shape evidence, BFF-only
browser transport, unexpected-error checks, and structured accepted
exceptions.

Usage is Deck's read-only cost, quota, and session-usage cockpit. It must stay
grounded in the current contract chain: Deck-facing Usage endpoints adapt
Gateway usage and session telemetry into product-level DTOs for cost,
providers, sessions, session logs, and timeseries. The active prototype
includes useful product ideas such as a high-density KPI topbar, trend chart,
provider quota detail, session inventory, and detail tabs. Current contract
truth supports those read-only workflows, but not provider billing accuracy
claims, tenant accounting, forecasts, quota-policy mutation, or a new charting
dependency.

## What Changes

- Reconcile the active Usage prototype at
  `deck-go/frontend-handoff/modules/usage/prototype.html` with contract truth
  from:
  - `contracts/source/deck-api.contract.ts`;
  - `contracts/source/deck-endpoints.contract.json`;
  - `frontend-handoff/modules/usage/api-usage.md`;
  - Go BFF inventory routes and frontend Usage API wrappers.
- Audit the current `frontend-new` Usage implementation against the active
  cost/quota/session cockpit prototype, fixing deterministic visual,
  interaction, i18n, fixture, route-wrapper, or documentation drift when code
  truth supports it.
- Preserve supported product capabilities:
  - cost summary and trend via `GET /api/usage/cost`;
  - provider quota/status via `GET /api/usage/providers`;
  - session usage inventory via `GET /api/usage/sessions`;
  - session logs via `GET /api/usage/sessions/logs`;
  - session timeseries via `GET /api/usage/timeseries`;
  - range switching, refresh, search/filter/sort, selected provider, and
    session detail tabs as frontend product behavior over Deck DTOs.
- Preserve unsupported prototype assumptions as explicit exceptions:
  - billing-grade cost accuracy;
  - tenant accounting;
  - forecasts and budget recommendations;
  - quota policy mutation;
  - dependency-gated Recharts fidelity.
- Strengthen mock visual evidence with prototype-shaped dense usage fixtures,
  provider quota diversity, session rows, detail tabs, localized theme variants,
  and accepted exceptions.
- Strengthen real Gateway E2E with Chat -> Usage shell navigation, dark/en,
  dark/zh, light/en, light/zh, route-shape checks, empty-valid or real-row
  branch handling, BFF-only browser transport checks, unexpected-error checks,
  and skipped-safe notes for unsupported billing/tenant/forecast semantics.
- Update Usage implementation notes, the remediation matrix, and head task
  `6.12` after evidence is recorded.

## Capabilities

### New Capabilities

- `frontend-usage-prototype-parity-remediation`: Defines Usage-specific
  prototype parity remediation, contract-truth calibration, real evidence
  policy, accepted exceptions, and archive criteria.

### Modified Capabilities

- `frontend-prototype-parity-remediation`: Adds a Usage row verdict and
  evidence status after this child archives.

## Impact

- Frontend:
  - `deck-go/frontend-new/src/components/panels/usage/`;
  - `deck-go/frontend-new/src/i18n/en.json`;
  - `deck-go/frontend-new/src/i18n/zh.json`;
  - `deck-go/frontend-new/src/api.ts` only if deterministic wrapper drift is
    found.
- E2E and mocks:
  - `deck-go/frontend-new/src/components/panels/usage/UsagePanel.test.tsx`;
  - `deck-go/test/e2e/usage-visual.spec.ts`;
  - `deck-go/test/e2e/usage-real-gateway.spec.ts`;
  - `deck-go/test/fixtures/mock-gateway.mjs`.
- Contracts:
  - no intended DTO expansion;
  - forecasts, billing accuracy, tenant accounting, and quota-policy mutation
    remain deferred until Deck/Gateway contracts exist.
- Documentation and matrix:
  - `deck-go/frontend-handoff/modules/usage/implementation-notes.md`;
  - `deck-go/docs/project/frontend-prototype-remediation-matrix.md`.
- OpenSpec:
  - this child change;
  - governing head task `6.12`.
