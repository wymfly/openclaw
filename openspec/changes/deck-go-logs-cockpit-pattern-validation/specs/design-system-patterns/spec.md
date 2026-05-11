## ADDED Requirements

### Requirement: Third cockpit consumers SHALL reuse existing cockpit patterns

The design-system implementation SHALL require any third validation module with
matching panel root, section header, KPI metric, or status-row anatomy to
consume the existing cockpit patterns instead of copying local CSS from Sessions
or Usage. Module-specific observability, table, tape, form, chart, or detail
molecules SHALL remain local unless they pass a separate reuse-analysis gate.

#### Scenario: Logs validates the cockpit pattern set

- **WHEN** Logs has matching root/header/KPI/status-row anatomy
- **THEN** it SHALL consume `PanelRoot`, `KpiStrip`, `PanelMetric`,
  `PanelSectionHeader`, and `PanelStatusRow` where those structures apply
- **AND** it SHALL keep log rows, filters, live tape, selected-line details, and
  raw payload rendering local

#### Scenario: Logs needs a shape not covered by cockpit patterns

- **WHEN** Logs has a local shape such as `LogRow`, `TapeRow`, or filter-level
  toggles
- **THEN** the implementation SHALL NOT add a new design-system pattern in this
  change
- **AND** any future promotion SHALL require a separate proposal with at least
  two module call sites
