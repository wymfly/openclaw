# usage - high-fidelity handoff

**Status:** `implemented`
**Protocol version:** `protocol-v1`
**Active visual target:** [`./prototype.html`](./prototype.html)
**OpenSpec change:** `frontend-usage-hifi-contract-redesign`

This package defines the visual and interaction target for the `usage/` module
rewrite in `frontend-new`. The current panel is already connected to the usage
contract chain, but its layout still uses the old global `deck-ui-usage` shell.
Code and contracts remain the final authority when this handoff drifts.

## What this module does

`usage/` is the operations cockpit for spend, token pressure, provider quota
health, session-level usage, context weight, and behavior signals. Operators use
it to answer: what is spending now, which provider window is hot, which sessions
explain the spend, and which model/tool/context behavior is driving pressure.

The design keeps summary, trend, provider pressure, and session drilldown in the
first viewport. Logs, timeseries, context weight, aggregates, and behavior
signals remain visible as structured evidence rather than disconnected report
widgets.

## Contract truth

Production and mocks must use the current Deck-facing and Gateway DTOs:

- `DeckGoUsageCostEntry`
- `DeckGoUsageCostResponse`
- `DeckGoUsageTotals`
- `DeckGoUsageProviderWindow`
- `DeckGoUsageProviderStatus`
- `DeckGoUsageProvidersResponse`
- `DeckGoUsageSessionEntry`
- `DeckGoUsageSessionsResponse`
- `DeckGoUsageSessionLogEntry`
- `DeckGoUsageSessionLogsResponse`
- `DeckGoUsageTimePoint`
- `DeckGoUsageTimeseriesResponse`
- `DeckGoContextWeightReport`
- `DeckGoUsageAggregateEntry`
- `DeckGoUsageDailyAggregate`
- `DeckGoUsageDailyModelAggregate`
- `DeckGoUsageLatencyStats`
- `DeckGoUsageMessageCounts`
- `DeckGoUsageToolSummary`

Endpoint/RPC truth:

- `GET /models/usage/cost` -> `usage.cost`
- `GET /models/usage/providers` -> `usage.status`
- `GET /usage/sessions` -> `sessions.usage`
- `GET /usage/sessions/logs` -> `sessions.usage.logs`
- `GET /usage/timeseries` -> `sessions.usage.timeseries`

Browser code must continue through `frontend-new/src/api.ts` wrappers and the
Deck backend:

- `fetchModelUsageCost`
- `fetchModelUsageProviders`
- `fetchUsageSessions`
- `fetchUsageSessionLogs`
- `fetchUsageTimeseries`

It must not call Gateway RPC directly.

## Workflow constraints

- Visual convergence is the goal of this module pass: mock + frontend should
  become stable against the contract and design system.
- Code truth wins over this handoff when the two disagree.
- Deterministic fixture/API drift may be fixed in this change. Uncertain real
  Gateway billing, provider quota reset, context-weight, and aggregation
  semantics must be recorded as follow-up instead of invented in the UI.
- Range refresh must continue to drive cost and session queries.
- Session detail must continue to lazy-load logs, timeseries, and context
  weight.
- No new Gateway endpoints, new dependencies, or canonical atom promotion are
  part of this handoff.

## Depends on canonical atoms

`Badge`, `Button`, `Card`, `Chip`, `Code`, `Input`, `SegmentedControl`,
`Spinner`, `Tag`, and status atoms can be used where production fit is
straightforward.

No canonical atom or token is required by this handoff. Local molecules:

- usage metric tile
- cost/token trend chart
- provider pressure rail
- quota window card
- session usage row
- session detail drawer
- context pressure summary
- aggregate breakdown row
- behavior signal row
- mock visual evidence banner

## How to implement

1. Open `prototype.html` and inspect ready, loading, empty, error, provider
   pressure, range refresh, trend switching, and session expanded states.
2. Read `api-usage.md` before touching mocks, API wrappers, or backend
   behavior.
3. Translate the prototype into `frontend-new/src/components/panels/usage/`,
   preserving API wrappers, range refresh, provider selection, trend switching,
   session expansion, lazy detail loading, and navigation handoffs.
4. Move Usage styling out of global `theme.css` into module-local CSS.
5. Add mock visual E2E with contract-shaped data and label evidence as mock
   visual coverage.

## Open questions for follow-up

- Whether real `usage.cost` always returns only cost totals or may include token
  detail beyond the current Deck DTO shape.
- Whether real `usage.status` provider windows always include `resetAt` and how
  missing reset times should be distinguished from unknown quota policy.
- Whether `sessions.usage` should be the long-term source for all daily/model
  aggregates or whether monitor routes should also feed this panel later.
- Whether context-weight payloads are stable enough to promote a shared context
  pressure molecule across Usage, Sessions, and Chat.
- Whether cost trend and quota rail should become canonical design-system chart
  primitives after Usage, Models, Activity, and Budget converge.
