## ADDED Requirements

### Requirement: Channels restores old management workspace

The Vite Channels panel SHALL restore old Deck channel list/detail, settings, access, bindings, analytics, health/probe, schema settings, retry strategy, DM policy, account config, onboarding, wizard runner, access descriptors, and provider-specific pages where Gateway metadata supports them.

#### Scenario: User opens channel details

- **WHEN** a user selects a channel
- **THEN** the panel SHALL expose old Deck-equivalent detail tabs, health, settings, access, bindings, diagnostics, and action affordances.

### Requirement: Config restores old schema editor

The Vite Config panel SHALL restore old Deck section navigation, schema form, search/highlight, field help, conflict dialog, diff preview dialog, tag filters, and typed field controls.

#### Scenario: User edits configuration

- **WHEN** a user edits `openclaw.json` through the Config panel
- **THEN** the panel SHALL expose old Deck-equivalent schema guidance, validation, conflict handling, and diff preview before saving.

### Requirement: Settings restores old sectioned UI

The Vite Settings panel SHALL restore old Deck about, appearance, connection, devices, notifications, pending requests, token rotation, confirmation, and device row surfaces.

#### Scenario: User opens device settings

- **WHEN** a user opens Settings devices or connection controls
- **THEN** the panel SHALL show old Deck-equivalent device/session state and action confirmation behavior.

### Requirement: Routing restores old simulation and conflict tooling

The Vite Routing panel SHALL restore old Deck activity feed, binding table, condition builder, conflict badge, route simulator, loading, empty, and error states.

#### Scenario: User simulates a route

- **WHEN** a user runs a route simulation
- **THEN** the panel SHALL render old Deck-equivalent simulation inputs, results, conflicts, and feedback.

### Requirement: Budget and Alerts restore old rule management

The Vite Budget and Alerts panels SHALL restore old Deck status cards, rule lists, rule forms, fired alerts, loading, empty, and error states.

#### Scenario: User edits a budget or alert rule

- **WHEN** a user creates or edits a rule
- **THEN** the panel SHALL expose old Deck-equivalent form validation and rule list feedback.

### Requirement: Remaining Control panels restore old detail surfaces

The Vite Plugins, Subagents, Identity, Nodes, and Docs panels SHALL restore old Deck detail, tab, dialog, list, viewer, pairing, run history, steer, and metadata surfaces where applicable.

#### Scenario: User opens a remaining Control panel

- **WHEN** a user opens Plugins, Subagents, Identity, Nodes, or Docs
- **THEN** the panel SHALL match old Deck perceptual layout and interaction structure for that panel.

### Requirement: Control panels are localized

All visible Control panel copy SHALL switch between English and Chinese.

#### Scenario: Locale switch on Control panel

- **WHEN** locale changes while a Control panel is active
- **THEN** panel-local headings, tabs, labels, placeholders, dialogs, errors, empty states, tooltips, and buttons SHALL switch language except for proper nouns, code, identifiers, and user data.

### Requirement: Control backend parity gaps are fixed or classified

The Vite Control panel migration SHALL fix Go backend/API/projection gaps required by old Deck control workflows when the Gateway source of truth supports the capability.

#### Scenario: Old control workflow needs missing Go service behavior

- **WHEN** Channels, Config, Settings, Routing, Budget, Alerts, Plugins, Subagents, Identity, Nodes, or Docs needs diagnostics, schema, conflict, simulation, rule, metadata, device, identity, pairing, docs, or stream behavior missing from the Go backend
- **THEN** the implementation SHALL update the Go backend/API adapter or document a Gateway-unsupported exception with an explicit unavailable state.
