## ADDED Requirements

### Requirement: Threads production UI matches the active read-only binding registry flow

The Threads production panel SHALL use the active handoff prototype as the
visual and interaction reference while preserving current deck-go contract
truth.

#### Scenario: Operator opens Threads workbench

- **WHEN** the operator navigates to Threads
- **THEN** the first viewport SHALL show the Threads brand, binding inventory,
  filter controls, selected binding detail or empty selection, relation
  metadata, copy/navigation affordances, and raw payload access
- **AND** the workbench SHALL use the active handoff prototype as the visual
  target unless an accepted exception is recorded.

#### Scenario: Operator interacts with Threads child surfaces

- **WHEN** the operator filters/selects bindings, copies a session key, opens a
  cross-panel handoff, or reviews raw payload
- **THEN** the UI SHALL update through Deck-facing DTOs and BFF wrappers
- **AND** it SHALL avoid direct Gateway browser calls.

### Requirement: Threads contract chain remains BFF-only

Threads browser code SHALL call only the Deck BFF/API facade and SHALL NOT call
the OpenClaw Gateway directly.

#### Scenario: Threads data is loaded

- **WHEN** the panel loads list or filtered data
- **THEN** the browser SHALL use `frontend-new/src/api.ts` and
  `GET /api/deck/threads`
- **AND** real E2E SHALL record any direct browser Gateway HTTP request or
  websocket attempt as a failure.

### Requirement: Threads unsupported prototype actions remain honest

Threads production and evidence SHALL NOT claim unsupported prototype actions as
contract-backed features.

#### Scenario: Prototype-only mutation or projection is encountered

- **WHEN** the prototype includes unbind, rebind, rename, activity, audit,
  transcript, or branch behavior that lacks a verified Deck/Gateway contract
- **THEN** the implementation notes, tests, or accepted-exception ledger SHALL
  record the behavior as unsupported, skipped-safe, or deferred
- **AND** the production UI SHALL not silently wire fake successful mutations.

### Requirement: Threads mock evidence covers prototype-shaped rows

Threads mock visual and unit evidence SHALL exercise the read-only product flow
with contract-shaped fixture data.

#### Scenario: Mock Threads evidence is claimed

- **WHEN** the child proposal records mock evidence
- **THEN** tests SHALL cover list, filters, selection, relation detail, copy,
  navigation affordances, localized copy, raw payload, and empty/error states
- **AND** prototype-vs-current parity artifacts SHALL include a prototype
  screenshot, mock-current screenshot, contact sheet, structured verdict, and
  accepted-exception ledger.

### Requirement: Threads real E2E verifies safe product flow and variants

Threads real Gateway evidence SHALL exercise product behavior through the Deck
shell and real BFF/Gateway chain.

#### Scenario: Real Threads UI variants are verified

- **WHEN** the real E2E verifies Threads UI
- **THEN** it SHALL navigate from another shell panel into Threads with the nav
  or handoff control
- **AND** it SHALL verify all four theme/locale combinations: dark/English,
  dark/Chinese, light/English, and light/Chinese
- **AND** it SHALL interact with selected-thread or empty fallback, copy/raw
  detail behavior, and filters
- **AND** it SHALL record unexpected console, page, BFF API, direct Gateway
  request, and direct Gateway websocket errors.

#### Scenario: Real Threads API shape is verified

- **WHEN** the real E2E verifies Threads API routes
- **THEN** it SHALL verify runtime readiness, list, filtered list, and
  empty-valid or row-shape outcomes
- **AND** it SHALL record mutation/activity/audit attempts as skipped-safe when
  no verified contract exists.

### Requirement: Threads deterministic defects are fixed before archive

Deterministic Threads defects found during remediation SHALL be fixed before
this child proposal archives.

#### Scenario: Threads remediation finds local drift

- **WHEN** remediation discovers a reproducible UI mismatch, stale fixture,
  localized text gap, API facade mismatch, direct Gateway browser call, or BFF
  route-shape bug
- **THEN** the child proposal SHALL fix it with focused verification
- **AND** SHALL NOT hand it off as a real E2E uncertainty.
