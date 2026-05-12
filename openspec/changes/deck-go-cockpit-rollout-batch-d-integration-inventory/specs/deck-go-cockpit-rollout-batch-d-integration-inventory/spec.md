## ADDED Requirements

### Requirement: Batch D SHALL migrate partial-fit integration/inventory chrome

Skills, Plugins, and Nodes SHALL consume existing cockpit pattern APIs for
shared panel chrome where the audited anatomy matches the cockpit rollout
readiness matrix. The batch SHALL preserve runtime behavior and SHALL NOT
change data loading, mutations, routing, i18n keys, backend/BFF/Gateway
contracts, generated artifacts, dependencies, global token values,
design-system atom APIs, or `PanelCockpit` APIs.

#### Scenario: Skills uses cockpit patterns for matching structures

- **WHEN** Skills renders page header/KPI/status/pill/surface chrome
- **THEN** matching structures SHALL use existing cockpit pattern APIs
- **AND** skill inventory rows, requirement evidence, config editors, install
  option rows, ClawHub catalog, and agent matrix SHALL remain local

#### Scenario: Plugins uses cockpit patterns for matching structures

- **WHEN** Plugins renders page header/KPI/status/pill/surface chrome
- **THEN** matching structures SHALL use existing cockpit pattern APIs
- **AND** plugin inventory rows, capability/action evidence, diagnostics,
  related-channel handoff, and lifecycle notices SHALL remain local

#### Scenario: Nodes uses cockpit patterns for matching structures

- **WHEN** Nodes renders metrics/status/pill/surface/selected node chrome
- **THEN** matching structures SHALL use existing cockpit pattern APIs
- **AND** lifecycle strips, pairing rows, dynamic command forms, pending-work
  queue, and permission/capability chips SHALL remain local

### Requirement: Batch D SHALL enforce integration style hygiene

The batch SHALL remove module-local CSS that reimplements cockpit-owned shared
chrome after those structures migrate. It SHALL NOT introduce old token alias
fallbacks, copied cockpit CSS, or module-private font definitions for migrated
chrome.

#### Scenario: Batch D style hygiene is checked

- **WHEN** Batch D claims completion
- **THEN** stale alias scans SHALL pass for Skills, Plugins, and Nodes
- **AND** remaining module CSS SHALL be limited to local molecules, layout
  adaptation, inventory rows, install/config/catalog surfaces, lifecycle
  evidence, pairing, remote-control, and trust affordances
