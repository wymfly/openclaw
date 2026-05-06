## ADDED Requirements

### Requirement: Design-system pattern extraction SHALL be gate-based

Deck Go SHALL close design-system pattern extraction work by auditing current
reuse evidence and promoting only shapes that satisfy the existing pattern
promotion gate.

#### Scenario: A candidate lacks reuse evidence

- **WHEN** a candidate pattern has fewer than two module call sites or lacks a
  reuse-analysis proposal
- **THEN** it SHALL remain panel-local or parked in handoff documentation
- **AND** the matrix SHALL record that no speculative extraction was performed

#### Scenario: Existing canonical patterns remain sufficient

- **WHEN** existing canonical patterns cover the stable cross-module shell needs
- **THEN** the change SHALL preserve those patterns and tests without adding new
  abstractions

### Requirement: Pattern contract documentation SHALL not keep placeholder truth

Deck Go SHALL keep the archived `design-system-patterns` spec purpose accurate
enough for future agents to understand the contract without relying on history.

#### Scenario: A spec purpose is placeholder text

- **WHEN** a durable OpenSpec pattern spec still says its purpose is TBD
- **THEN** the purpose SHALL be replaced with the real pattern-layer contract
  purpose

### Requirement: Deferred design-system matrix item SHALL be closed with evidence

Deck Go SHALL update the head contract-chain matrix and verification evidence
when the design-system extraction audit is complete.

#### Scenario: Child proposal is archived

- **WHEN** this child proposal passes validation and is archived
- **THEN** the proposal matrix item SHALL be marked archived
- **AND** the decision index SHALL state that no new extraction was promoted
  because the reuse-analysis gate was not satisfied
