## ADDED Requirements

### Requirement: Batch B SHALL migrate partial-fit relationship/runtime chrome

Identity, Subagents, and Channels SHALL consume existing cockpit pattern APIs
for shared panel chrome where the audited anatomy matches the cockpit rollout
readiness matrix. The batch SHALL preserve runtime behavior and SHALL NOT
change data loading, mutations, routing, i18n keys, backend/BFF/Gateway
contracts, generated artifacts, dependencies, global token values,
design-system atom APIs, or `PanelCockpit` APIs.

#### Scenario: Identity uses cockpit patterns for matching structures

- **WHEN** Identity renders topbar/KPI/status/pill/surface chrome
- **THEN** matching structures SHALL use existing cockpit pattern APIs
- **AND** hash chips, channel pills, peer mapping rows, link/unlink dialogs,
  base-hash guards, and raw payload disclosure SHALL remain local

#### Scenario: Subagents uses cockpit patterns for matching structures

- **WHEN** Subagents renders topbar/KPI/status/pill/surface chrome
- **THEN** matching structures SHALL use existing cockpit pattern APIs
- **AND** run queue rows, lineage tree/timeline, defaults grid, permissions,
  and action result surfaces SHALL remain local

#### Scenario: Channels uses cockpit patterns for matching structures

- **WHEN** Channels renders list/detail header, KPI, status, or surface chrome
- **THEN** matching structures SHALL use existing cockpit pattern APIs where
  the current contract supports it
- **AND** diagnostics, probe result badges, WeCom access controls, routing
  handoff, throughput chart, and channel inventory rows SHALL remain local

### Requirement: Batch B SHALL enforce partial-fit style hygiene

The batch SHALL remove module-local CSS that reimplements cockpit-owned shared
chrome after those structures migrate. It SHALL NOT introduce old token alias
fallbacks, copied cockpit CSS, or module-private font definitions for migrated
chrome.

#### Scenario: Batch B style hygiene is checked

- **WHEN** Batch B claims completion
- **THEN** stale alias scans SHALL pass for Identity, Subagents, and Channels
- **AND** remaining module CSS SHALL be limited to local molecules, layout
  adaptation, forms, rows, diagnostics, and domain-specific surfaces
