## ADDED Requirements

### Requirement: Chat surroundings SHALL follow the Data Fabric panel protocol

`deck-go/frontend-new` Chat surroundings SHALL use Data Fabric for
backend/Gateway server state and preserve local Chat UI interaction state
outside the server-state cache.

#### Scenario: Chat surrounding fetch lifecycles are migrated

- **WHEN** Chat surrounding code loads session inventory, active snapshot,
  session previews, command discovery, or session-event subscription state
- **THEN** it SHALL import the matching Data Fabric hook, mutation, or query
  option factory
- **AND** it SHALL NOT add new raw `deckFetch`, raw Gateway client, or
  component-local `useEffect(fetch*)` lifecycles for migrated data

#### Scenario: Chat UI state remains local

- **WHEN** Chat stores transcript messages, streaming state, tool progress,
  command execution state, selected artifact, right panel mode, search input,
  sidebar collapsed state, or canvas command queue
- **THEN** that state SHALL remain in the existing store or React local state
- **AND** it SHALL NOT be modeled as TanStack Query server state

#### Scenario: Chat remains buildable and testable

- **WHEN** `cd deck-go && make frontend-build` and focused Chat tests run
- **THEN** `frontend-new` SHALL type-check and the migrated Chat surroundings
  SHALL pass with Data Fabric test support available
