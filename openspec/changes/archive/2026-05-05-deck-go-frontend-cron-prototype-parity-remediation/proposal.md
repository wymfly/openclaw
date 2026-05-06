## Why

The Cron module has an active high-fidelity handoff prototype and an existing
`frontend-new` implementation, but the remediation matrix still records only
mock-functional evidence and unreviewed parity. Under the strengthened head
standard, Cron must prove prototype/current alignment where current Gateway and
Deck contracts support it, then verify real Gateway behavior with safe
run-scoped scheduler fixture evidence rather than read-only smoke alone.

Cron is a mutation-heavy control surface. Operators can create, edit, enable,
disable, run, and delete scheduled jobs, so this pass must explicitly separate
safe disposable real fixtures from unsupported or skipped-safe scheduler
operations.

## What Changes

- Reconcile the active Cron prototype at
  `deck-go/frontend-handoff/modules/cron/prototype.html` with current contract
  truth from:
  - `contracts/source/deck-api.contract.ts`;
  - `contracts/source/deck-endpoints.contract.json`;
  - `contracts/source/deck-mutations.contract.json`;
  - `contracts/source/deck-list-queries.contract.json`;
  - `contracts/source/deck-api-dynamic-surfaces.contract.json`;
  - `frontend-handoff/modules/cron/api-usage.md`;
  - Go BFF Cron routes and frontend Cron API wrappers.
- Audit current `frontend-new` Cron implementation against the active
  scheduled-job control-plane prototype, fixing deterministic visual,
  interaction, i18n, fixture, mutation-evidence, or API drift when deck-go
  contract truth supports it.
- Preserve supported product capabilities:
  - scheduler status;
  - job inventory with search/filter/sort;
  - selected-job hero and detail tabs;
  - create/edit builder;
  - enable/disable;
  - run history;
  - guarded delete;
  - run-now where a disposable fixture makes it safe.
- Attempt representative real fixture creation through Deck BFF/Gateway in the
  isolated real E2E state. Create a run-scoped Cron job only if the Gateway
  accepts a disposable schedule and the test can prove cleanup. If creation or
  cleanup is rejected by real Gateway behavior, circuit-break with exact route
  evidence and keep writes skipped-safe.
- Strengthen mock visual evidence with prototype/current screenshots, list and
  detail states, history/scheduler/payload tabs, builder create/edit states,
  run-now/delete-confirm states, localized theme variants, and a structured
  pass or accepted-exception verdict.
- Strengthen real Gateway E2E with Deck shell navigation into Cron, dark/English,
  dark/Chinese, light/English, and light/Chinese variants, safe child-surface
  interactions, BFF-only browser transport checks, unexpected error checks,
  route-shape checks, and cleanup guards for only run-scoped jobs.
- Update Cron implementation notes, the remediation matrix, and head task `6.4`
  after evidence is recorded.

## Capabilities

### New Capabilities

- `frontend-cron-prototype-parity-remediation`: Defines Cron-specific prototype
  parity remediation, product-contract calibration, real fixture policy,
  accepted exceptions, and archive criteria.

### Modified Capabilities

- `frontend-prototype-parity-remediation`: Adds a Cron row verdict and evidence
  status after this child archives.

## Impact

- Frontend:
  - `deck-go/frontend-new/src/components/panels/cron/`;
  - `deck-go/frontend-new/src/i18n/en.json`;
  - `deck-go/frontend-new/src/i18n/zh.json`.
- E2E and mocks:
  - `deck-go/frontend-new/src/components/panels/cron/CronPanel.test.tsx`;
  - `deck-go/test/e2e/cron-visual.spec.ts`;
  - `deck-go/test/e2e/cron-real-gateway.spec.ts`;
  - `deck-go/test/e2e/helpers.ts` only if deterministic run-scoped fixture or
    evidence helpers require focused repair;
  - `deck-go/test/fixtures/mock-gateway.mjs` only if prototype-shaped Cron mock
    density or mutation behavior is incomplete.
- Contracts:
  - no intended DTO expansion;
  - `contracts/source/deck-mutations.contract.json` may be updated if real
    fixture-safe Cron create/update/delete cleanup is proven.
- Documentation and matrix:
  - `deck-go/frontend-handoff/modules/cron/implementation-notes.md`;
  - `deck-go/docs/project/frontend-prototype-remediation-matrix.md`.
- OpenSpec:
  - this child change;
  - governing head task `6.4`.
