## ADDED Requirements

### Requirement: Readiness matrix SHALL include patterns and icons columns

The cross-module readiness matrix at `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include columns for `patterns` and `icons` alongside the existing per-atom columns. Each panel row SHALL declare per-pattern and per-icon usage status:

- `applies` — panel will consume the canonical pattern / icon as-is
- `extend` — panel needs an additive variant (must be filed as a follow-up `design-system/proposals/`)
- `missing` — panel needs a new pattern / icon not yet canonical (blocks panel migration until proposal lands)
- `n/a` — pattern / icon not relevant to this panel

The readiness gate SHALL evaluate `patterns` and `icons` cells the same way it evaluates atom cells: every `extend` and `missing` entry SHALL be either resolved or accepted as an explicit follow-up before panel migration begins.

#### Scenario: New panel adds row with patterns/icons cells

- **WHEN** a developer proposes migrating `channels` panel and updates the readiness matrix
- **THEN** the row SHALL contain per-pattern cells (PageShell / NavRail / TopBar / EmptyState / KbdHint / SectionHeader) and per-icon cells for any icons consumed
- **AND** any `extend` or `missing` cell SHALL link to its follow-up proposal or accepted-deferral entry

#### Scenario: A panel migration discovers a missing pattern

- **WHEN** the channels panel migration discovers it needs a `ListShell` pattern not yet canonical
- **THEN** the matrix cell SHALL read `missing`
- **AND** a `frontend-handoff/design-system/proposals/<YYYY-MM-DD>-pattern-list-shell.md` SHALL be filed
- **AND** the panel migration SHALL pause until the proposal is decided (per design-system-patterns reuse-analysis gate)

### Requirement: Agents prototype reflowback candidates SHALL be recorded

The readiness matrix or its appendix SHALL include an `agents-prototype-reflowback-candidates` entry recording panel-local molecules that the agents pilot exposed but did NOT promote to canonical atoms / patterns / molecules. The entry SHALL include:

- Each candidate name (e.g., `Avatar`, `ListRow`, `StatusPill`, `FileRow`)
- One-line description and where it currently lives in `frontend-handoff/modules/agents/`
- Promotion criterion: "wait for second panel exhibiting the same shape, then evaluate at quarterly reflowback day"

These candidates SHALL NOT be promoted to canonical design system surfaces by this change. Promotion happens only after a second panel demonstrates the same shape AND a separate change goes through the reuse-analysis gate.

#### Scenario: Reading the reflowback record after this change archives

- **WHEN** any agent reads the readiness matrix appendix after archive
- **THEN** the agent SHALL find an entry listing `Avatar`, `ListRow`, `StatusPill`, `FileRow` (and any other agents-pilot candidates)
- **AND** each candidate SHALL be marked "panel-local; awaiting second-panel signal"

#### Scenario: A second panel exhibits the same shape as a recorded candidate

- **WHEN** the channels prototype implements an `Avatar`-like surface and lists it in its `components.md`
- **THEN** the readiness matrix entry for `Avatar` SHALL be updated to "two-panel signal; eligible for next reflowback review"
- **AND** a separate OpenSpec change SHALL handle the actual promotion (this change does NOT promote)
