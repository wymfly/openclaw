## ADDED Requirements

### Requirement: Dynamic command registration

The system SHALL provide a `CommandRegistry` class that supports registering, unregistering, and querying commands from multiple sources (local, builtin, skill, plugin) via a Map-based data structure.

#### Scenario: Register a local command

- **WHEN** a local command definition is registered via `registry.register(command)`
- **THEN** the command SHALL be stored with `source: "local"` and retrievable by name via `registry.get(name)`

#### Scenario: Register a remote command from discovery

- **WHEN** a discovered command is registered via `registry.register(command)` with `source: "builtin"`
- **THEN** the command SHALL be stored and included in `registry.getAll()` results

#### Scenario: Unregister a command

- **WHEN** `registry.unregister(name)` is called for an existing command
- **THEN** the command SHALL be removed and `registry.get(name)` SHALL return undefined

#### Scenario: Duplicate name registration

- **WHEN** a command with an already-registered name is registered
- **THEN** the command with lower priority value (higher priority) SHALL be kept, and the other SHALL be accessible via `source:name` qualified name

### Requirement: Source-tagged command metadata

Each registered command SHALL carry a `source` field (local | builtin | skill | plugin) and an `execMode` field (local | remote) to enable the executor and palette to handle commands differently based on their origin.

#### Scenario: Local command metadata

- **WHEN** a command from the static 14-command set is registered
- **THEN** it SHALL have `source: "local"`, `execMode: "local"`, and an `execute` function

#### Scenario: Discovered command metadata

- **WHEN** a command from `deck.commands.discover` is registered
- **THEN** it SHALL have `source` matching the discover response source, `execMode: "remote"`, and no `execute` function

### Requirement: Priority-based conflict resolution

The registry SHALL resolve name conflicts using a numeric `priority` field where lower values indicate higher priority, following the order: plugin (0) > local (10) > builtin (20) > skill (30).

#### Scenario: Local command overrides builtin with same name

- **WHEN** a local command `/model` (priority 10) and a builtin command `/model` (priority 20) are both registered
- **THEN** `registry.get("model")` SHALL return the local command
- **AND** the builtin command SHALL be accessible via `registry.get("builtin:model")`

#### Scenario: Skill command does not override local

- **WHEN** a skill command `/help` (priority 30) is registered after a local `/help` (priority 10)
- **THEN** `registry.get("help")` SHALL still return the local command

#### Scenario: Displaced command promoted after unregister

- **WHEN** a local command `/model` (priority 10) and a builtin command `/model` (priority 20) are registered, and then the local command is unregistered
- **THEN** `registry.get("model")` SHALL return the builtin command (auto-promoted from qualified)

#### Scenario: Displaced command promoted after unregisterBySource

- **WHEN** a local `/model` and builtin `/model` are registered, and then `unregisterBySource("local")` is called
- **THEN** `registry.get("model")` SHALL return the builtin command

### Requirement: Command filtering and search

The registry SHALL provide `filter(query)` method that returns commands matching a prefix search across all sources, sorted by category order then priority.

#### Scenario: Prefix search across sources

- **WHEN** `registry.filter("mo")` is called with local `/model` and builtin `/monitor` registered
- **THEN** both commands SHALL be returned, sorted by category order then priority

#### Scenario: Empty filter returns all

- **WHEN** `registry.filter("")` is called
- **THEN** all registered commands SHALL be returned, grouped by category

### Requirement: Backward-compatible migration

The registry SHALL accept all 14 existing `SlashCommandDef` entries via a `registerLocalCommands()` convenience method, preserving their existing category, icon, argOptions, and descriptionKey fields.

#### Scenario: Migrate existing commands

- **WHEN** `registerLocalCommands(SLASH_COMMANDS)` is called with the existing 14 command definitions
- **THEN** all 14 commands SHALL be registered with `source: "local"`, `execMode: "local"`, and retain their original metadata
