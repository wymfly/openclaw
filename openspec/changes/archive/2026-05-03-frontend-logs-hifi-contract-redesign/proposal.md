## Why

Logs is a small but important operational module and the next best target after agents, routing, and subagents. The current panel already loads `/logs`, subscribes to `/logs/stream`, filters parsed lines, persists cursors, and prepares export text, but it still uses the old `deck-ui-logs` global shell styling and has no module handoff package. This change lets us prove the high-fidelity workflow on a streaming/read-only observability panel without changing Gateway truth.

## What Changes

- Create a complete high-fidelity logs handoff package under `deck-go/frontend-handoff/modules/logs/`.
- Redesign `deck-go/frontend-new/src/components/panels/logs/` into a contract-led log operations workbench for tail status, stream state, filtering, live tape, stream event inspection, payload details, and export preview.
- Preserve the existing logs contract boundary: `fetchLogsTail({ cursor, limit, maxBytes })` and `streamLogEvents` over `/logs/stream`.
- Add contract-shaped mock Gateway log tail data and a focused mock visual E2E for the ready workbench plus an interaction state.
- Record logs design-system evidence after agents/routing/subagents, classifying repeated observability molecules and any promotion candidates.

## Capabilities

### New Capabilities

- `frontend-logs-hifi-redesign`: Covers the logs handoff package, production UI rewrite, contract-shaped mocks, mock visual evidence, and local design-system feedback.

### Modified Capabilities

- `design-system-cross-module-readiness`: Adds logs as the fourth high-fidelity module and records whether the logs panel needs distinct observability molecules or can reuse the existing workbench candidates.

## Impact

- `deck-go/frontend-handoff/modules/logs/`
- `deck-go/frontend-new/src/components/panels/logs/`
- `deck-go/test/fixtures/mock-gateway.mjs` and focused Playwright visual coverage
- `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md`
- `openspec/specs/frontend-logs-hifi-redesign/spec.md`
- `openspec/specs/design-system-cross-module-readiness/spec.md`
