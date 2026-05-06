# frontend-webhooks-real-contract-verification Specification

## Purpose

TBD - created by archiving change frontend-webhooks-real-contract-verification. Update Purpose after archive.

## Requirements

### Requirement: Webhooks contract chain is verified before completion

The Webhooks implementation SHALL be reviewed against the full Deck-facing webhook BFF/localstore contract chain before this change is marked complete.

#### Scenario: Webhooks contract matrix is recorded

- **WHEN** the Webhooks module is implemented or reviewed
- **THEN** the handoff notes SHALL record the workflow-to-contract matrix for inventory, filters, selection, detail tabs, create, edit, delete confirmation, test delivery, delivery history, delivery expansion, response/error rendering, secret handling, unsupported retry/live-event/event-catalog/stats claims, BFF-only access, and real-stack safety
- **AND** every workflow SHALL be classified as supported, degraded, unsupported, environment-dependent, empty-valid, skipped-safe, or handoff-blocked

### Requirement: Webhooks production behavior stays contract-backed

The production Webhooks panel SHALL expose only behavior backed by current Deck-facing DTOs, frontend wrappers, Go BFF routes, localstore delivery behavior, or Deck UI state.

#### Scenario: Route and feature truth is used

- **WHEN** Webhooks handoff, frontend, backend, tests, or docs describe the contract chain
- **THEN** they SHALL name the current `/api/webhooks*` BFF route family as the route truth
- **AND** they SHALL distinguish current CRUD/test-delivery/delivery-history behavior from unsupported retry, stats, event catalog, audit timeline, and live push behavior
- **AND** they SHALL NOT claim delivery retry, live `webhook.delivery` push, `/api/events/catalog`, `/api/webhooks/stats`, durable polling cache, or real platform-event dispatch unless verified in code and tests

#### Scenario: Browser remains BFF-only

- **WHEN** the Webhooks panel renders in mock or real-stack environments
- **THEN** browser code SHALL call only deck-go BFF endpoints and disposable test receivers when explicitly testing delivery
- **AND** it SHALL NOT call OpenClaw Gateway HTTP or WebSocket endpoints directly

### Requirement: Webhooks deterministic drift is fixed directly

Clear Webhooks-scoped issues found during explore or verification SHALL be fixed directly when the fix is low-risk and evidence-backed.

#### Scenario: Deterministic drift is found

- **WHEN** contract, backend, frontend, mock, i18n, handoff, or test drift is discovered and no material product ambiguity exists
- **THEN** the implementation SHALL fix the drift in the source-owned layer
- **AND** focused regression evidence SHALL be added or refreshed

### Requirement: Webhooks has mock visual evidence

The Webhooks implementation SHALL include L1 mock visual verification through the real frontend API path and contract-shaped BFF/mock receiver data.

#### Scenario: Mock visual E2E verifies interaction states

- **WHEN** the Webhooks mock visual E2E runs
- **THEN** it SHALL render the production Webhooks panel with receiver inventory, selected detail, subscriptions, delivery history, create/edit or builder state, test delivery result, delete confirmation or safe guard evidence, and error/empty evidence when available
- **AND** closeout evidence SHALL label the test as mock/local visual coverage rather than real external receiver reliability or full platform event delivery assurance

### Requirement: Webhooks has bounded real-stack evidence

The Webhooks implementation SHALL include bounded L2 real-stack verification for the BFF/localstore route chain.

#### Scenario: Real stack exercises disposable webhook delivery

- **WHEN** the real stack and a disposable local receiver are available
- **THEN** the test SHALL verify response shapes for create, update or patch, test delivery, delivery history, delete, and at least one safe not-found/error path
- **AND** the production Webhooks UI SHALL render against the real BFF without browser-side direct Gateway calls

#### Scenario: Real receiver or environment state is unavailable

- **WHEN** local receiver networking, operator auth, route state, or delivery side effects block the scenario after bounded attempts
- **THEN** the test SHALL record the scenario as degraded, skipped-safe, or handoff-blocked evidence
- **AND** static review, focused tests, BFF route tests, and mock visual evidence SHALL still be completed before moving to the next module

### Requirement: Webhooks dependency and backend-expansion claims are gated

The Webhooks implementation SHALL NOT introduce a new UI dependency, backend retry route, live push channel, event catalog endpoint, stats endpoint, audit endpoint, or persistence behavior without explicit contract evidence or approval.

#### Scenario: Handoff requests richer backend or UI primitives

- **WHEN** the Webhooks handoff suggests richer primitives or backend features that are not declared in contracts or implemented in the BFF
- **THEN** production SHALL use existing dependencies, current BFF routes, canonical atoms/patterns, or module-local molecules in this change
- **AND** missing specialized fidelity SHALL be recorded as dependency-blocked or backend-contract-blocked handoff risk instead of silently adding speculative behavior
