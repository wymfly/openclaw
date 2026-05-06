## ADDED Requirements

### Requirement: Contract-chain audit matrix

deck-go SHALL maintain an audit matrix that records the contract chain for each audited module capability from source authority through frontend and E2E evidence.

#### Scenario: Capability chain is recorded

- **WHEN** a module capability is included in the audit
- **THEN** the audit SHALL record the capability name, module, source class, Gateway method or Deck source, Go adapter or BFF route, contract source, generated artifact, frontend facade, panel surface, mock E2E evidence, real E2E evidence, and known gap

#### Scenario: Code truth takes precedence

- **WHEN** the audit matrix conflicts with contract source, generated artifacts, backend routes, frontend wrappers, or test evidence
- **THEN** the implementation SHALL treat the code and generated contract chain as authoritative and update the audit rather than preserving stale prose

### Requirement: Capability classification vocabulary

deck-go SHALL classify audited capabilities with a shared vocabulary that separates Gateway support from Deck product value.

#### Scenario: Capability has a primary classification

- **WHEN** an audit row is created
- **THEN** it SHALL use one primary classification from `gateway-backed`, `deck-derived`, `deck-local`, or `unsupported-needs-contract`

#### Scenario: Unsupported product projection is encountered

- **WHEN** a prototype or UI note describes behavior without sufficient Gateway, Deck BFF, or Deck-local contract authority
- **THEN** the audit SHALL classify it as `unsupported-needs-contract` and SHALL NOT present it as an active production guarantee

### Requirement: Follow-up decision index

deck-go SHALL maintain a decision index that turns audited gaps into future proposal candidates.

#### Scenario: Gap requires product or architecture decision

- **WHEN** a gap depends on product policy, Gateway evolution, platform contract design, or dependency approval
- **THEN** the audit SHALL record it in the decision index with proposed owner area, priority, affected modules, and suggested follow-up proposal type

#### Scenario: Gap is deterministic low-risk drift

- **WHEN** a gap has a clear source of truth and a low-risk fix
- **THEN** the implementation MAY fix it directly in this change and SHALL record the evidence in the audit

### Requirement: P0 hardening candidates are separated from product enhancements

deck-go SHALL distinguish contract-chain hardening from product feature expansion.

#### Scenario: P0 hardening is identified

- **WHEN** the audit finds describe visibility drift, upstream-schema-missing read paths, overly broad dynamic envelopes, or config write-safety blockers
- **THEN** it SHALL list the item as a P0 hardening candidate with evidence and recommended next action

#### Scenario: Product enhancement is identified

- **WHEN** the audit finds forecast, retry, audit, live subscription, advanced editor, charting, or similar product expansion
- **THEN** it SHALL list the item separately from P0 hardening and SHALL NOT block the head audit change on implementing it

### Requirement: Module status notes are reconciled

deck-go SHALL reconcile obvious stale handoff status notes discovered during the audit.

#### Scenario: Stale status is unambiguous

- **WHEN** a module README or implementation note status contradicts archived OpenSpec evidence and current tests
- **THEN** the implementation SHALL update the status note or record why it remains intentionally stale
