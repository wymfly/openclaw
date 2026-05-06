# frontend-routing-real-contract-verification Specification

## Purpose

TBD - created by archiving change frontend-routing-real-contract-verification. Update Purpose after archive.

## Requirements

### Requirement: Routing contract chain is verified before completion

The Routing implementation SHALL be reviewed against the full Deck-facing routing contract chain before this change is marked complete.

#### Scenario: Routing contract matrix is recorded

- **WHEN** the Routing module is implemented or reviewed
- **THEN** the handoff notes SHALL record the workflow-to-contract matrix for list, filter, select, simulate, validate, add, remove, reorder, DM scope patch, activity reuse, BFF-only access, hash mismatch, and empty/error handling
- **AND** every workflow SHALL be classified as supported, degraded, unsupported, environment-dependent, empty-valid, skipped-safe, or handoff-blocked

### Requirement: Routing production behavior stays contract-backed

The production Routing panel SHALL expose only behavior backed by current Deck-facing DTOs, frontend wrappers, Go BFF routes, Gateway routing RPCs, config patch behavior, or Deck UI state.

#### Scenario: Route and method truth is used

- **WHEN** Routing handoff, frontend, backend, tests, or docs describe the contract chain
- **THEN** they SHALL name the real wrappers and routes for routing list, validate, add, remove, simulate, DM scope patch, and activity reuse
- **AND** they SHALL distinguish `/api/deck/routing` BFF action envelopes from underlying Gateway methods
- **AND** they SHALL NOT claim first-class reorder, conflict severity, simulation reason strings, stable backend binding IDs, or server-side routing activity filtering unless verified in code and tests

#### Scenario: Browser remains BFF-only

- **WHEN** the Routing panel renders in mock or real-stack environments
- **THEN** browser code SHALL call only deck-go BFF endpoints
- **AND** it SHALL NOT call OpenClaw Gateway HTTP or WebSocket endpoints directly

### Requirement: Routing deterministic drift is fixed directly

Clear Routing-scoped issues found during explore or verification SHALL be fixed directly when the fix is low-risk and evidence-backed.

#### Scenario: Deterministic drift is found

- **WHEN** contract, backend, frontend, mock, i18n, handoff, or test drift is discovered and no material product ambiguity exists
- **THEN** the implementation SHALL fix the drift in the source-owned layer
- **AND** focused regression evidence SHALL be added or refreshed

### Requirement: Routing has mock visual evidence

The Routing implementation SHALL include L1 mock visual verification through the real frontend API path and contract-shaped mock data.

#### Scenario: Mock visual E2E verifies interaction states

- **WHEN** the Routing mock visual E2E runs
- **THEN** it SHALL render the production Routing panel with contract-shaped list, simulate, validation, mutation, hash, and activity data
- **AND** it SHALL verify ready state plus at least two interaction states among selected binding detail, simulation, validation warning, add draft, remove confirmation, reorder state, DM scope patch state, or activity empty/error handling
- **AND** closeout evidence SHALL label the test as mock visual coverage rather than real Gateway/LLM or real production config evidence

### Requirement: Routing has bounded real-stack evidence

The Routing implementation SHALL include bounded L2 real-stack verification for the Routing BFF contract chain.

#### Scenario: Real stack exposes routing routes

- **WHEN** the real stack is available
- **THEN** the test SHALL verify response shapes for `GET /api/deck/routing` and `POST /api/deck/routing` action `simulate`
- **AND** it SHALL verify safe action shapes for `validate` and mutation paths without committing destructive or persistent user config changes unless a disposable fixture is available
- **AND** the production Routing UI SHALL render against the real BFF without browser-side direct Gateway calls

#### Scenario: Real routing state is empty or mutation is unsafe

- **WHEN** the real stack has no bindings, missing routing Gateway support, hash-protected mutation cannot be safely restored, or activity is empty after bounded attempts
- **THEN** the test SHALL record the route shape as empty-valid, degraded, skipped-safe, or handoff-blocked evidence
- **AND** static review, focused tests, BFF route tests, and mock visual evidence SHALL still be completed before moving to the next module

### Requirement: Routing dependency claims are gated

The Routing implementation SHALL NOT introduce a new editor, diagram, table, charting, or state-machine dependency without explicit dependency approval.

#### Scenario: Handoff requests richer specialized UI primitives

- **WHEN** the Routing handoff suggests richer UI primitives that are not declared in `frontend-new/package.json`
- **THEN** production SHALL use existing dependencies, canonical atoms, or module-local molecules in this change
- **AND** any missing specialized fidelity SHALL be recorded as dependency-blocked handoff risk instead of silently adding a package
