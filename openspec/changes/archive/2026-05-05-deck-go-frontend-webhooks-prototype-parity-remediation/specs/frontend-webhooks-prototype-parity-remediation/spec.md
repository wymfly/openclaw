# frontend-webhooks-prototype-parity-remediation Specification

## ADDED Requirements

### Requirement: Webhooks production UI matches the active receiver workbench flow

The Webhooks production panel SHALL use the active handoff prototype as the
visual and interaction reference while preserving current deck-go contract
truth.

#### Scenario: Operator opens Webhooks workbench

- **WHEN** the operator navigates to Webhooks
- **THEN** the first viewport SHALL show the Webhooks brand, KPI strip,
  receiver inventory, filters/search, selected receiver detail or empty
  selection, and guarded create/test/delete actions
- **AND** the workbench SHALL use the active handoff prototype as the visual
  target unless an accepted exception is recorded.

#### Scenario: Operator interacts with Webhooks child surfaces

- **WHEN** the operator filters/selects receivers, opens the builder, edits
  subscriptions, tests delivery, expands delivery evidence, or opens guarded
  delete confirmation
- **THEN** the UI SHALL update through Deck-facing DTOs and BFF wrappers
- **AND** it SHALL avoid direct Gateway or localstore browser calls.

### Requirement: Webhooks contract chain remains BFF-only

Webhooks browser code SHALL call only the Deck BFF/API facade and SHALL NOT call
OpenClaw Gateway or localstore directly.

#### Scenario: Webhooks data or mutations are performed

- **WHEN** the panel lists receivers, creates/updates/deletes a receiver, sends
  a test delivery, or reads delivery history
- **THEN** the browser SHALL use `frontend-new/src/api.ts` and relative
  `/api/webhooks*` routes
- **AND** real E2E SHALL record any direct browser Gateway HTTP request or
  websocket attempt as a failure.

### Requirement: Webhooks unsupported prototype actions remain honest

Webhooks production and evidence SHALL NOT claim unsupported prototype actions
or projections as contract-backed features.

#### Scenario: Prototype-only operation is encountered

- **WHEN** the prototype includes retry mutation, global stats, backend event
  catalog, audit timeline, live delivery push, or platform-event dispatch that
  lacks a verified Deck contract
- **THEN** the implementation notes, tests, or accepted-exception ledger SHALL
  record the behavior as unsupported, skipped-safe, or deferred
- **AND** production UI SHALL not silently wire fake successful behavior.

### Requirement: Webhooks mock evidence covers prototype-shaped receivers

Webhooks mock visual and unit evidence SHALL exercise the product flow with
contract-shaped fixture data.

#### Scenario: Mock Webhooks evidence is claimed

- **WHEN** the child proposal records mock evidence
- **THEN** tests SHALL cover inventory, filters/search, selection, detail tabs,
  builder validation, create/edit/delete, test delivery, delivery expansion,
  redacted secrets, localized copy, and empty/error states
- **AND** prototype-vs-current parity artifacts SHALL include a prototype
  screenshot, mock-current screenshot, contact sheet, structured verdict, and
  accepted-exception ledger.

### Requirement: Webhooks real E2E verifies run-scoped product flow and variants

Webhooks real BFF evidence SHALL exercise product behavior through the Deck
shell and real BFF/localstore chain.

#### Scenario: Real Webhooks UI variants are verified

- **WHEN** the real E2E verifies Webhooks UI
- **THEN** it SHALL navigate from another shell panel into Webhooks with the nav
  or handoff control
- **AND** it SHALL verify all four theme/locale combinations: dark/English,
  dark/Chinese, light/English, and light/Chinese
- **AND** it SHALL interact with selected-webhook or empty fallback, builder,
  guarded delete confirmation, delivery tabs, and filters
- **AND** it SHALL record unexpected console, page, BFF API, direct Gateway
  request, and direct Gateway websocket errors.

#### Scenario: Real Webhooks API shape is verified

- **WHEN** the real E2E verifies Webhooks API routes
- **THEN** it SHALL verify runtime readiness, list, create, patch, test
  delivery, deliveries, not-found/delete, and cleanup using run-scoped fixtures
- **AND** it SHALL record retry, stats, event catalog, audit, live-push, and
  platform-event-dispatch attempts as skipped-safe when no verified contract
  exists.

### Requirement: Webhooks deterministic defects are fixed before archive

Deterministic Webhooks defects found during remediation SHALL be fixed before
this child proposal archives.

#### Scenario: Webhooks remediation finds local drift

- **WHEN** remediation discovers a reproducible UI mismatch, stale fixture,
  localized text gap, API facade mismatch, direct Gateway/localstore browser
  call, or BFF route-shape bug
- **THEN** the child proposal SHALL fix it with focused verification
- **AND** SHALL NOT hand it off as a real E2E uncertainty.
