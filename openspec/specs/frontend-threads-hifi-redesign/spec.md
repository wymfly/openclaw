# frontend-threads-hifi-redesign Specification

## Purpose

TBD - created by archiving change frontend-threads-hifi-contract-redesign. Update Purpose after archive.

## Requirements

### Requirement: Threads handoff package defines the visual contract

The threads module SHALL have a complete handoff package under `deck-go/frontend-handoff/modules/threads/` before the production UI rewrite is marked complete. The package SHALL use Gateway `deck.threads.list`, the Go BFF `GET /api/deck/threads`, `fetchThreads()`, and `DeckGoThreadEntry` as the source truth.

#### Scenario: Handoff package is reviewed

- **WHEN** the threads handoff package is created
- **THEN** it SHALL include `README.md`, `prototype.html`, `components.md`, `states.md`, `interactions.md`, and `api-usage.md`
- **AND** unsupported or uncertain real Gateway thread-source behavior SHALL be documented as discrepancy notes or open questions rather than guaranteed UI behavior
- **AND** the package SHALL describe filter, sorted inventory, relationship, handoff, empty, error, and payload detail states

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

### Requirement: Threads UI aligns with the settled frontend design system

The threads panel SHALL use the current chat/agents/routing/subagents/logs/settings/sessions/channels/gateway/models/usage/memory design-system posture: Inter/JetBrains Mono typography, `--ds-*` tokens, compact workbench density, low-radius surfaces, clear focus states, and local molecules only when canonical atoms or patterns are not yet justified.

#### Scenario: Threads UI is rendered

- **WHEN** the threads panel is rendered with contract-shaped mock data
- **THEN** the first viewport SHALL expose filter state, inventory health, selected relationship, metadata, and handoff affordances without overlapping text or nested decorative cards
- **AND** long thread, session, account, and channel identifiers SHALL wrap or truncate in stable constrained regions without shifting the layout

### Requirement: Threads mock visual verification is available

The threads rewrite SHALL include focused mock visual verification that exercises the real frontend against contract-shaped thread data without requiring a real Gateway or LLM.

#### Scenario: Mock visual E2E runs

- **WHEN** the threads mock visual E2E is executed
- **THEN** it SHALL load thread data through the normal frontend API path
- **AND** it SHALL capture or assert the ready workspace state and at least one interaction state such as filtering, selection, copy fallback, or related-panel handoff feedback
- **AND** closeout evidence SHALL label the test as mock visual coverage, not real Gateway/LLM E2E
