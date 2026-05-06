# frontend-memory-real-contract-verification Specification

## Purpose

TBD - created by archiving change frontend-memory-real-contract-verification. Update Purpose after archive.

## Requirements

### Requirement: Memory contract chain is verified before completion

The Memory implementation SHALL be reviewed against the full Deck-facing memory contract chain before this change is marked complete.

#### Scenario: Contract chain matrix is recorded

- **WHEN** the Memory module is implemented or reviewed
- **THEN** the handoff notes SHALL record the workflow-to-contract matrix for browse, file read, search, health, dream-diary read, dream maintenance actions, destructive confirmation, agent selection, Markdown rendering, BFF-only access, and empty/error handling
- **AND** every workflow SHALL be classified as supported, degraded, unsupported, environment-dependent, empty-valid, or handoff-blocked

### Requirement: Memory production behavior stays contract-backed

The production Memory panel SHALL expose only behavior backed by current Deck-facing DTOs, frontend wrappers, Go BFF routes, Gateway memory/doctor RPCs, filesystem workspace resolution, or Deck UI state.

#### Scenario: Route and method truth is used

- **WHEN** Memory handoff, frontend, backend, tests, or docs describe the contract chain
- **THEN** they SHALL name the real wrappers and routes for browse, file read, search, health, and dreams
- **AND** they SHALL distinguish canonical `POST /api/memory/search` from legacy `GET /api/memory/search`
- **AND** they SHALL NOT claim LanceDB semantic quality, memory edit/write support, dream progress streaming, Activity audit integration, persisted search history, or production ACL behavior unless verified in code and tests

#### Scenario: Browser remains BFF-only

- **WHEN** the Memory panel renders in mock or real-stack environments
- **THEN** browser code SHALL call only deck-go BFF endpoints
- **AND** it SHALL NOT call OpenClaw Gateway HTTP or WebSocket endpoints directly

### Requirement: Memory deterministic drift is fixed directly

Clear Memory-scoped issues found during explore or verification SHALL be fixed directly when the fix is low-risk and evidence-backed.

#### Scenario: Deterministic drift is found

- **WHEN** contract, backend, frontend, mock, i18n, handoff, or test drift is discovered and no material product ambiguity exists
- **THEN** the implementation SHALL fix the drift in the source-owned layer
- **AND** focused regression evidence SHALL be added or refreshed

### Requirement: Memory has mock visual evidence

The Memory implementation SHALL include L1 mock visual verification through the real frontend API path and contract-shaped mock data.

#### Scenario: Mock visual E2E verifies interaction states

- **WHEN** the Memory mock visual E2E runs
- **THEN** it SHALL render the production Memory panel with contract-shaped browse/read, search, health, and dreams data
- **AND** it SHALL verify ready state plus at least two interaction states among directory browse, file read, search degraded/result display, health diagnostics, dream-diary read, or destructive confirmation
- **AND** closeout evidence SHALL label the test as mock visual coverage rather than real Gateway/LLM, real LanceDB, or production memory-corpus evidence

### Requirement: Memory has bounded real-stack evidence

The Memory implementation SHALL include bounded L2 real-stack verification for the Memory BFF contract chain.

#### Scenario: Real stack exposes memory routes

- **WHEN** the real stack is available
- **THEN** the test SHALL verify response shapes for `GET /api/memory/browse`, canonical `POST /api/memory/search`, legacy `GET /api/memory/search`, `GET /api/memory/health`, and safe `POST /api/memory/dreams` action `read`
- **AND** the production Memory UI SHALL render against the real BFF without browser-side direct Gateway calls

#### Scenario: Real memory data is empty or unavailable

- **WHEN** the real stack has no memory files, unavailable workspace resolution, missing dream diary, or LanceDB-disabled search after bounded attempts
- **THEN** the test SHALL record the route shape as empty-valid, degraded, or handoff-blocked evidence
- **AND** static review, focused tests, BFF route tests, and mock visual evidence SHALL still be completed before moving to the next module

### Requirement: Memory dependency claims are gated

The Memory implementation SHALL NOT introduce a new Markdown, search, table, or charting dependency without explicit dependency approval.

#### Scenario: Handoff requests undeclared Markdown dependency

- **WHEN** the Memory handoff suggests `react-markdown` or richer GFM rendering but the dependency is not declared in `frontend-new/package.json`
- **THEN** production SHALL use existing dependencies or a module-local safe renderer in this change
- **AND** any missing GFM, syntax highlighting, sanitization plugin, or rich link fidelity SHALL be recorded as dependency-blocked handoff risk instead of silently adding the package
