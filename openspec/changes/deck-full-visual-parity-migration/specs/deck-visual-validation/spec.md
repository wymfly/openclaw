## ADDED Requirements

### Requirement: Visual parity requires reference evidence

Each migrated panel SHALL have reference evidence comparing old Next Deck and Vite Deck on desktop Web.

#### Scenario: Panel is marked complete

- **WHEN** a panel is marked visually migrated
- **THEN** the evidence SHALL include old authority file mapping, current target file mapping, desktop screenshot evidence, i18n switch evidence, and interaction checklist results.

### Requirement: Final visual closure uses paired old/current screenshots

Full visual migration closure SHALL use a paired screenshot matrix comparing the old Next Deck client and the current Vite/Go Deck target for every active desktop panel.

#### Scenario: Full visual migration is prepared for archive

- **WHEN** `deck-full-visual-parity-migration` is prepared for final archive
- **THEN** every active desktop panel SHALL have old-reference evidence, current-target screenshot evidence, a verdict, console/page error review, and an accepted exception only when a screenshot cannot be deterministically captured or the behavior is unsupported by the Gateway/source of truth.

### Requirement: Representative sampling is insufficient for full parity

Opening a representative subset of panels SHALL NOT be enough to claim full old Deck visual parity.

#### Scenario: Browser traversal passes without old/current comparison

- **WHEN** a browser traversal proves panels render without crashes but lacks paired old/current visual comparison
- **THEN** the traversal SHALL be classified as integration E2E evidence, not final visual parity evidence.

### Requirement: Panel subsurfaces are validated

Each panel SHALL validate materially different old Deck subsurfaces, not only its default route.

#### Scenario: Old panel has tabs, dialogs, wizards, detail panes, forms, or special states

- **WHEN** old Deck exposes a materially distinct tab, dialog, wizard, detail pane, form, stream state, empty state, loading state, error state, or unavailable state
- **THEN** the screenshot matrix SHALL include that state or record a source-linked accepted exception.

### Requirement: Verdicts block closure

Visual comparison rows SHALL have explicit verdicts before final closure.

#### Scenario: A screenshot matrix row is unresolved

- **WHEN** any row is missing a verdict or is marked `needs-fix`
- **THEN** the umbrella change SHALL remain open unless the row is split into a new blocking proposal with source and target file references.

### Requirement: Browser validation uses the managed local stack

Visual validation SHALL run against the Go backend and managed local Gateway stack, not against deprecated CLI smoke scripts.

#### Scenario: E2E visual validation runs

- **WHEN** browser validation is performed for this migration
- **THEN** it SHALL use the established Playwright/browser plugin path with the Go backend managing Gateway health and startup.

### Requirement: Non-parity exceptions are tracked

Any intentional deviation from old Deck visual or interaction behavior SHALL be documented with rationale.

#### Scenario: Vite behavior differs from old Deck

- **WHEN** a migrated panel intentionally differs from old Deck
- **THEN** the child change SHALL record the difference, the reason, and whether it is a Gateway/API constraint, desktop-only scope decision, or future redesign deferral.
