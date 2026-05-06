# frontend-docs-real-contract-verification Specification

## Purpose

TBD - created by archiving change frontend-docs-real-contract-verification. Update Purpose after archive.

## Requirements

### Requirement: Docs contract chain is verified before completion

The Docs implementation SHALL be reviewed against the full Deck-facing docs contract chain before this change is marked complete.

#### Scenario: Docs contract matrix is recorded

- **WHEN** the Docs module is implemented or reviewed
- **THEN** the handoff notes SHALL record the workflow-to-contract matrix for list, detail, category filter, query/search, keyword filtering, extract, delete, selected missing detail, Markdown rendering, BFF-only access, empty/error handling, and real-stack safety
- **AND** every workflow SHALL be classified as supported, degraded, unsupported, environment-dependent, empty-valid, skipped-safe, or handoff-blocked

### Requirement: Docs production behavior stays contract-backed

The production Docs panel SHALL expose only behavior backed by current Deck-facing DTOs, frontend wrappers, Go BFF routes, local docs store/extraction behavior, Gateway chat-history dependency, or Deck UI state.

#### Scenario: Route and method truth is used

- **WHEN** Docs handoff, frontend, backend, tests, or docs describe the contract chain
- **THEN** they SHALL name the real wrappers and routes for list, detail, extract, and delete
- **AND** they SHALL distinguish local-store behavior from Gateway chat-history extraction dependency
- **AND** they SHALL NOT claim server-side vector search, editable documents, static documentation hosting, version history, ACL/retention policy, import/export, durable audit feed, or production knowledge-base completeness unless verified in code and tests

#### Scenario: Browser remains BFF-only

- **WHEN** the Docs panel renders in mock or real-stack environments
- **THEN** browser code SHALL call only deck-go BFF endpoints
- **AND** it SHALL NOT call OpenClaw Gateway HTTP or WebSocket endpoints directly

### Requirement: Docs deterministic drift is fixed directly

Clear Docs-scoped issues found during explore or verification SHALL be fixed directly when the fix is low-risk and evidence-backed.

#### Scenario: Deterministic drift is found

- **WHEN** contract, backend, frontend, mock, i18n, handoff, or test drift is discovered and no material product ambiguity exists
- **THEN** the implementation SHALL fix the drift in the source-owned layer
- **AND** focused regression evidence SHALL be added or refreshed

### Requirement: Docs has mock visual evidence

The Docs implementation SHALL include L1 mock visual verification through the real frontend API path and contract-shaped mock/local data.

#### Scenario: Mock visual E2E verifies interaction states

- **WHEN** the Docs mock visual E2E runs
- **THEN** it SHALL render the production Docs panel with contract-shaped documents, selected detail, search/filter state, extraction result or disabled extraction state, delete confirmation, and raw payload data
- **AND** closeout evidence SHALL label the test as mock visual coverage rather than real Gateway/LLM extraction quality, production document corpus, or knowledge-base completeness evidence

### Requirement: Docs has bounded real-stack evidence

The Docs implementation SHALL include bounded L2 real-stack verification for the Docs BFF contract chain.

#### Scenario: Real stack exposes docs routes

- **WHEN** the real stack is available
- **THEN** the test SHALL verify response shapes for `GET /api/docs`, safe `GET /api/docs/{id}` or empty-valid missing detail, safe `POST /api/docs/extract` when a disposable session is available, and safe `DELETE /api/docs/{id}` when a disposable doc exists or a non-existent id is used
- **AND** the production Docs UI SHALL render against the real BFF without browser-side direct Gateway calls

#### Scenario: Real doc state is empty or mutation is unsafe

- **WHEN** the real stack has no docs, no extractable chat history, no active session, delete mutation cannot be safely restored, or docs routes are otherwise state-blocked after bounded attempts
- **THEN** the test SHALL record the route shape as empty-valid, degraded, skipped-safe, or handoff-blocked evidence
- **AND** static review, focused tests, BFF route tests, and mock visual evidence SHALL still be completed before moving to the next module

### Requirement: Docs dependency claims are gated

The Docs implementation SHALL NOT introduce a new Markdown, syntax highlighting, search-indexing, popover, command-palette, table, charting, or editor dependency without explicit dependency approval.

#### Scenario: Handoff requests richer specialized UI primitives

- **WHEN** the Docs handoff suggests richer UI primitives or libraries that are not declared in `frontend-new/package.json`
- **THEN** production SHALL use existing dependencies, canonical atoms/patterns, or module-local molecules in this change
- **AND** any missing specialized fidelity SHALL be recorded as dependency-blocked handoff risk instead of silently adding a package
