## ADDED Requirements

### Requirement: Command-backed Chat and Sessions mutations SHALL map to contract truth

Deck Go SHALL treat command-backed Chat and Sessions mutations as first-class contract-backed workflows.

#### Scenario: Command mutates session state

- **WHEN** a visible command creates, sends to, patches, resets, clears, compacts, aborts, branches, restores, or deletes Chat/Sessions state
- **THEN** the command matrix SHALL name the Deck BFF route or Gateway method used for the mutation
- **AND** the mutation SHALL have DTO, frontend facade, success/failure interpretation, and evidence status

#### Scenario: Command has equivalent UI control

- **WHEN** a command is equivalent to a visible UI control such as a context-bar toggle, reset action, stop button, or compact action
- **THEN** both the command path and the UI-control path SHALL converge on the same backend mutation semantics
- **AND** both paths SHALL update the same frontend state fields

### Requirement: Command mutations SHALL reconcile durable state after execution

Deck Go SHALL reconcile command mutation results into durable Chat/Sessions state.

#### Scenario: Mutation returns success

- **WHEN** a command-backed mutation succeeds
- **THEN** the frontend SHALL update local state immediately when safe
- **AND** the frontend SHALL reconcile against SSE, snapshot, list, or read-after-write data when available

#### Scenario: Mutation returns failure

- **WHEN** a command-backed mutation fails
- **THEN** the frontend SHALL not leave optimistic state that falsely indicates success
- **AND** the user SHALL see a command-specific failure state or message

#### Scenario: Compact mutation completes

- **WHEN** command-driven compaction completes
- **THEN** the active session SHALL display updated compaction count, checkpoint availability, transcript/projection state, or a documented degraded state when the Gateway lacks one of those signals

### Requirement: Command mutation safety SHALL be explicit

Deck Go SHALL classify command-backed mutations by real-E2E safety before running them against the real Gateway.

#### Scenario: Disposable fixture is proven

- **WHEN** a command mutation has a disposable isolated session/workspace/config fixture and cleanup or harmless persistence is proven
- **THEN** the command MAY be included in real E2E representative coverage

#### Scenario: Disposable fixture is not proven

- **WHEN** a command mutation can affect non-disposable operator state
- **THEN** the command SHALL be skipped-safe or handoff-blocked for real E2E
- **AND** its code path and UI behavior SHALL still receive unit, integration, or mock E2E verification
