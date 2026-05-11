## ADDED Requirements

### Requirement: Broad cockpit consumers SHALL use existing cockpit APIs first

During broad cockpit rollout, panels with matching anatomy SHALL consume the
existing `PanelRoot`, `PanelSurface`, `KpiStrip`, `PanelMetric`,
`PanelSectionHeader`, `PanelStatusRow`, and `PanelPill` APIs before introducing
new design-system patterns or local copies of already-promoted structures.

#### Scenario: A remaining panel has a local KPI strip

- **WHEN** a target panel has a local KPI or metric strip matching `KpiStrip` and `PanelMetric`
- **THEN** the rollout batch SHALL migrate that structure to the existing cockpit APIs
- **AND** it SHALL NOT copy Sessions, Usage, or Logs local CSS as a substitute

#### Scenario: Existing cockpit APIs are insufficient

- **WHEN** a target panel needs a repeated structure that cannot be expressed by existing cockpit APIs
- **THEN** the batch SHALL keep that structure local or open a separate pattern proposal
- **AND** it SHALL NOT add className/style escape hatches to cockpit patterns

### Requirement: New rollout patterns SHALL require separate reuse analysis

The cockpit rollout program SHALL NOT introduce new shared patterns merely
because broad migration discovers visually similar structures. New patterns such
as detail heroes, timelines, queue rows, or domain-specific row renderers SHALL
require a separate reuse-analysis proposal naming at least two stable call sites
and explaining why existing cockpit patterns cannot cover the shape.

#### Scenario: A detail hero repeats across two batches

- **WHEN** two or more panels expose a similar selected-detail hero during cockpit rollout
- **THEN** the batch SHALL record it as a promotion candidate
- **AND** a separate pattern proposal SHALL define the shared API before any code lands in `design-system/patterns`

#### Scenario: A batch wants to extend a cockpit pattern variant

- **WHEN** a batch needs a new typed variant on an existing cockpit pattern
- **THEN** the proposal SHALL justify the variant with panel evidence
- **AND** the variant SHALL be added through the design-system pattern layer with focused tests and Gallery coverage
