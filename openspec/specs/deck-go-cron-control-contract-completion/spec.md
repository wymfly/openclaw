## Purpose

Define the completed Cron control contract chain from Gateway-backed scheduler
methods through deck-go BFF routes, Deck-facing DTOs, frontend facades,
mutation evidence, dynamic-surface limits, and durable verification evidence.

## Requirements

### Requirement: Cron product claims SHALL map to contract truth

Deck Go SHALL ensure visible Cron workflows map to current Gateway support, Deck
BFF routes, Deck-facing DTOs, frontend facades, list-query metadata,
mutation evidence, dynamic-surface metadata, and evidence status.

#### Scenario: Supported or degraded workflow is exposed

- **WHEN** the UI exposes Cron status, job list, run history, create, update,
  delete, or manual run workflows
- **THEN** the workflow SHALL have a Gateway support basis, Deck BFF route,
  Deck-facing DTO or explicit dynamic-surface entry, frontend facade, panel
  surface, and evidence status

#### Scenario: Capability is not implemented

- **WHEN** product design wants cron preview, bulk operations, live run streams,
  optimistic concurrency, global analytics, delivery-kind DTOs, or fixture-safe
  real scheduler writes
- **THEN** the capability SHALL remain unsupported, degraded, deferred, or
  skipped-safe until contracts and fixtures support it

### Requirement: Cron write and run actions SHALL be mutation-evidence known

Deck Go SHALL record action-level mutation evidence for production-visible Cron
create, update, delete, and manual run workflows.

#### Scenario: Cron job is created or updated

- **WHEN** the frontend calls `POST /api/cron` or `PATCH /api/cron/{jobId}`
- **THEN** the response SHALL use `DeckGoCronJob`
- **AND** mutation evidence SHALL mark the returned job `id` as the target id

#### Scenario: Cron job is deleted

- **WHEN** the frontend calls `DELETE /api/cron/{jobId}`
- **THEN** the response SHALL use `DeckGoCronDeleteResponse`
- **AND** mutation evidence for `cron.delete` SHALL use route `jobId` as the
  target id

#### Scenario: Cron job is run manually

- **WHEN** the frontend calls `POST /api/cron/{jobId}/run`
- **THEN** the response SHALL use `DeckGoCronRunResponse`
- **AND** mutation evidence for `cron.run` SHALL use route `jobId` as the target
  id

### Requirement: Cron run Gateway schema SHALL match handler behavior

Deck Go SHALL keep generated Gateway protocol artifacts aligned with real
`cron.run` handler responses.

#### Scenario: Cron run is skipped by invalid job spec

- **WHEN** `cron.run` returns `ran=false` because the job has an invalid session
  target spec
- **THEN** the generated result schema SHALL allow `reason: "invalid-spec"`

### Requirement: Cron dynamic payload and delivery leaves SHALL remain explicit

Deck Go SHALL keep Cron payload and delivery dynamic surfaces documented until
delivery-kind DTOs are productized.

#### Scenario: Cron payload or delivery result is rendered

- **WHEN** the UI renders `payload` or `delivery` fields
- **THEN** those fields SHALL be treated as raw evidence bounded by documented
  Cron dynamic-surface entries

### Requirement: Cron completion SHALL update durable evidence

Deck Go SHALL keep the head contract-chain matrix, generated matrix Markdown,
module handoff notes, mutation-evidence docs, dynamic-surface docs, and head
verification evidence synchronized with this module completion result.

#### Scenario: Child proposal is archived

- **WHEN** this child proposal passes validation and is archived
- **THEN** the Cron matrix row SHALL mark the follow-up as archived
- **AND** remaining scheduler fixture, payload, delivery, preview, and bulk
  operation limits SHALL stay visible in matrix gaps and implementation notes
