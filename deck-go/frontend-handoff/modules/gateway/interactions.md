# gateway - interactions

## Navigation

- Use a compact tab strip with Overview, Timeline, History, and Runtime.
- Overview is default.
- Selecting a monitor history row switches to Timeline and loads detail.
- Keyboard focus must remain visible on tabs and selectable rows.

## Refresh

- Runtime refresh calls `refreshRuntimeSummary()`.
- Diagnostics refresh calls `fetchGatewayHealth()` and `fetchGatewayStatus()`.
- The visible refresh button may trigger runtime + diagnostics refresh, but it
  must not start, stop, or restart Gateway.

## History to timeline

1. Operator opens History.
2. Operator activates a `MonitorRunRow`.
3. UI sets selected run id.
4. UI calls `fetchMonitorRunDetail(runId)`.
5. UI switches to Timeline and renders detail.

## First-run empty state

- If diagnostics or monitor calls map to `gateway_not_configured`, render the
  shared `GatewayNotConfiguredEmptyState`.
- The empty state should sit inside the gateway workbench and should not cover
  runtime capabilities that are still available.

## Hover and focus

- Metric tiles are static and should not look clickable.
- Monitor run rows are clickable and should have hover/focus/selected states.
- Buttons use the existing low-radius, token-backed button rhythm.

## Accessibility

- Tabs use `role="tablist"`, `role="tab"`, and `role="tabpanel"`.
- Selected monitor rows expose `aria-pressed`.
- Refresh button exposes a stable label.
- Error surfaces use `role="alert"` only for real non-configuration errors.
- Text must wrap within cards; identifiers may use `overflow-wrap:anywhere`.

## Copy constraints

- Keep visible copy operator-facing: runtime, health, Gateway, activity,
  monitor, timeline.
- Avoid developer-only route names in primary headings.
- The handoff may mention endpoints, but production UI should not surface route
  names unless it is evidence/debug text.
