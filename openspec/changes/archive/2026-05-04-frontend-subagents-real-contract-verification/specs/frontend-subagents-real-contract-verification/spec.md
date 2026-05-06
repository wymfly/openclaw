## ADDED Requirements

### Requirement: Subagents contract chain is verified before completion

The Subagents implementation SHALL be reviewed against the full Deck-facing Subagents BFF/Gateway contract chain before this change is marked complete.

#### Scenario: Subagents contract matrix is recorded

- **WHEN** the Subagents module is implemented or reviewed
- **THEN** the handoff notes SHALL record the workflow-to-contract matrix for runs list, list filters, selected detail, lineage, outcome/raw inspection, steer, kill, per-agent permission reads/writes, global defaults visibility, unsupported audit/stalled/killed-state assumptions, BFF-only access, and real-stack safety
- **AND** every workflow SHALL be classified as supported, degraded, unsupported, environment-dependent, empty-valid, skipped-safe, or handoff-blocked

### Requirement: Subagents production behavior stays contract-backed

The production Subagents panel SHALL expose only behavior backed by current Deck-facing DTOs, frontend wrappers, Go BFF routes, runtime facade behavior, Gateway Subagents methods, config contract behavior, or Deck UI state.

#### Scenario: Route and feature truth is used

- **WHEN** Subagents handoff, frontend, backend, tests, or docs describe the contract chain
- **THEN** they SHALL name `/api/deck/subagents` and `/api/deck/agents` BFF action routes as route truth
- **AND** they SHALL distinguish current `deck.subagents.list`, `deck.subagents.lineage`, `deck.subagents.kill`, `deck.subagents.steer`, `deck.agents.subagents.get`, and `deck.agents.subagents.set` behavior from unsupported per-run REST routes, audit endpoints, kill-cascade guarantees, stalled-state inference, and client-generated steer dedup keys
- **AND** they SHALL NOT claim unsupported behaviors unless verified in code and tests

#### Scenario: Browser remains BFF-only

- **WHEN** the Subagents panel renders in mock or real-stack environments
- **THEN** browser code SHALL call only deck-go BFF endpoints or the generated Deck Gateway client through approved frontend facade boundaries
- **AND** it SHALL NOT call OpenClaw Gateway HTTP or WebSocket endpoints directly

### Requirement: Subagents deterministic drift is fixed directly

Clear Subagents-scoped issues found during explore or verification SHALL be fixed directly when the fix is low-risk and evidence-backed.

#### Scenario: Deterministic drift is found

- **WHEN** contract, backend, frontend, mock, i18n, handoff, or test drift is discovered and no material product ambiguity exists
- **THEN** the implementation SHALL fix the drift in the source-owned layer
- **AND** focused regression evidence SHALL be added or refreshed

### Requirement: Subagents has mock visual evidence

The Subagents implementation SHALL include L1 mock visual verification through the real frontend API path and contract-shaped BFF/mock Gateway data.

#### Scenario: Mock visual E2E verifies interaction states

- **WHEN** the Subagents mock visual E2E runs
- **THEN** it SHALL render the production Subagents panel with runs and permissions modes, selected-run detail, lineage, outcome/raw evidence, steer and kill confirmation flows, permission edit state, and empty/error evidence when available
- **AND** closeout evidence SHALL label the test as mock/local visual coverage rather than real Gateway live-run semantic assurance

### Requirement: Subagents has bounded real-stack evidence

The Subagents implementation SHALL include bounded L2 real-stack verification for the BFF/Gateway Subagents route chain.

#### Scenario: Real stack exercises Subagents safe read paths

- **WHEN** the real stack is available
- **THEN** the test SHALL verify `GET /api/deck/subagents`, `POST /api/deck/subagents` lineage when a run exists, and `POST /api/deck/agents` subagent-config reads for configured agents
- **AND** the production Subagents UI SHALL render against the real BFF without browser-side direct Gateway calls

#### Scenario: Real Gateway Subagents state is empty, unavailable, or unsafe to mutate

- **WHEN** real Gateway run lists are empty, methods are unavailable, config mutation is unsafe, live run mutation is unsafe, or optional fields vary after bounded attempts
- **THEN** the test SHALL record the scenario as empty-valid, degraded, skipped-safe, or handoff-blocked evidence
- **AND** static review, focused tests, BFF route tests, and mock visual evidence SHALL still be completed before moving to the next module

### Requirement: Subagents dependency and backend-expansion claims are gated

The Subagents implementation SHALL NOT introduce a new UI dependency, audit endpoint, per-run REST route, kill-cascade behavior, client-generated steer dedup behavior, stalled-state status contract, or unsupported status filter without explicit contract evidence or approval.

#### Scenario: Handoff requests richer backend or UI primitives

- **WHEN** the Subagents handoff suggests richer primitives or backend features that are not declared in contracts or implemented in the BFF
- **THEN** production SHALL use existing dependencies, current BFF routes, canonical atoms/patterns, or module-local molecules in this change
- **AND** missing specialized fidelity SHALL be recorded as dependency-blocked or backend-contract-blocked handoff risk instead of silently adding speculative behavior
