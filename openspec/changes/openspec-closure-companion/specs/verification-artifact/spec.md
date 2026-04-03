## ADDED Requirements

### Requirement: Each change SHALL maintain a machine-readable verification artifact

Each OpenSpec change that enters implementation SHALL maintain a machine-readable verification artifact keyed by `scenario_id`.

#### Scenario: Verification artifact initializes from scenario inventory

- **WHEN** a project initializes closure tracking for a change
- **THEN** the verification artifact SHALL create an entry for every active `scenario_id`
- **AND** each new entry SHALL begin in a non-verified status such as `pending`

#### Scenario: Verification entry records owner and evidence

- **WHEN** implementation or validation work progresses for a scenario
- **THEN** the corresponding verification entry SHALL be able to record the owning task, the intended verification command, and evidence references
- **AND** the closure companion SHALL be able to evaluate closure state from that entry without parsing free-form prose

### Requirement: Verification statuses SHALL distinguish implementation gaps from specification gaps

Verification state SHALL make it possible to distinguish "not implemented yet" from "spec needs correction" and similar classes of incompleteness.

#### Scenario: Spec contradiction is recorded explicitly

- **WHEN** implementation or review reveals that a scenario no longer matches intended behavior and the spec itself must change
- **THEN** the verification entry SHALL be markable as `spec-fix-required` or an equivalent explicit state
- **AND** the closure companion SHALL not treat that scenario as verified

#### Scenario: Deferred verification carries explicit rationale

- **WHEN** a project intentionally defers or waives verification for a scenario
- **THEN** the verification artifact SHALL require an explicit status and rationale for that decision
- **AND** the closure companion SHALL surface that scenario as not fully closed unless project policy explicitly permits otherwise
