## ADDED Requirements

### Requirement: Channels product claims SHALL map to contract truth

Deck Go SHALL ensure visible Channels workflows map to typed Gateway methods,
Deck BFF routes, Deck-facing DTOs, config-write safety metadata, frontend
facades, and evidence status.

#### Scenario: Visible workflow is supported

- **WHEN** the Channels UI exposes inventory, probe, logout, config patch,
  routing handoff, or throughput workflows
- **THEN** the workflow SHALL have a frontend facade, Deck/Gateway DTO or typed
  method, and matrix evidence status

#### Scenario: Workflow is degraded or unsupported

- **WHEN** a Channels workflow depends on unavailable throughput metrics,
  first-class channel creation, provider-specific projections, or unsafe real
  channel mutations
- **THEN** the workflow SHALL be degraded, disabled, skipped-safe, deferred, or
  unsupported rather than product-complete

### Requirement: Channels actions SHALL be mutation-evidence known

Deck Go SHALL record action-level mutation evidence metadata for
production-visible Channels probe, logout, and config patch actions.

#### Scenario: Channel probe action is recorded

- **WHEN** the Channels panel runs a probe/test through a frontend facade
- **THEN** `deck-mutations.contract.json` SHALL name the action id, route,
  response DTO, success indicator, target channel, audit coverage, idempotency,
  conflict behavior, and fixture safety status

#### Scenario: Channel logout action is recorded

- **WHEN** the Channels panel exposes channel logout behind confirmation
- **THEN** mutation evidence metadata SHALL mark the route, response DTO,
  Gateway-backed source, target channel, upstream error behavior, and skipped
  real fixture safety unless disposable channel state is proven

#### Scenario: Channel config patch action is recorded

- **WHEN** the Channels panel saves channel settings through `PATCH /channels/{channelId}`
- **THEN** mutation evidence metadata SHALL reference config-write safety for
  base-hash/conflict behavior and mark real fixture execution deferred unless
  reversible config state is proven

### Requirement: Channels facades SHALL preserve BFF transport boundaries

Channels panel code SHALL use frontend API facades for channel actions rather
than assembling raw BFF paths, Gateway RPC transport calls, or mutation action
identifiers in production components.

#### Scenario: Panel performs channel action

- **WHEN** the Channels panel tests, logs out, toggles, or patches a channel
- **THEN** production component code SHALL call the API facade
- **AND** mutation evidence interpretation SHALL remain in
  `frontend-new/src/api.ts`, generated metadata, or tests

### Requirement: Channels throughput SHALL be honest about availability

Deck Go SHALL present throughput as unavailable/degraded when no real Gateway or
Deck metric source backs the endpoint payload.

#### Scenario: Throughput endpoint returns empty placeholder

- **WHEN** `GET /channels/{channelId}/throughput` returns zero totals and empty
  buckets
- **THEN** production UI SHALL render an empty/unavailable state
- **AND** matrix evidence SHALL NOT treat prototype traffic bars as real
  throughput coverage

### Requirement: Channels completion SHALL update durable evidence

Deck Go SHALL keep the head contract-chain matrix, generated matrix Markdown,
and Channels handoff notes synchronized with this module completion result.

#### Scenario: Channels child proposal is archived

- **WHEN** this child proposal passes validation and is archived
- **THEN** the channels matrix row SHALL remove blockers satisfied by dynamic
  surface hardening, config-write safety, and safe mutation evidence
- **AND** remaining throughput or real channel mutation blockers SHALL be
  documented as module-specific degraded, skipped-safe, deferred, or unsupported
  scenarios
