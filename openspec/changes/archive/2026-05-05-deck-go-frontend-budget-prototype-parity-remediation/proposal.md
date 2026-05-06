## Why

The Budget module has an active high-fidelity handoff prototype and a current
`frontend-new` implementation, but the remediation matrix still records only
mock-functional evidence with no strict prototype parity verdict. Under the
strengthened head standard, Budget must prove the production workbench matches
the rule/evaluation prototype where current deck-go contracts support it, and
must verify real CRUD behavior with safe run-scoped fixture data rather than
route-shape smoke alone.

Budget is a Deck-local governance surface, not a raw Gateway billing dashboard.
Its current contract truth is budget-rule CRUD plus one evaluation snapshot per
rule. The prototype includes broader product ideas such as durable recent-change
history, workspace/channel scopes, hourly/task periods, bootstrap gating, and
forecast/history affordances; this change must preserve supported behavior while
recording unsupported projections honestly.

## What Changes

- Reconcile the active Budget prototype at
  `deck-go/frontend-handoff/modules/budget/prototype.html` with current contract
  truth from:
  - `contracts/source/deck-api.contract.ts`;
  - `contracts/source/deck-endpoints.contract.json`;
  - `contracts/source/deck-mutations.contract.json`;
  - `frontend-handoff/modules/budget/api-usage.md`;
  - Go BFF Budget routes and frontend API wrappers.
- Audit current `frontend-new` Budget implementation against the active v2
  rule/evaluation workbench, fixing deterministic visual, interaction, i18n,
  fixture, or API drift when deck-go contract truth supports it.
- Preserve supported product capabilities:
  - `GET /api/usage/budget` list;
  - `GET /api/usage/budget/evaluate` evaluation snapshot;
  - `POST /api/usage/budget` create;
  - `PATCH /api/usage/budget/{id}` update/toggle;
  - `DELETE /api/usage/budget/{id}` delete;
  - local search, status filters, rule selection, definition/threshold summary,
    create/edit/toggle/delete flows, and validation feedback.
- Keep unsupported or deferred projections explicit:
  - durable per-rule recent-change history;
  - forecast/projection;
  - time-series/history charts;
  - org/workspace/channel scopes where current BFF does not persist target ids;
  - hourly/task periods where current BFF validates only daily/weekly/monthly;
  - notification routing or budget-to-alert binding.
- Strengthen mock visual evidence with prototype/current screenshots, list and
  detail screenshots, filtered states, create/edit/toggle/delete/validation
  states, localized theme variants, and a structured pass or accepted-exception
  verdict.
- Strengthen real Gateway E2E with safe run-scoped budget-rule
  create/patch/evaluate/delete fixture data, route-shape checks, shell
  navigation into Budget, dark/English, dark/Chinese, light/English, and
  light/Chinese variants, child-surface interactions, BFF-only browser transport
  checks, unexpected error checks, and cleanup guards.
- Update Budget implementation notes, the remediation matrix, and head task
  `6.2` after evidence is recorded.

## Capabilities

### New Capabilities

- `frontend-budget-prototype-parity-remediation`: Defines Budget-specific
  prototype parity remediation, product-contract calibration, real fixture
  policy, accepted exceptions, and archive criteria.

### Modified Capabilities

- `frontend-prototype-parity-remediation`: Adds a Budget row verdict and
  evidence status after this child archives.

## Impact

- Frontend:
  - `deck-go/frontend-new/src/components/panels/budget/`;
  - `deck-go/frontend-new/src/i18n/en.json`;
  - `deck-go/frontend-new/src/i18n/zh.json`.
- E2E and mocks:
  - `deck-go/frontend-new/src/components/panels/budget/BudgetPanel.test.tsx`;
  - `deck-go/test/e2e/budget-visual.spec.ts`;
  - `deck-go/test/e2e/budget-real-gateway.spec.ts`;
  - `deck-go/test/e2e/helpers.ts` only if deterministic run-scoped fixture or
    evidence helpers require focused repair.
- Backend/contracts:
  - no intended contract expansion; deterministic BFF or contract drift found
    during verification may be fixed in this child when current deck-go truth
    supports the fix.
- Documentation and matrix:
  - `deck-go/frontend-handoff/modules/budget/implementation-notes.md`;
  - `deck-go/docs/project/frontend-prototype-remediation-matrix.md`.
- OpenSpec:
  - this child change;
  - governing head task `6.2`.
