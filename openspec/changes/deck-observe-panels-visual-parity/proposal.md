## Why

The Observe group is not visually or structurally migrated from the old Next.js Deck client. The current Vite implementation keeps several panels operational, but most old observe workflows were reduced into compact single-panel views.

This matters because these panels are how operators inspect usage, sessions, memory, logs, activity, threads, and Gateway RPC behavior. A production Deck cannot treat them as lightweight placeholders after the business logic migration.

## What Changes

- Restore old Deck desktop visual and interaction structure for Usage, Sessions, Memory, Logs, Activity, Threads, and API Explorer.
- Restore old cards, charts, filters, sidebars, detail panes, timelines, transcript search, export controls, stream views, method/schema views, and empty/loading/error states where the old Deck had concrete UI.
- Wire all Observe group visible copy through EN/ZH i18n.
- Fix or classify Go backend/API/projection gaps discovered while restoring old Node+Next observe workflows.
- Validate each Observe panel in this worktree with old authority files, current target files, targeted tests/build checks, interaction coverage notes, and backend gap notes; defer Playwright screenshots to the merged local integration branch.

## Capabilities

### New Capabilities

- `deck-observe-panel-parity`: Defines old Deck visual, interaction, i18n, and backend-gap parity requirements for Usage, Sessions, Memory, Logs, Activity, Threads, and API Explorer.

### Modified Capabilities

- None.

## Impact

- Reference files:
  - `dashboard/src/components/panels/usage/**/*`
  - `dashboard/src/components/panels/sessions/**/*`
  - `dashboard/src/components/panels/memory/**/*`
  - `dashboard/src/components/panels/logs/**/*`
  - `dashboard/src/components/panels/activity/**/*`
  - `dashboard/src/components/panels/threads/**/*`
  - `dashboard/src/components/panels/api-explorer/**/*`
- Vite target files:
  - `deck-go/frontend/src/components/panels/usage/**/*`
  - `deck-go/frontend/src/components/panels/sessions/**/*`
  - `deck-go/frontend/src/components/panels/memory/**/*`
  - `deck-go/frontend/src/components/panels/logs/**/*`
  - `deck-go/frontend/src/components/panels/activity/**/*`
  - `deck-go/frontend/src/components/panels/threads/**/*`
  - `deck-go/frontend/src/components/panels/api-explorer/**/*`
  - `deck-go/**/*` backend/API files needed to close documented Observe panel parity gaps
- Evidence:
  - Usage old tree includes `BreakdownTable`, `ContextPressure`, `DateRangePicker`, `LatencyCard`, `SessionUsageList`, `SummaryCards`, `UsageChart`, and `UsagePanel`; Vite has `UsagePanel`, `UsageTrendChart`, and helpers.
  - Sessions old tree includes compaction, context health, scope, detail, export, transcript search, and turn timeline components; Vite has a smaller sessions tree.
  - Memory old tree includes dream diary, file tree, health diagnostics, knowledge graph, and search; Vite has one panel file.
  - Logs and Activity old trees include SSE hooks and stream/timeline components; Vite panels are simplified.
  - API Explorer old tree includes event list, method detail, and schema viewer; Vite has one panel file.
