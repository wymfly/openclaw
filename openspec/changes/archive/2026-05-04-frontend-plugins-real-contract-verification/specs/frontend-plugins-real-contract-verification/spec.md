## ADDED Requirements

### Requirement: Plugins contract chain is verified before completion

The Plugins implementation SHALL be reviewed against the full Deck-facing plugin inventory BFF/Gateway contract chain before this change is marked complete.

#### Scenario: Plugins contract matrix is recorded

- **WHEN** the Plugins module is implemented or reviewed
- **THEN** the handoff notes SHALL record the workflow-to-contract matrix for inventory, capability scope switching, search/filter, selection, selected detail, capabilities, diagnostics, raw evidence, channel handoff, unsupported manifest/audit/lifecycle claims, BFF-only access, and real-stack safety
- **AND** every workflow SHALL be classified as supported, degraded, unsupported, environment-dependent, empty-valid, skipped-safe, or handoff-blocked

### Requirement: Plugins production behavior stays contract-backed

The production Plugins panel SHALL expose only behavior backed by current Deck-facing DTOs, frontend wrappers, Go BFF routes, runtime facade behavior, Gateway `deck.plugins.list`, or Deck UI state.

#### Scenario: Route and feature truth is used

- **WHEN** Plugins handoff, frontend, backend, tests, or docs describe the contract chain
- **THEN** they SHALL name `/api/deck/plugins` backed by Gateway `deck.plugins.list` as route truth
- **AND** they SHALL distinguish current read-only inventory behavior from unsupported manifest projection, audit projection, install, uninstall, enable, disable, reload, marketplace, trust-source, package-signature, and production activation control behavior
- **AND** they SHALL NOT claim those unsupported behaviors unless verified in code and tests

#### Scenario: Browser remains BFF-only

- **WHEN** the Plugins panel renders in mock or real-stack environments
- **THEN** browser code SHALL call only deck-go BFF endpoints
- **AND** it SHALL NOT call OpenClaw Gateway HTTP or WebSocket endpoints directly

### Requirement: Plugins deterministic drift is fixed directly

Clear Plugins-scoped issues found during explore or verification SHALL be fixed directly when the fix is low-risk and evidence-backed.

#### Scenario: Deterministic drift is found

- **WHEN** contract, backend, frontend, mock, i18n, handoff, or test drift is discovered and no material product ambiguity exists
- **THEN** the implementation SHALL fix the drift in the source-owned layer
- **AND** focused regression evidence SHALL be added or refreshed

### Requirement: Plugins has mock visual evidence

The Plugins implementation SHALL include L1 mock visual verification through the real frontend API path and contract-shaped BFF/mock Gateway data.

#### Scenario: Mock visual E2E verifies interaction states

- **WHEN** the Plugins mock visual E2E runs
- **THEN** it SHALL render the production Plugins panel with inventory, capability scope controls, selected detail, diagnostics, raw evidence, channel handoff state, lifecycle limitation copy, and error/empty evidence when available
- **AND** closeout evidence SHALL label the test as mock/local visual coverage rather than real plugin activation, marketplace trust, package signature, or mutation assurance

### Requirement: Plugins has bounded real-stack evidence

The Plugins implementation SHALL include bounded L2 real-stack verification for the BFF/Gateway inventory route chain.

#### Scenario: Real stack exercises plugin inventory

- **WHEN** the real stack is available
- **THEN** the test SHALL verify `GET /api/deck/plugins` and `GET /api/deck/plugins?capability=all` response envelopes
- **AND** the production Plugins UI SHALL render against the real BFF without browser-side direct Gateway calls

#### Scenario: Real Gateway inventory is empty or environment-specific

- **WHEN** real Gateway plugin inventory is empty, environment-specific, or missing optional fields after bounded attempts
- **THEN** the test SHALL record the scenario as empty-valid, degraded, skipped-safe, or handoff-blocked evidence
- **AND** static review, focused tests, BFF route tests, and mock visual evidence SHALL still be completed before moving to the next module

### Requirement: Plugins dependency and backend-expansion claims are gated

The Plugins implementation SHALL NOT introduce a new UI dependency, backend manifest route, backend audit route, plugin lifecycle mutation, marketplace behavior, trust-source behavior, package signature behavior, or persistence behavior without explicit contract evidence or approval.

#### Scenario: Handoff requests richer backend or UI primitives

- **WHEN** the Plugins handoff suggests richer primitives or backend features that are not declared in contracts or implemented in the BFF
- **THEN** production SHALL use existing dependencies, current BFF routes, canonical atoms/patterns, or module-local molecules in this change
- **AND** missing specialized fidelity SHALL be recorded as dependency-blocked or backend-contract-blocked handoff risk instead of silently adding speculative behavior
