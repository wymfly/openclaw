# Observe Panel Visual Parity Implementation Plan

## Scope

This plan implements `deck-observe-panels-visual-parity` from branch `work/deck-observe-panels-visual-parity`.

Baseline:

- current worktree baseline: `0f17c40ca7`;
- shared visual-parity baseline ancestor: `341d965a36`;
- Playwright E2E and screenshot comparison: deferred until merge back to the local integration branch.

The worktree objective is to restore old Deck Observe panel workflows and perceptual structure in Vite+React while preserving Go/Gateway as the data authority.

## Evidence Inventory

| Panel        | Old Next authority                                                                                                                                                                                                                                                       | Current Vite target                                                                                          | Primary migration action                                                                                         | Backend stance                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Usage        | `dashboard/src/components/panels/usage/UsagePanel.tsx`, `SummaryCards.tsx`, `UsageChart.tsx`, `BreakdownTable.tsx`, `LatencyCard.tsx`, `ContextPressure.tsx`, `DateRangePicker.tsx`, `SessionUsageList.tsx`; `dashboard/src/stores/usage.ts`                             | `deck-go/frontend/src/components/panels/usage/UsagePanel.tsx`, `UsageTrendChart.tsx`, `usage-trend.ts`       | Re-split the current single panel into old card/chart/table/list boundaries while keeping Go-backed fetch logic  | Use existing usage cost/provider/session/log/timeseries/context APIs first                  |
| Sessions     | `SessionList.tsx`, `SessionDetail.tsx`, `TurnTimeline.tsx`, `TranscriptSearch.tsx`, `SessionExport.tsx`, `CompactionHistory.tsx`, `ContextHealthBar.tsx`, `ContextWeightBreakdown.tsx`, `ScopeSelector.tsx`, `ScopeStrategyCard.tsx`; `dashboard/src/stores/sessions.ts` | `SessionsPanel.tsx`, `SessionCompactionHistory.tsx`, `SessionSubagentDetails.tsx`, `SessionUsageDetails.tsx` | Restore old list/detail/timeline/transcript/export workspace and keep current compaction/subagent/usage sections | Existing session APIs likely cover core workflow; scope/context gaps require classification |
| Memory       | `MemoryPanel.tsx`, `FileTree.tsx`, `SearchPanel.tsx`, `KnowledgeGraph.tsx`, `HealthDiagnostics.tsx`, `DreamDiaryTab.tsx`; `dashboard/src/stores/memory.ts`                                                                                                               | `MemoryPanel.tsx`                                                                                            | Split current Memory panel into old tab/detail surfaces                                                          | Browse/read/search/health/dreams exist; graph support must be proven or marked unavailable  |
| Logs         | `LogsPanel.tsx`, `LogFilters.tsx`, `LogStream.tsx`, `useLogSSE.ts`                                                                                                                                                                                                       | `LogsPanel.tsx`                                                                                              | Restore filter toolbar plus stream viewport, pause/resume, clear/export, and status states                       | Tail/stream exist; server filtering/cursor support must be proven before backend edits      |
| Activity     | `ActivityPanel.tsx`, `EventTimeline.tsx`, `useActivitySSE.ts`                                                                                                                                                                                                            | `ActivityPanel.tsx`, `useActivitySSE.ts`                                                                     | Restore timeline/status/filter structure and preserve current monitor surfaces backed by Go data                 | Activity and monitor APIs exist; event shape/cursor parity needs tests                      |
| Threads      | `ThreadsPanel.tsx`, `ThreadList.tsx`, `ThreadDetail.tsx`, `ThreadRelationView.tsx`                                                                                                                                                                                       | Same component names plus `thread-utils.ts`                                                                  | Verify and tighten visual/i18n parity rather than wholesale rewrite                                              | Current thread payload likely sufficient; relation completeness needs tests                 |
| API Explorer | `ApiExplorerPanel.tsx`, `MethodDetail.tsx`, `SchemaViewer.tsx`, `EventList.tsx`                                                                                                                                                                                          | `ApiExplorerPanel.tsx`                                                                                       | Split current inspector into old method/detail/schema/event boundaries                                           | Gateway describe exists; do not fabricate missing schema/event metadata                     |

## Implementation Order

0. Guardrails first.
   Confirm the backend gap status vocabulary, Observe-local shared primitive extraction rule, and deferred Playwright blocking gate before source edits.

1. Usage first.
   Usage has the clearest old component split and creates reusable Observe-local card, chart, and table patterns. Keep data fetching in the Vite panel or panel-local hooks, but render through old visual boundaries.

2. Sessions second.
   Sessions is the highest workflow-risk panel. Restore the old two-pane workspace, transcript workflow, export affordances, and context/compaction sections. Do not remove current Go-backed subagent and usage detail sections.

3. Memory third.
   Memory is a large single-file collapse in Vite. Restore old tabs and detail surfaces. The knowledge graph must be backed by returned relationships or shown as unavailable.

4. Logs and Activity fourth.
   These panels share stream/timeline state. Restore visible connection, pause, error, empty, and filter behavior. Keep Go-backed monitor run surfaces in Activity as a real-data extension.

5. Threads and API Explorer fifth.
   Threads already has much of the component tree and mostly needs visual/i18n tightening. API Explorer needs component split and inspector states restored.

6. Cross-panel consistency sixth.
   Review filter behavior, empty/loading/error semantics, unavailable states, i18n key naming, and repeated primitive candidates before claiming the worktree is code-complete.

## Shared Primitive Rule

Start each batch with panel-local components. Extract an Observe-local shared primitive only after a second panel needs the same structure and the interaction/API contract is stable.

This worktree may consume already-landed shell primitives, but it must not add new shell-level shared primitives. Do not move primitives outside Observe-owned panel directories in this worktree. Cross-Observe or shell-level reuse must land as a separate shared-baseline patch before Observe consumes it.

## Backend Gap Status Gate

Every `backend-gaps.md` row must use one status:

- `covered-by-current-go`: use the current API and add targeted shape tests.
- `needs-proof`: inspect payloads or write a failing targeted test before deciding.
- `go-adapter-missing-but-upstream-exists`: Go/API adapter work is allowed.
- `gateway-unsupported`: render an explicit unavailable state.

Panel-local UI edits may proceed while a capability is `needs-proof`, but they must use existing APIs and render unavailable states for unproven capabilities. `needs-proof` blocks only Go/API adapter edits.

## Per-Panel Acceptance Notes

### Usage

- All old visible sections are present: summary cards, range control, trend chart, provider/model breakdown, latency, context pressure, session usage list.
- Current Go-backed usage APIs remain the only data source.
- Empty, loading, error, and partial-data states have visible old-style affordances.
- EN/ZH copy comes from observe-local i18n keys, not hardcoded panel strings.

### Sessions

- Selecting a session renders list, detail summary, turn timeline, transcript search, and export controls as independently identifiable regions.
- Current compaction, usage, and subagent detail components remain available where data exists.
- Scope strategy/context health affordances either bind to real Go data or render explicit unavailable states.
- EN/ZH copy covers all controls, headings, states, and action labels.

### Memory

- Old tabs are restored: files, search, graph, diagnostics, dream diary.
- File browsing, file read, search, health, and dreams use existing Go APIs.
- Knowledge graph does not invent nodes/edges. It either uses real returned relationship data or shows unavailable.
- EN/ZH copy covers all tabs, controls, diagnostics, and empty/error states.

### Logs

- Old filter toolbar and stream viewport are restored.
- Pause/resume, clear/export, stream status, loading, empty, and error states are visible.
- Filters stay client-side unless Go support is proven.
- EN/ZH copy covers all controls and states.

### Activity

- Old timeline and SSE/status pattern is restored.
- Existing monitor stats/run detail surfaces are kept only as real Go-backed data.
- Filters and connection states remain visible.
- EN/ZH copy covers timeline, filters, monitor labels, and states.

### Threads

- List, detail, and relation view match old workflow structure.
- Relation rendering uses the current payload and helper utilities.
- Missing relation details are explicit unavailable states, not fabricated links.
- EN/ZH copy covers all controls and states.

### API Explorer

- Method list/detail, schema viewer, event list, request/response, and error feedback are separate visual regions.
- Gateway describe remains the only schema/method/event authority.
- Missing schema/event metadata is shown as unavailable.
- EN/ZH copy covers all labels, filters, request controls, and result states.

### Cross-Panel Consistency

- `consistency-checklist.md` records each panel's filter behavior, empty/loading/error/unavailable semantics, EN/ZH key prefix policy, hardcoded-English check, and primitive extraction decision.
- Every non-`pending` checklist cell includes a short evidence note or file reference.
- Any repeated structure extracted in this worktree is Observe-local and justified by at least two panels sharing the same stable contract.
- Any repeated structure left duplicated is marked intentional with a reason.

## Non-E2E Verification

Run these in this worktree before claiming the Observe proposal is implemented:

```bash
openspec validate deck-observe-panels-visual-parity --strict
git diff --check -- openspec/changes/deck-observe-panels-visual-parity deck-go/frontend/src/components/panels deck-go/frontend/src/i18n deck-go/frontend/src/api.ts deck-go/backend
cd deck-go/frontend && npm run build
```

Targeted frontend tests should be run for every touched Observe panel test file, for example:

```bash
cd deck-go/frontend && npm run test:deck-ui -- src/components/panels/usage/UsagePanel.test.tsx
```

Run the targeted test command for every touched panel test file, not only the primary `<Panel>.test.tsx`, when implementation creates or modifies additional panel test files.

If Go backend/API adapter files change, run targeted Go tests for the touched server/runtime package before the frontend build claim:

```bash
cd deck-go/backend && go test ./internal/server/...
```

## Deferred Integration Evidence

Do not run Playwright E2E in this worktree.

This is a blocking integration gate, not an optional follow-up. The OpenSpec change is not visually complete and must not be archived until the merged local integration branch passes the browser evidence matrix below.

After merge back to the local integration branch, capture Playwright/browser evidence for:

- Usage: EN/ZH, light/dark, range switch, chart/table/session list.
- Sessions: EN/ZH, light/dark, list/detail, timeline, transcript search, export, compaction/context.
- Memory: EN/ZH, light/dark, files, search, graph/unavailable, diagnostics, dream diary.
- Logs: EN/ZH, light/dark, filters, pause/resume, stream empty/error/loading states.
- Activity: EN/ZH, light/dark, timeline, filters, SSE/status, monitor run detail when data exists.
- Threads: EN/ZH, light/dark, list/detail/relation view.
- API Explorer: EN/ZH, light/dark, method detail, schema viewer, event list, request/response/error states.
