## ADDED Requirements

### Requirement: PanelRegistry central data structure

The system SHALL provide a `PANELS` array in `dashboard/src/lib/panel-registry.ts` where each entry contains: `id` (string literal), `group` (nav group name), `icon` (LucideIcon), `labelKey` (i18n key), `component` (lazy or eager React component), `shortcutIndex?` (optional keyboard shortcut position 1-9), `eager?` (boolean, default false), `position?` ('bottom' for fixed-bottom items like settings).

#### Scenario: Registry contains all existing panels

- **WHEN** the `PANELS` array is read
- **THEN** it SHALL contain entries for all 23 currently registered panels plus settings (24 total): chat, agents, gateway, models, usage, sessions, memory, logs, activity, threads, cron, webhooks, approvals, skills, budget, alerts, channels, routing, subagents, identity, config, docs, settings

### Requirement: Panel type derived from registry

The `Panel` type in `dashboard/src/stores/ui.ts` SHALL be derived from the registry entries' `id` field: `type Panel = typeof PANELS[number]['id']`.

#### Scenario: Panel type matches registry entries

- **WHEN** a new entry with `id: 'newpanel'` is added to the PANELS array
- **THEN** the `Panel` type SHALL automatically include `'newpanel'` without editing `ui.ts`

### Requirement: NavRail reads from registry

`NavRail.tsx` SHALL read its nav groups and menu items from the registry instead of hardcoded `navGroups` array. Entries with `position: 'bottom'` SHALL be rendered separately at the bottom of the rail.

#### Scenario: NavRail renders grouped panels

- **WHEN** NavRail renders
- **THEN** it SHALL display panels grouped by their `group` field from the registry

#### Scenario: Settings renders at bottom

- **WHEN** NavRail renders
- **THEN** the settings entry (with `position: 'bottom'`) SHALL render below the scrollable groups, matching current behavior
  Evidence: `dashboard/src/components/layout/NavRail.tsx:215-231` currently renders settings separately

### Requirement: Page routing reads from registry

`page.tsx` SHALL derive its component loading from the registry. Entries with `eager: true` SHALL use static import; all others SHALL use `lazy()`.

#### Scenario: Chat loads eagerly

- **WHEN** the chat panel is activated
- **THEN** it SHALL load via static import (not lazy), matching current behavior
  Evidence: `dashboard/src/app/page.tsx:11` currently imports ChatPanel eagerly

#### Scenario: Other panels load lazily

- **WHEN** any non-eager panel is activated
- **THEN** it SHALL load via the `component` field from the registry entry (lazy import)

### Requirement: Keyboard shortcuts read from registry

`useKeyboardShortcuts.ts` SHALL derive its Alt+N mapping from registry entries that have a `shortcutIndex` field.

#### Scenario: First 9 panels have keyboard shortcuts

- **WHEN** user presses Alt+1 through Alt+9
- **THEN** the system SHALL navigate to the panel whose `shortcutIndex` matches the pressed number

### Requirement: Adding a new panel requires only registry entry

Adding a new panel to Deck SHALL require: (1) creating the panel component file, (2) adding one entry to the PANELS array in `panel-registry.ts`, (3) adding i18n keys. No changes to NavRail, page.tsx, useKeyboardShortcuts, or ui.ts SHALL be necessary.

#### Scenario: New panel registration

- **WHEN** a developer adds a new entry to the PANELS array with a lazy component import
- **THEN** the panel SHALL appear in NavRail, be routable via page.tsx, and have keyboard shortcut support (if shortcutIndex provided) without modifying any other file
