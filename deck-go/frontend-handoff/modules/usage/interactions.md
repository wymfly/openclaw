# Interactions

## Refresh Range

1. Operator chooses a shortcut or custom day count.
2. Operator clicks refresh.
3. Panel calls `fetchModelUsageCost(days)`, `fetchModelUsageProviders()`, and
   `fetchUsageSessions({ startDate, endDate, limit: 50 })`.
4. Selected provider is preserved when still present.

## Switch Trend View

1. Operator clicks `Tokens`, `Cost`, or `By model`.
2. Panel updates chart rows from already-loaded data.
3. No API call is made.

## Select Provider

1. Operator clicks a provider row in the pressure rail.
2. Selected-provider windows and raw payload details update.
3. Hottest-window summary remains based on all providers.

## Search Sessions

1. Operator types into session search.
2. Local filtering matches session key, label, session id, agent id, and channel.
3. Empty search results use the module empty state.

## Expand Session

1. Operator clicks a session row.
2. If missing, panel calls:
   - `fetchUsageSessionLogs({ key, limit: 50 })`
   - `fetchUsageTimeseries({ key })`
   - `fetchUsageSessions({ key, includeContextWeight: true, limit: 1 })`
3. Detail renders logs, timeseries, context pressure, and handoff actions.

## Cross-Panel Handoff

Session detail actions use shared Deck navigation helpers:

- `navigateToAgent(ui, agentId)`
- `navigateToSession(ui, sessionKey)`

The panel must not manipulate route query strings directly.
