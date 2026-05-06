# frontend-cron-real-contract-verification Specification

## Purpose

Defines Cron-specific real-contract verification, Gateway/BFF route-chain safety, deterministic drift handling, mock visual coverage, bounded real-stack evidence, and gated backend/dependency expansion.

## Requirements

### Requirement: Cron contract chain is verified before completion

The Cron implementation SHALL be reviewed against the full Deck-facing cron BFF/Gateway contract chain before this change is marked complete.

#### Scenario: Cron contract matrix is recorded

- **WHEN** the Cron module is implemented or reviewed
- **THEN** the handoff notes SHALL record the workflow-to-contract matrix for scheduler status, inventory, search/filter/sort, selected detail, builder create/update, enable/disable, run-now, delete, run history, scheduler detail, raw evidence, unsupported preview/bulk/live-history claims, BFF-only access, and real-stack safety
- **AND** every workflow SHALL be classified as supported, degraded, unsupported, environment-dependent, empty-valid, skipped-safe, or handoff-blocked

### Requirement: Cron production behavior stays contract-backed

The production Cron panel SHALL expose only behavior backed by current Deck-facing DTOs, frontend wrappers, Go BFF routes, runtime facade behavior, Gateway `cron.*` methods, or Deck UI state.

#### Scenario: Route and feature truth is used

- **WHEN** Cron handoff, frontend, backend, tests, or docs describe the contract chain
- **THEN** they SHALL name `/api/cron`, `/api/cron/{jobId}`, `/api/cron/{jobId}/run`, `/api/cron/{jobId}/runs`, and `/api/cron/status` backed by Gateway `cron.list`, `cron.add`, `cron.update`, `cron.remove`, `cron.run`, `cron.runs`, and `cron.status` as route truth
- **AND** they SHALL distinguish current scheduled-job control behavior from unsupported cron preview, bulk operations, cursor pagination, optimistic concurrency, live history streams, and stable delivery semantics
- **AND** they SHALL NOT claim unsupported behaviors unless verified in code and tests

#### Scenario: Browser remains BFF-only

- **WHEN** the Cron panel renders in mock or real-stack environments
- **THEN** browser code SHALL call only deck-go BFF endpoints
- **AND** it SHALL NOT call OpenClaw Gateway HTTP or WebSocket endpoints directly

### Requirement: Cron deterministic drift is fixed directly

Clear Cron-scoped issues found during explore or verification SHALL be fixed directly when the fix is low-risk and evidence-backed.

#### Scenario: Deterministic drift is found

- **WHEN** contract, backend, frontend, mock, i18n, handoff, or test drift is discovered and no material product ambiguity exists
- **THEN** the implementation SHALL fix the drift in the source-owned layer
- **AND** focused regression evidence SHALL be added or refreshed

### Requirement: Cron has mock visual evidence

The Cron implementation SHALL include L1 mock visual verification through the real frontend API path and contract-shaped BFF/mock Gateway data.

#### Scenario: Mock visual E2E verifies interaction states

- **WHEN** the Cron mock visual E2E runs
- **THEN** it SHALL render the production Cron panel with scheduler status, job inventory, search/filter/sort controls, selected detail, run history, scheduler detail, builder/create/update controls, guarded delete state, raw evidence, and error/empty evidence when available
- **AND** closeout evidence SHALL label the test as mock/local visual coverage rather than real Gateway scheduler semantic assurance

### Requirement: Cron has bounded real-stack evidence

The Cron implementation SHALL include bounded L2 real-stack verification for the BFF/Gateway cron route chain.

#### Scenario: Real stack exercises cron read paths

- **WHEN** the real stack is available
- **THEN** the test SHALL verify `GET /api/cron`, `GET /api/cron/status`, and a safe run-history path when a real job exists
- **AND** the production Cron UI SHALL render against the real BFF without browser-side direct Gateway calls

#### Scenario: Real Gateway cron state is empty, unavailable, or unsafe to mutate

- **WHEN** real Gateway cron inventory is empty, methods are unavailable, mutation is unsafe, or optional fields vary after bounded attempts
- **THEN** the test SHALL record the scenario as empty-valid, degraded, skipped-safe, or handoff-blocked evidence
- **AND** static review, focused tests, BFF route tests, and mock visual evidence SHALL still be completed before moving to the next module

### Requirement: Cron dependency and backend-expansion claims are gated

The Cron implementation SHALL NOT introduce a new UI dependency, cron parser, preview endpoint, bulk mutation route, live run-history stream, cursor-pagination behavior, optimistic-concurrency behavior, or persistence behavior without explicit contract evidence or approval.

#### Scenario: Handoff requests richer backend or UI primitives

- **WHEN** the Cron handoff suggests richer primitives or backend features that are not declared in contracts or implemented in the BFF
- **THEN** production SHALL use existing dependencies, current BFF routes, canonical atoms/patterns, or module-local molecules in this change
- **AND** missing specialized fidelity SHALL be recorded as dependency-blocked or backend-contract-blocked handoff risk instead of silently adding speculative behavior
