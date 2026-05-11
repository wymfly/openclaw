## ADDED Requirements

### Requirement: Logs SHALL validate cockpit patterns as the third module sample

The cross-module readiness record SHALL identify Logs as the third validation
sample for the cockpit pattern set after Sessions and Usage. The record SHALL
state which cockpit patterns Logs consumed, which Logs molecules stayed local,
whether canonical token values changed, and whether broad rollout is now allowed
or still module-by-module.

#### Scenario: Logs cockpit migration completes

- **WHEN** Logs consumes cockpit patterns for its root/header/KPI/status
  structures
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md`
  SHALL record Logs as the third cockpit validation sample
- **AND** the record SHALL state that canonical token values did not change
- **AND** the record SHALL classify log rows, filters, live tape, details pane,
  and raw payload rendering as Logs-local molecules

#### Scenario: Broad cockpit rollout is considered after Logs

- **WHEN** Logs validates the cockpit API with fresh tests and visual smoke
- **THEN** readiness SHALL allow future modules to choose cockpit patterns for
  matching root/header/KPI/status structures
- **AND** readiness SHALL still reject global token-value rewrites or automatic
  all-module migration without module-specific evidence
