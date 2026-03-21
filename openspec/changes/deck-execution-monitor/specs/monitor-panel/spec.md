## ADDED Requirements

### Requirement: Monitor panel replaces Activity panel

The `activity` panel type SHALL be renamed to `monitor` in the `Panel` union type in `stores/ui.ts`. All references to `activity` panel (NavRail, i18n keys, component imports) SHALL be updated to `monitor`.

#### Scenario: Panel type renamed

- **WHEN** the UI store is initialized
- **THEN** the `Panel` type SHALL include `monitor` and SHALL NOT include `activity`

#### Scenario: Legacy URL migration

- **WHEN** a user's localStorage contains `activePanel: "activity"`
- **THEN** on load, the migration function SHALL convert it to `monitor`

### Requirement: Monitor panel has three tabs

The Monitor panel SHALL have 3 tabs: **Overview** (default), **Timeline**, and **History**.

#### Scenario: Default tab is Overview

- **WHEN** user navigates to the Monitor panel
- **THEN** the Overview tab SHALL be active by default

#### Scenario: Tab switching

- **WHEN** user clicks the "Timeline" tab
- **THEN** the Timeline content SHALL be displayed and the Overview content SHALL be hidden

### Requirement: Overview tab contains gateway diagnostics and live feed

The Overview tab SHALL display the migrated gateway diagnostics (ConnectionCard, HealthCard, HeartbeatCard) in a card grid at the top, followed by a live event feed (the existing EventTimeline component adapted for Monitor context).

#### Scenario: Diagnostics cards displayed

- **WHEN** user views the Overview tab
- **THEN** ConnectionCard, HealthCard, and HeartbeatCard SHALL be displayed in a responsive grid (1-3 columns based on viewport width)

#### Scenario: Live feed below diagnostics

- **WHEN** user views the Overview tab
- **THEN** the EventTimeline (live SSE events) SHALL be displayed below the diagnostics cards
- **AND** SSE subscription SHALL be active for real-time event updates

### Requirement: Gateway panel removed from NavRail

The `gateway` panel type SHALL be removed from the `Panel` union type. The NavRail SHALL NOT display a Gateway entry. The HeaderBar connection status indicator (dot + tooltip) SHALL remain unchanged and SHALL navigate to the Monitor panel on click.

#### Scenario: NavRail has no Gateway entry

- **WHEN** user views the NavRail
- **THEN** no "Gateway" entry SHALL be present

#### Scenario: HeaderBar indicator navigates to Monitor

- **WHEN** user clicks the connection status indicator in the HeaderBar
- **THEN** the active panel SHALL switch to `monitor`

### Requirement: Monitor panel registered in NavRail OBSERVE group

The Monitor panel SHALL be registered in the NavRail under the OBSERVE group, replacing the Activity entry. The icon SHALL change from `Activity` (lucide) to `MonitorDot` (lucide) or similar operational icon.

#### Scenario: Monitor in NavRail

- **WHEN** user views the NavRail
- **THEN** the OBSERVE group SHALL contain a "Monitor" entry with an operational icon

### Requirement: Monitor Zustand store

A `useMonitorStore` Zustand store SHALL manage: active tab (overview/timeline/history), selected runId, run list, run events, run summary, live events (migrated from activity store), filters, loading states.

#### Scenario: Tab state persisted

- **WHEN** user switches to the History tab and then navigates away
- **THEN** returning to Monitor SHALL restore the History tab as active

#### Scenario: Selected run state

- **WHEN** user selects run "run-abc" in History
- **THEN** `selectedRunId` SHALL be set to "run-abc" and the Timeline tab SHALL load its events

### Requirement: Monitor API routes

The system SHALL expose 3 API routes:

- `GET /api/monitor/runs` — paginated run list with filters (agentId, sessionKey, since, until, status, cursor, limit)
- `GET /api/monitor/runs/[runId]` — all events for a run with computed summary
- `GET /api/monitor/stats` — overview statistics (total runs, today's runs, average duration, top agents)

#### Scenario: List runs API

- **WHEN** `GET /api/monitor/runs?agentId=assistant&limit=20` is called
- **THEN** the response SHALL contain up to 20 runs matching the filter, with summary metrics per run, and a `nextCursor` for pagination

#### Scenario: Run detail API

- **WHEN** `GET /api/monitor/runs/run-abc` is called
- **THEN** the response SHALL contain all events for `run-abc` ordered by seq, plus a computed summary (tool count, model count, tokens, duration, files, subagents, compacted)

#### Scenario: Stats API

- **WHEN** `GET /api/monitor/stats` is called
- **THEN** the response SHALL contain: `totalRuns`, `todayRuns`, `avgDurationMs`, `topAgents` (top 5 by run count)

### Requirement: i18n keys for Monitor panel

All user-visible text in the Monitor panel SHALL use `useTranslations("monitor")` with keys defined in both `zh.json` and `en.json`.

#### Scenario: i18n keys present

- **WHEN** the Monitor panel is rendered
- **THEN** all visible text (tab labels, headers, empty states, filter labels, status badges) SHALL come from the `monitor` i18n namespace

#### Scenario: zh and en in sync

- **WHEN** a new i18n key is added to `zh.json` under `monitor`
- **THEN** the same key SHALL also be added to `en.json` under `monitor`
