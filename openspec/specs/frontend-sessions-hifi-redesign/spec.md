# frontend-sessions-hifi-redesign Specification

## Purpose

TBD - created by archiving change frontend-sessions-hifi-contract-redesign. Update Purpose after archive.

## Requirements

### Requirement: Sessions handoff package defines the visual contract

The sessions module SHALL have a complete handoff package under `deck-go/frontend-handoff/modules/sessions/` before the production UI rewrite is marked complete. The package SHALL use the current Deck-facing session, chat history, usage, compaction, and subagent lineage DTOs and BFF routes as source truth.

#### Scenario: Handoff package is reviewed

- **WHEN** the sessions handoff package is created
- **THEN** it SHALL include `README.md`, `prototype.html`, `components.md`, `states.md`, `interactions.md`, and `api-usage.md`
- **AND** unsupported or uncertain product/Gateway behavior SHALL be documented as discrepancy notes or open questions rather than guaranteed UI behavior
- **AND** transcript cache, destructive mutation, and export behavior SHALL be documented explicitly

### Requirement: Sessions production panel follows contract-backed workflows

The production sessions panel SHALL render and operate from contract-backed session inventory, preview, detail, history, usage, compaction, subagent lineage, and mutation data while preserving the existing panel registry and API facade boundaries.

#### Scenario: Sessions data is loaded

- **WHEN** session inventory, previews, selected detail, chat history, usage/context data, compaction checkpoints, and optional subagent lineage resolve
- **THEN** the panel SHALL show inventory status, detail status, visible count, filters, selected-session metadata, transcript evidence, usage/context diagnostics, compaction history, lineage/relations when present, and action controls
- **AND** missing optional fields SHALL render as unavailable, empty, or omitted rather than fabricated values

#### Scenario: Session filters and selection are used

- **WHEN** an operator searches, changes type/time filters, pages inventory, selects a session, or opens a session from a navigation `sessionKey`
- **THEN** the panel SHALL use the existing sessions wrappers and keep selected-session detail/history consistent with the selected key
- **AND** transcript cache usage SHALL remain intact for cached histories

#### Scenario: Session transcript is searched or exported

- **WHEN** an operator searches transcript history or prepares JSON/Markdown export
- **THEN** the panel SHALL search the loaded normalized transcript messages
- **AND** export previews SHALL be generated from the selected session and current transcript messages without mutating server state

#### Scenario: Session actions are executed

- **WHEN** an operator resets, clears, patches, compacts, or deletes a session
- **THEN** the panel SHALL call the existing session action wrapper with the current selected session key and required payload
- **AND** compaction and delete SHALL retain a confirmation gate
- **AND** successful actions SHALL invalidate the selected transcript cache and refresh session state according to the existing selection-preservation behavior

### Requirement: Sessions UI aligns with the settled frontend design system

The sessions panel SHALL use the chat/agents/routing/subagents/logs/settings design-system posture: Inter/JetBrains Mono typography, `--ds-*` tokens, compact workbench density, low-radius surfaces, clear focus states, and local molecules only when canonical atoms are not yet justified.

#### Scenario: Sessions UI is rendered

- **WHEN** the sessions panel is rendered with contract-shaped mock data
- **THEN** the first viewport SHALL expose inventory health, selected-session identity, status/count metrics, filters, transcript/usage evidence, and action affordances without overlapping text or nested decorative cards
- **AND** destructive actions SHALL remain visually distinct from non-destructive actions

### Requirement: Sessions mock visual verification is available

The sessions rewrite SHALL include focused mock visual verification that exercises the real frontend against contract-shaped sessions/history/usage/compaction/lineage data without requiring a real Gateway or LLM.

#### Scenario: Mock visual E2E runs

- **WHEN** the sessions mock visual E2E is executed
- **THEN** it SHALL load session data through the frontend API path
- **AND** it SHALL capture or assert the ready workbench state and at least one interaction state such as transcript export, filter state, compaction confirmation, patch result, or delete confirmation
- **AND** closeout evidence SHALL label the test as mock visual coverage, not real Gateway/LLM E2E
