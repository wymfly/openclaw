## ADDED Requirements

### Requirement: Batch C SHALL migrate partial-fit automation/control chrome

Webhooks, Cron, and Approvals SHALL consume existing cockpit pattern APIs for
shared panel chrome where the audited anatomy matches the cockpit rollout
readiness matrix. The batch SHALL preserve runtime behavior and SHALL NOT
change data loading, mutations, routing, i18n keys, backend/BFF/Gateway
contracts, generated artifacts, dependencies, global token values,
design-system atom APIs, or `PanelCockpit` APIs.

#### Scenario: Webhooks uses cockpit patterns for matching structures

- **WHEN** Webhooks renders topbar/KPI/status/pill/surface chrome
- **THEN** matching structures SHALL use existing cockpit pattern APIs
- **AND** receiver rows, event subscriptions, receiver form, delivery history,
  test result seam, and raw payload disclosure SHALL remain local

#### Scenario: Cron uses cockpit patterns for matching structures

- **WHEN** Cron renders topbar/KPI/status/pill/surface chrome
- **THEN** matching structures SHALL use existing cockpit pattern APIs
- **AND** job rows, schedule forms, heartbeat details, run-history rows, and
  manual-run evidence SHALL remain local

#### Scenario: Approvals uses cockpit patterns for matching structures

- **WHEN** Approvals renders topbar/KPI/status/pill/surface chrome
- **THEN** matching structures SHALL use existing cockpit pattern APIs
- **AND** decision controls, policy defaults, allowlist rows, plugin approval
  rows, stream evidence, and raw policy/action disclosure SHALL remain local

### Requirement: Batch C SHALL enforce guarded-write style hygiene

The batch SHALL remove module-local CSS that reimplements cockpit-owned shared
chrome after those structures migrate. It SHALL NOT introduce old token alias
fallbacks, copied cockpit CSS, or module-private font definitions for migrated
chrome.

#### Scenario: Batch C style hygiene is checked

- **WHEN** Batch C claims completion
- **THEN** stale alias scans SHALL pass for Webhooks, Cron, and Approvals
- **AND** remaining module CSS SHALL be limited to local molecules, layout
  adaptation, forms, rows, delivery/scheduler/security surfaces, and guarded
  write affordances
