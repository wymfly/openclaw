## ADDED Requirements

### Requirement: Old Deck is the visual authority

The Vite Deck frontend SHALL use the old Next.js Deck client under `dashboard/` as the visual authority for desktop Web parity in this migration phase.

#### Scenario: Panel visual migration starts from old authority files

- **WHEN** a panel visual migration task begins
- **THEN** the task SHALL identify the corresponding old `dashboard/src/components/panels/**` authority files and current `deck-go/frontend/src/components/panels/**` target files
- **AND** the task SHALL document which old layout, tabs, dialogs, lists, charts, cards, or renderer components are missing from the Vite target.

### Requirement: Perceptual parity over redesign

The Vite Deck frontend SHALL prioritize old Deck perceptual parity over new visual redesign for this phase.

#### Scenario: Proposed style differs from old Deck

- **WHEN** an implementation proposes a layout or visual treatment that differs materially from old Deck
- **THEN** it SHALL either restore the old Deck treatment or document a Gateway/API-driven exception in the relevant child change.

### Requirement: Desktop parity is blocking

The Vite Deck frontend SHALL treat desktop Web parity as blocking for completion of this visual migration.

#### Scenario: Desktop screenshot shows unresolved mismatch

- **WHEN** a desktop screenshot comparison shows a panel still uses a simplified or unrelated Vite layout
- **THEN** that panel SHALL NOT be marked visually migrated.
