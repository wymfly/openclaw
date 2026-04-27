## ADDED Requirements

### Requirement: Desktop shell matches old Deck app frame

The Vite Deck desktop shell SHALL match old Deck perceptual layout for nav rail, header, content padding, active state, status controls, theme switching, locale switching, loading fallback, and panel error boundaries.

#### Scenario: Desktop shell loads

- **WHEN** Vite Deck loads on a desktop viewport
- **THEN** nav rail, header, and content frame SHALL visually match old Deck proportions and hierarchy
- **AND** panel loading/errors SHALL use old Deck-equivalent fallback surfaces.

### Requirement: Shared panel primitives are restored

The Vite Deck frontend SHALL provide old Deck-equivalent shared primitives for repeated cards, lists, tabs, dialogs, forms, tables, inline edits, skeletons, errors, empty states, badges, and batch actions.

#### Scenario: Panel migrates old list/detail layout

- **WHEN** a panel requires old Deck list/detail, tabs, or dialog primitives
- **THEN** it SHALL use shared primitives rather than one-off panel CSS.

### Requirement: Global interactions match old Deck

The Vite Deck shell SHALL preserve old Deck desktop interactions for sidebar collapse, bottom settings placement, active panel selection, gateway status navigation, theme cycle, locale toggle, and keyboard shortcuts.

#### Scenario: User toggles theme and locale

- **WHEN** the user toggles theme or locale from the header
- **THEN** the shell and active panel SHALL update without losing active panel state.

### Requirement: Shell service gaps are explicit

The Vite Deck shell SHALL NOT hide old Deck global surfaces solely because the Go backend lacks a projection that the old Node+Next service provided.

#### Scenario: Restored shell surface needs missing backend data

- **WHEN** a restored shell/header/toast/onboarding/status surface needs auth, bootstrap, notification, health, or gateway status data
- **THEN** the implementation SHALL fix the Go backend/API gap or present a documented unavailable state tied to a Gateway-source limitation.
