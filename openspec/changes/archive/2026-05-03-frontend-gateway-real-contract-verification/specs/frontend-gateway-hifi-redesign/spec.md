## MODIFIED Requirements

### Requirement: Gateway production panel follows contract-backed workflows

The production gateway panel SHALL render and operate from contract-backed runtime summary, runtime capabilities, Gateway health/status/describe diagnostics, activity feed, monitor history, monitor stats, and selected monitor run detail while preserving the existing panel registry and API facade boundaries. The production implementation SHALL treat the refreshed handoff as the visual target, but it SHALL follow code truth: runtime status and capabilities are Deck runtime/BFF data, health/status/describe are Gateway diagnostic RPC evidence through the Go BFF, and activity/monitor data are Deck event-bus projections that may be empty in real stacks.

#### Scenario: Gateway diagnostics data is loaded

- **WHEN** runtime summary, capabilities, health/status/describe diagnostics, activity events, monitor runs, monitor stats, and optional selected run detail resolve
- **THEN** the panel SHALL show runtime mode, status, health, connectivity, bundled or remote runtime facts, Gateway health/status/describe evidence, activity evidence, monitor history, and timeline detail
- **AND** missing optional fields SHALL render as unavailable, empty, or omitted rather than fabricated values
- **AND** the documented route chain SHALL use current frontend wrappers and Go BFF routes
- **AND** the documented route chain SHALL distinguish real Gateway diagnostic RPCs from Deck event-bus activity/monitor projections

#### Scenario: Runtime mode differs

- **WHEN** the runtime summary indicates bundled supervisor state
- **THEN** bundled-specific pid, ownership, restart attempts, configured state, and resolved Gateway URL SHALL be visible
- **WHEN** the runtime summary indicates remote mode without supervisor state
- **THEN** remote-specific last connection, latency, TLS verification, and last error SHALL be visible

#### Scenario: Monitor history and timeline are used

- **WHEN** an operator selects a monitor run from history
- **THEN** the panel SHALL load run detail through the existing wrapper and show the selected run timeline, event count, duration, tool/model counts, token count, file ops, subagent spawns, and event rows
- **AND** if the real stack has no monitor runs, the UI SHALL render empty history as valid evidence rather than fabricating a run

#### Scenario: Gateway is not configured

- **WHEN** diagnostics or monitor calls return the existing Gateway-not-configured signal
- **THEN** the panel SHALL show the shared first-run empty state
- **AND** raw `gateway_not_configured` errors SHALL NOT be shown as operator-facing data errors

#### Scenario: Prototype-only gateway workflows are reviewed

- **WHEN** the handoff package references runtime lifecycle actions, batch console execution, editable describe explorer, durable activity history, or guaranteed monitor event coverage
- **THEN** production SHALL keep those workflows out of guaranteed active behavior unless a matching Deck-facing contract or verified BFF route exists
- **AND** unresolved workflow assumptions SHALL be recorded in `deck-go/frontend-handoff/modules/gateway/implementation-notes.md`
