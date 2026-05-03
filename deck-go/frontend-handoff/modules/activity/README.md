# Activity

**Status**: ready-for-implementation
**Design completed**: 2026-05-03
**Designer**: Codex single-agent replacement workflow
**Depends on atoms**: Button, Input, Select, Badge/Pill, Card, Code/Json detail, Status, Spinner
**New atoms needed**: none
**New tokens needed**: none
**Backend endpoints used**: see `api-usage.md`

## What this module does

Activity is an Observe workspace for runtime event projection and execution monitoring. It combines the contract-backed activity feed with monitor run history so an operator can see what happened, which agent/session it belongs to, and what model/tool/file/subagent evidence exists for a selected run.

This package is a high-fidelity handoff for `deck-go/frontend-new/src/components/panels/activity/`. It is intentionally based on the current deck-go contract chain and production code, not on the old visual shell. Code and contracts remain the source of truth; this prototype is an implementation guide.

## Contract truth

- Activity events: `GET /api/activity?limit=...` -> `fetchActivityEvents()` -> `DeckGoActivityEvent[]`.
- Monitor runs: `GET /api/monitor/runs?...` -> `fetchMonitorRuns()` -> `DeckGoMonitorRun[]`.
- Monitor stats: `GET /api/monitor/stats` -> `fetchMonitorStats()` -> `DeckGoMonitorStatsResponse`.
- Monitor run detail: `GET /api/monitor/runs/{runId}` -> `fetchMonitorRunDetail()` -> selected run summary/events.
- Realtime stream: shared frontend stream + `activity.event` SSE payloads -> `useActivitySSE()` -> merge into the activity timeline.
- Browser code must continue to call the Go BFF wrapper only; it must not call Gateway directly.

## How to implement

1. Open `prototype.html` and inspect the density, two-region layout, diagnostics stack, wrapping behavior, and selected states.
2. Read `components.md` for the module-local component tree and data boundaries.
3. Read `states.md` for loading, empty, not-configured, error, and mock-ready states.
4. Read `interactions.md` for filtering, grouping, selection, pagination, and cross-panel handoff behavior.
5. Read `api-usage.md` and preserve the current API wrapper/SSE path.
6. Translate prototype classes into `ActivityPanel.tsx` + `activity-panel.css`, keeping strings in i18n and behavior covered by tests.

## Open questions for implementation

- Real Gateway projection completeness differs by event source. The UI must show contract-shaped activity/monitor data when available, but this change does not claim real Gateway/LLM coverage.
- Monitor event `data` is a JSON string by contract, but the inner schema is stream-specific. Parsed diagnostics should remain best-effort and raw payloads must stay inspectable.
- Top-agent and run-status taxonomy comes from BFF projections. Do not invent richer statuses or ranking semantics in the frontend.
