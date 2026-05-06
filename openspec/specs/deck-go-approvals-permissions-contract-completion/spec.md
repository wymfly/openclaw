## Purpose

Complete the Deck Go Approvals contract-chain so approval queues, policy
controls, decision resolution, Gateway protocol generation, mutation evidence,
and durable matrix evidence stay aligned with current Gateway and Deck code
truth.

## Requirements

### Requirement: Approvals product claims SHALL map to contract truth

Deck Go SHALL ensure visible Approvals workflows map to current Gateway
approval methods, Deck BFF routes, Deck-facing DTOs, frontend facades, and
evidence status.

#### Scenario: Visible workflow is supported

- **WHEN** the Approvals UI exposes policy reads, policy saves, exec pending
  queue reads, plugin pending queue reads, exec decisions, plugin decisions, or
  stream refresh
- **THEN** the workflow SHALL have a frontend facade, Deck BFF route, Deck/Gateway
  DTO or typed method, and matrix evidence status

#### Scenario: Workflow is unsupported or fixture unsafe

- **WHEN** an Approvals workflow depends on decision reason params, recent
  decision history, summary KPIs, or resolving/mutating real operator state
  without disposable fixture proof
- **THEN** the workflow SHALL be unsupported, skipped-safe, deferred, or
  documented rather than product-complete

### Requirement: Approval queue protocol generation SHALL preserve array result types

Deck Go Gateway TypeScript protocol generation SHALL emit object-array schemas
as array type aliases instead of object interfaces followed by array syntax.

#### Scenario: Approval list result is generated

- **WHEN** `exec.approval.list` or `plugin.approval.list` result schema is an
  array of objects
- **THEN** generated TypeScript protocol output SHALL use an array result type
- **AND** the generated method map SHALL reference that array type as the result

### Requirement: Plugin approval resolve SHALL have a typed result

Gateway method metadata SHALL expose the existing successful
`plugin.approval.resolve` response shape.

#### Scenario: Plugin approval is resolved

- **WHEN** `plugin.approval.resolve` succeeds
- **THEN** its result schema SHALL describe the existing `{ ok: true }` response
- **AND** generated Gateway clients SHALL no longer type the result as `unknown`

### Requirement: Approval actions SHALL be mutation-evidence known

Deck Go SHALL record action-level mutation evidence metadata for production
visible Approvals policy save, exec decision, and plugin decision actions.

#### Scenario: Approval policy is saved

- **WHEN** the Approvals panel saves approval policy through
  `PUT /api/approvals/policy`
- **THEN** `deck-mutations.contract.json` SHALL name the route, response DTO,
  success indicator, target policy snapshot, audit coverage, conflict behavior,
  and deferred real fixture safety status

#### Scenario: Exec approval decision is resolved

- **WHEN** the Approvals panel resolves an exec approval through
  `POST /api/approvals`
- **THEN** mutation evidence metadata SHALL mark the route, response DTO,
  Gateway-backed source, target approval id, upstream behavior, and skipped-safe
  real fixture status unless disposable pending approval state is proven

#### Scenario: Plugin approval decision is resolved

- **WHEN** the Approvals panel resolves a plugin approval through
  `POST /api/approvals/plugins`
- **THEN** mutation evidence metadata SHALL mark the route, response DTO,
  Gateway-backed source, target approval id, upstream behavior, and skipped-safe
  real fixture status unless disposable pending approval state is proven

### Requirement: Approvals facades SHALL preserve BFF transport boundaries

Approvals panel code SHALL use frontend API facades for approval actions rather
than assembling raw BFF paths, Gateway RPC transport calls, or mutation action
identifiers in production components.

#### Scenario: Panel performs approval action

- **WHEN** the Approvals panel saves policy or resolves an approval
- **THEN** production component code SHALL call the API facade
- **AND** mutation evidence interpretation SHALL remain in
  `frontend-new/src/api.ts`, generated metadata, or tests

### Requirement: Approvals completion SHALL update durable evidence

Deck Go SHALL keep the head contract-chain matrix, generated matrix Markdown,
and Approvals handoff notes synchronized with this module completion result.

#### Scenario: Approvals child proposal is archived

- **WHEN** this child proposal passes validation and is archived
- **THEN** the approvals matrix row SHALL remove stale upstream-schema-missing
  blockers satisfied by current Gateway schemas and protocol codegen fixes
- **AND** remaining approval policy/decision real mutation blockers SHALL be
  documented as skipped-safe, deferred, or unsupported scenarios
