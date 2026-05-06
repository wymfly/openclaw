## MODIFIED Requirements

### Requirement: Threads production panel follows contract-backed workflows

The production threads panel SHALL render and operate from contract-backed thread inventory data while preserving the existing panel registry and API facade boundaries. The production implementation SHALL treat the v2 handoff as the visual target, but it SHALL simplify, omit, or hand off mutation, recent-activity, audit, transcript, and branch workflows unless they are verified against a Deck-facing contract.

#### Scenario: Thread data is loaded

- **WHEN** `fetchThreads()` resolves with contract-shaped thread entries
- **THEN** the panel SHALL show inventory status, result count, active filters, sorted thread rows, selected-thread identity, relationship evidence, timestamps, account/bound-by metadata, handoff actions, and raw payload detail
- **AND** missing optional fields SHALL render as unavailable, empty, or omitted rather than fabricated values

#### Scenario: Thread filters and selection are used

- **WHEN** an operator edits agent/channel filters, changes active/all status, refreshes, or selects a thread
- **THEN** the panel SHALL call `fetchThreads()` with normalized `agentId`, `channel`, and `status` values
- **AND** the selected thread SHALL remain stable when the loaded result still contains it
- **AND** the fallback selection SHALL choose the most recently active loaded thread

#### Scenario: Thread handoff actions are used

- **WHEN** an operator copies the selected session key or opens related Sessions/Agents views
- **THEN** the panel SHALL use the selected `targetSessionKey` and `agentId`
- **AND** it SHALL use the shared Deck navigation helpers for cross-panel handoff instead of direct route mutation
- **AND** clipboard failure SHALL produce a usable visible session-key fallback

#### Scenario: Prototype-only thread workflows are reviewed

- **WHEN** the handoff package references unbind, rebind, rename, recent activity, audit, transcript, or branch-indicator workflows
- **THEN** production SHALL keep those workflows out of active behavior unless a matching Deck-facing contract or verified BFF endpoint exists
- **AND** unresolved workflow assumptions SHALL be recorded in `deck-go/frontend-handoff/modules/threads/implementation-notes.md`
