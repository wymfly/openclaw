# frontend-logs-prototype-parity-remediation Specification

## Purpose

Records the completed Logs prototype-parity remediation contract: active
prototype selection, typed logs contract truth, mock prototype parity evidence,
deterministic-fix ownership, bounded real Gateway validation, and BFF-only
browser transport.

## Requirements

### Requirement: Logs active prototype is pinned before remediation

The logs remediation SHALL identify the active visual target before changing or
validating production UI.

#### Scenario: Logs prototype files are inspected

- **WHEN** logs remediation begins
- **THEN** `deck-go/frontend-handoff/modules/logs/prototype.html` SHALL be
  treated as the active visual target
- **AND** older files such as `prototype-v1-codex.html` SHALL be treated as
  historical context unless the handoff README declares them active.

### Requirement: Logs contract truth controls production behavior

The logs remediation SHALL reconcile prototype assumptions with the actual Deck
logs DTOs, BFF routes, stream payloads, and generated Gateway protocol truth.

#### Scenario: Prototype line fields or stream assumptions differ from contract truth

- **WHEN** prototype data uses normalized fields, stream summaries, filters, or
  export affordances that exceed the current logs contract chain
- **THEN** production SHALL follow the current Deck/Gateway contract chain,
  including typed `logs.tail` string rows and dynamic stream event payload leaves
- **AND** unsupported or dynamic behavior SHALL be documented as an accepted
  exception or follow-up contract decision.

### Requirement: Logs strict mock prototype parity evidence is produced

The logs remediation SHALL produce strict mock prototype parity evidence under
the shared remediation gate.

#### Scenario: Logs visual parity is claimed

- **WHEN** this change marks logs visually aligned
- **THEN** evidence SHALL include prototype screenshot, mock-current screenshot,
  side-by-side comparison artifact, structured verdict, and
  accepted-exception ledger if differences remain
- **AND** a passing mock visual Playwright spec alone SHALL NOT be sufficient.

### Requirement: Logs deterministic defects are fixed before archive

Deterministic logs defects found during remediation SHALL be fixed in this child
proposal before archive.

#### Scenario: Scoped defect is discovered

- **WHEN** remediation discovers a reproducible logs UI, parser, fixture, stream,
  API facade, contract, Go adapter, DTO, or handoff-doc defect
- **THEN** the proposal SHALL fix the defect and run focused verification
- **AND** the defect SHALL NOT be handed off as real Gateway uncertainty.

### Requirement: Logs real Gateway evidence is read-only and bounded

Logs real Gateway evidence SHALL use safe read and stream operations without
fabricating real rows.

#### Scenario: Safe observable activity can be triggered

- **WHEN** Logs real Gateway E2E starts
- **THEN** the test SHALL trigger safe Deck/Gateway activity such as BFF runtime,
  module, or log-tail requests before judging real data availability
- **AND** any created identifier SHALL be scoped to the current test run when
  the operation supports run-scoped state
- **AND** the test SHALL NOT insert synthetic rows into the UI or mutate
  non-isolated user/global state just to populate Logs.

#### Scenario: Real log data is empty or stream is quiet

- **WHEN** `/api/logs` returns no lines or `/api/logs/stream` does not emit a
  batch within the bounded wait
- **THEN** the UI evidence SHALL verify valid empty/quiet-state rendering
- **AND** the result SHALL be recorded as `empty-valid`, `degraded`, or
  `handoff-blocked` with concrete command/output evidence.

### Requirement: Logs real E2E covers shell navigation, variants, and child interactions

Logs real Gateway evidence SHALL exercise the user-facing product surface, not
only API probes.

#### Scenario: Logs real E2E is claimed

- **WHEN** this change records real Gateway evidence for Logs
- **THEN** the evidence SHALL start from the Deck shell and navigate to the Logs
  module through the product navigation
- **AND** the evidence SHALL cover both light and dark themes
- **AND** the evidence SHALL cover both English and Chinese locale rendering
- **AND** the evidence SHALL interact with safe child surfaces such as filters,
  row selection or empty-state behavior, details/raw payload rendering,
  pause/resume, clear-local, and export preview when data exists.

### Requirement: Logs browser transport remains BFF-only

The logs remediation SHALL verify browser code does not call Gateway directly.

#### Scenario: Logs UI is exercised against the real stack

- **WHEN** the Logs panel is opened in real Gateway E2E
- **THEN** browser HTTP and WebSocket traffic SHALL target the Deck BFF rather
  than the Gateway URL directly
- **AND** unexpected browser API errors SHALL be recorded and fixed when they are
  deterministic logs-owned defects.
