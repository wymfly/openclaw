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

### D6: Observe owns only its panel surfaces in parallel worktrees

Observe may run in a separate worktree from baseline `341d965a36`.

Owned implementation surfaces:

- `deck-go/frontend/src/components/panels/usage/**`
- `deck-go/frontend/src/components/panels/sessions/**`
- `deck-go/frontend/src/components/panels/memory/**`
- `deck-go/frontend/src/components/panels/logs/**`
- `deck-go/frontend/src/components/panels/activity/**`
- `deck-go/frontend/src/components/panels/threads/**`
- `deck-go/frontend/src/components/panels/api-explorer/**`
- Observe panel tests and `openspec/changes/deck-observe-panels-visual-parity/**`

Shared-file rules:

- `deck-go/frontend/src/i18n/en.json` and `deck-go/frontend/src/i18n/zh.json` may be extended only with Observe panel-local keys.
- `deck-go/frontend/src/api.ts` and Go backend files may be changed only after the relevant row is added to `backend-gaps.md`.
- Shared chart/list/timeline primitives should be local to Observe unless another active worktree needs them; cross-group shared primitives should land as a small shared-baseline patch.

### D7: This worktree does not run Playwright E2E

Observe visual parity can be implemented and code-validated in this parallel worktree, but browser E2E and final screenshot comparison are deferred until the worktree is merged back into the local integration branch.

This worktree must still produce non-E2E evidence:

- old Next authority file mapping per panel;
- current Vite target file mapping per panel;
- backend gap classification before any Go/API edits;
- targeted frontend tests and build checks for touched panel code;
- targeted Go tests only when backend/API files change.

Final Playwright evidence is an integration-branch responsibility because concurrent worktrees would otherwise contend for local ports, Gateway lifecycle, and browser/MCP state.

### D8: Preserve current Go-backed functionality while restoring old visual structure

Old Deck is the visual and workflow reference, not the data authority. Current Vite panels already contain Go-backed behavior that should not be removed just because the old Next component tree did not have the exact same section.

Panel migrations should:

- restore old layout, component boundaries, controls, empty/loading/error states, and EN/ZH visible copy;
- keep current Go/Gateway-backed surfaces when they expose real data;
- mark unsupported old affordances as explicit unavailable states instead of fabricating data;
- avoid shared shell or chat changes unless the gap is proven to block Observe parity.

### D9: Backend gaps use explicit status gates

Every row in `backend-gaps.md` must carry one status:

- `covered-by-current-go`
- `needs-proof`
- `go-adapter-missing-but-upstream-exists`
- `gateway-unsupported`

Panel-local UI edits may proceed while a row is `needs-proof`, but they must use existing APIs and render explicit unavailable states for unproven capability.

Go/API adapter edits may proceed only after the relevant row is no longer ambiguous:

- `covered-by-current-go` means implement against the current API and add targeted shape tests.
- `needs-proof` means inspect payloads or write a failing targeted test before deciding.
- `go-adapter-missing-but-upstream-exists` permits Go/API adapter work.
- `gateway-unsupported` requires an explicit unavailable state in the UI.

### D10: Observe-local shared primitive extraction is gated

Panel batches should start with local components. Extract an Observe-local shared primitive only after a second panel needs the same structure and the API/interaction contract is stable.

This worktree may consume already-landed shell primitives, but it must not add new shell-level shared primitives. Cross-Observe reuse outside the owned panel directories is not allowed in this worktree unless it lands as a separate small shared-baseline patch before Observe consumes it.

### D11: Deferred Playwright is a blocking integration gate

This worktree does not run Playwright E2E, but the OpenSpec change is not complete until the merged local integration branch passes the documented Playwright/browser screenshot matrix for Observe panels.

The local worktree can be code-complete with targeted tests/build evidence; it cannot be archived as visually complete without the integration-branch browser evidence.

## Risks / Trade-offs

- **Risk: Observe pages expose stale or partial data.** → Add panel-specific backend gap ledgers and targeted tests for projections.
- **Risk: Usage/session charts need design primitives from shell work.** → Consume only already-landed shell primitives; any new primitive starts panel-local, then Observe-local after second use, or lands separately as a shared-baseline patch.
- **Risk: Memory graph/search support may be incomplete.** → Use explicit unavailable states instead of fake graph data when Gateway support is absent.
- **Risk: Panel-by-panel work creates inconsistent Observe UX.** → Add a cross-panel consistency pass for filters, empty/loading/error states, unavailable states, i18n key naming, and inspector/list layout semantics.

## Migration Plan

1. Restore Usage summary/filter/chart/table structure.
2. Restore Sessions list/detail/timeline/transcript/export/context structure.
3. Restore Memory tabs and real-data-backed diagnostics/search/graph surfaces.
4. Restore Logs and Activity stream/timeline/filter surfaces.
5. Restore Threads visual parity and relation/detail behavior.
6. Restore API Explorer method/schema/event inspection.
7. Run cross-panel Observe consistency review for filters, states, unavailable handling, i18n naming, and repeated primitive extraction.
8. Run group-level i18n, light/dark, targeted tests, build, and backend gap validation.
9. Defer Playwright E2E traversal and screenshot comparison to the merged local integration branch, where it blocks final OpenSpec closure.
