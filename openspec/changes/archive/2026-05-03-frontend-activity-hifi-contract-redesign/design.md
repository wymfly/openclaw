## Context

`frontend-new` already contains a functional `ActivityPanel` under the `activity` panel id. It calls `fetchActivityEvents()`, `fetchMonitorRuns()`, `fetchMonitorRunDetail()`, and `fetchMonitorStats()`, all of which reach the Go BFF. The browser also subscribes to the shared event stream and merges `activity.event` SSE payloads into the local timeline. The backend routes are sourced from runtime event-bus projections rather than direct browser-to-Gateway RPC.

The current panel loads, filters, groups, selects, paginates monitor runs, parses selected run diagnostics, opens related Agents/Sessions views, and renders not-configured empty states. The main gap is visual and workflow convergence: the layout is a dense card stack using global `deck-ui-activity` CSS in `theme.css`, and there is no complete `frontend-handoff/modules/activity/` package for future design/engineering work.

## Goals / Non-Goals

**Goals:**

- Produce a complete Activity handoff package.
- Rewrite Activity into a high-fidelity operations timeline workspace aligned with the current design-system posture.
- Preserve activity loading, SSE merge, filters, grouping, selection, monitor run pagination, stats/top-agent navigation, run detail parsing, and cross-panel handoff behavior.
- Fix deterministic mock Gateway data gaps needed for visual E2E.
- Add focused mock visual coverage for ready and interaction states.
- Record Activity-specific design-system feedback without silently promoting atoms or patterns.

**Non-Goals:**

- No real Gateway/LLM E2E in this module pass.
- No new Gateway method or BFF route.
- No browser-side direct Gateway RPC.
- No new dependencies, charting libraries, virtualization libraries, or table/editor libraries.
- No canonical design-system atom/pattern promotion inside this module change.
- No guarantee about upstream event-bus completeness beyond contract-shaped rendering; uncertain real projection semantics become handoff open questions.

## Decisions

1. **Treat Activity as an operations timeline cockpit, not a generic event log.**
   The first viewport should expose stream health, filter state, grouped activity, monitor run status, and selected diagnostics. This keeps the two related contracts visible without forcing operators through a raw table.

2. **Preserve the existing API wrappers and SSE hook.**
   The frontend already respects the BFF boundary with `fetchActivityEvents`, `fetchMonitorRuns`, `fetchMonitorRunDetail`, `fetchMonitorStats`, and `useActivitySSE`. The rewrite should keep this path and avoid a new client abstraction.

3. **Use module-local molecules for timeline rows, run rows, diagnostics, stats, and payload detail.**
   These molecules overlap with Gateway/Logs/Usage/Sessions detail patterns, but Activity has event-bus and run-diagnostic semantics. Any promotion to design-system patterns waits for a separate proposal.

4. **Keep filters contract-shaped.**
   Activity filters stay as agent id/name, event type, and time range. Monitor filters stay as agent id, session key, status enum, time range, and cursor pagination. Do not infer richer statuses or stream categories that the BFF contract does not expose.

5. **Fix only deterministic mock/API drift.**
   The mock Gateway should provide realistic activity and monitor data for normal frontend visual paths. If real Gateway projections omit some streams or have source-specific gaps, document that in handoff rather than fabricating product guarantees.

## Risks / Trade-offs

- **Risk: Visual rewrite regresses SSE merge or selected event behavior.** -> Keep focused unit tests for load/sort/filter/select/group/SSE behavior and visual E2E for ready plus interaction states.
- **Risk: Run diagnostic parsing overstates Gateway truth.** -> Render only fields present in selected run events; label or omit missing optional values rather than inventing values.
- **Risk: Global CSS cleanup affects unrelated panels.** -> Move only `deck-ui-activity` styling to module-local CSS and verify focused Activity tests plus frontend build.
- **Risk: Mock visual coverage hides real Gateway gaps.** -> Label E2E as mock-only and record projection completeness uncertainty in handoff notes.
