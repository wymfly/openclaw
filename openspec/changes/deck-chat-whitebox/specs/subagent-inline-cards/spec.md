## ADDED Requirements

### Requirement: Subagent spawn inline card

The system SHALL render an inline status card in the message stream when a subagent is spawned during an assistant message's execution.

#### Scenario: Subagent spawn event received

- **WHEN** an agent event with subagent spawn phase is received for the active session
- **THEN** a SubagentCard SHALL be inserted into the current streaming message's content area showing: subagent identifier, task description (if available), and a "running" status badge with elapsed timer

#### Scenario: Multiple subagents in one message

- **WHEN** multiple subagents are spawned during a single assistant message's execution
- **THEN** each subagent SHALL have its own card rendered in spawn order within the message

### Requirement: Subagent completion status

The system SHALL update the subagent inline card when the subagent completes, fails, or is cancelled.

#### Scenario: Subagent completes successfully

- **WHEN** a subagent complete event is received
- **THEN** the SubagentCard SHALL update to show: "completed" status badge in green, final duration, and a collapsed summary of the result (if available)

#### Scenario: Subagent fails

- **WHEN** a subagent error event is received
- **THEN** the SubagentCard SHALL update to show: "failed" status badge in red, duration until failure, and the error message in a collapsible section

#### Scenario: Subagent still running after parent completes

- **WHEN** the parent assistant message finishes streaming but a subagent card still shows "running"
- **THEN** the card SHALL continue showing the elapsed timer and update when the subagent eventually completes or fails

### Requirement: Subagent card collapsibility

Each SubagentCard SHALL be collapsible. The collapsed state SHALL show a single-line summary (identifier + status + duration). The expanded state SHALL show task description and result/error details.

#### Scenario: Default state for running subagent

- **WHEN** a subagent is currently running
- **THEN** the card SHALL be expanded by default

#### Scenario: Default state for completed subagent

- **WHEN** a subagent has completed (success or failure) and the message is no longer streaming
- **THEN** the card SHALL be collapsed by default

#### Scenario: User toggles collapse

- **WHEN** user clicks the collapse/expand toggle on a SubagentCard
- **THEN** the card SHALL toggle between collapsed and expanded state; this preference SHALL persist until the page is refreshed

### Requirement: Subagent store tracking

The chat store SHALL maintain a `subagentRuns` map per session tracking subagent lifecycle state.

#### Scenario: Store initialization on spawn

- **WHEN** a subagent spawn event is dispatched
- **THEN** the store SHALL create an entry in `subagentRuns` with: `id`, `taskDescription` (if available), `status: "running"`, `startedAt` timestamp, and the `parentRunId` linking to the assistant message

#### Scenario: Store update on completion

- **WHEN** a subagent complete/error event is dispatched
- **THEN** the store SHALL update the corresponding entry with: `status: "completed" | "failed"`, `completedAt` timestamp, `duration`, and `result` or `error` content

#### Scenario: Session cleanup

- **WHEN** a session is removed from the store
- **THEN** all `subagentRuns` entries for that session SHALL also be removed
