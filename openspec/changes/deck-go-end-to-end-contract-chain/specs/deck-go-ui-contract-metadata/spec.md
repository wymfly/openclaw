## ADDED Requirements

### Requirement: UI metadata references generated contracts

Deck Go SHALL provide UI metadata that references generated Deck-facing DTOs, fields, endpoints, actions, and capabilities by stable identifiers.

#### Scenario: Metadata references a DTO field

- **WHEN** UI metadata declares display or input behavior for a field
- **THEN** the referenced DTO and field SHALL exist in the generated Deck-facing contract artifacts

#### Scenario: Stale metadata is detected

- **WHEN** a DTO field is renamed or removed without updating UI metadata
- **THEN** the metadata validation check SHALL fail

### Requirement: Field metadata supports frontend construction

Field metadata SHALL describe enough semantics for frontend panels to choose appropriate controls, display formatting, validation hints, and empty states.

#### Scenario: Form field metadata is generated

- **WHEN** a DTO field is intended for user input
- **THEN** its metadata SHALL identify the input kind, label, optional help text, required status, validation constraints when known, and whether the field is secret or sensitive

#### Scenario: Table field metadata is generated

- **WHEN** a DTO field is intended for tabular display
- **THEN** its metadata SHALL identify label, value kind, sortability, filterability, and preferred compact display behavior

#### Scenario: Status field metadata is generated

- **WHEN** a DTO field represents status, health, lifecycle, severity, or mode
- **THEN** its metadata SHALL define the known values and their UI semantics without requiring panel-local hardcoded mappings

### Requirement: Action metadata captures safety and capability semantics

Mutation and command actions exposed through Deck-facing contracts SHALL carry UI metadata for safety, capability requirements, and expected result behavior.

#### Scenario: Destructive action is described

- **WHEN** an action can delete, revoke, stop, kill, reset, or otherwise destructively mutate state
- **THEN** its metadata SHALL mark the action as destructive and provide confirmation semantics for frontend consumers

#### Scenario: Capability-gated action is described

- **WHEN** an action requires runtime mode, Gateway method availability, access scope, or local capability support
- **THEN** its metadata SHALL list those requirements so the frontend can disable, hide, or explain the action before submission

#### Scenario: Async action is described

- **WHEN** an action starts asynchronous work
- **THEN** its metadata SHALL describe the expected pending, success, failure, and refresh behavior

### Requirement: UI metadata is generated or checked with contracts

UI metadata SHALL be generated or validated as part of the Deck Go contract check workflow.

#### Scenario: Contract check runs

- **WHEN** `make contracts-check` or the equivalent Deck Go contract verification command runs
- **THEN** UI metadata references SHALL be validated together with generated DTO artifacts

#### Scenario: Frontend design consumes metadata

- **WHEN** a future frontend panel is built from contract metadata
- **THEN** it SHALL be able to identify available fields, actions, states, and empty-state guidance without reading backend handler code
