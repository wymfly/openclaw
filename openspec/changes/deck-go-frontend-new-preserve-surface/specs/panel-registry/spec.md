## MODIFIED Requirements

### Requirement: PanelRegistry central data structure

The system SHALL provide a `PANELS` array in `deck-go/frontend-new/src/deck-ui/panel-registry.tsx` where each entry contains: `id` (string literal), `group` (nav group name), `icon` (Deck UI icon component), `labelKey` (i18n key), `importTarget` or equivalent component registration metadata, `shortcutIndex?` (optional keyboard shortcut position 1-9), and `position?` (`bottom` for fixed-bottom items like settings). The registry MUST be the source used by the active `frontend-new` shell for grouping, labels, shortcut order, adjacent-panel navigation, and panel lookup.

#### Scenario: Registry contains all existing panels

- **WHEN** the active `frontend-new` `PANELS` array is read
- **THEN** it SHALL contain entries for `chat`, `agents`, `gateway`, `models`, `usage`, `sessions`, `memory`, `logs`, `activity`, `threads`, `api-explorer`, `cron`, `webhooks`, `approvals`, `skills`, `budget`, `alerts`, `channels`, `plugins`, `routing`, `subagents`, `identity`, `config`, `nodes`, `docs`, and `settings`
- **AND** no current preserved panel from frozen `deck-go/frontend` SHALL be omitted

### Requirement: Panel type derived from registry

The active `PanelId` type SHALL be exported from `deck-go/frontend-new/src/deck-ui/panel-registry.tsx` and MUST remain aligned with the registry entries. Implementations MAY use an explicit string-literal union or a derived type, but the host guard MUST fail if `PanelId`, `PANELS`, and component registration drift apart.

#### Scenario: Panel type matches registry entries

- **WHEN** a panel id is present in the `PANELS` array
- **THEN** active-panel state, adjacent-panel navigation, component rendering, and shell navigation SHALL accept that id
- **AND** the host guard SHALL fail if a registered id cannot be rendered

### Requirement: NavRail reads from registry

`deck-go/frontend-new/src/deck-ui/NavRail.tsx` SHALL read its nav groups and menu items from the registry instead of hardcoded panel groups. Entries with `position: "bottom"` SHALL be rendered separately at the bottom of the rail.

#### Scenario: NavRail renders grouped panels

- **WHEN** NavRail renders in `frontend-new`
- **THEN** it SHALL display panels grouped by their `group` field from the registry

#### Scenario: Settings renders at bottom

- **WHEN** NavRail renders in `frontend-new`
- **THEN** the settings entry with `position: "bottom"` SHALL render below the scrollable groups

### Requirement: Page routing reads from registry

The active `frontend-new` panel host SHALL derive panel selection and component rendering from the registry plus its component registration map. `chat` and `agents` MAY have explicit render paths only to preserve their new-authority implementations, but those explicit paths MUST still correspond to registered panel ids and MUST NOT hide the preserved panel inventory.

#### Scenario: Chat opens from registry-backed shell

- **WHEN** the chat panel is activated
- **THEN** the active shell SHALL render the `frontend-new` ChatPanel implementation
- **AND** the chat panel id SHALL remain present in the registry

#### Scenario: Preserved panels open from registry-backed shell

- **WHEN** any non-chat/non-agents registered panel is activated
- **THEN** the active shell SHALL render the preserved panel implementation for that id
- **AND** it SHALL NOT show a placeholder-only fallback when a preserved implementation exists

### Requirement: Keyboard shortcuts read from registry

`frontend-new` keyboard shortcut handling SHALL derive its Alt+N mapping from registry entries that have a `shortcutIndex` field.

#### Scenario: First 9 panels have keyboard shortcuts

- **WHEN** user presses Alt+1 through Alt+9 outside editable fields
- **THEN** the system SHALL navigate to the panel whose `shortcutIndex` matches the pressed number

### Requirement: Adding a new panel requires only registry entry

Adding a new panel to active `frontend-new` SHALL require only localized registration work: creating the panel component, adding one registry entry, adding or updating the component registration case/lazy import, and adding i18n keys. NavRail, header, adjacent-panel navigation, shortcut mapping, and active-panel persistence MUST NOT need unrelated hardcoded edits.

#### Scenario: New panel registration

- **WHEN** a developer adds a new panel component, registry entry, component registration, and i18n keys
- **THEN** the panel SHALL appear in NavRail, be routable through the panel host, and have keyboard shortcut support if `shortcutIndex` is provided
- **AND** no unrelated shell file SHALL need panel-specific hardcoding
