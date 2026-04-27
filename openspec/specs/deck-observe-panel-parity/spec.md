## Purpose

Track production visual and interaction parity for the migrated Vite Observe deck panels against the old Deck client while preserving Gateway-backed capability boundaries.

## Requirements

### Requirement: Usage restores old analytics workspace

The Vite Usage panel SHALL restore old Deck desktop structure for summary cards, trend charts, date range selection, breakdown tables, latency/context pressure cards, and session usage lists.

#### Scenario: Usage panel opens on desktop

- **WHEN** the Usage panel opens
- **THEN** it SHALL present the old Deck analytics workspace rather than a simplified metric-only layout.

### Requirement: Sessions restores old inspection workspace

The Vite Sessions panel SHALL restore old Deck list/detail, context health, compaction history, scope strategy, turn timeline, transcript search, and export workflows.

#### Scenario: User opens a session detail

- **WHEN** a user selects a session
- **THEN** the panel SHALL expose old Deck-equivalent detail, timeline, transcript, context, and export affordances.

### Requirement: Memory restores old diagnostic surfaces

The Vite Memory panel SHALL restore old Deck dream diary, file tree, health diagnostics, knowledge graph, and search surfaces where Go/Gateway data supports them.

#### Scenario: Memory data is unavailable

- **WHEN** an old Memory surface is not supported by the Gateway or Go backend
- **THEN** the panel SHALL show an explicit unavailable state rather than fake or blank data.

### Requirement: Logs and Activity restore streaming controls

The Vite Logs and Activity panels SHALL restore old Deck filter, stream, SSE status, timeline, pause/resume, loading, and error-state affordances.

#### Scenario: Stream receives events

- **WHEN** logs or activity events stream from the backend
- **THEN** the panel SHALL render old Deck-equivalent streaming/timeline behavior with visible connection state.

### Requirement: Threads and API Explorer restore detail tooling

The Vite Threads and API Explorer panels SHALL restore old Deck detail, relation, method detail, schema viewer, event list, request/response, and error feedback surfaces.

#### Scenario: User inspects a Gateway method

- **WHEN** a user selects a Gateway method in API Explorer
- **THEN** the panel SHALL show old Deck-equivalent method metadata, schema details, and request/response feedback.

### Requirement: Observe panels are localized

All visible Observe panel copy SHALL switch between English and Chinese.

#### Scenario: Locale switch on Observe panel

- **WHEN** locale changes while an Observe panel is active
- **THEN** panel-local headings, controls, filters, tabs, placeholders, errors, empty states, and buttons SHALL switch language except for proper nouns, code, identifiers, and user data.

### Requirement: Observe backend parity gaps are fixed or classified

The Vite Observe panel migration SHALL fix Go backend/API/projection gaps required by old Deck observe workflows when the Gateway source of truth supports the capability.

#### Scenario: Old observe workflow needs missing backend projection

- **WHEN** Usage, Sessions, Memory, Logs, Activity, Threads, or API Explorer needs a projection, stream filter, export payload, relation graph, schema, event list, or error shape missing from the Go backend
- **THEN** the implementation SHALL update the Go backend/API adapter or document a Gateway-unsupported exception with an explicit unavailable state.
