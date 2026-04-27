## Context

Observe panels show the biggest risk of false parity: most current Vite panels open and display data, but they no longer expose the old Deck inspection workflows.

| Panel        | Old Deck evidence                                                                                                                     | Current Vite evidence                                                                        | Meaning                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Usage        | `UsagePanel`, `SummaryCards`, `UsageChart`, `BreakdownTable`, `LatencyCard`, `ContextPressure`, `DateRangePicker`, `SessionUsageList` | `UsagePanel`, `UsageTrendChart`, `usage-trend`                                               | Summary/charts/filter/table structure is reduced.                                       |
| Sessions     | `SessionList`, `SessionDetail`, `TurnTimeline`, `TranscriptSearch`, `SessionExport`, compaction/context/scope components              | `SessionsPanel`, `SessionCompactionHistory`, `SessionSubagentDetails`, `SessionUsageDetails` | Some logic exists, but old detail workspace and transcript workflow need parity review. |
| Memory       | `DreamDiaryTab`, `FileTree`, `HealthDiagnostics`, `KnowledgeGraph`, `SearchPanel`                                                     | `MemoryPanel`                                                                                | Old multi-surface memory UI is not migrated.                                            |
| Logs         | `LogFilters`, `LogStream`, `useLogSSE`                                                                                                | `LogsPanel`                                                                                  | Old filter/stream structure is reduced.                                                 |
| Activity     | `EventTimeline`, `useActivitySSE`                                                                                                     | `ActivityPanel`, `useActivitySSE`                                                            | Needs timeline and status parity, not just event display.                               |
| Threads      | `ThreadList`, `ThreadDetail`, `ThreadRelationView`                                                                                    | similar files exist                                                                          | Needs visual and i18n parity verification.                                              |
| API Explorer | `MethodDetail`, `SchemaViewer`, `EventList`                                                                                           | `ApiExplorerPanel`                                                                           | Old RPC method/schema/event inspection is collapsed.                                    |

## Goals / Non-Goals

**Goals:**

- Restore old Observe panel desktop layouts, tabs, sidebars, filters, charts, timelines, and detail panes.
- Keep Go/Gateway data authority while fixing Go backend projection gaps required by old workflows.
- Make all Observe panel visible copy EN/ZH-complete.
- Produce browser evidence for each panel, with old/current comparison.

**Non-Goals:**

- Do not redesign Observe panels using the newer visual concept.
- Do not make mobile parity blocking.
- Do not invent fake metrics or stream events to satisfy old layouts.

## Decisions

### D1: Sessions and Usage are the first Observe subtracks

Sessions and Usage are the most workflow-heavy Observe pages. They should be restored before smaller panels because their shared chart, timeline, export, and transcript patterns can be reused.

### D2: Memory restores old tab/detail surfaces only where data is real

The Memory panel must restore old visible structure, but every dream diary, file tree, health, graph, or search surface must be backed by Go/Gateway data or an explicit unavailable state.

### D3: Stream panels keep SSE behavior visible

Logs and Activity are not complete if they render static lists only. Old SSE-derived stream state, filters, loading, paused/error, and timeline affordances must be preserved where the Go backend supports them.

### D4: API Explorer is a contract inspection tool

API Explorer parity requires method detail, schema viewer, event list, request/response states, and clear error feedback. A one-file method list is not sufficient.

### D5: Backend gaps are fixed per panel

If old Node+Next service behavior supplied usage breakdowns, session transcript/export data, memory graph/search data, logs/activity stream filtering, thread relations, or RPC schema/events that Go does not expose, the owning panel migration must fix the Go backend/API adapter or record a Gateway-unsupported exception.

## Risks / Trade-offs

- **Risk: Observe pages expose stale or partial data.** → Add panel-specific backend gap ledgers and targeted tests for projections.
- **Risk: Usage/session charts need design primitives from shell work.** → Depend on `deck-shell-i18n-parity` for shared cards, tabs, tables, and chart containers.
- **Risk: Memory graph/search support may be incomplete.** → Use explicit unavailable states instead of fake graph data when Gateway support is absent.

## Migration Plan

1. Restore Usage summary/filter/chart/table structure.
2. Restore Sessions list/detail/timeline/transcript/export/context structure.
3. Restore Memory tabs and real-data-backed diagnostics/search/graph surfaces.
4. Restore Logs and Activity stream/timeline/filter surfaces.
5. Restore Threads visual parity and relation/detail behavior.
6. Restore API Explorer method/schema/event inspection.
7. Run group-level i18n, light/dark, browser traversal, and backend gap validation.
