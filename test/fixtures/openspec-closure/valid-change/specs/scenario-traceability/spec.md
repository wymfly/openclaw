## ADDED Requirements

### Requirement: Stable IDs exist

Every active scenario SHALL expose a stable identifier.

#### Scenario: New scenario gets an id

- **scenario_id**: `traceability.new-id`
- **WHEN** a new scenario is added
- **THEN** it SHALL have a stable id

## MODIFIED Requirements

### Requirement: Existing IDs survive wording changes

Existing scenarios SHALL keep the same id across wording-only edits.

#### Scenario: Same scenario, new title wording

- **scenario_id**: `traceability.same-id`
- **WHEN** a scenario title is rewritten
- **THEN** the same id SHALL remain attached to it
