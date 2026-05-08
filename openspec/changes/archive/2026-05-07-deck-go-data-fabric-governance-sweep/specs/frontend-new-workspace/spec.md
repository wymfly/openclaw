## ADDED Requirements

### Requirement: frontend-new SHALL route panel server state through Data Fabric or approved exceptions

`deck-go/frontend-new` SHALL treat Data Fabric as the default server-state path
for panel and shared shell data.

#### Scenario: Panel server reads use Data Fabric

- **WHEN** a panel or shared shell hook needs backend/Gateway server data for
  first-load or background refresh
- **THEN** it SHALL import a Data Fabric hook, query option factory, or mutation
  wrapper
- **AND** it SHALL NOT add new direct `deckFetch`, generated Gateway client,
  `fetch*` BFF facade calls, or store-owned `fetch*/load*/refresh*` server
  lifecycle methods unless listed in the governance exception registry

#### Scenario: Specialized Chat paths remain explicit

- **WHEN** Chat stream, command, history seam, or adapter code remains
  imperative
- **THEN** it SHALL be represented as a governance exception with a specific
  reason
- **AND** ordinary panel reads SHALL NOT copy that exception pattern
