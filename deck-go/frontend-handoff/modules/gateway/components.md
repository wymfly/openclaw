# gateway - components

## Production ownership

- `frontend-new/src/components/panels/gateway/GatewayPanel.tsx`
- `frontend-new/src/components/panels/gateway/gateway-panel.css`

## Layout tree

```txt
GatewayPanel
  GatewayHeader
    RuntimeModePills
    RefreshButton
  GatewayMetrics
    RuntimeStatusMetric
    GatewayHealthMetric
    ConnectivityMetric
    MonitorRunsMetric
    ActivityMetric
  GatewayTabs
    Overview
    Timeline
    History
    Runtime
  GatewayWorkbench
    OverviewColumn
      RuntimeSummaryCard
      DiagnosticsGrid
      ActivityFeedCard
    EvidenceColumn
      MonitorHistoryCompact
      SelectedTimelinePreview
  RuntimeTab
    RuntimeSummaryCard
    BundledRuntimeFacts | RemoteRuntimeFacts
  HistoryTab
    MonitorStats
    MonitorRunRow[]
  TimelineTab
    TimelineHero
    TimelineStatGrid
    TimelineEventRow[]
```

## Local molecules

### Runtime metric tile

Compact `label + value + detail` tile. Use for runtime status, health,
connectivity, monitor run count, and activity count. Keep local until a
dedicated KpiCard / metric pattern exists.

### Runtime status strip

Dense row of status pills for mode, configured state, supervisor/remote state,
resolved URL, refresh state, and ownership/connection details.

### Diagnostic evidence tile

Small evidence surface for Gateway health and Gateway status. It should show
missing optional fields as `n/a` or `Unknown`, never fabricated values.

### Activity row

Single-row live evidence from `DeckGoActivityEvent`, showing description,
agent/session details, type, and timestamp. It is contextual evidence, not a
replacement for the Activity module.

### Monitor run row

Selectable row for `DeckGoMonitorRun`, showing run id, agent, session, status,
event count, tool/model counts, tokens, and last event time.

### Timeline stat tile

Small summary tile for selected run detail: events/duration, tool/model calls,
tokens, and file/subagent operations.

### Timeline event row

Event row for `DeckGoMonitorRunEvent`, showing sequence, stream, timestamp, and
a summarized JSON payload. Use monospace for raw identifiers only.

## Class naming

Production should replace global gateway styling with module-local classes:

- `.gateway-panel`
- `.gateway-panel__header`
- `.gateway-metrics`
- `.gateway-metric`
- `.gateway-tabs`
- `.gateway-workbench`
- `.gateway-card`
- `.gateway-surface`
- `.gateway-status-strip`
- `.gateway-diagnostics`
- `.gateway-activity-row`
- `.gateway-run-row`
- `.gateway-timeline-row`
- `.gateway-error`

Legacy shared `deckgo-*` classes may remain only where still owned by global
shell infrastructure outside this module.
