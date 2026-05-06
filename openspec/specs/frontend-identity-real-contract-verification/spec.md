# frontend-identity-real-contract-verification Specification

## Purpose

TBD - created by archiving change frontend-identity-real-contract-verification. Update Purpose after archive.

## Requirements

### Requirement: Identity contract chain is verified before completion

The Identity implementation SHALL be reviewed against the full Deck identity DTO, Gateway generated method, Go BFF/runtime route, endpoint classification, UI metadata, frontend wrapper, mock fixture, and E2E contract chain before this change is marked complete.

#### Scenario: Contract chain matrix is recorded

- **WHEN** the Identity module is implemented or reviewed
- **THEN** the handoff notes SHALL record the workflow-to-contract matrix for identity list, identity link, identity unlink, agent identity profile, bootstrap/runtime gating if used, refresh, missing-hash guard, failed-mutation refresh, first-run or empty data states, unsupported rename/create/delete workflows, peer activity projection, recent mutation projection, and BFF-only browser behavior
- **AND** every workflow SHALL be classified as supported, degraded, unsupported, environment-dependent, empty-valid, skipped-safe, or handoff-blocked
- **AND** stale prototype route/method names SHALL be corrected or explicitly recorded as stale

### Requirement: Identity production behavior stays contract-backed

The production Identity panel SHALL expose only behavior backed by current Deck-facing DTOs, frontend wrappers, Go BFF/runtime routes, generated Gateway methods, or documented Deck projections.

#### Scenario: Route and method truth is used

- **WHEN** Identity handoff, frontend, backend, tests, or docs describe the contract chain
- **THEN** they SHALL name the real wrappers and routes for identity list/link/unlink and agent identity
- **AND** they SHALL distinguish generated Gateway methods from Deck-local UI projections
- **AND** they SHALL use `deck.identity.list`, `deck.identity.link`, `deck.identity.unlink`, and `agent.identity.get` for upstream method truth
- **AND** they SHALL use `/api/deck/identity` and `/api/agents/{agentId}/identity` for production BFF routes
- **AND** they SHALL NOT claim canonical rename/create/delete, peer activity, durable recent mutation audit, profile/API-key/session management, or contact directory synchronization unless verified in code and tests

#### Scenario: BaseHash mutations are safety gated

- **WHEN** the Identity panel exposes link or unlink mutations
- **THEN** it SHALL require the current `configHash` and submit it as `baseHash`
- **AND** it SHALL validate canonical, channel, and peer ID locally before calling the mutation wrapper
- **AND** it SHALL render BFF errors, 409-style drift, and missing hash states without breaking the rest of the panel
- **AND** it SHALL refresh identity links after failed mutations so the visible hash and relationship state are current

#### Scenario: Unsupported prototype workflows are handled

- **WHEN** the refreshed handoff references rename canonical, create canonical, delete canonical, enriched peer activity, recent mutation audit, profile/API key/session management, proofing, trust, or directory sync
- **THEN** production SHALL keep those workflows disabled, read-only, omitted, or recorded as unavailable
- **AND** production SHALL NOT claim those workflows as real Gateway guarantees

### Requirement: Identity has mock visual evidence

The Identity implementation SHALL include L1 mock visual verification through the real frontend API path and contract-shaped identity data.

#### Scenario: Mock visual E2E verifies interaction states

- **WHEN** the Identity mock visual E2E runs
- **THEN** it SHALL render the production Identity panel with contract-shaped identity list, config hash, peers, and mutation state
- **AND** it SHALL verify ready state plus at least two interaction states among canonical selection, link dialog, link success/failure, missing-hash guard, unlink confirmation, raw payload expansion, or disabled unsupported actions
- **AND** closeout evidence SHALL label the test as mock visual coverage rather than real Gateway/LLM, identity provider proofing, contact directory sync, or production audit assurance

### Requirement: Identity has bounded real-stack evidence

The Identity implementation SHALL include bounded L2 real-stack verification for the identity BFF contract chain.

#### Scenario: Real stack exposes identity route shapes

- **WHEN** the real stack is available
- **THEN** the test SHALL verify runtime readiness, `GET /api/deck/identity`, and `GET /api/agents/{agentId}/identity` response shapes when available
- **AND** the production Identity UI SHALL render against the real BFF without browser-side direct Gateway calls
- **AND** empty identity links SHALL be recorded as empty-valid when the route shape is correct

#### Scenario: Real stack verifies safe mutation only when baseHash is available

- **WHEN** the real stack exposes a usable `configHash` and a controlled test canonical/peer can be linked and unlinked without harming operator data
- **THEN** the test SHALL submit a bounded link/unlink through `POST /api/deck/identity` with `baseHash`
- **AND** the test SHALL record pass, degraded, skipped-safe, or handoff-blocked evidence after at most three fresh attempts
- **AND** no unsupported rename/create/delete or external identity-provider workflow SHALL be used solely for this verification

#### Scenario: Real identity mutation is unsafe or unavailable

- **WHEN** real identity state lacks `configHash`, the route is unavailable, the Gateway rejects identity methods, or mutation would affect uncontrolled operator data
- **THEN** the implementation SHALL record the blocker as skipped-safe or handoff-blocked evidence
- **AND** static review, focused tests, BFF route-shape checks, and mock visual evidence SHALL still be completed before moving to the next module

### Requirement: Identity deterministic drift is fixed directly

Clear Identity-scoped issues found during explore or verification SHALL be fixed directly when the fix is low-risk and evidence-backed.

#### Scenario: Deterministic drift is found

- **WHEN** contract, backend, frontend, mock, i18n, handoff, or test drift is discovered and no material product ambiguity exists
- **THEN** the implementation SHALL fix the drift in the source-owned layer
- **AND** focused regression evidence SHALL be added or refreshed
