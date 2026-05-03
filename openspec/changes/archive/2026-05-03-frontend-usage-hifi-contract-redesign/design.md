## Context

`frontend-new` already has a functional `UsagePanel` under the `usage` panel id. It loads model cost through `/models/usage/cost`, provider pressure through `/models/usage/providers`, session usage through `/usage/sessions`, session logs through `/usage/sessions/logs`, and timeseries through `/usage/timeseries`.

The implementation is behavior-rich, but the surface is still structured as old `deckgo-card` columns with `deck-ui-usage` global styling. It exposes useful data but does not give operators a clear first-viewport answer to "what is spending, what is under quota pressure, which sessions explain it, and what context/tool behavior is driving the cost?"

## Goals / Non-Goals

**Goals:**

- Produce a complete Usage handoff package.
- Rewrite Usage into a high-fidelity usage operations cockpit aligned with the current design-system posture.
- Preserve cost, provider quota, session usage, logs, timeseries, context weight, range refresh, trend switching, and cross-panel handoff behavior.
- Fix deterministic mock Gateway usage payload gaps needed for visual E2E.
- Add focused mock visual coverage for the ready cockpit and meaningful interaction states.
- Record Usage-specific design-system feedback without silently promoting atoms.

**Non-Goals:**

- No real Gateway/LLM E2E.
- No new Gateway, usage, monitor, or config endpoints.
- No direct Gateway RPC from browser code.
- No new dependencies.
- No canonical design-system atom promotion inside this module change.
- No redesign of billing calculation semantics or quota policy semantics beyond presenting current contract-shaped data.

## Decisions

1. **Treat Usage as an operations cockpit, not a list of report widgets.**
   The first viewport should combine totals, trend, provider pressure, and session drilldown entry points. Deeper signals such as logs, timeseries, context weight, aggregates, and behavior diagnostics remain present but become structured secondary evidence.

2. **Keep all data through existing API wrappers.**
   `fetchModelUsageCost`, `fetchModelUsageProviders`, `fetchUsageSessions`, `fetchUsageSessionLogs`, and `fetchUsageTimeseries` remain the production boundary. Browser code must keep using the Deck backend and typed facade instead of direct Gateway RPC.

3. **Use module-local molecules for charts, KPI tiles, quota rails, session detail, and context pressure.**
   Usage repeats molecules seen in Models and Sessions, but it is still too early to promote chart/table/quota/session-detail APIs. This change keeps those layouts local and records promotion candidates in readiness after visual verification.

4. **Fix only deterministic mock/API drift.**
   The mock Gateway should provide enough cost/provider/session/log/timeseries/context data to exercise the normal frontend API path. Unknown real Gateway billing, provider quota reset, context weight, or session aggregation semantics become handoff follow-up.

5. **Preserve range and drilldown semantics.**
   The redesign may change layout and classes, but range refresh must still drive cost and sessions, provider selection must remain deterministic, trend view switching must remain local, and expanding a session must still lazy-load logs/timeseries/context detail.

## Risks / Trade-offs

- **Risk: Visual rewrite regresses behavior.** -> Keep focused unit tests for load calls, range refresh, provider selection, trend switching, session expansion, log/timeseries/context loading, and navigation handoffs.
- **Risk: Mock usage data hides real Gateway gaps.** -> Label visual E2E as mock-only and document uncertain real Gateway usage/provider/context semantics in handoff notes.
- **Risk: Chart/quota molecules become de facto shared APIs.** -> Keep them under `panels/usage/` and record promotion candidates instead of exporting shared atoms.
- **Risk: Dense financial/usage information overwhelms the operator.** -> Use compact first-viewport hierarchy, strong grouping, restrained tokens, and responsive constraints rather than adding more cards.
- **Risk: Global CSS cleanup affects unrelated panels.** -> Move only `deck-ui-usage` styling to module-local CSS and verify focused Usage tests plus frontend build.
