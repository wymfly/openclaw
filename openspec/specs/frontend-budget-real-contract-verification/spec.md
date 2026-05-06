# frontend-budget-real-contract-verification Specification

## Purpose

TBD - created by archiving change frontend-budget-real-contract-verification. Update Purpose after archive.

## Requirements

### Requirement: Budget contract chain is verified before completion

The Budget implementation SHALL be reviewed against the full Deck-local contract chain before this change is marked complete.

#### Scenario: Contract chain matrix is recorded

- **WHEN** the Budget module is implemented or reviewed
- **THEN** the handoff notes SHALL record the workflow-to-contract matrix for rule list, evaluation, status filter, search, selected-rule detail, threshold meter, create, edit, toggle enabled, delete, validation, refresh, bootstrap mutation gating, recent changes, agent directory, forecast, history, notification routing, and billing enforcement workflows
- **AND** every workflow SHALL be classified as supported, degraded, unsupported, environment-dependent, or handoff-blocked

### Requirement: Budget production behavior stays contract-backed

The production Budget panel SHALL expose only behavior backed by `DeckGoBudgetRule`, `DeckGoBudgetEvaluation`, `DeckGoBudgetRulesResponse`, `DeckGoBudgetEvaluationsResponse`, `fetchBudgetRules()`, `evaluateBudgetRules()`, `createBudgetRule()`, `updateBudgetRule()`, `deleteBudgetRule()`, and the `/api/usage/budget*` Deck BFF routes.

#### Scenario: Route and method truth is used

- **WHEN** Budget handoff, frontend, backend, tests, or docs describe the contract chain
- **THEN** they SHALL name the real Deck BFF wrappers and routes
- **AND** they SHALL describe rule CRUD as Deck-local `localstore` behavior
- **AND** they SHALL describe evaluation as local rules plus managed runtime usage-cost data
- **AND** they SHALL NOT claim non-existent upstream `gateway.usage.budget.*` RPC methods unless such methods are verified in code

#### Scenario: Budget writes are scoped and reversible in real verification

- **WHEN** real-stack Budget mutation verification runs
- **THEN** it SHALL use uniquely named test rules
- **AND** it SHALL verify create, update or toggle, list, evaluate shape, and delete cleanup when supported
- **AND** it SHALL record handoff-blocked evidence if any real write scenario fails after bounded attempts without a deterministic Budget-scoped fix

#### Scenario: Unsupported budget capabilities are handled

- **WHEN** the v2 handoff references real billing accuracy, production quota enforcement, forecast/projection, per-rule history, durable recent-change audit, notification routing, org/team billing policy, or upstream budget RPCs without a verified Deck-facing contract
- **THEN** production SHALL keep those workflows local, disabled, or recorded as unavailable
- **AND** production SHALL NOT claim those capabilities as real Budget guarantees

### Requirement: Budget has mock visual evidence

The Budget implementation SHALL include L1 mock visual verification through the real frontend API path and contract-shaped mock data.

#### Scenario: Mock visual E2E verifies interaction states

- **WHEN** the Budget mock visual E2E runs
- **THEN** it SHALL render the production Budget panel with contract-shaped rule and evaluation data
- **AND** it SHALL verify ready state plus at least two interaction states among status filtering, search, selected-rule switch, threshold meter, create, edit, validation, toggle enabled, delete confirmation, mutation success, or empty state
- **AND** closeout evidence SHALL label the test as mock visual coverage rather than real billing/enforcement coverage

### Requirement: Budget has bounded real-stack evidence

The Budget implementation SHALL include bounded L2 real-stack verification for the BFF contract chain.

#### Scenario: Real stack exposes budget reads and evaluations

- **WHEN** the real stack is available
- **THEN** the test SHALL verify runtime readiness, `GET /api/usage/budget` response shape, `GET /api/usage/budget/evaluate` response shape, and production UI rendering

#### Scenario: Real stack mutations are safe to exercise

- **WHEN** Budget real-stack writes are supported
- **THEN** the test SHALL create a uniquely named test rule, update or toggle it, verify it appears in list/evaluation shape when applicable, and delete it
- **AND** it SHALL avoid leaving persistent test rules behind

#### Scenario: Real stack mutation is blocked

- **WHEN** Budget real-stack mutation verification fails after at most three fresh attempts without a deterministic Budget-scoped fix
- **THEN** the blocking evidence SHALL be recorded in `verification.yaml` and handoff notes
- **AND** static review, focused tests, read-only L2 checks, and mock visual evidence SHALL still be completed before moving to the next module

### Requirement: Budget deterministic drift is fixed directly

Clear Budget-scoped issues found during explore or verification SHALL be fixed directly when the fix is low-risk and evidence-backed.

#### Scenario: Deterministic drift is found

- **WHEN** contract, backend, frontend, mock, i18n, handoff, or test drift is discovered and no material product ambiguity exists
- **THEN** the implementation SHALL fix the drift in the source-owned layer
- **AND** focused regression evidence SHALL be added or refreshed
