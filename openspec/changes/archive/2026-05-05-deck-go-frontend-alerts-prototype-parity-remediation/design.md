## Context

Alerts is a Deck-local rule-management surface. The current contract chain is:

`AlertsPanel` -> `frontend-new/src/api.ts` wrappers -> Deck BFF routes:

- `GET /api/alerts`
- `POST /api/alerts`
- `PATCH /api/alerts/{ruleId}`
- `DELETE /api/alerts/{ruleId}`

The BFF stores alert rules in local state and validates the closed action union
`toast | activity | webhook`. Current contracts do not expose an evaluator,
test-fire endpoint, durable fired-alert timeline, durable audit history, or
per-rule webhook target binding. The active prototype in
`frontend-handoff/modules/alerts/prototype.html` is a dense rule CRUD workbench
with KPI strip, filterable rule list, selected-rule detail tabs, create/edit
form, delete confirmation, and test-fire/audit/fires projections.

Production already implements the broad workbench shape and CRUD path, but the
head matrix still records Alerts as parity-unreviewed. This child proposal must
generate the missing parity proof, fix deterministic drift, and upgrade real E2E
to the strengthened standard.

## Goals / Non-Goals

**Goals:**

- Confirm `frontend-handoff/modules/alerts/prototype.html` is the active visual
  target and `prototype-v1-codex.html` is reference-only.
- Audit production Alerts against the active v2 alert-rule prototype.
- Fix deterministic drift in layout, filters, detail tabs, dialogs, localized
  text, fixture data, route wrappers, or cleanup guards when current deck-go
  truth supports it.
- Preserve BFF-only browser access for all alert-rule data and mutations.
- Attempt representative real fixture data by creating a run-scoped alert rule
  through `POST /api/alerts`, patching it through `PATCH /api/alerts/{id}`, and
  deleting it through `DELETE /api/alerts/{id}`.
- Cleanup any run-scoped real alert rule only when the rule name or id is tied
  to the current run id.
- Upgrade mock visual E2E and real Gateway E2E to cover shell navigation,
  theme/locale variants, safe child surfaces, fixture evidence, and unexpected
  error checks.
- Update Alerts implementation notes, matrix row, and head task `6.1`.

**Non-Goals:**

- Do not add an alert evaluator engine in this child.
- Do not add a real test-fire endpoint unless current BFF contract truth already
  exposes one.
- Do not add durable fired-alert history or audit-history storage.
- Do not add condition DSL parsing, syntax highlighting, or autocomplete.
- Do not add per-rule webhook target binding.
- Do not mutate or delete non-run-scoped real user rules.
- Do not edit generated contract artifacts unless a source contract fix requires
  regeneration.

## Decisions

### D1: Treat current Alerts as candidate implementation

Production already follows the prototype's core CRUD workbench pattern. This
child should compare current code with the active prototype and patch concrete
deterministic gaps instead of replacing the panel from handoff files.

Alternative considered: wholesale replacement from prototype files. Rejected
because production already adapts the prototype to generated Deck DTOs, i18n,
mutation evidence helpers, and BFF-only wrappers.

### D2: Real fixture data uses Deck BFF CRUD

Alerts real fixture data should be created through the product path:
run-scoped alert rule create -> patch/toggle -> UI interaction -> delete cleanup.
Direct local store writes or test-only seed endpoints would bypass the contract
chain being verified.

Alternative considered: pre-seed localstore files. Rejected because BFF route
validation and browser mutation wrappers are the important product behavior.

### D3: Unsupported prototype projections stay honest

The prototype includes test-fire, fired-history, audit, and webhook-binding
ideas. Current Alerts contracts support rule state and `lastFiredAt` only. The
production panel may show fallback, disabled, preview, or unsupported messaging,
but must not claim those projections are Gateway-backed capabilities.

Alternative considered: fabricate recent-fire and audit data in production for
visual parity. Rejected because it would make the control surface less truthful
and would hide missing product contracts.

### D4: Cleanup is allowed only for run-scoped rules

Alert delete is a real mutation. E2E cleanup may delete only a rule created by
the current run id. If fixture creation fails, the test records skipped-safe or
handoff-blocked evidence and still verifies read/UI surfaces.

Alternative considered: delete the first available rule after the test.
Rejected because real stack may include user-created rules copied into isolated
state.

## Risks / Trade-offs

- **Risk: real BFF local state contains existing rules.** -> Create and cleanup
  only run-scoped rules; filter UI searches by the run id.
- **Risk: current prototype assumes unsupported test-fire/audit/fires.** -> Keep
  these as fallback/unsupported states and list them as accepted exceptions.
- **Risk: visual parity is affected by Deck shell chrome.** -> Treat shell
  chrome as an accepted exception when the module panel matches the prototype
  workbench.
- **Risk: CRUD route validation differs from prototype input freedom.** -> Let
  current Deck DTO and BFF validation win; patch prototype-derived assumptions
  only when source contracts support them.

## Migration Plan

1. Audit prototype files, production Alerts code, contract sources, BFF routes,
   mock visual spec, and real E2E spec.
2. Generate or inspect prototype-current parity evidence for the active v2
   Alerts target.
3. Patch deterministic UI, i18n, fixture, route, or test drift found by the
   audit.
4. Upgrade mock visual E2E to capture list, detail, filters, create/edit/delete
   dialogs, test-preview fallback, unsupported tabs, and localized theme
   variants.
5. Upgrade real E2E to verify route shapes, shell navigation, theme/locale axes,
   safe child interactions, BFF-only transport, unexpected errors, and
   run-scoped create/patch/delete fixture evidence or skipped-safe circuit
   breaker.
6. Update implementation notes and the head matrix, validate, then archive this
   child proposal.

## Open Questions

- Whether future Alerts should add a first-class evaluator and test-fire route.
- Whether fired alert history should be derived from Activity or stored as a
  durable Alerts projection.
- Whether CRUD audit should reuse the control audit history surface or expose an
  Alerts-specific route.
- Whether condition DSL should become a typed expression contract.
- Whether webhook action should bind a specific webhook target per alert rule.
