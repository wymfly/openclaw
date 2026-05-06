## ADDED Requirements

### Requirement: Threads contract chain is verified before completion

The Threads implementation SHALL be reviewed against the full contract chain before this change is marked complete.

#### Scenario: Contract chain matrix is recorded

- **WHEN** the Threads module is implemented or reviewed
- **THEN** the handoff notes SHALL record the workflow-to-contract matrix for list, filter, selection, relationship detail, raw payload, copy session key, Sessions/Agents handoff, mutation, recent activity, audit, transcript, and branch indicator workflows
- **AND** every workflow SHALL be classified as supported, degraded, unsupported, environment-dependent, or real-empty-valid

### Requirement: Threads production behavior stays contract-backed

The production Threads panel SHALL expose only behavior backed by `DeckGoThreadEntry`, `DeckGoThreadsResponse`, `fetchThreads()`, `GET /api/deck/threads`, and existing Deck navigation helpers.

#### Scenario: Unsupported prototype capabilities are handled

- **WHEN** the v2 handoff references unbind, rebind, rename, recent activity, audit, transcript, or branch workflows without a verified Deck-facing contract
- **THEN** production SHALL omit, disable, or label those workflows as unavailable
- **AND** production SHALL NOT fabricate activity, audit, transcript, branch, mutation success, or non-Discord thread semantics from mock-only data

### Requirement: Threads has mock visual evidence

The Threads implementation SHALL include L1 mock visual verification through the real frontend API path and contract-shaped mock Gateway data.

#### Scenario: Mock visual E2E verifies interaction states

- **WHEN** the Threads mock visual E2E runs
- **THEN** it SHALL render the production Threads panel with contract-shaped data
- **AND** it SHALL verify ready state plus at least two interaction states among filtering, selection, copy fallback, Sessions handoff, Agents handoff, empty state, or error state
- **AND** closeout evidence SHALL label the test as mock visual coverage rather than real Gateway coverage

### Requirement: Threads has bounded real-stack evidence

The Threads implementation SHALL include L2 real-stack verification for the read-only BFF contract chain.

#### Scenario: Real stack returns thread data

- **WHEN** the real stack is available and `GET /api/deck/threads` returns one or more contract-shaped thread entries
- **THEN** the test SHALL verify runtime readiness, response shape, filter forwarding when safe, production render, selected relationship detail, and non-mutating handoff controls

#### Scenario: Real stack has no persisted thread bindings

- **WHEN** the real stack is available but `GET /api/deck/threads` returns an empty `threads` array
- **THEN** the test SHALL verify runtime readiness, valid response shape, production empty-state rendering, and no fabricated rows
- **AND** the scenario SHALL be recorded as `real-empty-valid`

#### Scenario: Real stack is blocked

- **WHEN** real-stack verification fails after at most three fresh attempts without a deterministic Threads-scoped fix
- **THEN** the blocking evidence SHALL be recorded in `verification.yaml` and handoff notes
- **AND** static review, focused tests, and mock visual evidence SHALL still be completed before moving to the next module

### Requirement: Threads deterministic drift is fixed directly

Clear Threads-scoped issues found during explore or verification SHALL be fixed directly when the fix is low-risk and evidence-backed.

#### Scenario: Deterministic drift is found

- **WHEN** contract, backend, frontend, mock, i18n, or test drift is discovered and no material product ambiguity exists
- **THEN** the implementation SHALL fix the drift in the source-owned layer
- **AND** focused regression evidence SHALL be added or refreshed
