## ADDED Requirements

### Requirement: Usage handoff package defines the visual contract

The change SHALL create a Usage handoff package under `deck-go/frontend-handoff/modules/usage/` that records code-truth constraints, contract inputs, implementation notes, interaction states, and open questions.

#### Scenario: Handoff package is complete

- **WHEN** the Usage redesign is implemented
- **THEN** the handoff package SHALL include `README.md`, `prototype.html`, `components.md`, `states.md`, `interactions.md`, and `api-usage.md`
- **AND** the package SHALL state that code and contracts remain the final authority
- **AND** uncertain real Gateway usage, quota, billing, context-weight, and aggregation semantics SHALL be listed as follow-up instead of invented in the frontend

### Requirement: Usage cockpit preserves current contract chain

The Usage panel SHALL continue to load usage data through the existing frontend API wrappers and Deck backend endpoints rather than direct browser-to-Gateway RPC.

#### Scenario: Usage data loads through wrappers

- **WHEN** the Usage panel refreshes its ready state
- **THEN** it SHALL use `fetchModelUsageCost`, `fetchModelUsageProviders`, and `fetchUsageSessions`
- **AND** session expansion SHALL use `fetchUsageSessionLogs`, `fetchUsageTimeseries`, and `fetchUsageSessions` with context-weight parameters when needed
- **AND** the browser code SHALL NOT call Gateway RPC methods directly

### Requirement: Usage cockpit exposes operator-first summary and pressure

The Usage panel SHALL present selected-window totals, token and cost signals, provider quota pressure, trend evidence, and session drilldown entry points in a coherent first-viewport cockpit.

#### Scenario: Usage ready state is visible

- **WHEN** cost, provider, and session usage data are loaded
- **THEN** the panel SHALL show a compact status/header region with selected window, total cost, total tokens, message/tool/latency signals, and provider pressure
- **AND** it SHALL show daily or model trend evidence without requiring session expansion
- **AND** it SHALL show a provider quota area with selected-provider and hottest-window evidence when provider data exists

### Requirement: Usage session drilldown remains actionable

The Usage panel SHALL preserve searchable session usage drilldown with expansion detail and cross-panel handoffs.

#### Scenario: Session usage is expanded

- **WHEN** an operator expands a session row
- **THEN** the panel SHALL show session logs, timeseries rows, and context-weight evidence when available
- **AND** it SHALL expose handoff actions to the related agent and session through shared Deck navigation helpers
- **AND** loading, empty, and error states SHALL remain visible without blank panes

### Requirement: Usage mock visual evidence is collected

The change SHALL add focused mock visual E2E evidence for the Usage panel using contract-shaped fixture data.

#### Scenario: Mock visual E2E covers usage states

- **WHEN** the Usage mock visual E2E runs
- **THEN** it SHALL open the Usage panel through the normal frontend route
- **AND** it SHALL capture the ready cockpit and at least two interaction states such as range refresh, trend view switching, provider quota selection, or session drilldown
- **AND** any screenshots or readiness notes SHALL label this as mock visual coverage rather than real Gateway/LLM evidence

### Requirement: Usage styles are module-local

The Usage redesign SHALL move obsolete panel-specific styling out of global `theme.css` into Usage module-local CSS or otherwise narrow global selectors so they do not define the new panel layout.

#### Scenario: Usage global styles are removed or narrowed

- **WHEN** the Usage redesign is complete
- **THEN** new layout, chart, quota, session, aggregate, and context-pressure styling SHALL live under `deck-go/frontend-new/src/components/panels/usage/`
- **AND** global CSS SHALL NOT retain broad `deck-ui-usage` layout definitions for the rewritten panel
