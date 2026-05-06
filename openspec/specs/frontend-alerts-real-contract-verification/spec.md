# frontend-alerts-real-contract-verification Specification

## Purpose

TBD - created by archiving change frontend-alerts-real-contract-verification. Update Purpose after archive.

## Requirements

### Requirement: Alerts capability audit precedes implementation closure

Before the Alerts real-contract pass is archived, the implementation SHALL audit the complete Alerts contract chain and classify each visible workflow as supported, degraded, unsupported, environment-dependent, or real-empty-valid.

#### Scenario: Alerts capability is inventoried

- **WHEN** implementation begins for this change
- **THEN** the implementer SHALL inspect the v2 handoff package, archived hifi change, source DTOs, generated DTOs, endpoint classification, frontend wrappers, current production panel, Go BFF route/input handling, localstore behavior, and related tests
- **AND** the result SHALL identify the source of truth for alert rule inventory, create, edit, toggle, delete, validation, refresh, selection, fired-history fallback, audit, test fire, condition semantics, and webhook action binding
- **AND** unsupported fired-history, audit, evaluator, delivery, webhook confirmation, or test-fire assumptions SHALL be recorded as product gaps instead of treated as implemented behavior

#### Scenario: Alerts workflows are classified

- **WHEN** the capability audit is complete
- **THEN** every visible Alerts workflow SHALL be classified as `supported`, `degraded`, `unsupported`, `environment-dependent`, or `real-empty-valid`
- **AND** unsupported or degraded workflows SHALL have an implementation decision: hide, disable, simplify, explain, keep mock-only, or document as follow-up

### Requirement: Alerts production UI follows the verified contract

The production Alerts panel SHALL implement the v2 alert rules workbench only through Deck-facing BFF wrappers and contract-shaped state.

#### Scenario: Alerts workbench renders contract-backed state

- **WHEN** `fetchAlertRules` returns contract-shaped data
- **THEN** the panel SHALL render rule metrics, rule inventory, selected rule evidence, entity type, condition, threshold, action, cooldown, enabled state, timestamps, and `lastFiredAt` fallback without direct Gateway calls
- **AND** filters, selection, refresh, and empty/error/loading states SHALL operate without fabricating fired or audit rows
- **AND** text, buttons, rows, filters, and dialogs SHALL fit within stable responsive constraints on supported desktop and mobile viewports

#### Scenario: Alerts mutations use BFF wrappers

- **WHEN** an operator creates, edits, toggles, or deletes an alert rule
- **THEN** the panel SHALL call `createAlertRule`, `updateAlertRule`, or `deleteAlertRule` with the existing Deck alert envelopes
- **AND** successful mutations SHALL refresh alert rules through `fetchAlertRules`
- **AND** validation failures SHALL remain local and SHALL NOT call mutation wrappers
- **AND** destructive delete SHALL require an explicit confirmation before calling `deleteAlertRule`

### Requirement: Alerts contract chain is mapped end-to-end

The implementation SHALL maintain an Alerts contract-chain matrix mapping user-visible workflows to frontend wrappers, Deck endpoints and DTOs, Go BFF/localstore behavior, capability classification, and verification evidence.

#### Scenario: Contract-chain matrix covers visible Alerts actions

- **WHEN** the Alerts implementation is ready for review
- **THEN** the matrix SHALL include rows for list, filter, refresh, select detail, create, edit, toggle, delete, validation, fired-history fallback, audit prototype state, test-fire prototype state, condition DSL, webhook action binding, empty state, and real-stack cleanup
- **AND** each row SHALL name the relevant wrapper, endpoint/DTO, Go route/localstore behavior, classification, and evidence status

#### Scenario: Browser code stays behind the BFF facade

- **WHEN** a reviewer scans `frontend-new/src/components/panels/alerts/**`
- **THEN** panel components MUST NOT call Gateway, backend internals, local files, local storage, or generated Go/TS internals directly
- **AND** production network calls SHALL go through `frontend-new/src/api.ts`

### Requirement: Alerts real verification covers safe CRUD behavior

Real verification SHALL include both API and browser UI evidence for safe Deck-local alert rule CRUD in the real stack.

#### Scenario: Real API smoke covers alert rule CRUD

- **WHEN** the real-stack API smoke runs
- **THEN** it SHALL verify runtime readiness, `GET /api/alerts`, `POST /api/alerts`, `PATCH /api/alerts/{ruleId}`, and `DELETE /api/alerts/{ruleId}`
- **AND** it SHALL assert response shape, mutation persistence, and cleanup of only the uniquely created test rule

#### Scenario: Real UI smoke covers production Alerts workflow

- **WHEN** the real-stack UI smoke runs
- **THEN** it SHALL open the production `frontend-new` Alerts panel through the deck-go shell
- **AND** it SHALL assert that the panel renders without API 4xx/5xx responses, unhandled page errors, or unexpected console errors
- **AND** it SHALL exercise at least one non-destructive interaction and one safe CRUD path when the environment allows mutation

### Requirement: Alerts verification evidence distinguishes mock and real coverage

The implementation SHALL clearly separate high-fidelity/mock visual evidence from real-stack functional evidence.

#### Scenario: Alerts mock visual E2E passes

- **WHEN** Alerts mock visual E2E passes
- **THEN** the evidence SHALL describe it as L1 mock/local visual coverage only
- **AND** it SHALL NOT be used to claim real evaluator behavior, real alert delivery, webhook delivery, audit history, fired-event history, or production incident assurance

#### Scenario: Alerts module is archive-ready

- **WHEN** static checks, code review, focused tests, L1 mock visual gates, and L2 real-stack CRUD/API/UI gates pass or are handoff-blocked by the circuit breaker with evidence
- **THEN** the change MAY be considered implementation-complete for the module rollout
- **AND** residual unsupported product capabilities SHALL remain documented for the later cross-module real E2E audit

### Requirement: Alerts code-level review remains mandatory

The implementation SHALL include a code-level review pass after implementation and verification.

#### Scenario: Alerts review pass completes

- **WHEN** implementation and focused tests are complete
- **THEN** the review pass SHALL inspect Alerts panel code, API wrapper usage, contract source/generated drift, Go route/localstore behavior, mock data, visual evidence, and real verification evidence
- **AND** the result SHALL be recorded as findings with file references or as an explicit no-finding statement with residual risks
