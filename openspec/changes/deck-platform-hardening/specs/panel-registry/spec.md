## ADDED Requirements

### Requirement: PanelRegistry central data structure

The system SHALL provide a `PanelRegistry` in `dashboard/src/lib/panel-registry.ts` that stores panel metadata: `id` (Panel type), `group` (nav group), `icon` (LucideIcon), `labelKey` (i18n key), `component` (lazy React component), `shortcutIndex?` (optional keyboard shortcut position).

#### Scenario: Registry contains all 23 existing panels

- **WHEN** `getPanelRegistry()` is called
- **THEN** it SHALL return entries for all 23 currently registered panels (chat, agents, gateway, models, usage, sessions, memory, logs, activity, threads, cron, webhooks, approvals, skills, budget, alerts, channels, routing, subagents, identity, config, docs, settings)

### Requirement: Panel type derived from registry

The `Panel` type union in `dashboard/src/stores/ui.ts` SHALL be derived from the registry entries rather than manually maintained.

#### Scenario: Adding a new panel to registry auto-extends type

- **WHEN** a new panel entry is added to the registry barrel
- **THEN** the `Panel` type SHALL automatically include the new panel's id without editing `ui.ts`

### Requirement: NavRail reads from registry

`NavRail.tsx` SHALL read its nav groups and menu items from the registry instead of hardcoded `navGroups` array.

#### Scenario: NavRail renders all registered panels

- **WHEN** NavRail renders
- **THEN** it SHALL display panels grouped by their `group` field from the registry, in the order defined by group priority

### Requirement: Page routing reads from registry

`page.tsx` SHALL derive its lazy imports and `ActivePanel` routing from the registry instead of hardcoded if-else chain.

#### Scenario: Panel component loads from registry

- **WHEN** user navigates to a registered panel
- **THEN** `page.tsx` SHALL load the component from the corresponding registry entry's `component` field

### Requirement: Keyboard shortcuts read from registry

`useKeyboardShortcuts.ts` SHALL derive its Alt+N mapping from registry entries that have a `shortcutIndex` field.

#### Scenario: First 9 panels have keyboard shortcuts

- **WHEN** user presses Alt+1 through Alt+9
- **THEN** the system SHALL navigate to the panel whose `shortcutIndex` matches the pressed number

### Requirement: Adding a new panel requires only registry entry

Adding a new panel to Deck SHALL require creating at most 2 files: the panel component and its registry entry. No changes to Shell, NavRail, page.tsx, useKeyboardShortcuts, or ui.ts SHALL be necessary.

#### Scenario: New panel registration

- **WHEN** a developer creates `dashboard/src/components/panels/newpanel/NewPanel.tsx` and adds a registry entry to the barrel
- **THEN** the panel SHALL appear in NavRail, be routable, and have the correct i18n label without modifying any of the 5 previously hardcoded touch points
