# frontend-gateway-hifi-redesign Specification

## Purpose

TBD - created by archiving change frontend-gateway-hifi-contract-redesign. Update Purpose after archive.

## Requirements

### Requirement: Gateway handoff package defines the visual contract

The gateway module SHALL have a complete handoff package under `deck-go/frontend-handoff/modules/gateway/` before the production UI rewrite is marked complete. The package SHALL use the current Deck-facing runtime, Gateway health/status, activity, and monitor run DTOs/routes as source truth.

#### Scenario: Handoff package is reviewed

- **WHEN** the gateway handoff package is created
- **THEN** it SHALL include `README.md`, `prototype.html`, `components.md`, `states.md`, `interactions.md`, and `api-usage.md`
- **AND** unsupported or uncertain runtime, Gateway, monitor, or lifecycle behavior SHALL be documented as discrepancy notes or open questions rather than guaranteed UI behavior
- **AND** runtime mode, Gateway diagnostics, activity feed, monitor history, timeline detail, refresh, and first-run empty behavior SHALL be documented explicitly

### Requirement: Gateway production panel follows contract-backed workflows

The production gateway panel SHALL render and operate from contract-backed runtime summary, runtime capabilities, Gateway health/status, activity feed, monitor history, monitor stats, and selected monitor run detail while preserving the existing panel registry and API facade boundaries.

#### Scenario: Gateway diagnostics data is loaded

- **WHEN** runtime summary, capabilities, health/status diagnostics, activity events, monitor runs, monitor stats, and optional selected run detail resolve
- **THEN** the panel SHALL show runtime mode, status, health, connectivity, bundled or remote runtime facts, Gateway health/status evidence, activity evidence, monitor history, and timeline detail
- **AND** missing optional fields SHALL render as unavailable, empty, or omitted rather than fabricated values

#### Scenario: Runtime mode differs

- **WHEN** the runtime summary indicates bundled supervisor state
- **THEN** bundled-specific pid, ownership, restart attempts, configured state, and resolved Gateway URL SHALL be visible
- **WHEN** the runtime summary indicates remote mode without supervisor state
- **THEN** remote-specific last connection, latency, TLS verification, and last error SHALL be visible

#### Scenario: Monitor history and timeline are used

- **WHEN** an operator selects a monitor run from history
- **THEN** the panel SHALL load run detail through the existing wrapper and show the selected run timeline, event count, duration, tool/model counts, token count, file ops, subagent spawns, and event rows

#### Scenario: Gateway is not configured

- **WHEN** diagnostics or monitor calls return the existing Gateway-not-configured signal
- **THEN** the panel SHALL show the shared first-run empty state
- **AND** raw `gateway_not_configured` errors SHALL NOT be shown as operator-facing data errors

### Requirement: Gateway UI aligns with the settled frontend design system

The gateway panel SHALL use the chat/agents/routing/subagents/logs/settings/sessions/channels design-system posture: Inter/JetBrains Mono typography, `--ds-*` tokens, compact workbench density, low-radius surfaces, clear focus states, and local molecules only when canonical atoms are not yet justified.

#### Scenario: Gateway UI is rendered

- **WHEN** the gateway panel is rendered with contract-shaped mock data
- **THEN** the first viewport SHALL expose runtime health, connectivity, diagnostics, key metrics, activity evidence, and navigation affordances without overlapping text or nested decorative cards
- **AND** lifecycle start/stop/restart actions SHALL remain absent unless a separate runtime lifecycle proposal introduces them

### Requirement: Gateway mock visual verification is available

The gateway rewrite SHALL include focused mock visual verification that exercises the real frontend against contract-shaped runtime, Gateway health/status, activity, and monitor data without requiring a real Gateway or LLM.

#### Scenario: Mock visual E2E runs

- **WHEN** the gateway mock visual E2E is executed
- **THEN** it SHALL load runtime/Gateway/monitor data through the frontend API path
- **AND** it SHALL capture or assert the ready workbench state and at least one interaction state such as runtime tab, history-to-timeline selection, or Gateway-not-configured state
- **AND** closeout evidence SHALL label the test as mock visual coverage, not real Gateway/LLM E2E
