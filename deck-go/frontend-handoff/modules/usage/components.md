# Components

## Usage Cockpit

Top-level module container. Owns data loading, range state, provider selection,
session expansion, and error handling. It should render a compact header, summary
metrics, a main trend/session column, and a provider/evidence sidecar.

## Summary Metrics

Local KPI tiles for:

- selected window
- total cost
- total tokens
- messages/tool calls
- p95 latency
- highest provider pressure

Tiles should use tight labels, numeric emphasis, and stable widths. They must not
resize the layout when values change.

## Trend Switcher

Segmented control for `tokens`, `cost`, and `by model`. The chart can remain a
CSS/progress-based bar chart in this change. It should expose readable labels,
values, and detail rows without canvas or external chart dependencies.

## Provider Pressure Rail

Sidecar molecule for provider quota evidence:

- hottest window summary
- selectable provider rows
- selected provider windows
- reset evidence when `resetAt` exists
- raw provider payload hidden behind details

Unknown reset times should render as `n/a`, not as a fabricated countdown.

## Session Drilldown

Searchable list of session usage rows. Expanded row shows:

- logs
- timeseries
- context pressure
- open agent/session actions

Expansion must lazy-load missing detail and cache already-loaded detail in panel
state.

## Aggregate Breakdown

Compact rows for by-model, by-provider, by-agent, and by-channel totals. These
stay local until the table/list pattern repeats enough to justify a canonical
DataTable proposal.

## Behavior Signals

Secondary evidence for message counts, tool calls, latency, daily signals, and
errors. This is not the primary spend answer, but it explains why costs changed.

## Context Pressure

Local summary of context-weight payload:

- total estimated chars
- source
- generated timestamp
- system prompt
- tools
- skills
- injected files

The molecule must preserve empty/loading states because context weight can be
unavailable even when session usage exists.
