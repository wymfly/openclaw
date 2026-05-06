## MODIFIED Requirements

### Requirement: Gateway contract chain is verified before completion

The Gateway implementation SHALL be reviewed against the full Deck runtime, Gateway diagnostic, typed Gateway batch, activity, monitor projection, endpoint classification, and UI metadata contract chain before this change is marked complete.

#### Scenario: Contract chain matrix is recorded

- **WHEN** the Gateway module is implemented or reviewed
- **THEN** the handoff notes SHALL record the workflow-to-contract matrix for bootstrap status, runtime gateway status, capabilities, Gateway health, Gateway status, Gateway describe, typed runtime Gateway batch, activity feed, monitor runs, monitor stats, monitor run detail, refresh, first-run not-configured state, lifecycle-action absence, describe explorer, and batch console workflows
- **AND** every workflow SHALL be classified as supported, degraded, unsupported, environment-dependent, empty-valid, skipped-safe, or handoff-blocked
- **AND** stale prototype route/method names SHALL be corrected or explicitly recorded as stale

### Requirement: Gateway production behavior stays contract-backed

The production Gateway panel SHALL expose only behavior backed by current Deck-facing DTOs, frontend wrappers, Go BFF/runtime routes, Gateway diagnostic RPCs, typed Gateway batch transport, or Deck event-bus projections.

#### Scenario: Route and method truth is used

- **WHEN** Gateway handoff, frontend, backend, tests, or docs describe the contract chain
- **THEN** they SHALL name the real wrappers and routes for runtime status, capabilities, Gateway health/status/describe, typed Gateway batch, activity, monitor runs, monitor stats, and monitor detail
- **AND** they SHALL distinguish Gateway diagnostic RPCs from Deck-local event-bus projections
- **AND** they SHALL use `health` and `status` for upstream Gateway diagnostic method names when referring to generated protocol truth
- **AND** they SHALL use `/api/v1/runtimes/{runtimeId}/gateway/batch` for production batch transport rather than `/api/gateway/batch`
- **AND** they SHALL NOT claim runtime lifecycle, durable activity, arbitrary mutating batch execution, or complete monitor event coverage unless verified in code and tests

#### Scenario: Unsupported prototype workflows are handled

- **WHEN** the refreshed handoff references runtime lifecycle actions, describe-explorer editing, durable activity history, arbitrary mutating batch execution, synthetic dry-run semantics, or monitor events that are not verified by a Deck-facing contract
- **THEN** production SHALL keep those workflows disabled, read-only, omitted, or recorded as unavailable
- **AND** production SHALL NOT claim those workflows as real Gateway guarantees

#### Scenario: Read-only Gateway batch is safety gated

- **WHEN** the Gateway panel exposes a batch composer
- **THEN** it SHALL be available only in bundled mode with a configured runtime
- **AND** it SHALL filter or reject methods whose described scope is `operator.write`
- **AND** it SHALL send requests through `POST /api/v1/runtimes/{runtimeId}/gateway/batch`
- **AND** it SHALL render BFF or per-slot validation errors without breaking the rest of the panel

### Requirement: Gateway has mock visual evidence

The Gateway implementation SHALL include L1 mock visual verification through the real frontend API path and contract-shaped mock/runtime/event/batch data.

#### Scenario: Mock visual E2E verifies interaction states

- **WHEN** the Gateway mock visual E2E runs
- **THEN** it SHALL render the production Gateway panel with contract-shaped runtime, Gateway diagnostic, batch, activity, and monitor data
- **AND** it SHALL verify ready state plus at least two interaction states among tab switching, describe search/detail, read-only batch validation/result, activity projection, runtime facts, not-configured empty state, describe evidence, or refresh
- **AND** closeout evidence SHALL label the test as mock visual coverage rather than real Gateway/LLM or real monitor coverage

### Requirement: Gateway has bounded real-stack evidence

The Gateway implementation SHALL include bounded L2 real-stack verification for the runtime, Gateway diagnostic, and safe read-only batch BFF contract chain.

#### Scenario: Real stack exposes runtime and Gateway diagnostics

- **WHEN** the real stack is available
- **THEN** the test SHALL verify runtime readiness, `GET /api/runtime/gateway`, `GET /api/runtime/capabilities`, `GET /api/gateway/health`, `GET /api/gateway/status`, `GET /api/gateway/describe`, `GET /api/activity`, `GET /api/monitor/runs`, and `GET /api/monitor/stats` response shapes
- **AND** the production Gateway UI SHALL render against the real BFF without browser-side direct Gateway calls

#### Scenario: Real stack verifies safe read-only batch

- **WHEN** the real stack is bundled and Gateway diagnostics are reachable
- **THEN** the test SHALL submit a bounded `gateway.batch` request through `POST /api/v1/runtimes/rt_local/gateway/batch` using read-only methods such as `gateway.describe`, `health`, or `status`
- **AND** the test SHALL record pass, degraded, or handoff-blocked evidence after at most three fresh attempts
- **AND** no mutating Gateway method SHALL be used solely for this verification

#### Scenario: Real monitor detail is empty or unavailable

- **WHEN** the real stack has no monitor runs after bounded attempts
- **THEN** the test SHALL record the monitor list/stats shape as empty-valid or handoff-blocked evidence
- **AND** static review, focused tests, read-only L2 checks, and mock visual evidence SHALL still be completed before moving to the next module

### Requirement: Gateway deterministic drift is fixed directly

Clear Gateway-scoped issues found during explore or verification SHALL be fixed directly when the fix is low-risk and evidence-backed.

#### Scenario: Deterministic drift is found

- **WHEN** contract, backend, frontend, mock, i18n, handoff, or test drift is discovered and no material product ambiguity exists
- **THEN** the implementation SHALL fix the drift in the source-owned layer
- **AND** focused regression evidence SHALL be added or refreshed
