## ADDED Requirements

### Requirement: MasterDetailLayout provides a reusable split-pane structure
The system SHALL provide a `MasterDetailLayout` component that renders a fixed-width list sidebar and a flexible detail area, replacing the copy-pasted split-pane structure across 7+ panels.

#### Scenario: Basic layout
- **WHEN** `MasterDetailLayout` is rendered with `sidebarWidth="w-56"`, a list component, and a detail component
- **THEN** it renders a `flex h-full` container with the list in a `shrink-0 border-r` aside and detail in a `flex-1` main area

#### Scenario: Empty state
- **WHEN** no item is selected in the list
- **THEN** the detail area displays the `emptyState` prop content (icon + message)

#### Scenario: Responsive collapse
- **WHEN** viewport width is below the mobile breakpoint
- **THEN** the layout collapses to a single pane: list view by default, detail view when an item is selected, with a back button to return to list

### Requirement: MethodPanel generates a complete CRUD panel from method namespace
The system SHALL provide a `MethodPanel` component that accepts a Gateway method namespace (e.g., `"deck.plugins"`) and auto-discovers list/detail/create/update/delete methods to render a full CRUD panel.

#### Scenario: Full CRUD namespace
- **WHEN** `MethodPanel` is rendered with `namespace="deck.plugins"` and the Gateway exposes `deck.plugins.list`, `deck.plugins.detail`, `deck.plugins.install`, `deck.plugins.uninstall`
- **THEN** the panel renders a MasterDetailLayout with: list populated from `.list` result, detail view from `.detail` result, install button triggering `.install` MethodForm, uninstall button triggering `.uninstall`

#### Scenario: Read-only namespace
- **WHEN** the namespace only has `list` and `detail` methods (no create/update/delete)
- **THEN** the panel renders without create/edit/delete buttons—read-only mode

#### Scenario: Custom method mapping
- **WHEN** `MethodPanel` receives explicit `listMethod`, `detailMethod`, `createMethod` props that don't follow namespace convention
- **THEN** the panel uses the explicitly specified methods instead of auto-discovery

### Requirement: MethodPanel supports field overrides and custom widgets
The system SHALL allow `MethodPanel` consumers to provide `fieldOverrides` for RJSF uiSchema customization and `customWidgets` for domain-specific field rendering.

#### Scenario: Domain-specific widget
- **WHEN** `customWidgets={{ "cronExpression": CronExpressionWidget }}` is provided
- **THEN** any schema field with `format: "cron-expression"` or matching `ui:widget` renders the custom `CronExpressionWidget` instead of a plain text input
