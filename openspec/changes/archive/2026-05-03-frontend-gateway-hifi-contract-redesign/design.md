## Context

`frontend-new` already has a functional `GatewayPanel` under the `gateway` panel id, while the visible navigation copy also uses Monitor terminology. The panel currently loads runtime summary from Deck UI state, runtime capabilities from `useCapabilities`, Gateway diagnostics from `fetchGatewayHealth` / `fetchGatewayStatus`, activity feed from `fetchActivityEvents`, and monitor projections from `fetchMonitorRuns`, `fetchMonitorStats`, and `fetchMonitorRunDetail`.

The current UI is behavior-rich but still depends on old `deck-ui-gateway` global styling and a tabbed legacy shell. It also mixes several operator questions in one surface: is the runtime configured, is the Gateway connected, what is the health/status snapshot, what recent activity happened, and which monitor runs explain the timeline.

## Goals / Non-Goals

**Goals:**

- Produce a complete gateway handoff package.
- Rewrite gateway into a high-fidelity runtime diagnostics workbench aligned with the settled design-system posture.
- Preserve runtime, Gateway, activity, monitor history, timeline detail, first-run empty state, and refresh behavior.
- Add contract-shaped mock visual coverage for the ready workbench and at least one interaction state.
- Record gateway-specific design-system feedback without promoting atoms in this module change.

**Non-Goals:**

- No real Gateway/LLM E2E.
- No runtime lifecycle start/stop/restart controls.
- No new Gateway or monitor endpoints.
- No direct Gateway RPC from browser code.
- No new dependencies.
- No design-system atom promotion inside this module change.

## Decisions

1. **Treat Gateway as a runtime diagnostics workbench, not a lifecycle controller.**
   The UI should make runtime mode/health/connectivity and diagnostic evidence scannable, but it should not introduce start/stop/restart controls because current tests explicitly guard against those lifecycle actions.

2. **Keep all data through existing API wrappers and UI store.**
   `fetchRuntimeGatewayStatus`, `fetchCapabilities`, `fetchGatewayHealth`, `fetchGatewayStatus`, `fetchActivityEvents`, `fetchMonitorRuns`, `fetchMonitorStats`, `fetchMonitorRunDetail`, and `refreshRuntimeSummary` remain the production boundary.

3. **Keep bundled and remote runtime differences visible but compact.**
   Bundled-specific supervisor facts and remote-specific last connection/TLS facts should render in separate detail surfaces while sharing the same high-level status row.

4. **Fix only deterministic fixture/API drift.**
   If the bundled mock stack lacks Gateway health/status/activity/monitor projection data required by visual E2E, add contract-shaped fixture data. Unknown real Gateway monitor semantics become handoff follow-up.

5. **Keep gateway molecules local.**
   Candidate shared patterns include runtime metric tile, diagnostic status row, activity row, monitor run row, timeline event row, and runtime detail strip. They remain local until a dedicated design-system proposal defines stable APIs.

## Risks / Trade-offs

- **Risk: Behavior regression through a visual rewrite.** -> Preserve focused unit tests for runtime summary, no lifecycle actions, runtime state matrix, remote runtime fields, first-run empty state, and history-to-timeline selection.
- **Risk: The panel duplicates Activity or Sessions functionality.** -> Keep Gateway focused on runtime diagnostics and only show activity/monitor evidence as context for Gateway health.
- **Risk: Mock data hides real Gateway monitor gaps.** -> Label visual E2E as mock-only and record uncertain monitor/Gateway gaps in handoff notes.
- **Risk: Runtime mode terminology confuses operators.** -> Keep mode, health, ownership, and endpoint terms close to the contract fields while avoiding developer-only route names in visible copy.
- **Risk: Large legacy tab diff.** -> Keep the change inside `panels/gateway/`, module-local CSS, mock fixture, E2E, handoff, and readiness docs.
