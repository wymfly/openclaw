# frontend-agents-prototype-parity-remediation Specification

## Purpose

TBD - created by archiving change deck-go-frontend-agents-prototype-parity-remediation. Update Purpose after archive.

## Requirements

### Requirement: Agents active prototype is pinned before remediation

The agents remediation child proposal SHALL identify the active visual target
before changing production UI.

#### Scenario: Agents prototype files are inspected

- **WHEN** the agents remediation implementation begins
- **THEN** `deck-go/frontend-handoff/modules/agents/prototype.html` SHALL be
  treated as the active visual target because the agents README declares it so
- **AND** other agents prototype files, including `prototype-v2-codex.html`,
  SHALL be treated as historical context unless the handoff README is updated
  with a new active target.

### Requirement: Agents prototype assumptions are reconciled with contract truth

The agents remediation SHALL compare prototype assumptions with the deck-go
contract chain and real Gateway capability before fixing UI.

#### Scenario: Prototype assumes unsupported behavior

- **WHEN** the active agents prototype assumes data, actions, or interaction
  semantics unsupported by Gateway/deck-go contract truth
- **THEN** production SHALL follow the supported contract behavior
- **AND** the difference SHALL be recorded as a source-linked accepted exception
  or handoff note.

### Requirement: Agents strict mock prototype parity evidence is produced

The agents remediation SHALL produce strict mock prototype parity evidence under
the shared remediation gate.

#### Scenario: Agents visual parity is claimed

- **WHEN** this change marks agents visually aligned
- **THEN** evidence SHALL include an agents prototype screenshot, agents
  mock-current screenshot, side-by-side comparison artifact, structured verdict,
  and accepted-exception ledger if differences remain
- **AND** a passing agents mock visual Playwright spec alone SHALL NOT be
  sufficient.

### Requirement: Agents deterministic defects are fixed before archive

Deterministic agents defects found during remediation SHALL be fixed in this
child proposal before archive.

#### Scenario: Scoped defect is discovered

- **WHEN** remediation discovers a reproducible agents UI, mock fixture, API
  facade, contract, Go adapter, or nullable DTO defect
- **THEN** the proposal SHALL fix the defect and run focused verification
- **AND** the defect SHALL NOT be handed off as a real Gateway uncertainty.

### Requirement: Agents real Gateway evidence is bounded

Agents real Gateway evidence SHALL be attempted for safe workflows and bounded
by an explicit circuit breaker.

#### Scenario: Unsafe mutation isolation is unavailable

- **WHEN** create, update, delete, or save evidence would mutate user
  configuration without disposable or reversible state
- **THEN** the mutation scenario SHALL be recorded as handoff-blocked
- **AND** read-only and non-destructive agents workflows SHALL still be
  verified or circuit-broken with command and failure evidence.
