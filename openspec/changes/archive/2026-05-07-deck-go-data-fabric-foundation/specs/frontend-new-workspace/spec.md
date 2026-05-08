## ADDED Requirements

### Requirement: frontend-new server-state reads SHALL use Data Fabric

`deck-go/frontend-new` SHALL route new server-state reads through the Data Fabric provider and domain hooks instead of adding new component-local `useEffect(fetch*)` lifecycles or store-owned `load*/fetch*/refresh*` server fetch methods.

#### Scenario: New panel server-state read is added

- **WHEN** a new or touched `frontend-new` panel needs data from deck-go backend or Gateway-backed adapters
- **THEN** the implementation SHALL add or reuse a Data Fabric query hook
- **AND** panel code SHALL import the domain hook rather than raw `deckFetch`, `gateway-client`, or `useQueryClient`

#### Scenario: Local UI state remains outside Data Fabric

- **WHEN** a panel stores selected rows, tabs, filters, modal state, form drafts, or expanded sections
- **THEN** that state SHALL remain in React local state or UI stores
- **AND** it SHALL NOT be modeled as TanStack Query server state

### Requirement: frontend-new active panel workspace SHALL remain independently buildable

`deck-go/frontend-new` SHALL remain the active Vite/React workspace and SHALL continue to build and test independently after Data Fabric is mounted.

#### Scenario: Frontend build runs

- **WHEN** `cd deck-go && make frontend-build` is run
- **THEN** `frontend-new` SHALL type-check and build with the Data Fabric provider mounted

#### Scenario: Frontend tests run

- **WHEN** `cd deck-go/frontend-new && npm run test:deck-ui` is run
- **THEN** `frontend-new` tests SHALL pass with Data Fabric test support available
