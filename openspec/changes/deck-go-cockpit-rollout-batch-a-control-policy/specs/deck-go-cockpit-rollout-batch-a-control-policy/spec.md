## ADDED Requirements

### Requirement: Batch A SHALL migrate Budget and Alerts shared cockpit chrome

Budget and Alerts SHALL consume existing cockpit pattern APIs for shared panel
chrome where their audited anatomy matches the cockpit rollout readiness matrix.
The batch SHALL NOT change runtime data semantics, mutations, routing, i18n
keys, backend/BFF/Gateway contracts, generated artifacts, dependencies, global
token values, design-system atom APIs, or `PanelCockpit` APIs.

#### Scenario: Budget uses cockpit patterns for direct-fit structures

- **WHEN** the Budget panel renders root/header/KPI/status/pill/surface chrome
- **THEN** the matching structures SHALL use the existing cockpit pattern APIs
- **AND** Budget rule rows, threshold progress, forms, evaluation cards, local
  changes, and confirmation flows SHALL remain module-local

#### Scenario: Alerts uses cockpit patterns for direct-fit structures

- **WHEN** the Alerts panel renders root/header/KPI/status/pill/surface chrome
- **THEN** the matching structures SHALL use the existing cockpit pattern APIs
- **AND** Alerts rule rows, trigger/action forms, fired-history fallback,
  condition cards, audit/test seams, and confirmation flows SHALL remain
  module-local

### Requirement: Batch A SHALL enforce style hygiene

The batch SHALL remove module-local CSS that reimplements cockpit-owned
root/header/KPI/metric/status/pill/surface structures after those structures
migrate to cockpit patterns. The batch SHALL NOT introduce old token alias
fallbacks or module-private font definitions for shared chrome.

#### Scenario: Style hygiene is checked before completion

- **WHEN** Batch A claims completion
- **THEN** stale alias and private-font scans SHALL be run for touched modules
- **AND** copied or duplicated cockpit CSS SHALL be absent from Budget and Alerts
- **AND** remaining module CSS SHALL be limited to business molecules, layout
  adaptation, modals, rows, forms, and complex domain surfaces
