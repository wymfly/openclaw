## ADDED Requirements

### Requirement: Mixed-source category groups

The command palette SHALL display commands grouped by source-aware categories: existing local categories (session, model, tools, agents), a "skills" group for skill commands, and a "more" group for remote built-in commands, with category headers and i18n labels.

#### Scenario: Default view shows local + skills

- **WHEN** user types `/` to open the palette with no filter
- **THEN** the palette SHALL show local commands grouped by their categories, followed by skill commands under a "Skills" header, and a "More commands..." expandable entry

#### Scenario: Skills group displays discovered skills

- **WHEN** the registry contains 3 skill commands (github, commit, deploy)
- **THEN** the "Skills" group SHALL show all 3 with their names, descriptions, and a generic skill icon

#### Scenario: More section is collapsed by default

- **WHEN** the palette shows the "More commands..." entry
- **THEN** clicking it SHALL expand to show all built-in remote commands grouped by their categories

#### Scenario: Empty skills group hidden

- **WHEN** no skill commands are registered
- **THEN** the "Skills" category header SHALL NOT appear in the palette

### Requirement: Cross-source prefix search

The palette SHALL support prefix-based search across all registered command sources, with results sorted by priority then alphabetically within each category.

#### Scenario: Search matches across sources

- **WHEN** user types `/mo`
- **THEN** the palette SHALL show local `/model` and any remote commands starting with "mo" (e.g., builtin `/monitor`)

#### Scenario: Search with no matches

- **WHEN** user types `/xyz` and no registered command starts with "xyz"
- **THEN** the palette SHALL show a "No matching commands" hint

#### Scenario: Search clears on backspace

- **WHEN** user deletes the filter back to just `/`
- **THEN** the palette SHALL return to the default view (all local + skills + more)

### Requirement: Ghost hint parameter placeholder

The palette SHALL display a ghost (dimmed) parameter hint in the input area when a command that accepts arguments is selected or typed.

#### Scenario: Static args ghost hint

- **WHEN** user types `/model ` (with trailing space) and the command has `args: "<name>"`
- **THEN** a dimmed placeholder `model_name` SHALL appear in the input

#### Scenario: Enum args ghost hint

- **WHEN** user types `/think ` and the command has `argOptions: ["off", "low", "medium", "high"]`
- **THEN** a dimmed placeholder `off | low | medium | high` SHALL appear

#### Scenario: No ghost hint for argless commands

- **WHEN** user types `/new ` (no args defined)
- **THEN** no ghost hint SHALL appear

### Requirement: Context-aware visibility filtering

The palette SHALL support `visibleIf` predicates on local commands that control their visibility based on current session state, without affecting manual input execution.

#### Scenario: Stop only visible when streaming

- **WHEN** the current session is NOT streaming
- **THEN** `/stop` SHALL NOT appear in the palette's default view

#### Scenario: Stop visible during streaming

- **WHEN** the current session IS streaming
- **THEN** `/stop` SHALL appear in the palette

#### Scenario: Manual input bypasses visibility

- **WHEN** user manually types `/stop` and presses Enter while not streaming
- **THEN** the command SHALL still execute (and return an appropriate error/no-op result)

### Requirement: Dynamic icon resolution

The palette SHALL resolve command icons dynamically: local commands use the existing lucide icon map, skill commands use a generic "sparkles" icon, plugin commands use a "plug" icon, and remote built-in commands use a "terminal" icon unless a specific icon is provided.

#### Scenario: Local command icon

- **WHEN** a local command has `icon: "brain"`
- **THEN** the palette SHALL render the Brain lucide icon

#### Scenario: Skill command default icon

- **WHEN** a skill command has no icon specified
- **THEN** the palette SHALL render a Sparkles icon

#### Scenario: Remote builtin default icon

- **WHEN** a remote built-in command has no icon specified
- **THEN** the palette SHALL render a Terminal icon
