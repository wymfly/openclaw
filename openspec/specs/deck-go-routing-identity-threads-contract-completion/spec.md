## Purpose

Capture the completed Routing, Identity, and Threads contract-chain closure for
Deck Go: Routing/Identity config-like writes are mutation-evidence known, the
generic config patch facade remains product-action neutral, and Threads is
verified as a read-only projection until Gateway and Deck contracts expose
mutation semantics.

## Requirements

### Requirement: Routing, Identity, and Threads product claims SHALL map to contract truth

Deck Go SHALL ensure visible Routing, Identity, and Threads workflows map to
current Gateway methods, Deck BFF routes, Deck-facing DTOs, frontend facades,
and evidence status.

#### Scenario: Visible workflow is supported

- **WHEN** the UI exposes identity list/link/unlink, routing list/validate/
  simulate/add/remove/DM-scope patch, or thread list/filter projection
- **THEN** the workflow SHALL have a frontend facade, Deck BFF route, Deck or
  Gateway DTO, and matrix evidence status

#### Scenario: Workflow is advisory or unsupported

- **WHEN** a workflow is validation, simulation, thread mutation, route history,
  first-class reorder, live thread refresh, or another unsupported prototype
  capability
- **THEN** the workflow SHALL be documented as read/advisory, unsupported,
  skipped-safe, deferred, or handoff-blocked rather than product-complete

### Requirement: Routing and Identity writes SHALL be mutation-evidence known

Deck Go SHALL record action-level mutation evidence metadata for production
visible identity link/unlink, routing add/remove, and routing DM-scope patch
actions.

#### Scenario: Config-like action is recorded

- **WHEN** the Identity or Routing panel runs a supported config-like write
  through a frontend facade
- **THEN** `deck-mutations.contract.json` SHALL name the action id, route,
  response DTO, success indicator, target id, audit coverage, idempotency,
  conflict behavior, and fixture safety status

#### Scenario: Real config write is not disposable

- **WHEN** a Routing or Identity action could mutate the operator's real config
- **THEN** mutation evidence SHALL mark automated real fixture execution deferred
  unless a disposable or reversible config fixture is proven

### Requirement: Generic config patch SHALL remain product-action neutral

Deck Go SHALL keep the generic config patch facade free of product-specific
mutation evidence while allowing product-specific wrappers to acknowledge their
own action ids.

#### Scenario: Routing patches DM scope

- **WHEN** Routing changes the DM-scope strategy through the config patch BFF
  route
- **THEN** the Routing facade SHALL acknowledge `routing.dm-scope.patch`
- **AND** generic `patchDeckConfig` callers SHALL NOT be misclassified as
  routing mutations

### Requirement: Threads SHALL be a verified read-only projection until Gateway exposes mutations

Deck Go SHALL present current Threads support as list/filter projection backed
by existing Gateway and Deck contracts.

#### Scenario: Thread projection is listed

- **WHEN** the Threads panel or facade fetches thread projections
- **THEN** the request SHALL use the Deck BFF thread route and generated
  `DeckGoThreadsResponse` contract

#### Scenario: Thread mutation is requested by product design

- **WHEN** product design wants thread rename, rebind, unbind, branch,
  transcript, route-history, or live-refresh mutation semantics
- **THEN** those capabilities SHALL remain unsupported or deferred until Gateway
  and Deck-facing contracts explicitly support them

### Requirement: Routing / Identity / Threads completion SHALL update durable evidence

Deck Go SHALL keep the head contract-chain matrix, generated matrix Markdown,
and module handoff notes synchronized with this module completion result.

#### Scenario: Child proposal is archived

- **WHEN** this child proposal passes validation and is archived
- **THEN** the Routing, Identity, and Threads matrix rows SHALL remove stale
  blockers
- **AND** remaining real config-write, route-history, reorder, or thread
  mutation blockers SHALL be documented as deferred, skipped-safe, or
  unsupported scenarios
