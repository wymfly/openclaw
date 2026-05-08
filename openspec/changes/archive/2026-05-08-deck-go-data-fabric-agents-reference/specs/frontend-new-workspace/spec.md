## ADDED Requirements

### Requirement: Agents panel SHALL be the first Data Fabric reference panel

`deck-go/frontend-new` SHALL migrate the Agents panel to Data Fabric as the
first business-module reference while preserving local UI state outside the
server-state cache.

#### Scenario: Agents panel avoids new naked server fetch lifecycle

- **WHEN** the Agents panel needs deck-go backend or Gateway-backed server state
- **THEN** it SHALL import Agents Data Fabric hooks or option factories
- **AND** it SHALL NOT add new production component-local `useEffect(fetch*)`
  lifecycles, raw `deckFetch` calls, raw Gateway client calls, or store-owned
  `load*/fetch*/refresh*` server lifecycle methods

#### Scenario: Agents panel preserves UI state boundaries

- **WHEN** the Agents panel stores selected agent, search text, filters, active
  section, modal state, form drafts, or dirty flags
- **THEN** that state SHALL remain in React state or UI stores
- **AND** it SHALL NOT be modeled as TanStack Query server state
