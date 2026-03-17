## ADDED Requirements

### Requirement: Schema-Driven Form Generation

The config editor SHALL auto-generate configuration forms from the OpenClaw JSON Schema fetched via the `config.schema` Gateway RPC. Each schema property SHALL be rendered as the appropriate form control.

#### Scenario: Generate form from schema

- **WHEN** the user navigates to the Config Editor panel
- **THEN** the panel SHALL call `config.schema` and `config.get` to fetch the schema and current values, then render form controls (text inputs, toggles, dropdowns, arrays) matching each schema property type

#### Scenario: Handle nested schema objects

- **WHEN** the schema contains nested objects (e.g., gateway.auth, models.providers)
- **THEN** the panel SHALL render nested sections with indentation and collapsible groups

### Requirement: Section Navigation

The config editor SHALL provide a sidebar or tab navigation for jumping between configuration sections (gateway / agents / hooks / models / channels / etc.).

#### Scenario: Navigate to section

- **WHEN** the user clicks "models" in the section navigator
- **THEN** the editor SHALL scroll or switch to the models configuration section

### Requirement: Save and Reload

The config editor SHALL support saving changes via `config.apply` with the full raw configuration string and a `baseHash` for optimistic concurrency control. Reloading SHALL fetch the current config and its hash via `config.get`.

#### Scenario: Save configuration changes

- **WHEN** the user modifies configuration values and clicks "Save"
- **THEN** the panel SHALL serialize the full configuration as a raw string and call `config.apply` with `{ raw, baseHash }` where `baseHash` is the hash received from the last `config.get` call, then call `config.get` to refresh

#### Scenario: Save conflict detection

- **WHEN** the `config.apply` call returns a conflict error (baseHash mismatch)
- **THEN** the panel SHALL display a conflict notification, reload the current config via `config.get`, and present a diff view so the user can re-apply changes

#### Scenario: Reload configuration

- **WHEN** the user clicks "Reload"
- **THEN** the panel SHALL call `config.get`, store the returned `baseHash`, and reset all form fields to the current persisted values

### Requirement: Dirty State Tracking

The config editor SHALL track unsaved changes (dirty state) and warn the user before navigating away with unsaved modifications.

#### Scenario: Dirty state indicator

- **WHEN** the user modifies a configuration value
- **THEN** the panel SHALL display a "Unsaved changes" indicator and the Save button SHALL become active

#### Scenario: Navigation guard

- **WHEN** the user attempts to navigate to another panel with unsaved changes
- **THEN** the panel SHALL display a confirmation dialog asking whether to discard or save changes
