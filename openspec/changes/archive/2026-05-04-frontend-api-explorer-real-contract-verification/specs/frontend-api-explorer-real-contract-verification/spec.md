## ADDED Requirements

### Requirement: API Explorer contract chain is verified before completion

The API Explorer implementation SHALL be reviewed against the full Deck-facing describe and typed Gateway RPC contract chain before this change is marked complete.

#### Scenario: API Explorer contract matrix is recorded

- **WHEN** the API Explorer module is implemented or reviewed
- **THEN** the handoff notes SHALL record the workflow-to-contract matrix for describe, method tree, schema inspection, raw params edit, typed run, error rendering, event inspection, untyped methods, history, BFF-only access, not-configured state, and real-stack safety
- **AND** every workflow SHALL be classified as supported, degraded, unsupported, environment-dependent, empty-valid, skipped-safe, or handoff-blocked

### Requirement: API Explorer production behavior stays contract-backed

The production API Explorer panel SHALL expose only behavior backed by current Deck-facing DTOs, frontend wrappers/transports, Go BFF describe/runtime RPC routes, generated Gateway allowlist behavior, or Deck UI state.

#### Scenario: Route and method truth is used

- **WHEN** API Explorer handoff, frontend, backend, tests, or docs describe the contract chain
- **THEN** they SHALL name `GET /api/gateway/describe` and `POST /api/v1/runtimes/{runtimeId}/gateway/rpc` as the current route truth
- **AND** they SHALL distinguish live describe catalog inspection from typed Gateway RPC invocation
- **AND** they SHALL NOT claim `/api/gateway/invoke`, arbitrary untyped invocation, stream rendering, CodeMirror, durable history persistence, response diffing, schema-aware autocomplete, or production tracing unless verified in code and tests

#### Scenario: Browser remains BFF-only

- **WHEN** the API Explorer panel renders in mock or real-stack environments
- **THEN** browser code SHALL call only deck-go BFF endpoints
- **AND** it SHALL NOT call OpenClaw Gateway HTTP or WebSocket endpoints directly

### Requirement: API Explorer deterministic drift is fixed directly

Clear API Explorer-scoped issues found during explore or verification SHALL be fixed directly when the fix is low-risk and evidence-backed.

#### Scenario: Deterministic drift is found

- **WHEN** contract, backend, frontend, mock, i18n, handoff, or test drift is discovered and no material product ambiguity exists
- **THEN** the implementation SHALL fix the drift in the source-owned layer
- **AND** focused regression evidence SHALL be added or refreshed

### Requirement: API Explorer has mock visual evidence

The API Explorer implementation SHALL include L1 mock visual verification through the real frontend API path and contract-shaped mock Gateway data.

#### Scenario: Mock visual E2E verifies interaction states

- **WHEN** the API Explorer mock visual E2E runs
- **THEN** it SHALL render the production API Explorer with describe catalog, selected method, params/body edit or fallback, response pane state, history state, event inspection, and untyped evidence when available
- **AND** closeout evidence SHALL label the test as mock visual coverage rather than real Gateway method completeness or side-effect safety evidence

### Requirement: API Explorer has bounded real-stack evidence

The API Explorer implementation SHALL include bounded L2 real-stack verification for the describe and typed RPC contract chain.

#### Scenario: Real stack exposes describe and safe typed invocation

- **WHEN** the real stack is available
- **THEN** the test SHALL verify response shapes for `GET /api/gateway/describe` and a safe read-only typed invocation through `POST /api/v1/runtimes/{runtimeId}/gateway/rpc`
- **AND** the production API Explorer UI SHALL render against the real BFF without browser-side direct Gateway calls

#### Scenario: Real method state or scope is unavailable

- **WHEN** the real stack lacks the chosen safe method, the operator scope blocks invocation, the typed allowlist rejects the method, or Gateway state prevents the scenario after bounded attempts
- **THEN** the test SHALL record the scenario as degraded, skipped-safe, or handoff-blocked evidence
- **AND** static review, focused tests, BFF route tests, and mock visual evidence SHALL still be completed before moving to the next module

### Requirement: API Explorer dependency claims are gated

The API Explorer implementation SHALL NOT introduce a new editor, syntax highlighting, JSON schema form, JSON viewer, diff, command palette, trace, table, charting, or persistence dependency without explicit dependency approval.

#### Scenario: Handoff requests richer specialized UI primitives

- **WHEN** the API Explorer handoff suggests richer UI primitives or libraries that are not declared in `frontend-new/package.json`
- **THEN** production SHALL use existing dependencies, canonical atoms/patterns, or module-local molecules in this change
- **AND** any missing specialized fidelity SHALL be recorded as dependency-blocked handoff risk instead of silently adding a package
