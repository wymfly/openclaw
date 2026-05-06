# frontend-memory-hifi-redesign Specification

## Purpose

Defines the contract-led high-fidelity redesign requirements for the Deck Memory panel, including handoff artifacts, wrapper-preserving frontend behavior, module-local styling, guarded dream actions, and mock visual evidence.

## Requirements

### Requirement: Memory handoff package defines the visual contract

The change SHALL create a Memory handoff package under `deck-go/frontend-handoff/modules/memory/` that records code-truth constraints, contract inputs, implementation notes, interaction states, and open questions.

#### Scenario: Handoff package is complete

- **WHEN** the Memory redesign is implemented
- **THEN** the handoff package SHALL include `README.md`, `prototype.html`, `components.md`, `states.md`, `interactions.md`, and `api-usage.md`
- **AND** the package SHALL state that code and contracts remain the final authority
- **AND** uncertain real Gateway memory, search, LanceDB, and dream-diary semantics SHALL be listed as follow-up instead of invented in the frontend

### Requirement: Memory workspace preserves current contract chain

The Memory panel SHALL continue to load memory data through the existing frontend API wrappers and Deck backend endpoints rather than direct browser-to-Gateway RPC, with `POST /api/memory/search` treated as the canonical search route and `GET /api/memory/search` retained as a compatibility alias.

#### Scenario: Memory data loads through wrappers

- **WHEN** the Memory panel refreshes or performs an action
- **THEN** it SHALL use `fetchAgentsList`, `browseMemory`, `readMemoryFile`, `searchMemory`, `fetchMemoryHealth`, and `runMemoryDreams`
- **AND** the browser code SHALL NOT call Gateway RPC methods directly
- **AND** the `searchMemory` wrapper SHALL send canonical POST search requests while preserving compatibility for degraded GET search responses in tests and backend aliases

### Requirement: Memory workspace exposes browse, search, graph, health, and dreams

The Memory panel SHALL present agent-scoped memory browse/read, search, health, and dreams as four first-class tabs in a coherent operations workspace. Graph-style relationship evidence MAY be shown as derived browse metadata when backed by loaded file nodes, but Graph SHALL NOT remain a separate first-class tab for the v2 handoff implementation.

#### Scenario: Memory ready state is visible

- **WHEN** memory data is loaded
- **THEN** the panel SHALL show the active agent, current tab/lane, file or result counts, current path, and selected detail state
- **AND** empty/loading/error states SHALL remain visible without blank panes
- **AND** the top-level tab set SHALL match the v2 handoff: Browse, Search, Health, and Dreams

### Requirement: Memory destructive actions remain guarded

The Memory panel SHALL preserve confirmation guards for destructive dream-diary actions.

#### Scenario: Destructive dream action is requested

- **WHEN** an operator requests repair, reset, or reset short-term actions
- **THEN** the panel SHALL require confirmation before calling the action
- **AND** rejected confirmations SHALL NOT call `runMemoryDreams`

### Requirement: Memory mock visual evidence is collected

The change SHALL add focused mock visual E2E evidence for the Memory panel using contract-shaped fixture data.

#### Scenario: Mock visual E2E covers memory states

- **WHEN** the Memory mock visual E2E runs
- **THEN** it SHALL open the Memory panel through the normal frontend route
- **AND** it SHALL capture the ready workspace and at least two interaction states such as file read, search, health, dreams, or graph
- **AND** any screenshots or readiness notes SHALL label this as mock visual coverage rather than real Gateway/LLM evidence

### Requirement: Memory styles are module-local

The Memory redesign SHALL move obsolete panel-specific styling out of global `theme.css` into Memory module-local CSS or otherwise narrow global selectors so they do not define the new panel layout.

#### Scenario: Memory global styles are removed or narrowed

- **WHEN** the Memory redesign is complete
- **THEN** new layout, file row, graph row, search result, health, dream, and detail sidecar styling SHALL live under `deck-go/frontend-new/src/components/panels/memory/`
- **AND** global CSS SHALL NOT retain broad `deck-ui-memory` layout definitions for the rewritten panel
