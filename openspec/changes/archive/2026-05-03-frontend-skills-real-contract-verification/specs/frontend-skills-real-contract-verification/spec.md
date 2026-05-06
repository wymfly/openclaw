## ADDED Requirements

### Requirement: Skills capability audit precedes real verification

Before changing or closing the Skills real-contract pass, the implementation SHALL audit real Gateway and Deck BFF capability and classify every visible Skills product workflow as supported, degraded, unsupported, environment-dependent, or mutation-isolation-blocked.

#### Scenario: Skills Gateway and BFF capability is inventoried

- **WHEN** implementation begins for this change
- **THEN** the implementer SHALL inspect Skills-related Gateway source/schema or generated artifacts, `gateway.describe` output from a real stack when available, Deck endpoint classification, exception records, Go BFF routes/adapters, frontend API wrappers, the archived hifi change, and current Skills tests
- **AND** the result SHALL identify Gateway methods, Deck BFF endpoints, local BFF behavior, and frontend wrappers used by installed inventory, selected skill detail, missing requirements, enable/disable, config save, install options, ClawHub bins/search/detail/install/update, and agent skill matrix read/write
- **AND** schema-light, marketplace/network-sensitive, credential-sensitive, dynamic, or mutation-sensitive surfaces SHALL be recorded as risks instead of treated as fully safe production capability

#### Scenario: Skills product workflows are classified

- **WHEN** the capability audit is complete
- **THEN** each major Skills workflow SHALL be classified as `supported`, `degraded`, `unsupported`, `environment-dependent`, or `mutation-isolation-blocked`
- **AND** unsupported or degraded workflows SHALL have a visible product decision: hide, disable, simplify, explain, keep mock-only, or document as follow-up

### Requirement: Skills contract chain is mapped end-to-end

The implementation SHALL maintain a Skills contract-chain matrix mapping user-visible workflows to frontend API wrappers, Deck-facing endpoints and DTOs, Go adapters, Gateway methods or local BFF behavior, capability classification, and verification evidence.

#### Scenario: Contract-chain matrix covers visible Skills actions

- **WHEN** the Skills implementation is ready for review
- **THEN** the matrix SHALL include rows for refresh, skill selection, missing requirements, enable/disable, config save, install option, ClawHub bins, ClawHub search, ClawHub detail, ClawHub install, ClawHub update, agent skill matrix read, agent skill matrix write, agent navigation, and unsupported authoring/trust/credential workflows
- **AND** each row SHALL name the relevant `frontend-new/src/api.ts` wrapper, Deck endpoint/DTO, Go route/adapter, Gateway method or BFF behavior, classification, and verification status

#### Scenario: Raw Gateway access stays out of Skills panel components

- **WHEN** a reviewer scans `frontend-new/src/components/panels/skills/**`
- **THEN** panel components MUST NOT call Gateway, ClawHub, package managers, or the filesystem directly
- **AND** panel components MUST NOT assemble raw Gateway method names or bypass the API facade for production network calls
- **AND** production calls SHALL go through `frontend-new/src/api.ts` or a local helper that wraps that API facade

### Requirement: Skills real verification uses a bounded circuit breaker

Skills real-stack verification SHALL be attempted for supported workflows, but it MUST be bounded so environment-sensitive or unsafe marketplace/config failures do not block the full multi-module rollout indefinitely.

#### Scenario: Skills real-stack scenario passes

- **WHEN** a Skills real-stack scenario succeeds against a real OpenClaw Gateway
- **THEN** the implementation evidence SHALL record the command or Playwright flow, date, scenario id, and observed success criteria
- **AND** the scenario SHALL be marked real-verified

#### Scenario: Skills real-stack scenario fails deterministically

- **WHEN** a Skills real-stack scenario fails and the cause is a deterministic code, contract, adapter, or frontend defect in the touched Skills surface
- **THEN** the implementer SHALL fix the defect within this change when the fix is scoped to Skills
- **AND** the scenario SHALL be retried after the fix

#### Scenario: Skills real-stack scenario reaches circuit breaker

- **WHEN** a Skills real-stack scenario has failed up to three fresh attempts without a scoped deterministic fix
- **THEN** the scenario SHALL be marked handoff-blocked instead of causing an infinite retry loop
- **AND** the handoff record SHALL include attempt count, command or flow, observed failure, likely classification, and next recommended action

### Requirement: Skills real verification covers API and UI behavior

Real verification SHALL include both backend/API evidence and browser UI evidence for Skills workflows that are safe to exercise in the local real Gateway stack.

#### Scenario: Real API smoke covers Skills capability

- **WHEN** the real-stack API smoke runs
- **THEN** it SHALL verify runtime health, `gateway.describe` availability, typed Skills Gateway methods where safe, production `/skills` BFF shape, and at least one safe read such as `skills.status`, `skills.bins`, or documented empty/unavailable state
- **AND** it SHALL fail or hand off if authentication, runtime startup, Gateway connectivity, or ClawHub network access prevents the probe

#### Scenario: Real UI smoke opens Skills product workflow

- **WHEN** the real-stack UI smoke runs
- **THEN** it SHALL open the production `frontend-new` Skills panel through the deck-go shell
- **AND** it SHALL assert that real or empty Skills state is rendered without API 4xx/5xx responses, unhandled page errors, or unexpected console errors
- **AND** it SHALL exercise at least one non-destructive interaction such as filtering, selecting a skill, refreshing, opening safe detail evidence, or viewing an empty state

#### Scenario: Mutating Skills workflow is safely isolated

- **WHEN** the implementation attempts skill enable/disable, config save, install option, ClawHub install/update, or agent skill matrix write against a real Gateway
- **THEN** it SHALL use disposable or otherwise reversible state
- **AND** if safe isolation is unavailable, the mutation scenario SHALL be handoff-blocked rather than run against ambiguous user configuration

### Requirement: Skills code-level review remains mandatory

The implementation SHALL include a code-level review pass regardless of whether real-stack mutation verification fully passes.

#### Scenario: Skills review pass completes

- **WHEN** implementation and focused tests are complete
- **THEN** the review pass SHALL inspect Skills panel code, API wrapper usage, Go adapter behavior, contract source/generated drift, test mocks, visual evidence, and real verification evidence
- **AND** the result SHALL be recorded as findings with file references or as an explicit no-finding statement with residual risks

#### Scenario: Skills real mutation verification is blocked

- **WHEN** one or more L2 real-stack mutation scenarios are handoff-blocked
- **THEN** the review pass SHALL still run
- **AND** final implementation evidence SHALL distinguish blocked mutation scenarios from code-review findings

### Requirement: Skills verification evidence distinguishes mock and real coverage

The implementation SHALL clearly separate L1 mock visual evidence from L2 real Gateway functional evidence.

#### Scenario: Skills mock visual E2E passes

- **WHEN** Skills mock visual E2E passes
- **THEN** the evidence SHALL describe it as mock visual coverage only
- **AND** it SHALL NOT be used to claim real Gateway, real ClawHub, real credential persistence, or real install safety

#### Scenario: Skills module is ready for archive with real blockers

- **WHEN** all static checks, code review, focused tests, and mock visual gates pass but one or more bounded real mutation scenarios are handoff-blocked
- **THEN** the change MAY be considered implementation-complete for the module rollout
- **AND** the blocked real scenarios SHALL remain documented for the later cross-module real E2E audit
