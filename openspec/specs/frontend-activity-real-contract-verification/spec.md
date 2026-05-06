# frontend-activity-real-contract-verification Specification

## Purpose

TBD - created by archiving change frontend-activity-real-contract-verification. Update Purpose after archive.

## Requirements

### Requirement: Activity capability audit precedes real verification

Before closing the Activity real-contract pass, the implementation SHALL audit Deck BFF and stream capability and classify every visible Activity workflow as supported, degraded, unsupported, environment-dependent, or real-empty-valid.

#### Scenario: Activity capability is inventoried

- **WHEN** implementation begins for this change
- **THEN** the implementer SHALL inspect Activity DTOs, endpoint classification, stream contract metadata, Go BFF routes, projection code, frontend API wrappers, `useActivitySSE`, the archived hifi change, current Activity tests, and the refreshed handoff package
- **AND** the result SHALL identify BFF endpoints, stream payloads, frontend wrappers, local projection behavior, and UI selectors used by activity feed, monitor runs, run detail, monitor stats, SSE merge, filters, pagination, diagnostics, and cross-panel navigation
- **AND** real Gateway/LLM telemetry uncertainty SHALL be recorded as risk instead of treated as proven by mock data

#### Scenario: Activity product workflows are classified

- **WHEN** the capability audit is complete
- **THEN** each major Activity workflow SHALL be classified as `supported`, `degraded`, `unsupported`, `environment-dependent`, or `real-empty-valid`
- **AND** unsupported or degraded workflows SHALL have a visible product decision: hide, simplify, explain, keep mock-only, or document as follow-up

### Requirement: Activity contract chain is mapped end-to-end

The implementation SHALL maintain an Activity contract-chain matrix mapping user-visible workflows to frontend API/stream wrappers, Deck endpoints and DTOs, Go BFF/projection behavior, capability classification, and verification evidence.

#### Scenario: Contract-chain matrix covers visible Activity actions

- **WHEN** the Activity implementation is ready for review
- **THEN** the matrix SHALL include rows for feed refresh, event selection, SSE merge, monitor stats, run list filters, cursor pagination, run detail, diagnostics parsing, raw payload inspection, cross-panel agent/session navigation, empty real state, and unsupported real LLM telemetry seeding
- **AND** each row SHALL name the relevant frontend wrapper, Deck endpoint/DTO or stream payload, Go route/projection, classification, and verification status

#### Scenario: Raw backend access stays out of Activity panel components

- **WHEN** a reviewer scans `frontend-new/src/components/panels/activity/**`
- **THEN** panel components MUST NOT call Gateway, the Go event bus, local files, local storage, or backend internals directly
- **AND** production network calls SHALL go through `frontend-new/src/api.ts` or stream helpers that wrap the API facade

### Requirement: Activity real verification covers API and UI behavior

Real verification SHALL include both backend/API evidence and browser UI evidence for Activity workflows that are safe to exercise in the local real Gateway stack.

#### Scenario: Real API smoke covers Activity capability

- **WHEN** the real-stack API smoke runs
- **THEN** it SHALL verify runtime readiness, `GET /api/activity`, `GET /api/monitor/runs`, `GET /api/monitor/stats`, and `GET /api/monitor/runs/{runId}` when a run exists
- **AND** it SHALL assert response shape and empty-state validity without requiring mock rows or real LLM activity

#### Scenario: Real UI smoke opens Activity product workflow

- **WHEN** the real-stack UI smoke runs
- **THEN** it SHALL open the production `frontend-new` Activity panel through the deck-go shell
- **AND** it SHALL assert that real or empty Activity/Monitor state is rendered without API 4xx/5xx responses, unhandled page errors, or unexpected console errors
- **AND** it SHALL exercise at least one non-destructive interaction such as filtering, refresh, event/run selection when available, or empty-state inspection

### Requirement: Activity code-level review remains mandatory

The implementation SHALL include a code-level review pass regardless of whether real-stack telemetry contains any events.

#### Scenario: Activity review pass completes

- **WHEN** implementation and focused tests are complete
- **THEN** the review pass SHALL inspect Activity panel code, API wrapper usage, stream normalization, Go route/projection behavior, contract source/generated drift, test mocks, visual evidence, and real verification evidence
- **AND** the result SHALL be recorded as findings with file references or as an explicit no-finding statement with residual risks

### Requirement: Activity verification evidence distinguishes mock and real coverage

The implementation SHALL clearly separate L1 mock visual evidence from L2 real stack functional evidence.

#### Scenario: Activity mock visual E2E passes

- **WHEN** Activity mock visual E2E passes
- **THEN** the evidence SHALL describe it as mock visual coverage only
- **AND** it SHALL NOT be used to claim real Gateway, real LLM, real provider, or real monitor-run telemetry completeness

#### Scenario: Activity module is ready for archive with empty real state

- **WHEN** all static checks, code review, focused tests, mock visual gates, and real-stack shape/UI gates pass but the real stack has no activity rows
- **THEN** the change MAY be considered implementation-complete for the module rollout
- **AND** the empty real state SHALL remain documented for the later cross-module real E2E audit
