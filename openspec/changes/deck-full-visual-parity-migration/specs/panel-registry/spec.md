## MODIFIED Requirements

### Requirement: PanelRegistry central data structure

The system SHALL provide a `PANELS` array for the active Deck frontend where each entry contains: `id` (string literal), `group` (nav group name), `icon` (old Deck-equivalent icon), `labelKey` (i18n key), `component` or Vite lazy import target, `shortcutIndex?` (optional keyboard shortcut position 1-9), `eager?` or equivalent eager loading metadata, `position?` ('bottom' for fixed-bottom items like settings). The Vite registry SHALL preserve old Deck panel identity, grouping, iconography, shortcut intent, and bottom-panel placement unless a documented product decision changes it.

#### Scenario: Registry contains all existing panels

- **WHEN** the active Vite Deck registry is read
- **THEN** it SHALL contain entries for all old Deck panel identities that remain active in the Go-backed product: chat, agents, gateway/monitor, models, usage, sessions, memory, logs, activity, threads, api-explorer, cron/scheduler, webhooks, approvals, skills, budget, alerts, channels, plugins, routing, subagents, identity, config, nodes, docs, settings
- **AND** any renamed panel SHALL document its old identity and Vite identity mapping.

### Requirement: Panel type derived from registry

The panel type in the active Deck frontend SHALL be derived from the registry entries' `id` field: `type Panel = typeof PANELS[number]['id']` or an equivalent registry-derived type.

#### Scenario: Panel type matches registry entries

- **WHEN** a new entry with `id: 'newpanel'` is added to the PANELS array
- **THEN** the Panel type SHALL automatically include `'newpanel'` without editing the UI store type manually.

### Requirement: NavRail reads from registry

`NavRail.tsx` SHALL read its nav groups and menu items from the registry instead of hardcoded `navGroups` array. Entries with `position: 'bottom'` SHALL be rendered separately at the bottom of the rail. Vite NavRail SHALL preserve old Deck grouping, labels, icon affordances, active state, collapse behavior, and mobile overlay behavior where mobile is in scope.

#### Scenario: NavRail renders grouped panels

- **WHEN** NavRail renders
- **THEN** it SHALL display panels grouped by their `group` field from the registry.

#### Scenario: Settings renders at bottom

- **WHEN** NavRail renders
- **THEN** the settings entry (with `position: 'bottom'`) SHALL render below the scrollable groups, matching old Deck behavior.

### Requirement: Page routing reads from registry

The active Deck page or panel host SHALL derive its component loading from the registry. Entries with `eager: true` or equivalent metadata SHALL use static/eager import; all others SHALL use lazy loading.

#### Scenario: Chat loads eagerly

- **WHEN** the chat panel is activated
- **THEN** it SHALL load via static/eager import, matching old Deck behavior.

#### Scenario: Other panels load lazily

- **WHEN** any non-eager panel is activated
- **THEN** it SHALL load via the component field or import target from the registry entry.

### Requirement: Keyboard shortcuts read from registry

Keyboard shortcut mapping SHALL derive from registry entries that have a `shortcutIndex` field.

#### Scenario: First 9 panels have keyboard shortcuts

- **WHEN** user presses Alt+1 through Alt+9
- **THEN** the system SHALL navigate to the panel whose `shortcutIndex` matches the pressed number.

### Requirement: Adding a new panel requires only registry entry

Adding a new panel to Deck SHALL require: (1) creating the panel component file, (2) adding one entry to the PANELS array in the registry, (3) adding i18n keys. No changes to NavRail, page/panel host, keyboard shortcut hook, or UI store type SHALL be necessary.

#### Scenario: New panel registration

- **WHEN** a developer adds a new entry to the PANELS array with a lazy component import
- **THEN** the panel SHALL appear in NavRail, be routable via the panel host, and have keyboard shortcut support (if shortcutIndex provided) without modifying unrelated shell files.
