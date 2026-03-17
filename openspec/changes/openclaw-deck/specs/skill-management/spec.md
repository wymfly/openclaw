## ADDED Requirements

### Requirement: Skill List Display

The skill management panel SHALL display all skills with status filters (ready / needs-setup / disabled) via the `skills.status` Gateway RPC.

#### Scenario: List skills with status

- **WHEN** the user navigates to the Skills panel
- **THEN** the panel SHALL call `skills.status` and display all skills grouped by status, with source tags (bundled / managed / plugin) and missing requirements indicators

#### Scenario: Filter by status

- **WHEN** the user selects the "needs-setup" filter
- **THEN** the panel SHALL display only skills that require configuration before they can be used

### Requirement: Skill Enable/Disable

The panel SHALL allow enabling and disabling individual skills via the `skills.update` Gateway RPC.

#### Scenario: Disable a skill

- **WHEN** the user toggles a skill to disabled
- **THEN** the panel SHALL call `skills.update` with enabled=false and the skill's status SHALL change to "disabled" in the list

#### Scenario: Enable a skill

- **WHEN** the user toggles a disabled skill to enabled
- **THEN** the panel SHALL call `skills.update` with enabled=true and the skill's status SHALL update accordingly

### Requirement: Environment Variable Configuration

The panel SHALL provide forms for configuring skill-specific environment variables and API keys required for skill operation.

#### Scenario: Configure skill API key

- **WHEN** the user enters an API key for a skill that requires one and saves
- **THEN** the panel SHALL persist the configuration via `skills.update` and the skill's status SHALL transition from "needs-setup" to "ready"

### Requirement: Missing Requirements Indicators

The panel SHALL display clear indicators when a skill has unmet requirements (missing API keys, unconfigured environment variables).

#### Scenario: Display missing requirements

- **WHEN** a skill has unconfigured required environment variables
- **THEN** the panel SHALL display a warning badge with a list of missing configuration items and a link to the configuration form
