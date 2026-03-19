## ADDED Requirements

### Requirement: Active Runs tab shows real-time subagent status

The Active Runs tab SHALL display running subagent cards in a tree-nested layout reflecting parent-child relationships, with 5-second visibility-gated polling.

#### Scenario: Display active runs

- **WHEN** user navigates to Subagents panel Active Runs tab
- **THEN** system polls `deck.subagents.list({ status: "active" })` every 5 seconds and renders run cards with agent badge, task description, depth, model, elapsed time (live updating), and kill/view-session actions

#### Scenario: Polling pauses when tab is hidden

- **WHEN** user switches to another browser tab
- **THEN** polling stops; when user returns, polling resumes immediately

#### Scenario: Kill subagent run

- **WHEN** user clicks "Terminate" on a run card and confirms
- **THEN** system calls `deck.subagents.kill({ runId })` and removes the card on success

### Requirement: Active Runs tab shows lineage tree

Below the run cards, a lineage tree visualization SHALL show the call topology using the LineageTree shared component.

#### Scenario: Display lineage tree

- **WHEN** there are active runs with parent-child relationships
- **THEN** the tree shows nodes with status icons (🔄 running, ✅ completed, ❌ failed, ⏱️ timeout) and elapsed time

### Requirement: History tab shows recent completed runs

The History tab SHALL display a table of completed/failed/timed-out runs with filtering and pagination. An empty state SHALL indicate the ephemeral nature of history data.

#### Scenario: Display history

- **WHEN** user navigates to History tab
- **THEN** system loads `deck.subagents.list({ status: "all" })` and renders a table with status, child agent, parent agent, task, duration, and outcome

#### Scenario: Empty history after sweep

- **WHEN** all runs have been swept from memory
- **THEN** system shows empty state: "仅显示最近 N 小时内的运行记录"

#### Scenario: Filter by status

- **WHEN** user selects "Failed" in the status filter
- **THEN** table shows only runs with `status: "failed"` or `"timeout"`

### Requirement: Config tab shows global subagent limits and per-agent permissions

The Config tab SHALL display editable global defaults (maxSpawnDepth, maxChildren, maxConcurrent) and a read-only per-agent permissions matrix.

#### Scenario: Edit global defaults

- **WHEN** user modifies maxSpawnDepth from 1 to 2 and saves
- **THEN** system applies the change via `config.patch` to `agents.defaults.subagents`

#### Scenario: View per-agent permissions matrix

- **WHEN** user views the Config tab
- **THEN** a table shows each agent's allowAgents, effective depth, effective concurrency, and subagent model; rows link to the Agent detail Subagent tab
