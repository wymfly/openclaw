# frontend-api-explorer-prototype-parity-remediation Specification

## Purpose

Tracks the API Explorer module's strict prototype parity remediation, contract-truth
reconciliation, and bounded real Gateway evidence requirements.

## Requirements

### Requirement: API Explorer active prototype is pinned before remediation

The API Explorer remediation SHALL identify the active visual target before
changing production UI.

#### Scenario: API Explorer prototype files are inspected

- **WHEN** API Explorer remediation begins
- **THEN** `deck-go/frontend-handoff/modules/api-explorer/prototype.html` SHALL
  be treated as the active visual target
- **AND** older files such as `prototype-v1-codex.html` SHALL be treated as
  historical context unless the handoff README declares them active.

### Requirement: API Explorer contract truth comes from Gateway describe and BFF invoke contracts

The API Explorer remediation SHALL reconcile prototype assumptions with the
actual Gateway describe/invoke contract chain.

#### Scenario: Prototype catalog differs from Gateway describe truth

- **WHEN** prototype sample methods, schemas, scopes, or response examples differ
  from `fetchGatewayDescribe()` or generated contract truth
- **THEN** production SHALL follow the Gateway/deck-go contract chain
- **AND** the difference SHALL be recorded as an accepted exception or handoff
  note.

### Requirement: API Explorer strict mock prototype parity evidence is produced

The API Explorer remediation SHALL produce strict mock prototype parity evidence
under the shared remediation gate.

#### Scenario: API Explorer visual parity is claimed

- **WHEN** this change marks API Explorer visually aligned
- **THEN** evidence SHALL include prototype screenshot, mock-current screenshot,
  side-by-side comparison artifact, structured verdict, and accepted-exception
  ledger if differences remain
- **AND** a passing mock visual Playwright spec alone SHALL NOT be sufficient.

### Requirement: API Explorer deterministic defects are fixed before archive

Deterministic API Explorer defects found during remediation SHALL be fixed in
this child proposal before archive.

#### Scenario: Scoped defect is discovered

- **WHEN** remediation discovers a reproducible API Explorer UI, mock fixture,
  API facade, contract, Go adapter, or DTO defect
- **THEN** the proposal SHALL fix the defect and run focused verification
- **AND** the defect SHALL NOT be handed off as a real Gateway uncertainty.

### Requirement: API Explorer real Gateway evidence is bounded and safe

API Explorer real Gateway evidence SHALL be attempted only for safe describe and
read-only invocation workflows.

#### Scenario: Safe invocation cannot be established

- **WHEN** no read-only invocation can be safely selected or the real stack is
  blocked
- **THEN** the scenario SHALL be recorded as handoff-blocked with command,
  attempt count, observed failure, and next action
- **AND** mock functional and mock prototype parity evidence SHALL still be
  completed.
