# design-system-cross-module-readiness Specification

## Purpose

TBD - created by archiving change frontend-chat-parity-and-foundation-audit. Update Purpose after archive.

## Requirements

### Requirement: Cross-module readiness audit gate

Before any non-chat panel migration to the design system begins, the panel SHALL be evaluated against `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` (a panel × atom matrix with `applies` / `extend` / `missing` status per cell), and the panel team SHALL confirm each `extend` and `missing` entry is either resolved or accepted as a follow-up.

#### Scenario: Panel migration is proposed

- **WHEN** a developer proposes migrating a non-chat panel (Settings / Models / Channels / Sessions / Logs / future) to the design system
- **THEN** the readiness matrix SHALL include a row for that panel with explicit status per atom
- **AND** the proposal SHALL link to that row as the readiness gate evidence

#### Scenario: Atom is missing for a panel migration

- **WHEN** the readiness matrix shows `missing` for a panel × atom cell (e.g., "Channels panel needs ChartSparkline atom")
- **THEN** the new atom SHALL be added to the design system in a separate atom-introduction change
- **AND** the panel migration SHALL wait for that atom-introduction change to land
- **AND** existing atoms MUST NOT be re-architected to satisfy the missing entry — only additive new atoms are allowed

### Requirement: No-breaking-change promise for atoms during cross-module rollout

When a panel migration discovers that an existing atom is insufficient (e.g., the Card atom has no `surface=warning` variant needed for the alert panel header), the missing functionality SHALL be added as either a new variant on the existing atom (additive) or as a new atom — never as a backwards-incompatible change to the atom's existing public API.

#### Scenario: Existing atom needs a new variant

- **WHEN** a panel migration requires a Card variant (`surface=warning`) not yet supported
- **THEN** the variant SHALL be added to the Card atom's existing variant union (`flat | elevated | inset | warning`)
- **AND** existing consumers SHALL continue to work unchanged
- **AND** the new variant SHALL ship with its own test coverage in the existing Card test file

#### Scenario: Existing atom's public API would need to change

- **WHEN** a panel migration requires the existing atom's API to change in a backwards-incompatible way
- **THEN** the panel migration SHALL be paused
- **AND** a new atom SHALL be introduced alongside the existing one (e.g., `CardV2`) rather than re-architecting the existing atom
- **AND** the readiness matrix SHALL track the deprecation/migration path between old and new atom

### Requirement: Readiness matrix maintenance

The cross-module readiness matrix at `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL be updated whenever (a) a new atom is added to the design system, (b) a new target panel is identified, or (c) a panel migration completes and its row should be moved to a "completed migrations" appendix.

#### Scenario: New atom is added to design-system

- **WHEN** a new atom is added under `deck-go/frontend/src/design-system/atoms/`
- **THEN** the readiness matrix SHALL gain a column for the new atom
- **AND** every existing panel row SHALL be updated to indicate whether it would consume the new atom

#### Scenario: Panel migration completes

- **WHEN** a panel migration to the design system completes
- **THEN** the panel's row SHALL move to the "completed migrations" appendix at the bottom of the readiness matrix
- **AND** the appendix entry SHALL link to the migration's archived OpenSpec change

### Requirement: Agents readiness evidence is recorded for rollout

The cross-module readiness record SHALL include agents-specific evidence before this agents high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which agents molecules remain local, and which candidates should be watched during routing/subagents/modules that follow.

#### Scenario: Agents redesign completes

- **WHEN** the agents high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include an agents entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** unresolved design-system candidates SHALL be listed as follow-up/watch items rather than silently promoted
