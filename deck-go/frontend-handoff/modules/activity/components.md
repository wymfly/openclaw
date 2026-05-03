# Activity Components

## Component Tree

```text
ActivityPanel
  ActivityWorkbench
    ActivityStreamColumn
      WorkbenchHeader
      ActivityMetrics
      ActivityFilterBar
      ActivityTimelineGroups
        ActivityGroupHeader
        ActivityTimelineRow
      ActivityEmptyState
    MonitorRunColumn
      MonitorStatsStrip
      RunFilterBar
      TopAgentsRail
      MonitorRunList
        MonitorRunRow
      PaginationActions
    InspectorColumn
      SelectedEventCard
      SelectedRunCard
        RunSummaryMetrics
        DiagnosticStack
          ModelDiagnosticRows
          ToolDiagnosticRows
          FileDiagnosticRows
          SubagentDiagnosticRows
        RawRunEvents
        JsonPayloadDetail
```

## Module-Local Molecules

### Workbench header

- Shows title, description, stream/run readiness badges, and refresh actions.
- Uses existing text and status state; it does not introduce a new shared pattern.

### Activity metric tile

- Compact tile for loaded events, visible events, unique agents, total runs, today runs, and average duration.
- Repeats prior module metric-tile molecules but remains local until a dedicated design-system proposal defines a shared KPI API.

### Activity filter bar

- Inputs/selects for agent id/name, event type, and time range.
- Event type options come from loaded event data.
- Empty option means all event types.

### Activity timeline group

- Header button toggles group collapse.
- Group labels use the existing time buckets: Today, Yesterday, This Week, Older.
- Rows show description, type, agent, timestamp, and event id.
- Rows are buttons with selected state and stable wrapping for long descriptions.

### Monitor run list

- Rows show run id, status, agent, event count, model/tool/token evidence, and timestamp range.
- Selected state mirrors selected run id.
- Pagination action appears only when `nextCursor` exists.

### Selected event card

- Shows selected event description, event id, type, agent, timestamp, details, open-agent action, and raw payload.
- Open-agent action appears only when `agentId` exists.

### Selected run card

- Shows selected run id, detail load state, summary badges, metrics, cross-panel actions, diagnostics, raw run event rows, and raw run payload.
- Open-agent and open-session actions appear only when target ids exist.

### Diagnostic stack

- Parses model, tool, file, and subagent rows from `runDetail.events`.
- Parsing is best-effort and stream-specific; raw rows are always retained.

## Props / Data Boundaries

The production implementation can keep this as one component or split local child components. Public API boundaries should not widen. All data remains internal to `ActivityPanel` and is sourced from existing wrappers/hooks.
