# gateway - states

## Ready

- Runtime status/capabilities, Gateway health/status, activity events, monitor
  runs, and monitor stats resolve.
- First viewport shows runtime status, health, connectivity, resolved URL,
  diagnostics, activity, and monitor evidence.
- The ready state must be readable without opening a details drawer.

## Runtime mode: bundled

- `capabilities.supervisorState === true` or runtime mode is not `remote`.
- Show pid, ownership state, restart attempts, configured state, auto-start if
  available, health, status, and resolved Gateway URL.
- Do not expose start, stop, or restart controls.

## Runtime mode: remote

- `capabilities.supervisorState === false` or runtime mode is `remote`.
- Show last connected time, p50 latency, TLS verification, last error, endpoint
  mutability, configured state, and Gateway URL.
- Missing values render as `n/a`, `None`, or `Unknown`.

## Gateway not configured

- Diagnostics or monitor calls return the existing `gateway_not_configured`
  signal.
- Show `GatewayNotConfiguredEmptyState`.
- Raw `gateway_not_configured` strings must not appear as operator-facing data
  errors.

## Loading

- Header refresh button may show disabled/in-flight state.
- Preserve previously loaded data where possible; do not blank the whole
  workbench on background refresh.
- Empty lists may show neutral empty copy.

## Diagnostics error

- Non-configuration Gateway health/status failures show a compact error surface
  near diagnostics.
- The runtime summary remains visible.

## Monitor error

- Activity/history/timeline failures show a compact monitor error surface.
- Diagnostics and runtime summary remain visible.

## Empty monitor

- If activity and monitor runs are empty but diagnostics are healthy, show
  neutral empty copy. Do not treat empty monitor projection as runtime failure.

## Selected run

- Selecting a history row sets the active tab to timeline, loads
  `/monitor/runs/{runId}`, and shows summary plus event rows.
- If detail is empty, show the selected run metadata and an empty timeline
  message.

## Mock visual

- Mock visual coverage may seed backend event projections through the mock
  Gateway subscription path. Evidence must be labeled mock-only and must not be
  claimed as real Gateway/LLM E2E.
