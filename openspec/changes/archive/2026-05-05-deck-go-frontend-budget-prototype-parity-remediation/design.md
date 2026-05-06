## Context

Budget is a Deck-local rule/evaluation governance surface. The current contract
chain is:

`BudgetPanel` -> `frontend-new/src/api.ts` wrappers -> Deck BFF routes:

- `GET /api/usage/budget`
- `GET /api/usage/budget/evaluate`
- `POST /api/usage/budget`
- `PATCH /api/usage/budget/{ruleId}`
- `DELETE /api/usage/budget/{ruleId}`

The BFF stores rules in local state and evaluates enabled rules against managed
runtime usage totals. Current contracts do not expose durable recent-change
history, forecasts, per-rule time-series, organization/workspace/channel target
fields, hourly/task-period validation, or notification/budget-to-alert binding.
The active prototype in `frontend-handoff/modules/budget/prototype.html` is a
dense two-pane rule workbench with KPI topbar, filterable rule rail, selected
rule detail, threshold meter, definition table, recent changes, and create/edit
toggle/delete dialogs.

Production already implements the broad rule CRUD path and evaluation summary,
but the head matrix still records Budget as parity-unreviewed. This child
proposal must generate the missing parity proof, fix deterministic drift, and
upgrade real E2E to the strengthened standard.

## Goals / Non-Goals

**Goals:**

- Confirm `frontend-handoff/modules/budget/prototype.html` is the active visual
  target and `prototype-v1-codex.html` is reference-only.
- Audit production Budget against the active v2 budget-rule prototype.
- Fix deterministic drift in layout, filters, selected-rule detail, threshold
  meter, form/dialog flows, localized text, fixture data, route wrappers, or
  cleanup guards when current deck-go truth supports it.
- Preserve BFF-only browser access for all budget-rule data and mutations.
- Attempt representative real fixture data by creating a run-scoped budget rule
  through `POST /api/usage/budget`, patching it through
  `PATCH /api/usage/budget/{id}`, evaluating through
  `GET /api/usage/budget/evaluate`, and deleting it through
  `DELETE /api/usage/budget/{id}`.
- Cleanup any run-scoped real budget rule only when the rule name or id is tied
  to the current run id.
- Upgrade mock visual E2E and real Gateway E2E to cover shell navigation, all
  four theme/locale variants, safe child surfaces, fixture evidence, and
  unexpected error checks.
- Update Budget implementation notes, matrix row, and head task `6.2`.

**Non-Goals:**

- Do not add durable budget history or a chart library in this child.
- Do not add forecast/projection contracts unless current BFF contract truth
  already exposes them.
- Do not add notification routing or budget-to-alert binding.
- Do not widen supported production period values beyond current BFF validation
  (`daily | weekly | monthly`) in this child.
- Do not mutate or delete non-run-scoped real user rules.
- Do not edit generated contract artifacts unless a source contract fix requires
  regeneration.

## Decisions

### D1: Treat current Budget as candidate implementation

Production already follows the prototype's core rule/evaluation workbench
pattern. This child should compare current code with the active prototype and
patch concrete deterministic gaps instead of replacing the panel wholesale from
handoff files.

Alternative considered: wholesale replacement from prototype files. Rejected
because production already adapts the prototype to generated Deck DTOs, i18n,
mutation evidence helpers, and BFF-only wrappers.

### D2: Real fixture data uses Deck BFF CRUD

Budget real fixture data should be created through the product path:
run-scoped rule create -> patch/evaluate -> UI interaction -> delete cleanup.
Direct localstore writes or test-only seed endpoints would bypass the contract
chain being verified.

Alternative considered: pre-seed localstore files. Rejected because BFF route
validation, mutation wrappers, and evaluation refresh are the important product
behavior.

### D3: Unsupported prototype projections stay honest

The prototype includes recent changes, bootstrap mutation gating, broader
scope/period examples, and forecast/history ideas. Current Budget contracts
support rule state and evaluation snapshots only. The production panel may show
local-only or unavailable messaging, but must not claim those projections are
Gateway-backed capabilities.

Alternative considered: fabricate recent-change and forecast data in production
for visual parity. Rejected because it would make the control surface less
truthful and would hide missing product contracts.

### D4: Cleanup is allowed only for run-scoped rules

Budget delete is a real mutation. E2E cleanup may delete only a rule created by
the current run id. If fixture creation fails, the test records skipped-safe or
handoff-blocked evidence and still verifies read/UI surfaces.

Alternative considered: delete the first available rule after the test.
Rejected because real stack may include user-created rules copied into isolated
state.

## Risks / Trade-offs

- **Risk: real BFF local state contains existing rules.** -> Create and cleanup
  only run-scoped rules; filter UI searches by the run id.
- **Risk: prototype uses unsupported scope/period values.** -> Keep production
  forms inside current BFF-supported values and record wider prototype examples
  as accepted exceptions.
- **Risk: visual parity is affected by Deck shell chrome.** -> Treat shell
  chrome as an accepted exception when the module panel matches the prototype
  workbench.
- **Risk: real evaluation depends on live usage totals.** -> Verify response
  shape and status rendering; do not claim billing accuracy or quota
  enforcement.

## Migration Plan

1. Audit prototype files, production Budget code, contract sources, BFF routes,
   mock visual spec, and real E2E spec.
2. Generate or inspect prototype-current parity evidence for the active v2
   Budget target.
3. Patch deterministic UI, i18n, fixture, route, or test drift found by the
   audit.
4. Upgrade mock visual E2E to capture list, detail, status filters, threshold
   meter, create/edit/toggle/delete/validation states, and localized theme
   variants.
5. Upgrade real E2E to verify route shapes, shell navigation, all four
   theme/locale variants, safe child interactions, BFF-only transport,
   unexpected errors, and run-scoped create/patch/evaluate/delete fixture
   evidence or skipped-safe circuit breaker.
6. Update implementation notes and the head matrix, validate, then archive this
   child proposal.

## Open Questions

- Whether Budget should gain durable recent-change history or reuse the control
  audit surface.
- Whether Budget should gain forecast/projection fields from usage totals.
- Whether Budget should gain per-rule history/time-series endpoints.
- Whether workspace/channel/org scopes need explicit target DTO fields.
- Whether budget rules should link to Alerts notification rules.
