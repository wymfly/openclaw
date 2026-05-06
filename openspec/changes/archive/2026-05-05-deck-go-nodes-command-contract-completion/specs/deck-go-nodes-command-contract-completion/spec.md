## ADDED Requirements

### Requirement: Nodes product claims SHALL map to contract truth

Deck Go SHALL ensure visible Nodes workflows map to current Gateway node
methods, Deck BFF routes, Deck-facing DTOs, frontend facades, and evidence
status.

#### Scenario: Visible workflow is supported

- **WHEN** the Nodes UI exposes inventory, describe, rename, invoke, pending
  enqueue, pairing list, pairing request, pairing approve/reject, or pairing
  verify workflows
- **THEN** the workflow SHALL have a frontend facade, Deck BFF route, Deck/Gateway
  DTO or typed method, and matrix evidence status

#### Scenario: Workflow is unsupported or fixture unsafe

- **WHEN** a Nodes workflow depends on command-specific payload schemas, QR/camera
  token UX, bulk actions, audit feed integration, live refresh, or real device
  mutations without disposable fixture proof
- **THEN** the workflow SHALL be unsupported, skipped-safe, deferred, or
  documented rather than product-complete

### Requirement: Node command envelopes SHALL remain typed while payload leaves stay dynamic

Deck Go SHALL treat `node.invoke` and `node.pending.enqueue` params and result
outer envelopes as typed Gateway contracts while keeping command-specific
payload leaves explicitly dynamic.

#### Scenario: Node command is invoked

- **WHEN** `node.invoke` is called through the Deck BFF
- **THEN** generated Gateway artifacts SHALL expose typed params and result
  outer fields
- **AND** command-specific `payload` content SHALL remain a documented dynamic
  surface unless Gateway exposes command-specific schemas

#### Scenario: Pending node work is enqueued

- **WHEN** `node.pending.enqueue` is called through the Deck BFF
- **THEN** generated Gateway artifacts SHALL expose typed params and result
  outer fields
- **AND** queued item `payload` content SHALL remain a documented dynamic
  surface unless Gateway exposes stable payload schemas

### Requirement: Node actions SHALL be mutation-evidence known

Deck Go SHALL record action-level mutation evidence metadata for production
visible Nodes rename, invoke, pending enqueue, and pairing request/approve/
reject/verify actions.

#### Scenario: Node action is recorded

- **WHEN** the Nodes panel runs a node or pairing action through a frontend facade
- **THEN** `deck-mutations.contract.json` SHALL name the action id, route,
  response DTO, success indicator, target id, audit coverage, idempotency,
  conflict behavior, and fixture safety status

#### Scenario: Real device mutation is not disposable

- **WHEN** a Nodes action could mutate real device, pending work, or pairing
  state
- **THEN** mutation evidence SHALL mark real fixture execution skipped-safe
  unless a disposable node fixture is proven

### Requirement: Nodes facades SHALL preserve BFF transport boundaries

Nodes panel code SHALL use frontend API facades for node actions rather than
assembling raw BFF paths, Gateway RPC transport calls, or mutation action
identifiers in production components.

#### Scenario: Panel performs node action

- **WHEN** the Nodes panel renames, invokes, enqueues pending work, or handles
  pairing actions
- **THEN** production component code SHALL call the API facade
- **AND** mutation evidence interpretation SHALL remain in
  `frontend-new/src/api.ts`, generated metadata, or tests

### Requirement: Nodes completion SHALL update durable evidence

Deck Go SHALL keep the head contract-chain matrix, generated matrix Markdown,
and Nodes handoff notes synchronized with this module completion result.

#### Scenario: Nodes child proposal is archived

- **WHEN** this child proposal passes validation and is archived
- **THEN** the nodes matrix row SHALL remove stale typed-envelope blockers
- **AND** remaining command-payload or real device mutation blockers SHALL be
  documented as dynamic, skipped-safe, deferred, or unsupported scenarios
