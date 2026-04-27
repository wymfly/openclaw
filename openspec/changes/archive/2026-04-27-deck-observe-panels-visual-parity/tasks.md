## 0. Parallel Worktree Readiness

- [x] 0.1 Confirm this worktree starts from `0f17c40ca7` or a documented descendant of shared baseline `341d965a36`.
- [x] 0.2 Create and maintain `backend-gaps.md` before changing Go backend/API adapter files.
- [x] 0.3 Keep shared frontend edits panel-local, namespaced, and recorded in the task evidence.
- [x] 0.4 Keep every `backend-gaps.md` row on one explicit status: `covered-by-current-go`, `needs-proof`, `go-adapter-missing-but-upstream-exists`, or `gateway-unsupported`.
- [x] 0.5 Do not run Playwright E2E in this worktree; maintain the integration-branch screenshot checklist in `implementation-plan.md`.
- [x] 0.6 Treat integration-branch Playwright/browser evidence as blocking final OpenSpec closure, not as optional follow-up.

Evidence: `HEAD` is `0f17c40ca7`; Playwright was not run in this worktree. Shared edits outside Usage were limited to build-gate compatibility fixes in `panel-registry.tsx`, `agent-batch-actions.ts`, `AgentsPanel.tsx`, and `useListState.ts`.

## 1. Usage

- [x] 1.1 Map old `dashboard/src/components/panels/usage` files to Vite targets.
- [x] 1.2 Split current Vite usage code into old visual/workflow boundaries: summary cards, date range picker, chart, breakdown table, latency card, context pressure, and session usage list.
- [x] 1.3 Preserve current Go-backed usage data paths for cost, providers, sessions, session logs, timeseries, and context weight.
- [x] 1.4 Fix or classify Go backend/API gaps for usage summary, trend, breakdown, latency, context, and session-level usage projections.
- [x] 1.5 Make Usage visible copy EN/ZH-complete and theme-compatible.
- [x] 1.6 Run targeted Usage tests/build evidence; defer screenshot capture to the integration branch.

Evidence: `UsagePanel.test.tsx` passed; frontend `npm run build` passed after the build-gate compatibility fixes above.

## 2. Sessions

- [x] 2.1 Map old `dashboard/src/components/panels/sessions` files to Vite targets.
- [x] 2.2 Split current Vite sessions code into old visual/workflow boundaries: list, detail, turn timeline, transcript search, export controls, compaction history, context health, context weight breakdown, scope selector, and scope strategy card.
- [x] 2.3 Preserve current Go-backed session detail, transcript, compaction, subagent, and usage surfaces.
- [x] 2.4 Fix or classify Go backend/API gaps for session detail, transcript, compaction, context, scope, export, and timeline payloads.
- [x] 2.5 Make Sessions visible copy EN/ZH-complete and theme-compatible.
- [x] 2.6 Run targeted Sessions tests/build evidence; defer screenshot capture to the integration branch.

Evidence: `SessionsPanel.test.tsx` passed; combined Usage+Sessions deck-ui tests passed; frontend `npm run build` passed. Desktop CSS now uses old Deck-like list/detail columns with session actions in the detail column.

## 3. Memory

- [x] 3.1 Map old `dashboard/src/components/panels/memory` files to Vite targets.
- [x] 3.2 Split current Vite memory code into old visual/workflow boundaries: file tree, search panel, knowledge graph, health diagnostics, and dream diary.
- [x] 3.3 Preserve current Go-backed browse, read, search, health, and dreams behavior.
- [x] 3.4 Fix or classify Go backend/API gaps for memory search, file tree, health, graph, and diary projections.
- [x] 3.5 Make Memory visible copy EN/ZH-complete and theme-compatible.
- [x] 3.6 Run targeted Memory tests/build evidence; defer screenshot capture to the integration branch.

Evidence: `MemoryPanel.test.tsx` passed; combined Usage+Sessions+Memory deck-ui tests passed; frontend `npm run build` passed. Knowledge graph remains derived only from real browsed file path relationships, matching the current `needs-proof` backend gap rule.

## 4. Logs And Activity

- [x] 4.1 Map old logs/activity stream files to Vite targets.
- [x] 4.2 Split current Logs code into old visual/workflow boundaries: log filters, stream viewport, pause/resume, export, empty, loading, and error states.
- [x] 4.3 Split current Activity code into old visual/workflow boundaries: activity timeline, SSE status, filters, run detail where real Go data exists, empty, loading, and error states.
- [x] 4.4 Fix or classify Go backend/API gaps for log/activity stream filtering, cursoring, event shape, and connection state.
- [x] 4.5 Make Logs and Activity visible copy EN/ZH-complete and theme-compatible.
- [x] 4.6 Run targeted Logs/Activity tests/build evidence; defer screenshot capture to the integration branch.

Evidence: `LogsPanel.test.tsx` passed, `ActivityPanel.test.tsx` passed, combined Usage+Sessions+Memory+Logs+Activity deck-ui tests passed with 33 tests, and frontend `npm run build` passed. Logs and Activity visible copy now resolves through `logs.*` and `activity.*`; Playwright/browser screenshots remain deferred to the integration branch.

## 5. Threads And API Explorer

- [x] 5.1 Map old `dashboard/src/components/panels/threads` and `dashboard/src/components/panels/api-explorer` files to Vite targets.
- [x] 5.2 Restore Threads list/detail/relation view visual parity while preserving current thread utilities.
- [x] 5.3 Split current API Explorer code into old visual/workflow boundaries: method detail, schema viewer, event list, request/response, and error feedback.
- [x] 5.4 Fix or classify Go backend/API gaps for thread relations and API Explorer method/schema/event projections.
- [x] 5.5 Make Threads and API Explorer visible copy EN/ZH-complete and theme-compatible.
- [x] 5.6 Run targeted Threads/API Explorer tests/build evidence; defer screenshot capture to the integration branch.

Evidence: `ThreadsPanel.test.tsx` passed, `ApiExplorerPanel.test.tsx` passed, combined Threads+API Explorer deck-ui tests passed with 7 tests, and frontend `npm run build` passed. Threads now uses old Deck-like column headers/list rows with detail/relation panes; API Explorer visible copy now resolves through `apiExplorer.*` while preserving grouped methods, events, collapsible schema rows, and describe retry behavior.

## 6. Cross-Observe Validation

- [x] 6.1 Run `openspec validate deck-observe-panels-visual-parity --strict`.
- [x] 6.2 Run targeted Observe panel tests for touched files.
- [x] 6.3 Run `npm run build` in `deck-go/frontend`.
- [x] 6.4 Run targeted Go backend tests only if Go/API adapter files change.
- [x] 6.5 Confirm every Observe panel has old authority files, current target files, and backend gap classification with no placeholder rows.
- [x] 6.6 Run a cross-panel consistency review for filter behavior, empty/loading/error semantics, unavailable states, EN/ZH key naming, and repeated primitive extraction.
- [x] 6.7 Update `consistency-checklist.md` with per-panel evidence for filter behavior, state semantics, i18n naming, hardcoded English checks, and primitive extraction decisions.
- [x] 6.8 Record the integration-branch Playwright route/screenshot matrix; do not execute Playwright E2E in this worktree.

Evidence: `openspec validate deck-observe-panels-visual-parity --strict` passed; combined Observe panel tests passed with 7 files and 40 tests; frontend `npm run build` passed; `git diff --check` passed for touched OpenSpec/frontend surfaces. No Go/backend/API adapter files changed, so Go tests were not applicable in this worktree. `backend-gaps.md` has explicit status rows for all Observe panels, `consistency-checklist.md` has non-pending rows for all implemented panels, and `implementation-plan.md` records the deferred integration-branch Playwright matrix.

## 7. Integration-Branch Closure Gate

- [x] 7.1 After this worktree merges back locally, run the Playwright/browser screenshot matrix for Usage, Sessions, Memory, Logs, Activity, Threads, and API Explorer.
- [x] 7.2 Treat any failed route, language/theme mode, or critical visual parity screenshot as blocking final completion/archive of this OpenSpec change.
