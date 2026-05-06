## ADDED Requirements

### Requirement: Nodes contract chain is verified before completion

The Nodes implementation SHALL be reviewed against the full Deck-facing nodes contract chain before this change is marked complete.

#### Scenario: Nodes contract matrix is recorded

- **WHEN** the Nodes module is implemented or reviewed
- **THEN** the handoff notes SHALL record the workflow-to-contract matrix for inventory, describe, rename, invoke, pending enqueue, pairing list, pairing request, pairing approve, pairing reject, pairing verify, selected orphan pairing, BFF-only access, dynamic envelope handling, and empty/error handling
- **AND** every workflow SHALL be classified as supported, degraded, unsupported, environment-dependent, empty-valid, skipped-safe, or handoff-blocked

### Requirement: Nodes production behavior stays contract-backed

The production Nodes panel SHALL expose only behavior backed by current Deck-facing DTOs, frontend wrappers, Go BFF routes, Gateway node RPCs, dynamic exception records, or Deck UI state.

#### Scenario: Route and method truth is used

- **WHEN** Nodes handoff, frontend, backend, tests, or docs describe the contract chain
- **THEN** they SHALL name the real wrappers and routes for inventory, node actions, pairing list, and pairing actions
- **AND** they SHALL distinguish typed node methods from dynamic `node.invoke` and `node.pending.enqueue` envelopes
- **AND** they SHALL NOT claim command schemas, trust attestation, camera token scan, bulk pairing actions, durable pairing audit logs, or remote shell/file transfer unless verified in code and tests

#### Scenario: Browser remains BFF-only

- **WHEN** the Nodes panel renders in mock or real-stack environments
- **THEN** browser code SHALL call only deck-go BFF endpoints
- **AND** it SHALL NOT call OpenClaw Gateway HTTP or WebSocket endpoints directly

### Requirement: Nodes deterministic drift is fixed directly

Clear Nodes-scoped issues found during explore or verification SHALL be fixed directly when the fix is low-risk and evidence-backed.

#### Scenario: Deterministic drift is found

- **WHEN** contract, backend, frontend, mock, i18n, handoff, or test drift is discovered and no material product ambiguity exists
- **THEN** the implementation SHALL fix the drift in the source-owned layer
- **AND** focused regression evidence SHALL be added or refreshed

### Requirement: Nodes has mock visual evidence

The Nodes implementation SHALL include L1 mock visual verification through the real frontend API path and contract-shaped mock data.

#### Scenario: Mock visual E2E verifies interaction states

- **WHEN** the Nodes mock visual E2E runs
- **THEN** it SHALL render the production Nodes panel with contract-shaped inventory, pairing, selected detail, dynamic command, and pending-work data
- **AND** it SHALL verify ready state plus at least two interaction states among pending pairing selection, orphan pairing detail, approve/reject confirmation, command invoke, pending enqueue, rename, or token verification validation
- **AND** closeout evidence SHALL label the test as mock visual coverage rather than real device, real pairing, or real remote-control evidence

### Requirement: Nodes has bounded real-stack evidence

The Nodes implementation SHALL include bounded L2 real-stack verification for the Nodes BFF contract chain.

#### Scenario: Real stack exposes nodes routes

- **WHEN** the real stack is available
- **THEN** the test SHALL verify response shapes for `GET /api/nodes`, `GET /api/nodes/pair`, and safe `POST /api/nodes` / `POST /api/nodes/pair` action shapes
- **AND** the production Nodes UI SHALL render against the real BFF without browser-side direct Gateway calls

#### Scenario: Real node state is empty or mutation is unsafe

- **WHEN** the real stack has no connected nodes, no pending pairing requests, dynamic remote commands cannot be safely executed, or pairing mutation cannot be safely restored after bounded attempts
- **THEN** the test SHALL record the route shape as empty-valid, degraded, skipped-safe, or handoff-blocked evidence
- **AND** static review, focused tests, BFF route tests, and mock visual evidence SHALL still be completed before moving to the next module

### Requirement: Nodes dependency claims are gated

The Nodes implementation SHALL NOT introduce a new QR, camera, command-schema, table, charting, or state-machine dependency without explicit dependency approval.

#### Scenario: Handoff requests richer specialized UI primitives

- **WHEN** the Nodes handoff suggests richer UI primitives that are not declared in `frontend-new/package.json`
- **THEN** production SHALL use existing dependencies, canonical atoms, or module-local molecules in this change
- **AND** any missing specialized fidelity SHALL be recorded as dependency-blocked handoff risk instead of silently adding a package
