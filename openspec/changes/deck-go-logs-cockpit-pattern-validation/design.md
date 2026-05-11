## Context

`deck-go-panel-cockpit-design-system` promoted shared cockpit patterns from
Sessions and Usage, then explicitly deferred broad rollout until a third module
validated the API. Logs is already remediated against its v2 prototype and has
the same operational workbench shape: top header/status controls, six KPI
metrics, two-pane workbench, and selected-detail surfaces. Its data contract is
already settled around `GET /api/logs`, `/api/logs/stream`, local parsing, and
dynamic stream payload leaves.

## Goals / Non-Goals

**Goals:**

- Use Logs as the third cockpit pattern validation sample.
- Replace only repeated cockpit chrome in Logs with existing patterns:
  `PanelRoot`, `KpiStrip`, `PanelMetric`, `PanelSectionHeader`,
  `PanelStatusRow`, and optionally `PanelPill`.
- Preserve Logs fetching, SSE subscription, parsing, filters, selection,
  export preview, raw payload display, and i18n behavior.
- Update focused tests, visual smoke selectors, handoff notes, and readiness
  evidence to record the result.

**Non-Goals:**

- No backend, BFF, Gateway, generated contract, or DTO changes.
- No global token value or density default changes.
- No refactor of log rows, filter bar, live tape, details-pane sections, or raw
  payload cards into shared design-system components.
- No durable export/download or server-side filtering.

## Decisions

1. **Use Logs as a validation consumer, not a new pattern source.**  
   Logs shall consume the cockpit pattern set already created from Sessions and
   Usage. New Logs-only shapes remain local unless another module repeats them.
   This avoids widening the design-system API before the existing API is proven.

2. **Migrate the KPI strip first.**  
   `MetricTile` is the clearest repeated structure. It maps directly to
   `PanelMetric` inside `KpiStrip` and already has warn/error variants. This
   gives the third-module evidence with minimal risk to Logs data behavior.

3. **Wrap the page chrome with `PanelRoot` and header with `PanelSectionHeader`.**  
   The outer `.logs-panel` class can remain as the module test id and layout
   scope, while the promoted root/header structure is rendered inside it. This
   keeps existing module-specific selectors stable for non-promoted areas.

4. **Keep row/tape/details molecules local.**  
   Log rows, live SSE tape rows, structured field lists, stack traces, raw
   payload cards, and filter bar behavior are Logs-specific because they depend
   on parsed log shape and observability workflows. They remain documented as
   local molecules.

5. **Verification remains UI-only and mock visual focused.**  
   The change touches frontend layout and tests only. It should run focused Logs
   unit tests, cockpit pattern tests, Logs mock visual E2E, frontend build, and
   OpenSpec validation. Real Gateway E2E is not required because no contract or
   real data path changes are made.

## Risks / Trade-offs

- **Risk: Pattern CSS changes Logs typography or spacing unexpectedly.**  
  Mitigation: keep module CSS scoped overrides only where necessary and run
  existing Logs mock visual E2E.

- **Risk: Old visual tests still assert local KPI classes.**  
  Mitigation: update tests/selectors to assert `ds-*` pattern classes for
  promoted structures while preserving local selectors for local molecules.

- **Risk: Treating Logs as successful validation could imply broad rollout is
  automatic.**  
  Mitigation: readiness docs shall say Logs validates the cockpit API but broad
  rollout still requires module-by-module migration, not global token changes.
