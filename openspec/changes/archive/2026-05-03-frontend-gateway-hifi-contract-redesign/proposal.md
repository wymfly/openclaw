## Why

Gateway/Monitor is the core runtime visibility surface for deck-go, but it still renders through the old `deck-ui-gateway` global shell while mixing runtime status, Gateway health/status, activity feed, monitor history, timeline detail, and bundled/remote runtime fields in one dense legacy layout.

This change applies the contract-led high-fidelity workflow to the gateway panel so operators get a clearer runtime diagnostics workbench while browser code remains behind the Deck API facade. Uncertain real Gateway, monitor projection, or runtime lifecycle semantics should be recorded as handoff follow-up rather than invented in the frontend.

## What Changes

- Create a complete high-fidelity gateway handoff package under `deck-go/frontend-handoff/modules/gateway/`.
- Redesign `deck-go/frontend-new/src/components/panels/gateway/` into a compact runtime diagnostics workbench:
  - runtime mode/health/connectivity summary
  - bundled supervisor and remote connection facts
  - Gateway health/status diagnostics
  - activity feed evidence
  - monitor run history and selected timeline detail
  - first-run Gateway-not-configured empty state
  - refresh affordance without adding lifecycle start/stop/restart controls
- Preserve current behavior for:
  - `fetchRuntimeGatewayStatus`
  - `fetchCapabilities`
  - `fetchGatewayHealth`
  - `fetchGatewayStatus`
  - `fetchActivityEvents`
  - `fetchMonitorRuns`
  - `fetchMonitorStats`
  - `fetchMonitorRunDetail`
  - `refreshRuntimeSummary`
- Add or update contract-shaped mock Gateway/runtime data if visual E2E gaps are found.
- Add focused mock visual E2E covering the ready workbench and at least one interaction state such as runtime tab, history-to-timeline selection, or Gateway-not-configured state.
- Update cross-module readiness evidence with gateway/runtime diagnostics molecules and promotion candidates.

## Capabilities

### New Capabilities

- `frontend-gateway-hifi-redesign`: Covers the gateway handoff package, production UI rewrite, contract-shaped mocks, mock visual evidence, and local design-system feedback.

### Modified Capabilities

- `design-system-cross-module-readiness`: Adds gateway implementation evidence after agents/routing/subagents/logs/settings/sessions/channels and records whether runtime diagnostics, activity-feed, and timeline molecules remain local or need a later pattern proposal.

## Impact

- `deck-go/frontend-handoff/modules/gateway/`
- `deck-go/frontend-new/src/components/panels/gateway/`
- `deck-go/frontend-new/src/theme.css` gateway global styling removal or narrowing
- `deck-go/test/fixtures/mock-gateway.mjs` and focused Playwright visual coverage if fixture gaps are found
- `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md`
- `openspec/specs/frontend-gateway-hifi-redesign/spec.md`
- `openspec/specs/design-system-cross-module-readiness/spec.md`
