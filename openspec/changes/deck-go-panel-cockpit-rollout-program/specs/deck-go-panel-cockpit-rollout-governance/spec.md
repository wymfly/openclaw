## ADDED Requirements

### Requirement: Cockpit rollout SHALL be governed by a head program

The system SHALL use a head OpenSpec program to govern broad cockpit pattern
rollout after Sessions, Usage, and Logs have validated the cockpit pattern API.
The head program SHALL define target inventory, readiness classifications, batch
grouping rules, and program closure requirements before broad panel migration
claims are made.

#### Scenario: A cockpit rollout batch is proposed

- **WHEN** a proposal migrates cockpit patterns into more than one remaining Deck panel
- **THEN** the proposal SHALL reference the cockpit rollout head program
- **AND** it SHALL identify the audited readiness classification for every panel in that batch

#### Scenario: Completion is claimed for the rollout program

- **WHEN** the cockpit rollout is claimed complete
- **THEN** every target panel SHALL be recorded as migrated, stay-local, or deferred with evidence
- **AND** the program SHALL include closure evidence linking all batch proposals and unresolved follow-ups

### Requirement: All target panels SHALL receive a readiness classification

The rollout program SHALL classify every target panel under
`deck-go/frontend-new/src/components/panels/` before implementation batches
begin. Each panel SHALL be classified as `direct-fit`, `partial-fit`,
`needs-new-pattern`, or `stay-local`, with evidence from code, CSS, tests, or
handoff notes.

#### Scenario: A panel has matching cockpit anatomy

- **WHEN** a panel contains repeated root, header, KPI metric, status-row, pill-row, or panel-surface anatomy
- **THEN** the readiness matrix SHALL classify which structures can consume existing cockpit patterns
- **AND** it SHALL list domain-specific structures that must remain module-local

#### Scenario: A panel does not fit cockpit rollout

- **WHEN** a panel is governed by a specialized surface or lacks meaningful cockpit anatomy
- **THEN** the readiness matrix SHALL classify it as `stay-local` or deferred
- **AND** it SHALL include a concrete reason rather than omitting the panel from the program

### Requirement: Batch proposals SHALL group panels by shared anatomy

Cockpit rollout implementation SHALL proceed through batch OpenSpec changes
grouping structurally similar panels. A normal batch SHALL include 2-5 panels
unless the proposal explicitly justifies a smaller validation slice or a larger
mechanical-only migration.

#### Scenario: A direct-fit batch is created

- **WHEN** multiple panels share header/status/KPI anatomy and have low migration risk
- **THEN** they MAY be implemented in one batch proposal
- **AND** the batch SHALL keep per-module tests, visual checks, and readiness evidence separate

#### Scenario: A panel in a batch proves more complex during explore

- **WHEN** implementation evidence shows a batched panel is not a direct or partial fit
- **THEN** the panel SHALL be removed from the batch or reclassified
- **AND** the batch SHALL continue only for panels whose classification remains supported

### Requirement: Cockpit rollout SHALL preserve module-local molecules

Batch changes SHALL migrate only the structures covered by existing cockpit
patterns unless a separate pattern proposal is accepted. Module-specific rows,
charts, editors, raw payload seams, timeline/event renderers, guarded mutation
flows, and domain-specific detail heroes SHALL remain local by default.

#### Scenario: A module-specific molecule repeats visually

- **WHEN** a local row, hero, timeline, editor, or detail molecule resembles a structure in another module
- **THEN** the batch SHALL NOT promote it automatically
- **AND** a separate pattern proposal SHALL be required if the molecule needs a shared API

#### Scenario: A batch migrates cockpit chrome only

- **WHEN** a batch changes only root/header/KPI/status/pill/surface structures
- **THEN** it SHALL preserve data loading, mutation behavior, routing, i18n keys, and contract paths
- **AND** any behavior change SHALL be moved to a separate non-cockpit proposal
