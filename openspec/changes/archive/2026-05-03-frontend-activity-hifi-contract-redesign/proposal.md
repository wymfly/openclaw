## Why

Activity is an Observe panel with a contract-backed data path across `GET /api/activity`, `GET /api/monitor/runs`, `GET /api/monitor/runs/{runId}`, `GET /api/monitor/stats`, and the shared activity SSE stream. The current UI preserves useful behavior, but it is still a dense legacy shell using global `deck-ui-activity` styling and has no complete high-fidelity handoff package.

This change applies the contract-led high-fidelity workflow to Activity so mock + frontend converge around the existing activity/monitor contract chain while preserving the current frontend skeleton and fixing only deterministic drift.

## What Changes

- Create a complete high-fidelity Activity handoff package under `deck-go/frontend-handoff/modules/activity/`.
- Redesign `deck-go/frontend-new/src/components/panels/activity/` into a compact operations timeline workspace:
  - activity stream health, counts, agent/type/time filters, grouped event timeline, and selected event detail
  - monitor run inventory, run filters, stats/top-agent summary, pagination, and selected run diagnostics
  - parsed model/tool/file/subagent diagnostics and raw event/payload inspection
  - empty, loading, error, first-run not-configured, and mock-ready states
- Preserve the current API wrapper behavior for activity, monitor, run detail, stats, and browser-only BFF access; do not call Gateway directly from browser code.
- Preserve live `activity.event` SSE merge behavior and existing navigation handoffs to Agents and Sessions.
- Fix deterministic mock Gateway activity/monitor payload gaps if visual E2E cannot exercise the normal frontend API path with contract-shaped data.
- Move obsolete global `deck-ui-activity` styling into module-local CSS using design-system tokens and stable responsive constraints.
- Add focused mock visual E2E covering the ready Activity workspace and meaningful interaction states.
- Update cross-module readiness evidence with Activity-specific findings and timeline/diagnostics/list/detail molecule candidates.

## Capabilities

### New Capabilities

- `frontend-activity-hifi-redesign`: Covers the Activity handoff package, production UI rewrite, contract-shaped mocks, focused mock visual evidence, and local design-system feedback.

### Modified Capabilities

- `design-system-cross-module-readiness`: Adds Activity implementation evidence and classifies whether grouped timeline, run inventory, diagnostic stack, top-agent filters, and raw payload detail molecules remain local, need a dedicated atom/pattern proposal, or stay as follow-up.

## Impact

- `deck-go/frontend-handoff/modules/activity/`
- `deck-go/frontend-new/src/components/panels/activity/`
- `deck-go/frontend-new/src/theme.css` Activity global styling removal or narrowing
- `deck-go/frontend-new/src/i18n/en.json` and `deck-go/frontend-new/src/i18n/zh.json`
- `deck-go/test/fixtures/mock-gateway.mjs` if activity/monitor mock drift is confirmed
- `deck-go/test/e2e/` focused Activity mock visual coverage
- `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md`
- `openspec/specs/frontend-activity-hifi-redesign/spec.md`
- `openspec/specs/design-system-cross-module-readiness/spec.md`
