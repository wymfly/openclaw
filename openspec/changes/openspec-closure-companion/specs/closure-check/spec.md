## ADDED Requirements

### Requirement: A closure companion SHALL detect open gaps across specs, plans, and verification state

The closure companion SHALL compare the active spec scenario inventory against implementation-plan mappings and verification entries to determine closure state.

#### Scenario: Missing plan mapping is reported as an open gap

- **WHEN** an active `scenario_id` exists in spec inventory but no implementation ownership mapping can be found
- **THEN** the closure companion SHALL report that scenario as an open coverage gap
- **AND** SHALL mark the change as not archive-ready

#### Scenario: Non-closed verification state blocks readiness

- **WHEN** any active scenario remains in a non-closed state such as `pending`, `blocked`, `deferred`, or `spec-fix-required`
- **THEN** the closure companion SHALL report that scenario as open
- **AND** the change SHALL not be considered archive-ready

### Requirement: The closure companion SHALL remain project-portable through a thin adapter layer

The closure companion SHALL consume project-specific conventions through configuration rather than through hardcoded repository assumptions.

#### Scenario: Project-specific paths are resolved through adapter config

- **WHEN** a project stores plans, verification artifacts, or wrapper commands in non-default locations
- **THEN** the closure companion SHALL resolve those locations through project adapter configuration
- **AND** SHALL NOT require the project to patch the companion's core logic

#### Scenario: Zero-gap changes report archive readiness

- **WHEN** every active `scenario_id` is mapped, verified, and free of open gaps under the active project policy
- **THEN** the closure companion SHALL report the change as archive-ready
- **AND** it SHALL produce a machine-readable result that projects can use as an archive gate, CI gate, or reporting input
