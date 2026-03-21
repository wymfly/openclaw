## ADDED Requirements

### Requirement: Gantt-style run timeline

The Monitor panel's Timeline tab SHALL display a Gantt-style visualization for a selected run, showing each event as a horizontal bar positioned by start time and sized by duration, within a time axis spanning the run's total duration.

#### Scenario: Tool call displayed with duration bar

- **WHEN** a run contains a tool call that started at T+2s and lasted 3s within a 10s total run
- **THEN** the timeline SHALL show a bar starting at 20% and spanning 30% of the axis width, colored with the `tool_call` stream color

#### Scenario: Model inference displayed

- **WHEN** a run contains a model call that started at T+0s and lasted 1.5s
- **THEN** the timeline SHALL show a bar at the start of the axis, spanning 15% width, colored with the `model` stream color

#### Scenario: Approval wait displayed

- **WHEN** a run contains a tool call with `approval_wait` duration of 45s
- **THEN** the timeline SHALL show a distinct "waiting" segment within the tool call bar, using a striped pattern

#### Scenario: Empty run displays message

- **WHEN** a run has no timed events
- **THEN** the timeline SHALL display a "No timed events" placeholder

### Requirement: Tool waterfall view

The Timeline tab SHALL include a hierarchical waterfall view showing tool calls in tree structure: which tool was called, its arguments summary, result summary, duration, and nested child calls (if any).

#### Scenario: Flat tool calls displayed

- **WHEN** a run has 3 sequential tool calls (read_file, edit_file, run_tests)
- **THEN** the waterfall SHALL show 3 rows at the same indent level, each with tool name, duration, and expandable details

#### Scenario: Nested tool calls displayed

- **WHEN** a tool call `orchestrate` spawned 2 child tool calls (`fetch_data`, `transform`)
- **THEN** `orchestrate` SHALL be at level 0, and `fetch_data` + `transform` SHALL be indented at level 1

#### Scenario: Expand tool call details

- **WHEN** user clicks on a tool call row in the waterfall
- **THEN** an expanded view SHALL show: full arguments (formatted JSON), full result (formatted JSON/text), start/end timestamps, and duration

### Requirement: File change summary

The Timeline tab SHALL include a file change summary section showing all file operations during the run, grouped by operation type (read/write/modify).

#### Scenario: File operations displayed

- **WHEN** a run has 2 file reads, 1 file write, and 1 file modify
- **THEN** the file change summary SHALL show 3 groups with file paths, and each group SHALL display the operation count badge

#### Scenario: No file operations

- **WHEN** a run has no `file_op` stream events
- **THEN** the file change summary section SHALL display "No file changes"

### Requirement: Model statistics panel

The Timeline tab SHALL display model statistics for the selected run: call count per model, total token consumption (input/output/cache), and any fallback events.

#### Scenario: Single model statistics

- **WHEN** a run used `claude-sonnet-4-20250514` for 3 calls, consuming 5000 input tokens and 2000 output tokens
- **THEN** the statistics panel SHALL show the model name, call count (3), and token breakdown (5000 in / 2000 out)

#### Scenario: Fallback event highlighted

- **WHEN** a run had a model fallback from `claude-sonnet-4-20250514` to `claude-haiku-4-5-20251001`
- **THEN** the statistics panel SHALL display a fallback event marker with both model names and the reason

#### Scenario: Cache hit displayed

- **WHEN** a run has 1500 cache read tokens
- **THEN** the statistics panel SHALL show cache tokens separately from input tokens

### Requirement: Subagent execution tree

The Timeline tab SHALL display a parent-child relationship tree for subagent executions within the run, using the shared `LineageTree` component.

#### Scenario: Subagent tree rendered

- **WHEN** a run spawned 2 subagents (sub-A, sub-B), and sub-A spawned 1 child (sub-A1)
- **THEN** the tree SHALL show the parent run at root, sub-A and sub-B as direct children, and sub-A1 as a child of sub-A

#### Scenario: No subagents

- **WHEN** a run has no `subagent` stream events
- **THEN** the subagent tree section SHALL not be rendered

### Requirement: Compaction event markers

The timeline SHALL display compaction markers when context overflow triggered compression during the run.

#### Scenario: Compaction marker displayed

- **WHEN** a run has a `compaction` stream event at T+30s
- **THEN** the timeline SHALL show a vertical marker line at the 30s position with a "Context Compacted" label

#### Scenario: Multiple compactions

- **WHEN** a run has 3 compaction events
- **THEN** 3 separate marker lines SHALL be displayed at their respective time positions

### Requirement: Stream color coding

Each event stream type SHALL have a distinct color for visual differentiation in the timeline and waterfall views.

#### Scenario: Color consistency

- **WHEN** the timeline displays events of different stream types
- **THEN** `tool_call` SHALL use purple, `model` SHALL use accent/blue, `file_op` SHALL use green, `subagent` SHALL use orange, `compaction` SHALL use warning/yellow, `system` SHALL use neutral/gray
- **AND** colors SHALL use CSS variables from the design system (e.g., `var(--purple)`, `var(--accent)`)
