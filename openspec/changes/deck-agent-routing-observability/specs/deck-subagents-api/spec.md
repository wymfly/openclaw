## ADDED Requirements

### Requirement: deck.subagents.list returns subagent runs from in-memory store

The system SHALL return subagent runs from the in-memory `subagentRuns` Map plus disk-persisted state. Results SHALL be filterable by status, child agent ID, and requester agent ID. The system SHALL NOT provide long-term history beyond the memory sweep window.

#### Scenario: List active runs

- **WHEN** client calls `deck.subagents.list({ status: "active" })`
- **THEN** system returns only runs with no `endedAt`, each with `runId`, `childAgentId`, `requesterAgentId`, `task`, `depth`, `status: "active"`, and `createdAt`

#### Scenario: List all runs with pagination

- **WHEN** client calls `deck.subagents.list({ status: "all", limit: 10, offset: 0 })`
- **THEN** system returns up to 10 runs sorted by `createdAt` descending, with `total` reflecting the count of matching runs still in memory

#### Scenario: No runs in memory after sweep

- **WHEN** client calls `deck.subagents.list({ status: "all" })` and all runs have been swept
- **THEN** system returns `runs: []` and `total: 0`

### Requirement: deck.subagents.kill terminates an active subagent run

The system SHALL terminate the specified subagent run using the existing kill mechanism.

#### Scenario: Kill active run

- **WHEN** client calls `deck.subagents.kill({ runId: "abc" })` and the run is active
- **THEN** system terminates the run and returns `ok: true` with the `childSessionKey`

#### Scenario: Kill non-existent run

- **WHEN** client calls `deck.subagents.kill({ runId: "nonexistent" })`
- **THEN** system returns `NOT_FOUND` error

### Requirement: deck.subagents.lineage returns the full call tree

The system SHALL walk upward from the given run/session to find the root (non-subagent session), then collect all descendant runs to form the complete tree. Each node SHALL include `parentRunId` reconstructed by reverse-lookup.

#### Scenario: Lineage for a depth-1 run

- **WHEN** client calls `deck.subagents.lineage({ runId: "abc" })` and "abc" was spawned by the root session
- **THEN** system returns `root` with the top-level session, and `nodes` containing one entry for "abc" with `depth: 1` and `parentRunId: null`

#### Scenario: Lineage for a nested tree

- **WHEN** client calls `deck.subagents.lineage({ sessionKey: "agent:tester:subagent:uuid" })` where tester was spawned by coder, which was spawned by main
- **THEN** system returns `root` as main's session, and `nodes` with two entries: coder (depth 1, parentRunId null) and tester (depth 2, parentRunId = coder's runId)

#### Scenario: Lineage for non-subagent session

- **WHEN** client calls `deck.subagents.lineage({ sessionKey: "agent:main:main" })`
- **THEN** system returns `root` as main's session and `nodes: []` (no subagent runs)
