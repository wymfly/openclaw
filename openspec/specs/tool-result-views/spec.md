## ADDED Requirements

### Requirement: Bash result split view

The system SHALL detect bash/terminal tool results and render them in a split-view layout with separate sections for command, stdout, stderr, and exit code.

#### Scenario: Successful bash command

- **WHEN** a tool_result is associated with a tool_use named "bash" (or "execute", "terminal") and the result contains recognizable output
- **THEN** the card SHALL display: (1) the command in a highlighted header bar, (2) stdout in a scrollable monospace block, (3) exit code badge showing "0" in green

#### Scenario: Failed bash command with stderr

- **WHEN** a bash tool_result contains stderr content and a non-zero exit code
- **THEN** the card SHALL display stderr in a red-tinted block separate from stdout, and the exit code badge SHALL be red

#### Scenario: Unrecognizable bash output

- **WHEN** a tool_result is associated with a bash tool but the content does not match expected patterns (no recognizable command/exit code structure)
- **THEN** the system SHALL fallback to the existing raw text rendering

### Requirement: File operation diff preview

The system SHALL detect file read/write tool results and render an inline diff view when both before and after content are available.

#### Scenario: Write tool with diff content

- **WHEN** a tool_result is associated with a tool_use named "write" or "edit" and the result content contains diff markers or before/after content
- **THEN** the card SHALL render a unified diff view with added lines in green background and removed lines in red background, with line numbers

#### Scenario: Read tool result

- **WHEN** a tool_result is associated with a tool_use named "read" and contains file content
- **THEN** the card SHALL render the content with syntax highlighting based on file extension (detected from the tool_use input's `file_path` parameter), with line numbers

#### Scenario: Diff for unsupported file type

- **WHEN** a diff is detected but the file appears to be binary (contains null bytes or non-UTF8 sequences)
- **THEN** the card SHALL display "[Binary file — diff not available]" placeholder text

### Requirement: Virtual scroll for long results

The system SHALL use virtual scrolling for tool results exceeding 200 lines, replacing the current 300px max-height truncation.

#### Scenario: Long stdout output

- **WHEN** a tool_result content exceeds 200 lines
- **THEN** the card SHALL render a virtual-scrolled container of 400px height showing only visible lines, with a line count indicator (e.g., "1-50 of 1,234 lines")

#### Scenario: Short result

- **WHEN** a tool_result content is 200 lines or fewer
- **THEN** the card SHALL render all lines directly without virtual scrolling (same as current behavior minus the max-height truncation)

#### Scenario: Expand virtual scroll container

- **WHEN** user clicks "Expand" on a virtual-scrolled result
- **THEN** the container height SHALL increase to 80vh, and a "Collapse" button SHALL appear to return to 400px

### Requirement: Show Raw toggle

Every enhanced tool result view SHALL provide a "Show Raw" toggle that switches between the formatted view and the original unprocessed text content.

#### Scenario: Toggle to raw view

- **WHEN** user clicks "Show Raw" on a formatted tool result (bash split view, diff view, etc.)
- **THEN** the card SHALL immediately switch to displaying the original `content` string in a monospace pre block

#### Scenario: Toggle back to formatted view

- **WHEN** user clicks "Show Formatted" on a raw-mode tool result
- **THEN** the card SHALL return to the detected formatted view (bash/diff/highlighted)

#### Scenario: Persistence within session

- **WHEN** user toggles a specific tool result card to raw mode
- **THEN** that card SHALL remain in raw mode until explicitly toggled back; other cards SHALL not be affected
