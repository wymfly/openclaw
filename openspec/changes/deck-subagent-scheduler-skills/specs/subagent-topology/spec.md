## ADDED Requirements

### Requirement: ActiveRunsTab displays DAG topology visualization

The ActiveRunsTab SHALL render subagent runs as an interactive DAG (directed acyclic graph) using the TreeDAG component, showing parent-child relationships with SVG connecting lines.

#### Scenario: Display topology with active runs

- **WHEN** user navigates to Subagents panel Active Runs tab with running subagents
- **THEN** system renders a TreeDAG visualization where each node shows agent badge, task summary, elapsed time, status icon (🔄 running / ✅ completed / ❌ failed / ⏱️ timeout), and root agent is highlighted

#### Scenario: Empty topology

- **WHEN** no subagent runs are active
- **THEN** system shows empty state with message "当前无活跃的子智能体运行"

#### Scenario: Large topology truncation

- **WHEN** lineage tree exceeds 50 nodes (maxNodes limit)
- **THEN** system renders the first 50 nodes and displays a "展开更多" link at truncated branches

### Requirement: Click-to-inspect shows session history

Clicking a node in the DAG SHALL navigate to the session detail for that subagent run.

#### Scenario: Inspect running subagent

- **WHEN** user clicks a node in the DAG visualization
- **THEN** system navigates to Sessions panel filtered to that run's sessionKey, showing the conversation history

#### Scenario: Inspect completed subagent

- **WHEN** user clicks a completed/failed node
- **THEN** system navigates to Sessions panel with the historical session, displaying outcome and duration

### Requirement: Steer operation injects instruction into running subagent

A "Steer" button on running subagent nodes SHALL allow users to inject an instruction into the subagent without terminating it.

#### Scenario: Steer a running subagent

- **WHEN** user clicks "Steer" on a running node, types an instruction in the dialog, and confirms
- **THEN** system calls `deck.subagents.steer({ runId, instruction })` and shows a success toast with the instruction preview

#### Scenario: Steer confirmation dialog

- **WHEN** user clicks "Steer"
- **THEN** a dialog appears with a textarea for the instruction, a warning about behavior change, and Confirm/Cancel buttons

#### Scenario: Steer idempotency dedup

- **WHEN** user submits the same instruction to the same runId within 60 seconds (e.g., double-click)
- **THEN** system returns the previous result without re-injecting; UI shows "指令已发送" without error

#### Scenario: Steer on non-running subagent

- **WHEN** user attempts to steer a completed/failed subagent
- **THEN** the Steer button is disabled with tooltip "仅可对运行中的子智能体发送指令"

### Requirement: Attachment transfer visualization on DAG edges

DAG edges SHALL display attachment transfer information when files are passed between parent and child subagents.

#### Scenario: Display attachment on edge

- **WHEN** a parent agent passes attachments to a child subagent
- **THEN** the connecting edge shows a small file icon badge; hovering shows a tooltip with file name, type, and size

#### Scenario: No attachments

- **WHEN** no attachments are transferred on an edge
- **THEN** the edge renders as a plain line without any badge

### Requirement: deck.subagents.steer RPC

A new `deck.subagents.steer` RPC SHALL accept `{ runId: string, instruction: string }` and inject the instruction into the running subagent's message queue.

#### Scenario: Successful steer

- **WHEN** `deck.subagents.steer` is called with a valid active runId
- **THEN** the instruction is injected and the response includes `{ success: true, dedupKey: string }`

#### Scenario: Steer non-existent run

- **WHEN** `deck.subagents.steer` is called with an invalid or completed runId
- **THEN** the response returns error `RUN_NOT_FOUND` or `RUN_NOT_ACTIVE`

#### Scenario: Dedup within window

- **WHEN** the same `(runId, sha256(instruction))` is sent within 60 seconds of a previous successful steer
- **THEN** the response returns `{ success: true, deduped: true }` without re-injecting
