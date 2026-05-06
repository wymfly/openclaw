## Why

The Alerts module has an active high-fidelity handoff prototype and a current
`frontend-new` implementation, but the remediation matrix still records only
mock-functional evidence with no structured prototype parity verdict. Under the
strengthened head standard, Alerts must prove the production workbench matches
the active prototype where current deck-go contracts support it, and must verify
real CRUD behavior through safe run-scoped fixture data rather than relying on
route-shape smoke alone.

Alerts is also a product-level Deck BFF surface, not a raw OpenClaw Gateway RPC
mirror. Its current truth is local alert-rule CRUD with unsupported evaluator,
test-fire, durable fired-history, audit-history, and webhook-target projections.
This change must keep those boundaries explicit while tightening mock visual
and real E2E evidence.

## What Changes

- Reconcile the active Alerts prototype at
  `deck-go/frontend-handoff/modules/alerts/prototype.html` with current
  contract truth from:
  - `contracts/source/deck-api.contract.ts`;
  - `contracts/source/deck-endpoints.contract.json`;
  - `contracts/source/deck-mutations.contract.json`;
  - `frontend-handoff/modules/alerts/api-usage.md`;
  - Go BFF Alerts routes and frontend API wrappers.
- Audit current `frontend-new` Alerts implementation against the active v2
  rule-management prototype, fixing deterministic visual, interaction, i18n,
  fixture, or API drift when deck-go contract truth supports it.
- Preserve supported product capabilities:
  - `GET /api/alerts` list;
  - `POST /api/alerts` create;
  - `PATCH /api/alerts/{id}` update/toggle;
  - `DELETE /api/alerts/{id}` delete;
  - local search, action/entity/enabled filters, detail tabs, create/edit/delete
    dialogs, and unsupported-state messaging.
- Keep unsupported or deferred projections explicit:
  - alert evaluator semantics;
  - condition DSL grammar/autocomplete;
  - test-fire execution endpoint;
  - durable fired alert history;
  - durable audit history;
  - per-rule webhook target binding.
- Strengthen mock visual evidence with prototype/current screenshots, list and
  detail screenshots, filtered states, create/edit/delete/test-preview dialog
  states, localized theme variants, and a structured pass or
  accepted-exception verdict.
- Strengthen real Gateway E2E with safe run-scoped alert-rule create/patch/delete
  fixture data, route-shape checks, shell navigation into Alerts, dark and light
  modes, English and Chinese locales, child-surface interactions, BFF-only
  browser transport checks, unexpected error checks, and cleanup guards.
- Update Alerts implementation notes, the remediation matrix, and head task
  `6.1` after evidence is recorded.

## Capabilities

### New Capabilities

- `frontend-alerts-prototype-parity-remediation`: Defines Alerts-specific
  prototype parity remediation, product-contract calibration, real fixture
  policy, accepted exceptions, and archive criteria.

### Modified Capabilities

- `frontend-prototype-parity-remediation`: Adds an Alerts row verdict and
  evidence status after this child archives.

## Impact

- Frontend:
  - `deck-go/frontend-new/src/components/panels/alerts/`;
  - `deck-go/frontend-new/src/i18n/en.json`;
  - `deck-go/frontend-new/src/i18n/zh.json`.
- E2E and mocks:
  - `deck-go/frontend-new/src/components/panels/alerts/AlertsPanel.test.tsx`;
  - `deck-go/test/e2e/alerts-visual.spec.ts`;
  - `deck-go/test/e2e/alerts-real-gateway.spec.ts`;
  - `deck-go/test/e2e/helpers.ts` only if deterministic run-scoped fixture or
    evidence helpers require focused repair.
- Backend/contracts:
  - no intended contract expansion; deterministic BFF or contract drift found
    during verification may be fixed in this child when current deck-go truth
    supports the fix.
- Documentation and matrix:
  - `deck-go/frontend-handoff/modules/alerts/implementation-notes.md`;
  - `deck-go/docs/project/frontend-prototype-remediation-matrix.md`.
- OpenSpec:
  - this child change;
  - governing head task `6.1`.
