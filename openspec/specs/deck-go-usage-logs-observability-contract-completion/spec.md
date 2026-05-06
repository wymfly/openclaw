## Purpose

Capture the completed Usage, Logs, and shared observability contract-chain
closure for Deck Go: Usage logs/timeseries generated envelopes match runtime
handler schemas, Logs tail is recognized as typed, and remaining dynamic or
product-limited observability leaves remain explicit.

## Requirements

### Requirement: Usage and Logs product claims SHALL map to contract truth

Deck Go SHALL ensure visible Usage and Logs workflows map to current Gateway
methods, Deck BFF routes, Deck-facing DTOs, frontend facades, list-query/live
metadata, and evidence status.

#### Scenario: Visible workflow is supported

- **WHEN** the UI exposes logs tailing, log stream display, usage cost,
  provider status, usage sessions, session logs, or usage timeseries
- **THEN** the workflow SHALL have a frontend facade, Deck BFF route, Deck or
  Gateway DTO, and matrix evidence status

#### Scenario: Workflow is product-limited

- **WHEN** product design wants server-side log filters, durable export,
  billing-accuracy guarantees, quota-policy semantics, tenant accounting,
  forecasts, or chart-library behavior
- **THEN** those capabilities SHALL remain unsupported, degraded, deferred, or
  handoff-blocked until Gateway/Deck contracts and dependencies support them

### Requirement: Usage generated Gateway envelopes SHALL match runtime handler schemas

Deck Go SHALL use the same narrow usage-result schemas in method metadata that
the runtime handlers use for validation.

#### Scenario: Usage logs are generated

- **WHEN** Gateway protocol artifacts are regenerated
- **THEN** `sessions.usage.logs` SHALL expose a typed params/result envelope
- **AND** log entries SHALL not collapse to `unknown[]`

#### Scenario: Usage timeseries is generated

- **WHEN** Gateway protocol artifacts are regenerated
- **THEN** `sessions.usage.timeseries` SHALL expose a typed params/result
  envelope with typed points
- **AND** the result SHALL not collapse to `unknown`

### Requirement: Logs tail SHALL be typed while log stream payload leaves remain documented dynamic

Deck Go SHALL treat `logs.tail` params/result outer fields as typed Gateway
contracts and keep log stream event `json` payloads documented as dynamic.

#### Scenario: Logs tail is fetched

- **WHEN** the Logs panel fetches `/api/logs`
- **THEN** the request SHALL use the shared list-query contract
- **AND** the response SHALL use the typed `DeckGoLogsTailResponse` contract

#### Scenario: Logs stream event is parsed

- **WHEN** the Logs panel consumes `/api/logs/stream`
- **THEN** the SSE event envelope SHALL remain generated
- **AND** event-specific `json` payload leaves SHALL stay in stream and
  dynamic-surface metadata until fixed event payload schemas are productized

### Requirement: Observability completion SHALL update durable evidence

Deck Go SHALL keep the head contract-chain matrix, generated matrix Markdown,
and module handoff notes synchronized with this module completion result.

#### Scenario: Child proposal is archived

- **WHEN** this child proposal passes validation and is archived
- **THEN** Logs and Usage matrix rows SHALL remove stale typed-envelope blockers
- **AND** remaining dynamic, product-limited, or dependency-gated blockers SHALL
  be documented as intentional gaps
