## ADDED Requirements

### Requirement: Docs production UI matches the active v2 reader flow

The Docs production panel SHALL use the active handoff prototype product flow as
its visual and interaction target while preserving current deck-go contract
truth.

#### Scenario: Operator opens Docs reader

- **WHEN** the operator navigates to Docs
- **THEN** the first viewport SHALL show a document workbench with topbar
  search/extract controls, category tree, selected document reader, provenance,
  keywords, outline, and related-doc surfaces or clear loading/empty/error
  states
- **AND** the workbench SHALL use the active v2 handoff prototype as the visual
  target unless an accepted exception is recorded.

#### Scenario: Operator searches and browses docs

- **WHEN** docs exist and the operator searches, selects a result, filters by a
  keyword, selects a related doc, or toggles category groups
- **THEN** the UI SHALL update local selection/filter state without changing the
  Deck-facing DTO shape
- **AND** it SHALL preserve URL hash selection and avoid direct Gateway calls.

#### Scenario: Operator extracts docs from an active session

- **WHEN** an active session key exists
- **THEN** the Extract control SHALL call `POST /api/docs/extract` through the
  frontend API facade and show running, success, or error feedback
- **AND** it SHALL refresh the docs list and select a newly extracted doc when
  the BFF returns one.

#### Scenario: Operator deletes a doc

- **WHEN** the operator clicks Delete
- **THEN** the UI SHALL require confirmation before calling `DELETE /api/docs/{id}`
- **AND** it SHALL treat a 404 delete response as already-missing success via
  the API wrapper and refresh the list.

### Requirement: Docs contract chain remains BFF-only

Docs browser code SHALL call only the Deck BFF/API facade and SHALL NOT call the
OpenClaw Gateway, docs store, or workspace filesystem directly.

#### Scenario: Docs data and actions are loaded

- **WHEN** the panel loads list/detail data, extracts docs, or deletes a doc
- **THEN** the browser SHALL use `frontend-new/src/api.ts` wrappers and Deck BFF
  routes
- **AND** real E2E SHALL record any direct browser Gateway HTTP request or
  websocket attempt as a failure.

### Requirement: Docs unsupported projections are explicit

Prototype-only or future Docs projections SHALL be labelled instead of silently
claimed as real Gateway-backed features.

#### Scenario: Prototype assumes unsupported or deferred behavior

- **WHEN** server-side search/indexing, inline editing, soft archive/bin, durable
  audit feed, internal markdown routing, version history, or richer markdown
  highlighting are unavailable from current Deck-facing contracts
- **THEN** the UI, tests, implementation notes, or accepted-exception ledger
  SHALL record them as local-only, unsupported, degraded, skipped-safe, or
  follow-up contracts
- **AND** archive SHALL NOT claim those projections as real Gateway-backed
  product capabilities.

### Requirement: Docs mock evidence covers reader prototype states

Docs mock visual and unit evidence SHALL exercise the prototype-shaped product
flow with contract-shaped fixture data.

#### Scenario: Mock Docs evidence is claimed

- **WHEN** the child proposal records mock evidence
- **THEN** tests SHALL cover list/detail loading, search overlay, keyword
  filtering, category navigation, related docs, outline, source navigation
  affordances, extract popover, delete confirmation, localized copy, and
  empty/error states
- **AND** prototype-vs-current parity artifacts SHALL include a prototype
  screenshot, mock-current screenshot, contact sheet, structured verdict, and
  accepted-exception ledger.

### Requirement: Docs real E2E verifies safe product flow and variants

Docs real Gateway evidence SHALL exercise product behavior through the Deck
shell and real BFF/Gateway chain.

#### Scenario: Real Docs UI variants are verified

- **WHEN** the real E2E verifies Docs UI
- **THEN** it SHALL navigate from another shell panel into Docs with the nav or
  handoff control
- **AND** it SHALL verify both theme axes and both locale axes, using all four
  combinations when the child identifies locale/density risk
- **AND** it SHALL interact with category navigation, search, keyword filtering,
  extract popover or disabled fallback, delete confirmation or skipped-safe
  fallback, outline/related/source affordances where available
- **AND** it SHALL record unexpected console, page, BFF API, direct Gateway
  request, and direct Gateway websocket errors.

#### Scenario: Real Docs API shape is verified

- **WHEN** the real E2E verifies Docs API routes
- **THEN** it SHALL verify runtime readiness, `GET /api/docs`,
  `GET /api/docs/{id}` or documented 404 fallback, `POST /api/docs/extract`,
  and bounded `DELETE /api/docs/{id}` only for run-scoped docs
- **AND** it SHALL record route payload shapes and any degraded/empty-valid
  fixture outcome.

### Requirement: Docs real E2E attempts representative fixture data safely

Docs real Gateway evidence SHALL attempt representative run-scoped data creation
before accepting empty-state-only evidence.

#### Scenario: Safe Docs fixture can be created

- **WHEN** the isolated real E2E environment can create a run-scoped chat session
  and extract docs through Deck BFF routes
- **THEN** the fixture SHALL include the current run id in session label, prompt,
  and extracted doc content/title/provenance
- **AND** cleanup SHALL delete only docs that include the current run id and
  SHALL refuse non-run-id cleanup targets.

#### Scenario: Docs fixture is empty or environment-blocked

- **WHEN** chat seed, history fetch, extraction, or cleanup is blocked by real
  environment constraints after bounded attempts
- **THEN** the real E2E SHALL mark fixture evidence degraded, empty-valid,
  skipped-safe, or handoff-blocked with concrete evidence
- **AND** it SHALL still run safe read/UI evidence and record what fixture
  support is missing.

### Requirement: Docs deterministic defects are fixed before archive

Deterministic Docs defects found during remediation SHALL be fixed before this
child proposal archives.

#### Scenario: Docs remediation finds local drift

- **WHEN** remediation discovers a reproducible UI mismatch, stale fixture,
  localized text gap, API facade mismatch, nullability issue, unsafe cleanup
  guard, or BFF projection bug
- **THEN** the child proposal SHALL fix it with focused verification
- **AND** SHALL NOT hand it off as a real E2E uncertainty.
