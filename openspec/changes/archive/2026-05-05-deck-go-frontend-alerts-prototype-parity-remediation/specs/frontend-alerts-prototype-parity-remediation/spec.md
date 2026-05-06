## ADDED Requirements

### Requirement: Alerts production UI matches the active v2 rule flow

The Alerts production panel SHALL use the active handoff prototype product flow
as its visual and interaction target while preserving current deck-go contract
truth.

#### Scenario: Operator opens Alerts workbench

- **WHEN** the operator navigates to Alerts
- **THEN** the first viewport SHALL show an alert-rule workbench with KPI
  metrics, search, action/entity/enabled filters, rule list, selected rule
  detail, tabs, and create/edit/delete/test-preview affordances or clear
  loading/empty/error states
- **AND** the workbench SHALL use the active v2 handoff prototype as the visual
  target unless an accepted exception is recorded.

#### Scenario: Operator filters and inspects rules

- **WHEN** rules exist and the operator searches, changes action/entity/enabled
  filters, selects a rule, switches detail tabs, toggles enabled state, opens
  edit/delete/test-preview dialogs, or cancels dialogs
- **THEN** the UI SHALL update local selection/filter/dialog state without
  changing the Deck-facing DTO shape
- **AND** it SHALL avoid direct Gateway calls.

#### Scenario: Operator creates, edits, and deletes rules

- **WHEN** the operator uses create, edit/toggle, or delete actions
- **THEN** the UI SHALL call the existing Alerts frontend API facade and Deck
  BFF routes
- **AND** it SHALL show running, success, error, or unsupported feedback without
  fabricating unavailable evaluator/test-fire/audit behavior.

### Requirement: Alerts contract chain remains BFF-only

Alerts browser code SHALL call only the Deck BFF/API facade and SHALL NOT call
the OpenClaw Gateway, alert localstore, or workspace filesystem directly.

#### Scenario: Alerts data and actions are loaded

- **WHEN** the panel loads alert rules, creates rules, patches rules, toggles
  rules, or deletes rules
- **THEN** the browser SHALL use `frontend-new/src/api.ts` wrappers and Deck BFF
  routes
- **AND** real E2E SHALL record any direct browser Gateway HTTP request or
  websocket attempt as a failure.

### Requirement: Alerts unsupported projections are explicit

Prototype-only or future Alerts projections SHALL be labelled instead of
silently claimed as real Gateway-backed features.

#### Scenario: Prototype assumes unsupported or deferred behavior

- **WHEN** alert evaluator semantics, condition DSL autocomplete, real test-fire,
  durable fired history, durable audit history, or per-rule webhook target
  binding are unavailable from current Deck-facing contracts
- **THEN** the UI, tests, implementation notes, or accepted-exception ledger
  SHALL record them as local-only, unsupported, degraded, skipped-safe, or
  follow-up contracts
- **AND** archive SHALL NOT claim those projections as real Gateway-backed
  product capabilities.

### Requirement: Alerts mock evidence covers rule-management prototype states

Alerts mock visual and unit evidence SHALL exercise the prototype-shaped product
flow with contract-shaped fixture data.

#### Scenario: Mock Alerts evidence is claimed

- **WHEN** the child proposal records mock evidence
- **THEN** tests SHALL cover list/detail loading, search, action/entity/enabled
  filters, overview/conditions/fires/audit tabs, create/edit form, delete
  confirmation, test-preview fallback, localized copy, and empty/error states
- **AND** prototype-vs-current parity artifacts SHALL include a prototype
  screenshot, mock-current screenshot, contact sheet, structured verdict, and
  accepted-exception ledger.

### Requirement: Alerts real E2E verifies safe product flow and variants

Alerts real Gateway evidence SHALL exercise product behavior through the Deck
shell and real BFF chain.

#### Scenario: Real Alerts UI variants are verified

- **WHEN** the real E2E verifies Alerts UI
- **THEN** it SHALL navigate from another shell panel into Alerts with the nav
  or handoff control
- **AND** it SHALL verify all four theme/locale combinations: dark/English,
  dark/Chinese, light/English, and light/Chinese
- **AND** it SHALL interact with search, action/entity/enabled filters, detail
  tabs, create/edit/delete/test-preview dialogs or disabled/skipped-safe
  fallbacks, and safe mutation surfaces where available
- **AND** it SHALL record unexpected console, page, BFF API, direct Gateway
  request, and direct Gateway websocket errors.

#### Scenario: Real Alerts API shape is verified

- **WHEN** the real E2E verifies Alerts API routes
- **THEN** it SHALL verify runtime readiness, `GET /api/alerts`,
  `POST /api/alerts`, `PATCH /api/alerts/{id}`, and
  `DELETE /api/alerts/{id}` for run-scoped rules
- **AND** it SHALL record route payload shapes and any degraded or skipped-safe
  fixture outcome.

### Requirement: Alerts real E2E attempts representative fixture data safely

Alerts real Gateway evidence SHALL attempt representative run-scoped data
creation before accepting empty-state-only evidence.

#### Scenario: Safe Alerts fixture can be created

- **WHEN** the isolated real E2E environment can create a run-scoped alert rule
  through Deck BFF routes
- **THEN** the fixture SHALL include the current run id in rule name and
  condition where practical
- **AND** cleanup SHALL delete only rules that include the current run id and
  SHALL refuse non-run-id cleanup targets.

#### Scenario: Alerts fixture is environment-blocked

- **WHEN** create, patch, delete, or cleanup is blocked by real environment
  constraints after bounded attempts
- **THEN** the real E2E SHALL mark fixture evidence degraded, skipped-safe, or
  handoff-blocked with concrete evidence
- **AND** it SHALL still run safe read/UI evidence and record what fixture
  support is missing.

### Requirement: Alerts deterministic defects are fixed before archive

Deterministic Alerts defects found during remediation SHALL be fixed before this
child proposal archives.

#### Scenario: Alerts remediation finds local drift

- **WHEN** remediation discovers a reproducible UI mismatch, stale fixture,
  localized text gap, API facade mismatch, nullability issue, unsafe cleanup
  guard, or BFF projection bug
- **THEN** the child proposal SHALL fix it with focused verification
- **AND** SHALL NOT hand it off as a real E2E uncertainty.
