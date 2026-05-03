# States

## Ready

Shows the usage cockpit with summary metrics, trend chart, provider pressure,
session drilldown, aggregate breakdown, and behavior signals. This is the main
mock visual target.

## Loading

Header and layout remain stable. Summary values may show skeleton-like loading
text or muted zero values. No blank pane should appear.

## Empty

If cost, provider, and session data are empty, keep the selected range visible
and show empty copy in the trend, provider, and session areas.

## Error

Display the API error near the header and keep stale/empty panel structure
visible. The operator should still understand which range and source were
attempted.

## Range Refresh

Changing range and clicking refresh reloads cost and sessions with the selected
range. The selected provider should remain if it still exists in the refreshed
payload, otherwise fall back deterministically to the first provider.

## Trend Switching

Switching between tokens, cost, and by-model views is local UI state and must not
refetch data.

## Provider Selected

Selecting a provider updates the quota rail and selected-window evidence. It
must not affect the trend or session list.

## Session Expanded

Expanding a session reveals logs, timeseries, and context pressure. The panel
fetches missing detail once and reuses cached state on subsequent expansion.

## Mock Visual

Mock visual screenshots must be labeled as mock visual evidence. They do not
prove real Gateway/LLM behavior.
