## ADDED Requirements

### Requirement: Chat production UI matches the active workbench flow

The Chat production panel SHALL use the active handoff prototype as the visual
and interaction reference while preserving current deck-go contract truth.

#### Scenario: Operator opens Chat workbench

- **WHEN** the operator navigates to Chat
- **THEN** the first viewport SHALL show a chat workbench with session sidebar,
  active agent context, transcript, composer, status/connection affordances, and
  right-drawer or artifact/canvas affordances when available
- **AND** the workbench SHALL use the active handoff prototype as the visual
  target unless an accepted exception is recorded.

#### Scenario: Operator interacts with Chat child surfaces

- **WHEN** the operator searches transcripts, changes block filters, opens
  composer menus, uses keyboard traversal, toggles the right drawer, opens an
  artifact, opens canvas, or handles a pending approval in a safe fixture
- **THEN** the UI SHALL update local state without changing the Deck-facing DTO
  shape
- **AND** it SHALL avoid direct Gateway calls.

#### Scenario: Operator creates or mutates a session

- **WHEN** the operator creates, sends to, steers, aborts, patches, clears,
  resets, compacts, or deletes a session
- **THEN** the UI SHALL call the existing Chat frontend API facade and Deck BFF
  routes
- **AND** destructive mutations SHALL be exercised in real E2E only for
  run-scoped sessions.

### Requirement: Chat contract chain remains BFF-only

Chat browser code SHALL call only the Deck BFF/API facade and SHALL NOT call the
OpenClaw Gateway, localstore, or workspace filesystem directly.

#### Scenario: Chat data and actions are loaded

- **WHEN** the panel loads sessions, snapshots, history, command discovery,
  media, canvas, compaction, approval, streaming, or send/steer/abort actions
- **THEN** the browser SHALL use `frontend-new/src/api.ts`,
  `frontend-new/src/components/panels/chat/chat-api.ts`, and Deck BFF routes
- **AND** real E2E SHALL record any direct browser Gateway HTTP request or
  websocket attempt as a failure.

### Requirement: Chat unsupported projections are explicit

Prototype-only, environment-only, or future Chat projections SHALL be labelled
instead of silently claimed as real Gateway-backed features.

#### Scenario: Prototype assumes unsupported or unsafe behavior

- **WHEN** approval expiration, always-approve side effects, full SSE replay,
  durable a2ui/canvas shape typing, artifact projection, or real model response
  completion is unavailable or unsafe from current Deck-facing contracts
- **THEN** the UI, tests, implementation notes, or accepted-exception ledger
  SHALL record them as local-only, unsupported, degraded, skipped-safe, or
  follow-up contracts
- **AND** archive SHALL NOT claim those projections as fully verified
  Gateway-backed product capabilities.

### Requirement: Chat mock evidence covers workbench prototype states

Chat mock visual and unit evidence SHALL exercise the prototype-shaped product
flow with contract-shaped fixture data.

#### Scenario: Mock Chat evidence is claimed

- **WHEN** the child proposal records mock evidence
- **THEN** tests SHALL cover rich and empty sessions, session sidebar,
  transcript search, block filters, composer/menu controls, approval prompt,
  artifact panel, canvas panel, keyboard traversal, localized copy, and
  empty/error states
- **AND** prototype-vs-current parity artifacts SHALL include a prototype
  screenshot, mock-current screenshot, contact sheet, structured verdict, and
  accepted-exception ledger.

### Requirement: Chat real E2E verifies safe product flow and variants

Chat real Gateway evidence SHALL exercise product behavior through the Deck
shell and real BFF/Gateway chain.

#### Scenario: Real Chat UI variants are verified

- **WHEN** the real E2E verifies Chat UI
- **THEN** it SHALL navigate from another shell panel into Chat with the nav or
  handoff control
- **AND** it SHALL verify all four theme/locale combinations: dark/English,
  dark/Chinese, light/English, and light/Chinese
- **AND** it SHALL interact with session sidebar, transcript, composer, search,
  block filters, right-drawer/artifact/canvas controls, approval/compaction
  surfaces, or disabled/skipped-safe fallbacks where available
- **AND** it SHALL record unexpected console, page, BFF API, direct Gateway
  request, and direct Gateway websocket errors.

#### Scenario: Real Chat API shape is verified

- **WHEN** the real E2E verifies Chat API routes
- **THEN** it SHALL verify runtime readiness, session list/history/snapshot,
  session create or send, command discovery, stream reachability, and safe
  run-scoped cleanup routes
- **AND** it SHALL record route payload shapes and any degraded or skipped-safe
  fixture outcome.

### Requirement: Chat real E2E attempts representative fixture data safely

Chat real Gateway evidence SHALL attempt representative run-scoped data creation
before accepting empty-state-only evidence.

#### Scenario: Safe Chat fixture can be created

- **WHEN** the isolated real E2E environment can create or send a run-scoped
  Chat session through Deck BFF routes
- **THEN** the fixture SHALL include the current run id in the prompt, session
  title, or metadata where practical
- **AND** cleanup SHALL delete only sessions that include the current run id and
  SHALL refuse non-run-id cleanup targets.

#### Scenario: Chat fixture is environment-blocked

- **WHEN** create, send, stream, history, delete, or cleanup is blocked by real
  environment constraints after bounded attempts
- **THEN** the real E2E SHALL mark fixture evidence degraded, skipped-safe, or
  handoff-blocked with concrete evidence
- **AND** it SHALL still run safe read/UI evidence and record what fixture
  support is missing.

### Requirement: Chat deterministic defects are fixed before archive

Deterministic Chat defects found during remediation SHALL be fixed before this
child proposal archives.

#### Scenario: Chat remediation finds local drift

- **WHEN** remediation discovers a reproducible UI mismatch, stale fixture,
  localized text gap, API facade mismatch, nullability issue, unsafe cleanup
  guard, stream projection bug, or BFF route-shape bug
- **THEN** the child proposal SHALL fix it with focused verification
- **AND** SHALL NOT hand it off as a real E2E uncertainty.
