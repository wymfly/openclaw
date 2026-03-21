## ADDED Requirements

### Requirement: Run history list with pagination

The Monitor panel's History tab SHALL display a paginated list of past runs, showing each run's ID, agent name, session key, start time, duration, event count, and status (completed/error/running).

#### Scenario: Default view shows recent runs

- **WHEN** user navigates to the History tab
- **THEN** the 20 most recent runs SHALL be loaded and displayed, sorted by start time descending

#### Scenario: Load more via pagination

- **WHEN** user scrolls to the bottom of the run list and more runs exist
- **THEN** the next 20 runs SHALL be loaded and appended to the list

#### Scenario: Empty state

- **WHEN** no runs exist in the `run_events` table
- **THEN** the History tab SHALL display an empty state with "No runs recorded yet" message

### Requirement: Run history filtering

The History tab SHALL support filtering by: agent (dropdown), session (text input), time range (date picker), and status (completed/error/running).

#### Scenario: Filter by agent

- **WHEN** user selects "assistant" from the agent dropdown
- **THEN** only runs with `agent_id = 'assistant'` SHALL be displayed

#### Scenario: Filter by time range

- **WHEN** user selects "Last 24 hours" from the time range picker
- **THEN** only runs with `created_at` within the last 24 hours SHALL be displayed

#### Scenario: Combined filters

- **WHEN** user selects agent "assistant" and time range "Last 24 hours"
- **THEN** only runs matching both filters SHALL be displayed

#### Scenario: Clear filters

- **WHEN** user clicks "Clear Filters"
- **THEN** all filters SHALL be reset and the full run list SHALL be displayed

### Requirement: Run detail navigation

Clicking a run in the History list SHALL navigate to the Timeline tab with that run selected, loading its events from `run_events`.

#### Scenario: Navigate to run detail

- **WHEN** user clicks on run "run-abc" in the History list
- **THEN** the Timeline tab SHALL become active with `run-abc` selected
- **AND** all events for `run-abc` SHALL be loaded via `GET /api/monitor/runs/run-abc`

#### Scenario: Deep link to run

- **WHEN** the URL contains `?runId=run-abc`
- **THEN** the Monitor panel SHALL open with the Timeline tab showing `run-abc`

### Requirement: Run status indicators

Each run in the History list SHALL display a status badge: "Completed" (green), "Error" (red), or "Running" (animated pulse, accent).

#### Scenario: Completed run

- **WHEN** a run's last event has stream `system` with data indicating completion
- **THEN** the status badge SHALL show "Completed" with green styling

#### Scenario: Error run

- **WHEN** a run's last event has stream `system` with data indicating error
- **THEN** the status badge SHALL show "Error" with red styling

#### Scenario: Running run

- **WHEN** a run has events but no terminal event (completion/error)
- **AND** the most recent event is less than 5 minutes old
- **THEN** the status badge SHALL show "Running" with an animated pulse

### Requirement: Run summary cards in History

Each run row in the History list SHALL display inline summary metrics: tool call count, model calls, total tokens, and duration.

#### Scenario: Summary metrics displayed

- **WHEN** run "run-abc" has 5 tool calls, 2 model calls, 3500 total tokens, and 12s duration
- **THEN** the row SHALL display: "5 tools", "2 models", "3.5k tokens", "12s"

#### Scenario: Abbreviated large numbers

- **WHEN** a run consumed 150,000 tokens
- **THEN** the display SHALL show "150k tokens"
