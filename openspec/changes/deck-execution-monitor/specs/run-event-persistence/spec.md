## ADDED Requirements

### Requirement: Run events persisted to SQLite

The system SHALL persist run-scoped events to a `run_events` SQLite table with columns: `id` (auto-increment), `run_id` (TEXT), `seq` (INTEGER), `stream` (TEXT), `data` (TEXT/JSON), `agent_id` (TEXT), `session_key` (TEXT), `created_at` (TEXT). The `(run_id, seq)` pair SHALL be unique.

#### Scenario: Tool call event persisted

- **WHEN** a Gateway SSE `agent` event arrives with `runId = 'run-abc'` containing a tool call start
- **THEN** a row SHALL be inserted into `run_events` with `run_id = 'run-abc'`, `stream = 'tool_call'`, and `data` containing the tool name, arguments, and start timestamp

#### Scenario: Model inference event persisted

- **WHEN** a Gateway SSE `chat` event with state `final` arrives for `runId = 'run-abc'`
- **THEN** a row SHALL be inserted into `run_events` with `run_id = 'run-abc'`, `stream = 'model'`, and `data` containing token usage (input, output, cache) and model ID

#### Scenario: Events without runId are not persisted

- **WHEN** a Gateway SSE event arrives without a `runId` field (e.g., system status events)
- **THEN** no row SHALL be inserted into `run_events`

### Requirement: Batch write pipeline with flush window

The write pipeline SHALL buffer incoming events and flush to SQLite in batches using a single transaction. A flush SHALL occur when either 50 events have accumulated or 500ms have elapsed since the first buffered event, whichever comes first.

#### Scenario: Batch flush on count threshold

- **WHEN** 50 events have been buffered within the flush window
- **THEN** all 50 events SHALL be written in a single SQLite transaction

#### Scenario: Batch flush on time threshold

- **WHEN** 10 events have been buffered and 500ms have elapsed since the first event
- **THEN** all 10 events SHALL be written in a single SQLite transaction

#### Scenario: Duplicate event rejected

- **WHEN** an event with `(run_id, seq)` matching an existing row is flushed
- **THEN** the duplicate SHALL be silently ignored (INSERT OR IGNORE) without affecting other events in the batch

### Requirement: 7-day retention with lazy pruning

The system SHALL delete `run_events` rows older than 7 days. Pruning SHALL occur lazily: on each `appendEvents` call, if more than 1 hour has elapsed since the last prune, execute the deletion before inserting new events.

#### Scenario: Prune triggered after 1 hour

- **WHEN** `appendEvents` is called and the last prune was more than 1 hour ago
- **THEN** rows with `created_at` older than 7 days SHALL be deleted before inserting new events

#### Scenario: Prune skipped within 1 hour

- **WHEN** `appendEvents` is called and the last prune was less than 1 hour ago
- **THEN** no deletion SHALL occur; events SHALL be inserted directly

### Requirement: Query events by runId

The system SHALL provide a `getRunEvents(runId)` method that returns all events for a given `run_id`, ordered by `seq` ascending.

#### Scenario: Retrieve all events for a run

- **WHEN** `getRunEvents('run-abc')` is called and 15 events exist for that run
- **THEN** all 15 events SHALL be returned, ordered by `seq` ascending

#### Scenario: Empty result for unknown runId

- **WHEN** `getRunEvents('run-nonexistent')` is called
- **THEN** an empty array SHALL be returned

### Requirement: Query run list with filters

The system SHALL provide a `listRuns(filters)` method that returns a paginated list of distinct runs. Filters SHALL include: `agentId`, `sessionKey`, `since` (datetime), `until` (datetime). Pagination SHALL use cursor-based navigation (last `run_id` + `created_at`).

#### Scenario: Filter by agent

- **WHEN** `listRuns({ agentId: 'agent-1', limit: 20 })` is called
- **THEN** up to 20 runs with `agent_id = 'agent-1'` SHALL be returned, most recent first

#### Scenario: Filter by time window

- **WHEN** `listRuns({ since: '2026-03-20', until: '2026-03-21' })` is called
- **THEN** only runs with events created within that time window SHALL be returned

#### Scenario: Cursor pagination

- **WHEN** `listRuns({ cursor: { runId: 'run-50', createdAt: '...' }, limit: 20 })` is called
- **THEN** the next 20 runs after the cursor position SHALL be returned

### Requirement: Run summary aggregation

The system SHALL provide a `getRunSummary(runId)` method that computes aggregated statistics from `run_events`: total duration, tool call count, model call count, total tokens (input/output/cache), file operations count, subagent spawns, and whether compaction occurred.

#### Scenario: Summary for a completed run

- **WHEN** `getRunSummary('run-abc')` is called and the run has 5 tool calls, 2 model calls, and 1 compaction event
- **THEN** the summary SHALL return `{ toolCalls: 5, modelCalls: 2, compacted: true, ... }` with accurate token totals

#### Scenario: Summary for run with no events

- **WHEN** `getRunSummary('run-empty')` is called and no events exist
- **THEN** the summary SHALL return null

### Requirement: Database migration for run_events table

The system SHALL create the `run_events` table via a numbered SQL migration file (`007_run_events.sql`) in the `dashboard/migrations/` directory, following the existing migration pattern.

#### Scenario: Migration applied on startup

- **WHEN** the Deck Server starts and `schema_version` does not include version 7
- **THEN** the `run_events` table and its indexes SHALL be created
- **AND** version 7 SHALL be recorded in `schema_version`

#### Scenario: Migration idempotent on re-run

- **WHEN** the Deck Server starts and version 7 is already in `schema_version`
- **THEN** the migration SHALL be skipped
