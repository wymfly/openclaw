## ADDED Requirements

### Requirement: Cron production UI matches the active scheduler workbench flow

The Cron production panel SHALL use the active handoff prototype as the visual
and interaction reference while preserving current deck-go contract truth.

#### Scenario: Operator opens Cron workbench

- **WHEN** the operator navigates to Cron
- **THEN** the first viewport SHALL show scheduler status, job inventory,
  search/filter/sort affordances, selected-job summary, safe mutation actions,
  and detail tabs for schedule, history, payload, or scheduler data where
  available
- **AND** the workbench SHALL use the active handoff prototype as the visual
  target unless an accepted exception is recorded.

#### Scenario: Operator interacts with Cron child surfaces

- **WHEN** the operator selects a job, changes filters, switches detail tabs,
  opens create/edit builder state, opens delete confirmation, views run
  history, or inspects scheduler status
- **THEN** the UI SHALL update local state without changing the Deck-facing DTO
  shape
- **AND** it SHALL avoid direct Gateway calls.

#### Scenario: Operator mutates a Cron job

- **WHEN** the operator creates, updates, enables, disables, runs, or deletes a
  job
- **THEN** the UI SHALL call the existing Cron frontend API facade and Deck BFF
  routes
- **AND** destructive or execution-triggering mutations SHALL be exercised in
  real E2E only for run-scoped disposable jobs or recorded as skipped-safe.

### Requirement: Cron contract chain remains BFF-only

Cron browser code SHALL call only the Deck BFF/API facade and SHALL NOT call the
OpenClaw Gateway, localstore, or workspace filesystem directly.

#### Scenario: Cron data and actions are loaded

- **WHEN** the panel loads jobs, status, runs, create/update/run/delete actions,
  or list-query state
- **THEN** the browser SHALL use `frontend-new/src/api.ts` and Deck BFF routes
- **AND** real E2E SHALL record any direct browser Gateway HTTP request or
  websocket attempt as a failure.

### Requirement: Cron unsupported projections are explicit

Prototype-only, environment-only, or future Cron projections SHALL be labelled
instead of silently claimed as real Gateway-backed features.

#### Scenario: Prototype assumes unsupported or unsafe behavior

- **WHEN** next-fire preview, durable run history, queue depth, retry policy,
  audit feed, notification binding, bulk operations, or run-now execution is
  unavailable or unsafe from current Deck-facing contracts
- **THEN** the UI, tests, implementation notes, or accepted-exception ledger
  SHALL record them as local-only, unsupported, degraded, skipped-safe, or
  follow-up contracts
- **AND** archive SHALL NOT claim those projections as fully verified
  Gateway-backed product capabilities.

### Requirement: Cron mock evidence covers scheduler prototype states

Cron mock visual and unit evidence SHALL exercise the prototype-shaped product
flow with contract-shaped fixture data.

#### Scenario: Mock Cron evidence is claimed

- **WHEN** the child proposal records mock evidence
- **THEN** tests SHALL cover job list/detail loading, scheduler status,
  search/filter/sort, create/edit builder state, enable/disable affordance,
  run-now affordance, delete confirmation, history/payload/scheduler tabs,
  localized copy, and empty/error states
- **AND** prototype-vs-current parity artifacts SHALL include a prototype
  screenshot, mock-current screenshot, contact sheet, structured verdict, and
  accepted-exception ledger.

### Requirement: Cron real E2E verifies safe product flow and variants

Cron real Gateway evidence SHALL exercise product behavior through the Deck
shell and real BFF/Gateway chain.

#### Scenario: Real Cron UI variants are verified

- **WHEN** the real E2E verifies Cron UI
- **THEN** it SHALL navigate from another shell panel into Cron with the nav or
  handoff control
- **AND** it SHALL verify all four theme/locale combinations: dark/English,
  dark/Chinese, light/English, and light/Chinese
- **AND** it SHALL interact with search/filter/sort, selected-job detail,
  history/payload/scheduler tabs, create/edit builder, delete confirmation,
  and skipped-safe run-now or disabled fallback where available
- **AND** it SHALL record unexpected console, page, BFF API, direct Gateway
  request, and direct Gateway websocket errors.

#### Scenario: Real Cron API shape is verified

- **WHEN** the real E2E verifies Cron API routes
- **THEN** it SHALL verify runtime readiness, job list, scheduler status, run
  history route, create/update/delete route shape where safe, and skipped-safe
  run-now policy
- **AND** it SHALL record route payload shapes and any degraded or skipped-safe
  fixture outcome.

### Requirement: Cron real E2E attempts representative fixture data safely

Cron real Gateway evidence SHALL attempt representative run-scoped data
creation before accepting empty-state-only evidence.

#### Scenario: Safe Cron fixture can be created

- **WHEN** the isolated real E2E environment can create a disabled or far-future
  run-scoped Cron job through Deck BFF routes
- **THEN** the fixture SHALL include the current run id in its name,
  description, payload, or metadata where practical
- **AND** cleanup SHALL delete only jobs that include the current run id and
  SHALL refuse non-run-id cleanup targets.

#### Scenario: Cron fixture is environment-blocked

- **WHEN** create, update, delete, or cleanup is blocked by real environment
  constraints after bounded attempts
- **THEN** the real E2E SHALL mark fixture evidence degraded, skipped-safe, or
  handoff-blocked with concrete evidence
- **AND** it SHALL still run safe read/UI evidence and record what fixture
  support is missing.

### Requirement: Cron deterministic defects are fixed before archive

Deterministic Cron defects found during remediation SHALL be fixed before this
child proposal archives.

#### Scenario: Cron remediation finds local drift

- **WHEN** remediation discovers a reproducible UI mismatch, stale fixture,
  localized text gap, API facade mismatch, nullability issue, unsafe cleanup
  guard, mutation-evidence mismatch, or BFF route-shape bug
- **THEN** the child proposal SHALL fix it with focused verification
- **AND** SHALL NOT hand it off as a real E2E uncertainty.
