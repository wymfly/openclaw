# Activity Interactions

## Filtering

- Activity agent filter matches `agentId` or `agentName` case-insensitively.
- Activity type filter uses the exact event `type` string.
- Activity time range filters by timestamp age: `1h`, `6h`, `24h`, `7d`, or `all`.
- Run agent/session filters are trimmed before being sent to `fetchMonitorRuns`.
- Run status sends only `"running"`, `"completed"`, or `"error"`; `"all"` omits the status parameter.
- Run time range maps to `since`; `"all"` omits `since`.
- Clearing run filters resets agent/session/status/time and reloads with `{ limit: 50 }`.

## Selection

- Activity refresh preserves selected event if the refreshed result still contains it.
- Run refresh preserves selected run if the refreshed result still contains it.
- Fallback selection chooses the newest event or first run from the loaded list.
- Row selected states must be visible without depending only on color.

## Grouping

- Activity groups are ordered Today, Yesterday, This Week, Older.
- Group header buttons toggle collapse and expose `aria-expanded`.
- Collapsing a group hides only its rows; selected details remain available if selection still exists.

## Pagination

- Load-more calls `fetchMonitorRuns()` with the current query and `cursor`.
- New run ids are appended without duplicating existing run ids.
- The selected run is not reset by loading an additional page.

## Cross-Panel Handoffs

- Open event agent -> `navigateToAgent(ui, selectedEvent.agentId)`.
- Open run agent -> `navigateToAgent(ui, selectedRunAgentId)`.
- Open run session -> `navigateToSession(ui, selectedRunSessionKey)`.
- Top agent shortcut -> `navigateToAgent(ui, agent.agentId)`.
- Handoff actions should be omitted when target ids are absent.

## Accessibility / Keyboard

- Timeline group headers and rows are native buttons.
- Selects and inputs keep visible focus rings.
- Buttons use concise visible labels and preserve existing i18n text.
- Loading and empty states should not remove surrounding layout regions abruptly.

## Visual QA Checklist

- The first viewport shows both activity and monitor evidence.
- No text overlaps in long event/run/session ids.
- JSON/raw payloads are constrained and scroll/wrap inside their region.
- Mock visual screenshots are labeled as mock coverage in closeout evidence.
