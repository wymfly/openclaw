## ADDED Requirements

### Requirement: Missing IDs are invalid

Every active scenario SHALL expose a stable identifier.

#### Scenario: Scenario is missing its id

- **WHEN** a scenario omits the stable id
- **THEN** parsing SHALL fail
