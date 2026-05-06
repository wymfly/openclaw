## ADDED Requirements

### Requirement: Approvals contract chain is verified before completion

The Approvals implementation SHALL be reviewed against the full Deck-facing approval BFF/Gateway contract chain before this change is marked complete.

#### Scenario: Approvals contract matrix is recorded

- **WHEN** the Approvals module is implemented or reviewed
- **THEN** the handoff notes SHALL record the workflow-to-contract matrix for policy read/write, pending exec queue, plugin queue, decision actions, reason-field unsupported state, stream updates, selected detail, policy editor, recent-decision or summary projections, BFF-only access, and real-stack safety
- **AND** every workflow SHALL be classified as supported, degraded, unsupported, environment-dependent, empty-valid, skipped-safe, or handoff-blocked

### Requirement: Approvals production behavior stays contract-backed

The production Approvals panel SHALL expose only behavior backed by current Deck-facing DTOs, frontend wrappers, Go BFF routes, runtime facade behavior, Gateway approval methods, SSE stream contracts, or Deck UI state.

#### Scenario: Route and feature truth is used

- **WHEN** Approvals handoff, frontend, backend, tests, or docs describe the contract chain
- **THEN** they SHALL name `/api/approvals/policy`, `/api/approvals/pending`, `/api/approvals`, `/api/approvals/plugins`, and `/api/stream` as route truth
- **AND** they SHALL distinguish current approval control behavior from unsupported bulk decisions, server-side summary KPIs, audit pagination, typed list-result schemas, real policy mutation fixtures, and server-authoritative countdown guarantees
- **AND** they SHALL NOT claim unsupported behaviors unless verified in code and tests

#### Scenario: Browser remains BFF-only

- **WHEN** the Approvals panel renders in mock or real-stack environments
- **THEN** browser code SHALL call only deck-go BFF endpoints
- **AND** it SHALL NOT call OpenClaw Gateway HTTP or WebSocket endpoints directly

### Requirement: Approvals deterministic drift is fixed directly

Clear Approvals-scoped issues found during explore or verification SHALL be fixed directly when the fix is low-risk and evidence-backed.

#### Scenario: Deterministic drift is found

- **WHEN** contract, backend, frontend, mock, i18n, handoff, or test drift is discovered and no material product ambiguity exists
- **THEN** the implementation SHALL fix the drift in the source-owned layer
- **AND** focused regression evidence SHALL be added or refreshed

### Requirement: Approvals has mock visual evidence

The Approvals implementation SHALL include L1 mock visual verification through the real frontend API path and contract-shaped BFF/mock Gateway data.

#### Scenario: Mock visual E2E verifies interaction states

- **WHEN** the Approvals mock visual E2E runs
- **THEN** it SHALL render the production Approvals panel with policy state, exec queue, plugin queue, selected detail, decision actions, policy edit state, stream/action evidence, raw payload evidence, and error/empty evidence when available
- **AND** closeout evidence SHALL label the test as mock/local visual coverage rather than real Gateway approval semantic assurance

### Requirement: Approvals has bounded real-stack evidence

The Approvals implementation SHALL include bounded L2 real-stack verification for the BFF/Gateway approval route chain.

#### Scenario: Real stack exercises approval read paths

- **WHEN** the real stack is available
- **THEN** the test SHALL verify `GET /api/approvals/policy`, `GET /api/approvals/pending`, and `GET /api/approvals/plugins`
- **AND** the production Approvals UI SHALL render against the real BFF without browser-side direct Gateway calls

#### Scenario: Real Gateway approval state is empty, unavailable, or unsafe to mutate

- **WHEN** real Gateway approval queues are empty, methods are unavailable, policy mutation is unsafe, or optional fields vary after bounded attempts
- **THEN** the test SHALL record the scenario as empty-valid, degraded, skipped-safe, or handoff-blocked evidence
- **AND** static review, focused tests, BFF route tests, and mock visual evidence SHALL still be completed before moving to the next module

### Requirement: Approvals dependency and backend-expansion claims are gated

The Approvals implementation SHALL NOT introduce a new UI dependency, bulk mutation route, recent-decision pagination route, typed summary RPC, policy reason validation behavior, or server-authoritative countdown behavior without explicit contract evidence or approval.

#### Scenario: Handoff requests richer backend or UI primitives

- **WHEN** the Approvals handoff suggests richer primitives or backend features that are not declared in contracts or implemented in the BFF
- **THEN** production SHALL use existing dependencies, current BFF routes, canonical atoms/patterns, or module-local molecules in this change
- **AND** missing specialized fidelity SHALL be recorded as dependency-blocked or backend-contract-blocked handoff risk instead of silently adding speculative behavior
