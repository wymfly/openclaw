## ADDED Requirements

### Requirement: Active spec scenarios SHALL expose stable scenario identities

Every ADDED or MODIFIED scenario that participates in implementation planning or closure review SHALL expose a stable `scenario_id`.

#### Scenario: New scenario receives a stable identifier

- **WHEN** a change introduces a new ADDED or MODIFIED scenario
- **THEN** that scenario SHALL declare a `scenario_id` that is unique within the change
- **AND** the `scenario_id` SHALL remain stable across wording-only edits to the scenario title or prose

#### Scenario: Semantically unchanged scenario keeps its identifier

- **WHEN** a scenario's title, formatting, or explanatory text changes without changing its intended behavior
- **THEN** the scenario SHALL keep the same `scenario_id`
- **AND** the closure companion SHALL treat that scenario as the same logical coverage target

### Requirement: Plans SHALL map scenario identities to implementation ownership

Implementation plans derived from OpenSpec changes SHALL provide scenario-level ownership mappings in addition to human-readable requirement coverage notes.

#### Scenario: Every active scenario is mapped to at least one task

- **WHEN** `writing-plans` or an equivalent planning step prepares an implementation plan for a change
- **THEN** every active scenario `scenario_id` SHALL be mapped to at least one implementation task
- **AND** the mapping SHALL be discoverable by the closure companion without relying on scenario title string matching

#### Scenario: Coverage matrix enumerates scenario-level ownership

- **WHEN** a plan claims that all OpenSpec requirements are covered
- **THEN** it SHALL expose a coverage matrix or equivalent manifest that enumerates each active `scenario_id`
- **AND** that matrix SHALL identify the owning task or tasks for each scenario
