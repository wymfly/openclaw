# frontend-budget-prototype-parity-remediation Specification

## Purpose

TBD - created by archiving change deck-go-frontend-budget-prototype-parity-remediation. Update Purpose after archive.

## Requirements

### Requirement: Budget production UI matches the active v2 rule flow

The Budget production panel SHALL use the active handoff prototype product flow
as its visual and interaction target while preserving current deck-go contract
truth.

#### Scenario: Operator opens Budget workbench

- **WHEN** the operator navigates to Budget
- **THEN** the first viewport SHALL show a budget-rule workbench with KPI
  metrics, search, status filters, rule list, selected rule detail, threshold
  summary or meter, create/edit/toggle/delete affordances, and clear
  loading/empty/error states
- **AND** the workbench SHALL use the active v2 handoff prototype as the visual
  target unless an accepted exception is recorded.

#### Scenario: Operator filters and inspects rules

- **WHEN** rules exist and the operator searches, changes status filters,
  selects a rule, reviews threshold/definition details, toggles enabled state,
  opens create/edit/delete flows, or cancels dialogs
- **THEN** the UI SHALL update local selection/filter/form/dialog state without
  changing the Deck-facing DTO shape
- **AND** it SHALL avoid direct Gateway calls.

#### Scenario: Operator creates, edits, toggles, and deletes rules

- **WHEN** the operator uses create, edit/toggle, or delete actions
- **THEN** the UI SHALL call the existing Budget frontend API facade and Deck
  BFF routes
- **AND** it SHALL show running, success, error, validation, or unsupported
  feedback without fabricating unavailable forecast/history/audit behavior.

### Requirement: Budget contract chain remains BFF-only

Budget browser code SHALL call only the Deck BFF/API facade and SHALL NOT call
the OpenClaw Gateway, localstore, or workspace filesystem directly.

#### Scenario: Budget data and actions are loaded

- **WHEN** the panel loads budget rules, evaluates rules, creates rules, patches
  rules, toggles rules, or deletes rules
- **THEN** the browser SHALL use `frontend-new/src/api.ts` wrappers and Deck BFF
  routes
- **AND** real E2E SHALL record any direct browser Gateway HTTP request or
  websocket attempt as a failure.

### Requirement: Budget unsupported projections are explicit

Prototype-only or future Budget projections SHALL be labelled instead of
silently claimed as real Gateway-backed features.

#### Scenario: Prototype assumes unsupported or deferred behavior

- **WHEN** durable recent changes, forecast/projection, per-rule history
  charts, org/workspace/channel target fields, unsupported period values, or
  budget-to-alert notification binding are unavailable from current Deck-facing
  contracts
- **THEN** the UI, tests, implementation notes, or accepted-exception ledger
  SHALL record them as local-only, unsupported, degraded, skipped-safe, or
  follow-up contracts
- **AND** archive SHALL NOT claim those projections as real Gateway-backed
  product capabilities.

### Requirement: Budget mock evidence covers rule-management prototype states

Budget mock visual and unit evidence SHALL exercise the prototype-shaped product
flow with contract-shaped fixture data.

#### Scenario: Mock Budget evidence is claimed

- **WHEN** the child proposal records mock evidence
- **THEN** tests SHALL cover list/detail loading, search, status filters,
  threshold summary or meter, create/edit/toggle/delete flows, validation,
  localized copy, and empty/error states
- **AND** prototype-vs-current parity artifacts SHALL include a prototype
  screenshot, mock-current screenshot, contact sheet, structured verdict, and
  accepted-exception ledger.

### Requirement: Budget real E2E verifies safe product flow and variants

Budget real Gateway evidence SHALL exercise product behavior through the Deck
shell and real BFF chain.

#### Scenario: Real Budget UI variants are verified

- **WHEN** the real E2E verifies Budget UI
- **THEN** it SHALL navigate from another shell panel into Budget with the nav
  or handoff control
- **AND** it SHALL verify all four theme/locale combinations: dark/English,
  dark/Chinese, light/English, and light/Chinese
- **AND** it SHALL interact with search, status filters, selected detail,
  threshold summary, create/edit/toggle/delete/validation flows or
  disabled/skipped-safe fallbacks, and safe mutation surfaces where available
- **AND** it SHALL record unexpected console, page, BFF API, direct Gateway
  request, and direct Gateway websocket errors.

#### Scenario: Real Budget API shape is verified

- **WHEN** the real E2E verifies Budget API routes
- **THEN** it SHALL verify runtime readiness, `GET /api/usage/budget`,
  `GET /api/usage/budget/evaluate`, `POST /api/usage/budget`,
  `PATCH /api/usage/budget/{id}`, and `DELETE /api/usage/budget/{id}` for
  run-scoped rules
- **AND** it SHALL record route payload shapes and any degraded or skipped-safe
  fixture outcome.

### Requirement: Budget real E2E attempts representative fixture data safely

Budget real Gateway evidence SHALL attempt representative run-scoped data
creation before accepting empty-state-only evidence.

#### Scenario: Safe Budget fixture can be created

- **WHEN** the isolated real E2E environment can create a run-scoped budget rule
  through Deck BFF routes
- **THEN** the fixture SHALL include the current run id in rule name and target
  fields where practical
- **AND** cleanup SHALL delete only rules that include the current run id and
  SHALL refuse non-run-id cleanup targets.

#### Scenario: Budget fixture is environment-blocked

- **WHEN** create, patch, evaluate, delete, or cleanup is blocked by real
  environment constraints after bounded attempts
- **THEN** the real E2E SHALL mark fixture evidence degraded, skipped-safe, or
  handoff-blocked with concrete evidence
- **AND** it SHALL still run safe read/UI evidence and record what fixture
  support is missing.

### Requirement: Budget deterministic defects are fixed before archive

Deterministic Budget defects found during remediation SHALL be fixed before this
child proposal archives.

#### Scenario: Budget remediation finds local drift

- **WHEN** remediation discovers a reproducible UI mismatch, stale fixture,
  localized text gap, API facade mismatch, nullability issue, unsafe cleanup
  guard, evaluation-shape bug, or BFF projection bug
- **THEN** the child proposal SHALL fix it with focused verification
- **AND** SHALL NOT hand it off as a real E2E uncertainty.
