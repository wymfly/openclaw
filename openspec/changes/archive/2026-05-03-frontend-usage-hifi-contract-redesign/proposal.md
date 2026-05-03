## Why

Usage is the next Observe panel that needs contract-led visual convergence. The current implementation already reaches usage cost, provider quota, session usage, logs, timeseries, and context-weight data, but the UI still lives in the old global `deck-ui-usage` shell and does not present usage as a coherent operations cockpit.

This change applies the high-fidelity handoff workflow to Usage so mock + frontend can converge against the current contract chain and design-system posture. Deterministic mock/API drift may be fixed; uncertain real Gateway usage semantics should be recorded as handoff follow-up.

## What Changes

- Create a complete high-fidelity Usage handoff package under `deck-go/frontend-handoff/modules/usage/`.
- Redesign `deck-go/frontend-new/src/components/panels/usage/` into a compact usage operations cockpit:
  - cost and token summary for the selected window
  - provider quota pressure and reset evidence
  - daily/model trend analysis
  - session usage drilldown with search, expansion, logs, timeseries, context weight, and cross-panel handoffs
  - aggregate breakdowns by model, provider, agent, and channel
  - behavior signals for latency, messages, tools, and errors
- Preserve current API wrapper behavior for:
  - `fetchModelUsageCost`
  - `fetchModelUsageProviders`
  - `fetchUsageSessions`
  - `fetchUsageSessionLogs`
  - `fetchUsageTimeseries`
- Fix deterministic mock Gateway usage payload gaps if visual E2E cannot exercise the normal frontend API path with contract-shaped data.
- Move or narrow obsolete global `deck-ui-usage` styling into module-local CSS using design-system tokens and stable responsive constraints.
- Add focused mock visual E2E covering the ready usage cockpit and meaningful interaction states such as range refresh, trend view changes, provider quota selection, and session drilldown.
- Update cross-module readiness evidence with Usage-specific findings and repeated chart/table/quota/session-detail/context-pressure molecules.

## Capabilities

### New Capabilities

- `frontend-usage-hifi-redesign`: Covers the Usage handoff package, production UI rewrite, contract-shaped mocks, focused mock visual evidence, and local design-system feedback.

### Modified Capabilities

- `design-system-cross-module-readiness`: Adds Usage implementation evidence and classifies whether chart, KPI, quota, table, session-detail, and context-pressure molecules remain local, need a dedicated atom proposal, or stay as follow-up.

## Impact

- `deck-go/frontend-handoff/modules/usage/`
- `deck-go/frontend-new/src/components/panels/usage/`
- `deck-go/frontend-new/src/theme.css` Usage global styling removal or narrowing
- `deck-go/frontend-new/src/i18n/en.json` and `deck-go/frontend-new/src/i18n/zh.json`
- `deck-go/test/fixtures/mock-gateway.mjs` if usage mock drift is confirmed
- `deck-go/test/e2e/` focused Usage mock visual coverage
- `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md`
- `openspec/specs/frontend-usage-hifi-redesign/spec.md`
- `openspec/specs/design-system-cross-module-readiness/spec.md`
