# frontend-gateway-hifi-redesign Specification

## Purpose

TBD - created by archiving change frontend-gateway-hifi-contract-redesign. Update Purpose after archive.

## Requirements

### Requirement: Gateway handoff package defines the visual contract

The gateway module SHALL have a complete handoff package under `deck-go/frontend-handoff/modules/gateway/` before the production UI rewrite is marked complete. The package SHALL use the current Deck-facing runtime, Gateway health/status/describe/batch, activity, and monitor route/DTO chain as source truth, and it SHALL call out every place where the v2 prototype is product guidance rather than code truth.

#### Scenario: Handoff package is reviewed

- **WHEN** the gateway handoff package is reviewed for implementation
- **THEN** it SHALL include `README.md`, `prototype.html`, `components.md`, `states.md`, `interactions.md`, `api-usage.md`, and implementation notes for the revised v2 handoff
- **AND** unsupported or uncertain runtime, Gateway, monitor, batch, activity, or lifecycle behavior SHALL be documented as discrepancy notes or open questions rather than guaranteed UI behavior
- **AND** runtime mode, Gateway diagnostics, describe explorer, bundled-only read-only batch console, activity projection, throughput projection, refresh, and first-run empty behavior SHALL be documented explicitly
- **AND** stale route or method names such as `/api/gateway/batch`, `gateway.health`, or `gateway.status` SHALL be corrected to the current code truth when discovered

### Requirement: Gateway production panel follows contract-backed workflows

The production gateway panel SHALL render and operate from contract-backed runtime summary, runtime capabilities, Gateway health/status/describe diagnostics, typed runtime Gateway batch transport, activity feed, monitor stats, and optional monitor evidence while preserving the existing panel registry and API facade boundaries. The production implementation SHALL treat the refreshed handoff as the visual target, but it SHALL follow code truth: runtime status and capabilities are Deck runtime/BFF data, health/status/describe are Gateway diagnostic RPC evidence through the Go BFF, typed batch is runtime-scoped under `/api/v1/runtimes/{runtimeId}/gateway/batch`, and activity/monitor data are Deck event-bus projections that may be empty in real stacks.

#### Scenario: Gateway diagnostics data is loaded

- **WHEN** runtime summary, capabilities, health/status/describe diagnostics, activity events, monitor stats, and optional monitor runs resolve
- **THEN** the panel SHALL show runtime mode, status, health, connectivity, bundled or remote runtime facts, Gateway health/status/describe evidence, activity evidence, throughput projection, and navigation affordances
- **AND** missing optional fields SHALL render as unavailable, empty, or omitted rather than fabricated values
- **AND** the documented route chain SHALL use current frontend wrappers and Go BFF routes
- **AND** the documented route chain SHALL distinguish real Gateway diagnostic RPCs from Deck event-bus activity/monitor projections

#### Scenario: Runtime mode differs

- **WHEN** the runtime summary indicates bundled supervisor state
- **THEN** bundled-specific pid, ownership, restart attempts, configured state, and resolved Gateway URL SHALL be visible
- **AND** the read-only Gateway batch composer SHALL be available only for read-capable methods when the runtime is configured and healthy enough to submit
- **WHEN** the runtime summary indicates remote mode without supervisor state
- **THEN** remote-specific last connection, latency, TLS verification, and last error SHALL be visible
- **AND** the batch composer SHALL be disabled or hidden with a clear remote-read-only explanation

#### Scenario: Methods and events are explored

- **WHEN** `GET /api/gateway/describe` returns methods, events, or untyped method names
- **THEN** the panel SHALL provide a searchable Methods & Events view with method/event mode, scope filtering for methods, selected entry detail, params/result/payload JSON, and untyped method evidence
- **AND** the view SHALL degrade to empty or unavailable states when describe data is missing or fails independently of health/status

#### Scenario: Batch console is used

- **WHEN** the runtime is bundled and configured
- **THEN** the panel SHALL expose a Gateway batch console backed by `POST /api/v1/runtimes/{runtimeId}/gateway/batch`
- **AND** the composer SHALL submit only read-only or non-write described methods by default
- **AND** invalid JSON params, empty method names, unsupported methods, nested `gateway.batch`, and subscription methods SHALL be surfaced as validation or per-slot errors rather than crashing the panel
- **AND** the UI SHALL NOT describe the batch as synthetic when it is backed by the real BFF transport

#### Scenario: Activity and monitor evidence are used

- **WHEN** activity, monitor runs, or monitor stats are available
- **THEN** the panel SHALL surface them as Deck BFF projections and use them only as supporting throughput/activity evidence
- **AND** if the real stack has no monitor runs, the UI SHALL render empty history as valid evidence rather than fabricating a run

#### Scenario: Gateway is not configured

- **WHEN** diagnostics, batch, or monitor calls return the existing Gateway-not-configured signal
- **THEN** the panel SHALL show or preserve the shared first-run empty state where appropriate
- **AND** raw `gateway_not_configured` errors SHALL NOT be shown as operator-facing data errors

#### Scenario: Prototype-only gateway workflows are reviewed

- **WHEN** the handoff package references runtime lifecycle actions, editable describe explorer, durable activity history, guaranteed monitor event coverage, or arbitrary mutating batch execution
- **THEN** production SHALL keep those workflows out of guaranteed active behavior unless a matching Deck-facing contract or verified BFF route exists
- **AND** unresolved workflow assumptions SHALL be recorded in `deck-go/frontend-handoff/modules/gateway/implementation-notes.md`

### Requirement: Gateway UI aligns with the settled frontend design system

The gateway panel SHALL use the settled frontend-new design-system posture: Inter/JetBrains Mono typography, `--ds-*` tokens, compact workbench density, low-radius surfaces, clear focus states, and local molecules only when canonical atoms are not yet justified.

#### Scenario: Gateway UI is rendered

- **WHEN** the gateway panel is rendered with contract-shaped mock data
- **THEN** the first viewport SHALL expose Gateway health, runtime mode, connectivity, sessions, channel/heartbeat summaries, describe counts, throughput/activity evidence, and tab navigation without overlapping text or nested decorative cards
- **AND** lifecycle start/stop/restart actions SHALL remain absent unless a separate runtime lifecycle proposal introduces them
- **AND** all labels, buttons, empty states, validation messages, and batch statuses SHALL be localizable through `frontend-new/src/i18n/{en,zh}.json`

### Requirement: Gateway mock visual verification is available

The gateway rewrite SHALL include focused mock visual verification that exercises the real frontend against contract-shaped runtime, Gateway health/status/describe/batch, activity, and monitor data without requiring a real Gateway or LLM.

#### Scenario: Mock visual E2E runs

- **WHEN** the gateway mock visual E2E is executed
- **THEN** it SHALL load runtime/Gateway/batch/activity/monitor data through the frontend API path
- **AND** it SHALL capture or assert the ready workbench state and at least two interaction states such as Methods & Events search/detail, batch tab, batch validation/result, activity tab, remote batch lock, or Gateway-not-configured state
- **AND** closeout evidence SHALL label the test as mock visual coverage, not real Gateway/LLM E2E
