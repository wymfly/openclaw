## ADDED Requirements

### Requirement: Sessions and Usage SHALL be reference consumers for cockpit patterns

The cross-module readiness record SHALL identify Sessions and Usage as the
reference consumers for the cockpit pattern set. Their evidence SHALL include
prototype parity status, machine-checked typography/token assertions, accepted
exceptions, and a classification of module-local molecules that must not be
promoted.

#### Scenario: Reference consumer migration completes

- **WHEN** Sessions and Usage have been migrated to the cockpit pattern set
- **THEN** the readiness matrix SHALL include entries linking both modules to the cockpit pattern change
- **AND** each entry SHALL state whether canonical tokens changed
- **AND** each entry SHALL list module-local molecules that remain unpromoted

#### Scenario: A reference consumer still has visual exceptions

- **WHEN** a reference consumer's `visualReview.status` remains `pending-human` or accepted with exceptions
- **THEN** the readiness record SHALL preserve that status
- **AND** the migration SHALL NOT claim pixel-perfect visual acceptance

### Requirement: Broad cockpit rollout SHALL require a third-module validation sample

The cockpit pattern set SHALL NOT be advertised as a safe broad migration path
for all panels until one additional non-reference module validates the extracted
patterns with bounded scope and fresh evidence.

#### Scenario: A third module is sampled

- **WHEN** a third module such as Budget, Models, or Activity consumes the cockpit patterns in a bounded validation slice
- **THEN** the readiness matrix SHALL record which cockpit patterns were reused
- **AND** the evidence SHALL include focused tests, visual smoke or parity artifacts, and any rejected pattern candidates

#### Scenario: A broad rollout is proposed before third-module validation

- **WHEN** a proposal attempts to migrate multiple remaining panels to cockpit patterns before a third-module sample exists
- **THEN** the proposal SHALL be blocked or narrowed to a single validation slice
- **AND** the readiness matrix SHALL continue to classify broad rollout as deferred

### Requirement: Global token changes SHALL remain separate from cockpit pattern extraction

Cross-module readiness SHALL distinguish pattern extraction from global token
value changes. This cockpit change SHALL NOT be used as evidence that canonical
token values or global density defaults should change.

#### Scenario: A token value change is proposed during cockpit migration

- **WHEN** implementation discovers a possible global token value or global density change
- **THEN** that change SHALL be recorded as a separate follow-up
- **AND** the cockpit pattern migration SHALL continue only if it can proceed with current canonical tokens

#### Scenario: A panel-specific token alias is removed

- **WHEN** a module removes stale or non-canonical token aliases during cockpit migration
- **THEN** the readiness record SHALL classify that cleanup as module drift correction
- **AND** it SHALL NOT be counted as proof that global token values were wrong
