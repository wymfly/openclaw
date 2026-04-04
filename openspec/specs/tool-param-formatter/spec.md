## ADDED Requirements

### Requirement: Structured parameter display

The system SHALL render tool_use block parameters as a structured key-value layout instead of raw `JSON.stringify` output. Top-level keys SHALL be displayed as labeled rows with syntax-highlighted values. Nested objects/arrays SHALL be rendered as collapsible JSON sub-trees.

#### Scenario: Simple key-value parameters

- **WHEN** a tool_use block has input `{ "file_path": "/src/main.ts", "line": 42 }`
- **THEN** the card SHALL display two rows: "file_path → /src/main.ts" and "line → 42" with monospace value formatting

#### Scenario: Nested object parameter

- **WHEN** a tool_use block has input containing a nested object (e.g., `{ "config": { "timeout": 30, "retry": true } }`)
- **THEN** the "config" row SHALL render as a collapsible section; collapsed state SHALL show `{2 keys}` summary; expanded state SHALL show the nested key-value pairs

#### Scenario: Large string parameter

- **WHEN** a parameter value is a string exceeding 500 characters
- **THEN** the value SHALL be truncated with an ellipsis and a "Show full" toggle to reveal the complete text

#### Scenario: Empty input

- **WHEN** a tool_use block has an empty input object `{}`
- **THEN** the card SHALL display "(no parameters)" in muted text

### Requirement: Collapsible tool use sections

The system SHALL render each tool_use card as a collapsible section. The collapsed header SHALL display the tool name and a one-line parameter summary. The expanded state SHALL show the full structured parameter display.

#### Scenario: Default collapsed state

- **WHEN** a tool_use block is rendered in a completed (non-streaming) message
- **THEN** the card SHALL be collapsed by default, showing tool name and parameter summary

#### Scenario: Streaming message tool use

- **WHEN** a tool_use block is rendered in a currently streaming message
- **THEN** the card SHALL be expanded by default to show real-time parameter population

#### Scenario: Parameter summary generation

- **WHEN** the card is collapsed
- **THEN** the header SHALL show the tool name followed by a summary: up to 3 top-level key names joined by comma, with "..." if more keys exist (e.g., "bash — command, timeout, ...")

### Requirement: Copy raw JSON action

The system SHALL provide a "Copy JSON" button on each tool_use card that copies the original unformatted `JSON.stringify(input, null, 2)` to the clipboard.

#### Scenario: Copy action

- **WHEN** user clicks the "Copy JSON" button on a tool_use card
- **THEN** the raw JSON string SHALL be copied to the clipboard and a brief "Copied" toast SHALL appear
