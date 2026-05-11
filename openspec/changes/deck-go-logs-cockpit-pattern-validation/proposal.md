## Why

Sessions and Usage proved that cockpit primitives can replace repeated panel
chrome, but broad rollout is intentionally deferred until a third module
validates the same API. Logs is the smallest operational panel with the same
header, KPI strip, and status-row anatomy, so it is the right third-module
sample before promoting a wider migration rule.

## What Changes

- Migrate only the shared Logs cockpit structures to the existing cockpit
  pattern set: `PanelRoot`, `KpiStrip`, `PanelMetric`, `PanelSectionHeader`,
  `PanelStatusRow`, and `PanelPill` if needed.
- Keep Logs-specific filter bar, log rows, live tape, selected-line details,
  raw payload rendering, parsing, stream state, and export preview local.
- Update Logs focused tests and visual smoke selectors to verify pattern
  consumption without changing data loading or user workflows.
- Record the third-module validation result in cross-module readiness and Logs
  handoff notes.
- Do not change backend routes, generated contracts, global tokens, dependencies,
  or Logs product scope.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `design-system-cross-module-readiness`: record Logs as the third cockpit
  pattern validation sample and update broad rollout readiness.
- `design-system-patterns`: clarify that third-sample validation requires
  consuming the existing cockpit patterns rather than copying Sessions/Usage
  local classes.

## Impact

- Frontend code: `deck-go/frontend-new/src/components/panels/logs/` and focused
  Logs tests.
- E2E selectors: Logs mock visual test may move from local metric/header classes
  to cockpit pattern classes where structures are promoted.
- Documentation: Logs implementation notes and cross-module readiness matrix.
- No API, backend, contract-generation, dependency, or global token impact.
