## MODIFIED Requirements

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
