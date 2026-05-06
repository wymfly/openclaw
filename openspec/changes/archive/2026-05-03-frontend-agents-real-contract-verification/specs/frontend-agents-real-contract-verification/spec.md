## ADDED Requirements

### Requirement: Agents capability audit precedes implementation

Before changing the production agents UI or agents contracts, the implementation SHALL audit real Gateway capability and classify every agents product workflow as supported, degraded, unsupported, or environment-dependent.

#### Scenario: Gateway capability is inventoried

- **WHEN** implementation begins for this change
- **THEN** the implementer SHALL inspect agents-related Gateway source/schema or generated artifacts, `gateway.describe` output from a real stack when available, Deck endpoint classification, and `deck-exceptions.contract.json`
- **AND** the result SHALL identify the Gateway methods and Deck BFF endpoints used by agents list, detail, create, update, delete, skills, subagents, event streams, previews, files, and status streams
- **AND** any upstream schema-missing or dynamic surface SHALL be recorded as a risk instead of treated as fully typed capability

#### Scenario: Product workflows are classified

- **WHEN** the agents capability audit is complete
- **THEN** each major agents workflow SHALL be classified as `supported`, `degraded`, `unsupported`, or `environment-dependent`
- **AND** unsupported or degraded workflows SHALL have a visible product decision: hide, disable, explain, or document as follow-up

### Requirement: Agents contract chain is mapped end-to-end

The implementation SHALL maintain an agents contract-chain matrix mapping user-visible workflows to frontend API wrappers, Deck-facing endpoints and DTOs, Go adapters, Gateway methods, and verification evidence.

#### Scenario: Contract-chain matrix covers visible actions

- **WHEN** the agents implementation is ready for review
- **THEN** the matrix SHALL include rows for agents refresh, detail load, overview update, create, delete, skills save, subagent policy save, event-stream save, file list/read/save, tool-policy preview, and system-prompt preview
- **AND** each row SHALL name the relevant `frontend-new/src/api.ts` wrapper, Deck-facing DTO or endpoint, Go adapter or route, Gateway method or local BFF behavior, and verification status

#### Scenario: Raw Gateway access stays out of panel components

- **WHEN** a reviewer scans `frontend-new/src/components/panels/agents/**`
- **THEN** panel components MUST NOT call Gateway directly
- **AND** panel components MUST NOT assemble raw `/api/...` endpoint strings or Gateway method names except in tests or static documentation
- **AND** production calls SHALL go through the API facade or store actions that wrap the API facade

### Requirement: Agents backend control adapters are completed when gaps are found

The implementation SHALL treat the Go backend and frontend as one agents control-plane module. If exploration finds agents-scoped backend route, adapter, DTO, normalization, or error-mapping gaps that prevent the product workflow from working against real Gateway capability, those gaps SHALL be fixed in this change unless they require upstream Gateway changes or unsafe broad refactors.

#### Scenario: Backend gap is deterministic and scoped

- **WHEN** the capability audit or real verification identifies a deterministic agents-scoped backend gap
- **THEN** the implementation SHALL update the relevant contract source, generated artifact, Go adapter, route, or normalization code
- **AND** it SHALL add or update focused Go tests that prove the adapter behavior
- **AND** it SHALL rerun the matching contract or backend verification command

#### Scenario: Backend gap requires upstream or broad work

- **WHEN** the backend gap depends on a missing upstream Gateway schema, unsupported Gateway method, unsafe mutation isolation, or a broad architecture change outside agents
- **THEN** the implementation SHALL document the gap as a handoff or follow-up
- **AND** production UI SHALL not present the unsupported behavior as fully available

### Requirement: Agents product design is calibrated to real Gateway capability

The production agents UI SHALL be derived from the high-fidelity prototype and the real Gateway-backed contract chain together. It MUST NOT blindly implement prototype interactions that cannot be backed by supported Gateway capability, Deck-facing contracts, and Go adapter behavior.

#### Scenario: Prototype interaction is supported

- **WHEN** a prototype interaction maps to real Gateway capability through the Deck Go contract chain
- **THEN** the production implementation SHALL implement it with backend and frontend behavior, focused tests, and real or mock evidence appropriate to the scenario

#### Scenario: Prototype interaction is not supported

- **WHEN** a prototype interaction cannot be backed by real Gateway capability or safe Deck Go adapter behavior
- **THEN** the production implementation SHALL hide, disable, simplify, or explain the interaction
- **AND** the unsupported behavior SHALL be documented in implementation notes or OpenSpec evidence

### Requirement: Real verification uses a bounded circuit breaker

Agents real-stack verification SHALL be attempted for supported workflows, but it MUST be bounded so environment-sensitive failures do not block the full multi-module rollout indefinitely.

#### Scenario: Real-stack scenario passes

- **WHEN** a real-stack scenario succeeds against a real OpenClaw Gateway
- **THEN** the implementation evidence SHALL record the command or Playwright flow, date, scenario id, and observed success criteria
- **AND** the scenario SHALL be marked as real-verified

#### Scenario: Real-stack scenario fails deterministically

- **WHEN** a real-stack scenario fails and the cause is a deterministic code, contract, adapter, or frontend defect in the touched agents surface
- **THEN** the implementer SHALL fix the defect within this change when the fix is scoped to agents
- **AND** the scenario SHALL be retried after the fix

#### Scenario: Real-stack scenario reaches circuit breaker

- **WHEN** a real-stack scenario has failed up to three fresh attempts without a scoped deterministic fix
- **THEN** the scenario SHALL be marked handoff-blocked instead of causing an infinite retry loop
- **AND** the handoff record SHALL include attempt count, command or flow, observed failure, likely classification, and next recommended action
- **AND** remaining static contract/code checks and mock visual gates SHALL still be completed

### Requirement: Agents real verification covers API and UI behavior

Real verification SHALL include both backend/API evidence and browser UI evidence for agents workflows that are safe to exercise in the local real Gateway stack.

#### Scenario: Real API smoke covers agents capability

- **WHEN** the real-stack API smoke runs
- **THEN** it SHALL verify runtime health, `gateway.describe` availability, `agents.list`, the Deck agents detail endpoint for an existing agent, and at least one safe section read endpoint
- **AND** it SHALL fail or hand off if authentication, runtime startup, or Gateway connectivity prevents the probe

#### Scenario: Real UI smoke opens agents product workflow

- **WHEN** the real-stack UI smoke runs
- **THEN** it SHALL open the production `frontend-new` agents panel through the deck-go shell
- **AND** it SHALL assert that real agent data is rendered without API 4xx/5xx responses, unhandled page errors, or unexpected console errors
- **AND** it SHALL exercise at least one non-destructive interaction such as selecting an agent, changing a section tab, or opening a read-only preview

#### Scenario: Mutating real workflow is safely isolated

- **WHEN** the implementation attempts create, update, delete, or save actions against a real Gateway
- **THEN** it SHALL use a disposable test agent or otherwise reversible state
- **AND** if safe isolation is unavailable, the mutation scenario SHALL be handoff-blocked rather than run against ambiguous user configuration

### Requirement: Code-level review remains mandatory

The implementation SHALL include a code-level review pass regardless of whether real-stack verification fully passes.

#### Scenario: Review pass completes

- **WHEN** implementation and focused tests are complete
- **THEN** the review pass SHALL inspect agents panel code, API wrapper usage, Go adapter changes, contract source/generated drift, test mocks, and verification evidence
- **AND** the result SHALL be recorded as findings with file references or as an explicit no-finding statement with residual risks

#### Scenario: Real verification is blocked

- **WHEN** one or more L2 real-stack scenarios are handoff-blocked
- **THEN** the review pass SHALL still run
- **AND** the final implementation evidence SHALL distinguish blocked real scenarios from code-review findings

### Requirement: Agents verification evidence distinguishes mock and real coverage

The implementation SHALL clearly separate L1 mock visual evidence from L2 real Gateway functional evidence.

#### Scenario: Mock visual E2E passes

- **WHEN** agents mock visual E2E passes
- **THEN** the evidence SHALL describe it as mock visual coverage only
- **AND** it SHALL NOT be used to claim real Gateway functionality

#### Scenario: Module is ready for archive with real blockers

- **WHEN** all static checks, code review, focused tests, and mock visual gates pass but one or more bounded real scenarios are handoff-blocked
- **THEN** the change MAY be considered implementation-complete for the module rollout
- **AND** the blocked real scenarios SHALL remain documented for the later cross-module real E2E audit
