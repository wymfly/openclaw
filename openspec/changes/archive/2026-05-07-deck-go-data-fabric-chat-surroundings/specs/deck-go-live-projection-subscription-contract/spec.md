## ADDED Requirements

### Requirement: Chat surrounding metadata SHALL map to Data Fabric invalidation

Data Fabric SHALL map current `command-discovery` and `chat-session` live
projection metadata to query invalidation without extending generated projection
fields.

#### Scenario: Command-discovery projection invalidates command data

- **WHEN** Data Fabric handles `commands.changed` or `projection.gap` for the
  `command-discovery` projection
- **THEN** it SHALL invalidate or mark stale command discovery query keys
- **AND** the command registry SHALL be repopulated from the authoritative
  command discovery query result

#### Scenario: Chat-session projection invalidates surrounding read models

- **WHEN** Data Fabric handles `chat-session` events or `projection.gap` that
  affect surrounding read models
- **THEN** it SHALL invalidate or mark stale Chat snapshot and related session
  list/preview keys according to module policy
- **AND** the specialized transcript dispatcher MAY continue to reduce stream
  frames directly for immediate UI rendering

#### Scenario: Patch fields remain out of scope

- **WHEN** Chat surrounding projection code is compiled or tested
- **THEN** it SHALL NOT require generated `patchStrategy` or `patchKeys` fields
