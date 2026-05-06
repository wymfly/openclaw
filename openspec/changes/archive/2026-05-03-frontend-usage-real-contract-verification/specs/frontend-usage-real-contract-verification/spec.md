## ADDED Requirements

### Requirement: Usage contract chain is verified before completion

The Usage implementation SHALL be reviewed against the full Deck-facing usage contract chain before this change is marked complete.

#### Scenario: Contract chain matrix is recorded

- **WHEN** the Usage module is implemented or reviewed
- **THEN** the handoff notes SHALL record the workflow-to-contract matrix for bootstrap status, cost, provider quota status, sessions, session logs, timeseries, context weight, range refresh, search/filter/sort, selected-session detail, cross-panel navigation, read-only behavior, and dependency-blocked chart fidelity
- **AND** every workflow SHALL be classified as supported, degraded, unsupported, environment-dependent, empty-valid, or handoff-blocked

### Requirement: Usage production behavior stays contract-backed

The production Usage panel SHALL expose only behavior backed by current Deck-facing DTOs, frontend wrappers, Go BFF routes, Gateway usage/session RPCs, or Deck UI state.

#### Scenario: Route and method truth is used

- **WHEN** Usage handoff, frontend, backend, tests, or docs describe the contract chain
- **THEN** they SHALL name the real wrappers and routes for cost, provider quota status, sessions, session logs, timeseries, context weight, and bootstrap status
- **AND** they SHALL distinguish canonical `/api/usage/*` routes from legacy `/api/models/usage/*` aliases
- **AND** they SHALL NOT claim real billing accuracy, tenant accounting, provider quota policy, cost forecast, or fixed timeseries granularity unless verified in code and tests

#### Scenario: Browser remains BFF-only

- **WHEN** the Usage panel renders in mock or real-stack environments
- **THEN** browser code SHALL call only deck-go BFF endpoints
- **AND** it SHALL NOT call OpenClaw Gateway HTTP or WebSocket endpoints directly

### Requirement: Usage deterministic drift is fixed directly

Clear Usage-scoped issues found during explore or verification SHALL be fixed directly when the fix is low-risk and evidence-backed.

#### Scenario: Deterministic drift is found

- **WHEN** contract, backend, frontend, mock, i18n, handoff, or test drift is discovered and no material product ambiguity exists
- **THEN** the implementation SHALL fix the drift in the source-owned layer
- **AND** focused regression evidence SHALL be added or refreshed

### Requirement: Usage has mock visual evidence

The Usage implementation SHALL include L1 mock visual verification through the real frontend API path and contract-shaped mock data.

#### Scenario: Mock visual E2E verifies interaction states

- **WHEN** the Usage mock visual E2E runs
- **THEN** it SHALL render the production Usage panel with contract-shaped cost, provider, session, session-log, timeseries, and context-weight data
- **AND** it SHALL verify ready state plus at least two interaction states among range refresh, trend mode switching, provider selection, session filtering, session detail loading, logs, timeseries, or context-weight display
- **AND** closeout evidence SHALL label the test as mock visual coverage rather than real Gateway/LLM or real billing evidence

### Requirement: Usage has bounded real-stack evidence

The Usage implementation SHALL include bounded L2 real-stack verification for the Usage BFF contract chain.

#### Scenario: Real stack exposes usage routes

- **WHEN** the real stack is available
- **THEN** the test SHALL verify response shapes for `GET /api/bootstrap/status`, `GET /api/usage/cost`, `GET /api/usage/providers`, `GET /api/usage/sessions`, and, when a session key exists, `GET /api/usage/sessions/logs` and `GET /api/usage/timeseries`
- **AND** the production Usage UI SHALL render against the real BFF without browser-side direct Gateway calls

#### Scenario: Real usage detail is empty or unavailable

- **WHEN** the real stack has no sessions, logs, timeseries, context-weight report, or provider quota windows after bounded attempts
- **THEN** the test SHALL record the empty route shape as empty-valid or handoff-blocked evidence
- **AND** static review, focused tests, read-only L2 checks, and mock visual evidence SHALL still be completed before moving to the next module

### Requirement: Usage dependency claims are gated

The Usage implementation SHALL NOT introduce a new charting dependency without explicit dependency approval.

#### Scenario: Handoff requests undeclared chart dependency

- **WHEN** the Usage handoff requests `recharts` but the dependency is not declared in `frontend-new/package.json`
- **THEN** production SHALL use existing dependencies for chart rendering in this change
- **AND** any missing tooltip, crosshair, brush, or chart accessibility fidelity SHALL be recorded as dependency-blocked handoff risk instead of silently adding the package
