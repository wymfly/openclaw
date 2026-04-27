## ADDED Requirements

### Requirement: Agents restores old list-detail workspace

The Vite Agents panel SHALL restore old Deck desktop list/detail/compare workspace structure, including agent list sidebar, detail area, comparison mode, tabs, files, skills, routing, sessions, tools, subagents, prompts, and config editors.

#### Scenario: Agents panel opens on desktop

- **WHEN** the Agents panel opens on desktop
- **THEN** it SHALL present the old Deck list/detail workspace rather than a simplified unrelated layout.

### Requirement: Models restores old tabbed system

The Vite Models panel SHALL restore old Deck Catalog, Provider Config, Fallbacks, and Usage tabs with old-equivalent provider lists, model detail, config forms, fallback chain cards, auth health, quota, and usage charts.

#### Scenario: User switches Models tabs

- **WHEN** the user switches between Models tabs
- **THEN** each tab SHALL match old Deck visual structure and interaction affordances.

### Requirement: Gateway restores old Monitor visual structure

The Vite Gateway panel SHALL restore old Deck Monitor visual structure for overview, health, connection, heartbeat, live feed, history, timeline, run timeline, file changes, model stats, tool waterfall, and subagent tree where Go-backed data supports them.

#### Scenario: Gateway panel opens

- **WHEN** the Gateway panel opens
- **THEN** it SHALL show old Monitor-equivalent overview and timeline surfaces, with documented unavailable states for unsupported data.

### Requirement: Core panels are localized

All visible Core panel copy SHALL switch between English and Chinese.

#### Scenario: Locale switch on Core panel

- **WHEN** locale changes while Agents, Gateway, or Models is active
- **THEN** panel-local headings, tabs, labels, placeholders, dialogs, errors, and buttons SHALL switch language except for allowed identifiers/user data.

### Requirement: Core backend parity gaps are fixed or classified

The Vite Core panel migration SHALL fix Go backend/API/projection gaps required by old Deck Agents, Models, and Monitor workflows when the Gateway source of truth supports the capability.

#### Scenario: Old Core tab needs missing Go projection

- **WHEN** an old Agents, Models, or Monitor tab/control requires a projection, mutation, health result, discovery result, usage result, timeline result, or config payload missing from the Go backend
- **THEN** the implementation SHALL update the Go backend/API adapter or document a Gateway-unsupported exception with an explicit unavailable state.
