## ADDED Requirements

### Requirement: Slash command registry SHALL preserve command source semantics

The Chat slash command registry SHALL preserve command source, priority, aliases, argument metadata, and execution mode for local and Gateway-discovered commands.

#### Scenario: Gateway command is discovered

- **WHEN** `deck.commands.discover` or an equivalent Gateway-backed command discovery path returns a command
- **THEN** the frontend registry SHALL retain source, execution mode, description, category, and available argument/alias metadata
- **AND** the command SHALL be executable from both palette selection and manual typed input

#### Scenario: Command sources collide

- **WHEN** two command sources expose the same command name
- **THEN** the active command SHALL be selected by the documented source-priority policy
- **AND** the displaced command SHALL remain addressable or explicitly recorded as shadowed in the command matrix

#### Scenario: Alias is typed manually

- **WHEN** the user manually types an accepted alias such as `/t high`
- **THEN** the alias SHALL resolve to the canonical command handler
- **AND** the UI SHALL show the same state update or error behavior as the canonical command

### Requirement: Slash command input modes SHALL be state-clean

The Chat command input SHALL close or transition command UI state correctly after command dispatch, rejection, or cancellation.

#### Scenario: Remote typed command is sent

- **WHEN** the user manually types a known remote command and sends it
- **THEN** the command palette SHALL close
- **AND** the command SHALL be sent through the remote command execution path
- **AND** the input SHALL not retain stale palette, tag, or argument-option state

#### Scenario: Unknown typed command is rejected

- **WHEN** the user manually types an unknown slash command
- **THEN** the frontend SHALL reject it with an unknown-command error
- **AND** the command SHALL NOT be sent as plain chat text
- **AND** stale palette, tag, or argument-option state SHALL be cleared

#### Scenario: Command argument mode dispatches

- **WHEN** the user selects an argument option or submits a tagged command argument
- **THEN** the final command request SHALL include the intended command name and argument value
- **AND** the UI SHALL clear transient command selection state after dispatch

### Requirement: Slash command acceptance SHALL include backend and frontend evidence

Slash command implementation SHALL require both execution-path and UI-state verification.

#### Scenario: Command implementation is marked complete

- **WHEN** a slash command task is checked complete
- **THEN** tests or evidence SHALL prove parser/registry behavior, executor routing, backend/OpenClaw path correctness, and frontend user-visible state or output behavior

#### Scenario: Command is not safe for real execution

- **WHEN** a command is high-risk or fixture safety is not proven
- **THEN** completion SHALL include code-level review evidence and a matrix skip/handoff reason
- **AND** the command SHALL NOT be counted as real-E2E-passed
