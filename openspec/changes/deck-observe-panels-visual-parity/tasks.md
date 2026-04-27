## 0. Parallel Worktree Readiness

- [ ] 0.1 Confirm this worktree starts from `341d965a36` or a documented descendant shared-baseline commit.
- [ ] 0.2 Create and maintain `backend-gaps.md` before changing Go backend/API adapter files.
- [ ] 0.3 Keep shared frontend edits panel-local, namespaced, and recorded in the task evidence.

## 1. Usage

- [ ] 1.1 Map old `dashboard/src/components/panels/usage` files to Vite targets.
- [ ] 1.2 Restore summary cards, usage chart, date range picker, breakdown table, latency card, context pressure, and session usage list.
- [ ] 1.3 Fix or classify Go backend/API gaps for usage summary, trend, breakdown, latency, context, and session-level usage projections.
- [ ] 1.4 Validate Usage EN/ZH, light/dark, filter, chart, and table screenshots.

## 2. Sessions

- [ ] 2.1 Map old `dashboard/src/components/panels/sessions` files to Vite targets.
- [ ] 2.2 Restore session list/detail workspace, compaction history, context health, context weight breakdown, scope selector, scope strategy card, turn timeline, transcript search, and export controls.
- [ ] 2.3 Fix or classify Go backend/API gaps for session detail, transcript, compaction, context, scope, export, and timeline payloads.
- [ ] 2.4 Validate Sessions EN/ZH, light/dark, list/detail/timeline/transcript/export screenshots.

## 3. Memory

- [ ] 3.1 Map old `dashboard/src/components/panels/memory` files to Vite targets.
- [ ] 3.2 Restore dream diary, file tree, health diagnostics, knowledge graph, and search panel surfaces.
- [ ] 3.3 Fix or classify Go backend/API gaps for memory search, file tree, health, graph, and diary projections.
- [ ] 3.4 Validate Memory EN/ZH, light/dark, tabs/search/graph/diagnostics screenshots.

## 4. Logs And Activity

- [ ] 4.1 Map old logs/activity stream files to Vite targets.
- [ ] 4.2 Restore log filters, log stream, activity timeline, SSE status, loading, pause/error, and empty states.
- [ ] 4.3 Fix or classify Go backend/API gaps for log/activity stream filtering, cursoring, event shape, and connection state.
- [ ] 4.4 Validate Logs and Activity EN/ZH, light/dark, filter/timeline/stream screenshots.

## 5. Threads And API Explorer

- [ ] 5.1 Restore Threads list/detail/relation view visual parity.
- [ ] 5.2 Restore API Explorer method detail, schema viewer, event list, request/response, and error feedback.
- [ ] 5.3 Fix or classify Go backend/API gaps for thread relations and API Explorer method/schema/event projections.
- [ ] 5.4 Validate Threads and API Explorer EN/ZH, light/dark, detail/relation/schema screenshots.

## 6. Cross-Observe Validation

- [ ] 6.1 Run targeted Observe panel tests.
- [ ] 6.2 Run browser plugin traversal for all Observe panels.
- [ ] 6.3 Confirm every Observe panel has old authority files, current target files, backend gap classification, and screenshot evidence.
