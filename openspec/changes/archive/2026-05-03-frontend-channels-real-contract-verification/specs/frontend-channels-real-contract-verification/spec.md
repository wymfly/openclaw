## ADDED Requirements

### Requirement: Channels capability audit precedes implementation

Before changing the production channels UI or channels contracts, the implementation SHALL audit real Gateway and Deck BFF capability and classify every channels product workflow as supported, degraded, unsupported, or environment-dependent.

#### Scenario: Channels Gateway and BFF capability is inventoried

- **WHEN** implementation begins for this change
- **THEN** the implementer SHALL inspect channels-related Gateway source/schema or generated artifacts, `gateway.describe` output from a real stack when available, Deck endpoint classification, `deck-exceptions.contract.json`, Go BFF routes/adapters, frontend API wrappers, and current channels tests
- **AND** the result SHALL identify the Gateway methods, Deck BFF endpoints, local BFF projections, and frontend wrappers used by channels inventory, account diagnostics, probe, throughput, logout, config patch, routing, and WeCom access controls
- **AND** any upstream schema-missing, placeholder, dynamic, or provider-shaped surface SHALL be recorded as a risk instead of treated as fully typed capability

#### Scenario: Channels product workflows are classified

- **WHEN** the channels capability audit is complete
- **THEN** each major channels workflow SHALL be classified as `supported`, `degraded`, `unsupported`, or `environment-dependent`
- **AND** unsupported or degraded workflows SHALL have a visible product decision: hide, disable, simplify, explain, or document as follow-up

### Requirement: Channels contract chain is mapped end-to-end

The implementation SHALL maintain a channels contract-chain matrix mapping user-visible workflows to frontend API wrappers, Deck-facing endpoints and DTOs, Go adapters or selectors, Gateway methods or local BFF projections, and verification evidence.

#### Scenario: Contract-chain matrix covers visible channels actions

- **WHEN** the channels implementation is ready for review
- **THEN** the matrix SHALL include rows for refresh, channel selection, account diagnostics, probe, throughput, logout, enable/disable, settings patch, DM policy patch, routing bindings, plugin navigation, WeCom access display/save, and create-channel affordance
- **AND** each row SHALL name the relevant `frontend-new/src/api.ts` wrapper, Deck-facing DTO or endpoint, Go adapter or route, Gateway method or local BFF behavior, capability classification, and verification status

#### Scenario: Raw Gateway access stays out of channels panel components

- **WHEN** a reviewer scans `frontend-new/src/components/panels/channels/**`
- **THEN** panel components MUST NOT call Gateway directly
- **AND** panel components MUST NOT assemble raw Gateway method names or bypass the API facade for production network calls
- **AND** production calls SHALL go through `frontend-new/src/api.ts` or a local helper that wraps that API facade

### Requirement: Channels BFF projections are explicit and contract-calibrated

The production channels implementation SHALL distinguish raw Gateway/provider-shaped payloads from Deck BFF projections and UI-only selectors. Prototype fields such as `accountDiagnostics`, `dmPolicy`, and `wecomAccess` MUST NOT be treated as real response fields unless the Deck contract and Go BFF implement them.

#### Scenario: Projection is deterministic and shared

- **WHEN** exploration proves a channels projection is deterministic, useful beyond one local component, and backed by existing Gateway/BFF data
- **THEN** the implementation MAY add or tighten a Deck-facing DTO field and Go BFF normalizer for that projection
- **AND** it SHALL add focused contract/backend/frontend tests and regenerate/check generated artifacts as required

#### Scenario: Projection remains UI-derived

- **WHEN** a prototype projection is presentation-specific or the underlying channel account payload intentionally remains provider-shaped
- **THEN** the implementation SHALL keep derivation in a defensive frontend selector or local helper
- **AND** the channels handoff notes SHALL document that the prototype field is not a server contract field

#### Scenario: Projection is unsupported

- **WHEN** a prototype projection cannot be backed by real Gateway/BFF data without broad or speculative work
- **THEN** the production UI SHALL hide, disable, simplify, or explain the related behavior
- **AND** the unsupported expectation SHALL be recorded as a follow-up or handoff item

### Requirement: Channels backend control adapters are completed when gaps are found

The implementation SHALL treat the Go backend and frontend as one channels control-plane module. If exploration finds channels-scoped backend route, adapter, DTO, normalization, or error-mapping gaps that prevent the product workflow from working against real Gateway capability, those gaps SHALL be fixed in this change unless they require upstream Gateway changes, unsafe real-state mutations, or broad architecture changes.

#### Scenario: Backend gap is deterministic and scoped

- **WHEN** the capability audit or real verification identifies a deterministic channels-scoped backend gap
- **THEN** the implementation SHALL update the relevant contract source, generated artifact, Go adapter, route, selector, or error-mapping code
- **AND** it SHALL add or update focused Go tests that prove the adapter behavior
- **AND** it SHALL rerun the matching contract or backend verification command

#### Scenario: Backend gap requires upstream or broad work

- **WHEN** the backend gap depends on a missing upstream Gateway schema, unsupported Gateway method, unsafe mutation isolation, or a broad architecture change outside channels
- **THEN** the implementation SHALL document the gap as a handoff or follow-up
- **AND** production UI SHALL not present the unsupported behavior as fully available

### Requirement: Channels product design is calibrated to real Gateway and BFF capability

The production channels UI SHALL be derived from the high-fidelity prototype and the real Gateway-backed contract chain together. It MUST NOT blindly implement prototype interactions that cannot be backed by supported Gateway capability, Deck-facing contracts, and Go adapter behavior.

#### Scenario: Prototype interaction is supported

- **WHEN** a prototype interaction maps to real Gateway or BFF capability through the Deck Go contract chain
- **THEN** the production implementation SHALL implement it with backend and frontend behavior, focused tests, and real or mock evidence appropriate to the scenario

#### Scenario: Prototype interaction is not supported

- **WHEN** a prototype interaction cannot be backed by real Gateway capability, Deck BFF projection, or safe adapter behavior
- **THEN** the production implementation SHALL hide, disable, simplify, or explain the interaction
- **AND** the unsupported behavior SHALL be documented in implementation notes or OpenSpec evidence

### Requirement: Channels real verification uses a bounded circuit breaker

Channels real-stack verification SHALL be attempted for supported workflows, but it MUST be bounded so environment-sensitive failures do not block the full multi-module rollout indefinitely.

#### Scenario: Channels real-stack scenario passes

- **WHEN** a channels real-stack scenario succeeds against a real OpenClaw Gateway
- **THEN** the implementation evidence SHALL record the command or Playwright flow, date, scenario id, and observed success criteria
- **AND** the scenario SHALL be marked as real-verified

#### Scenario: Channels real-stack scenario fails deterministically

- **WHEN** a channels real-stack scenario fails and the cause is a deterministic code, contract, adapter, or frontend defect in the touched channels surface
- **THEN** the implementer SHALL fix the defect within this change when the fix is scoped to channels
- **AND** the scenario SHALL be retried after the fix

#### Scenario: Channels real-stack scenario reaches circuit breaker

- **WHEN** a channels real-stack scenario has failed up to three fresh attempts without a scoped deterministic fix
- **THEN** the scenario SHALL be marked handoff-blocked instead of causing an infinite retry loop
- **AND** the handoff record SHALL include attempt count, command or flow, observed failure, likely classification, and next recommended action
- **AND** remaining static contract/code checks and mock visual gates SHALL still be completed

### Requirement: Channels real verification covers API and UI behavior

Real verification SHALL include both backend/API evidence and browser UI evidence for channels workflows that are safe to exercise in the local real Gateway stack.

#### Scenario: Real API smoke covers channels capability

- **WHEN** the real-stack API smoke runs
- **THEN** it SHALL verify runtime health, `gateway.describe` availability, typed channels Gateway methods, the production `/channels` endpoint, and at least one safe read such as `/channels/{id}/throughput` or a documented empty-state when no channels are configured
- **AND** it SHALL fail or hand off if authentication, runtime startup, or Gateway connectivity prevents the probe

#### Scenario: Real UI smoke opens channels product workflow

- **WHEN** the real-stack UI smoke runs
- **THEN** it SHALL open the production `frontend-new` channels panel through the deck-go shell
- **AND** it SHALL assert that real or empty channels state is rendered without API 4xx/5xx responses, unhandled page errors, or unexpected console errors
- **AND** it SHALL exercise at least one non-destructive interaction such as selecting a channel, switching a tab, refreshing, or viewing a safe empty state

#### Scenario: Mutating channels workflow is safely isolated

- **WHEN** the implementation attempts logout, enable/disable, config patch, DM policy patch, WeCom access save, or create-channel behavior against a real Gateway
- **THEN** it SHALL use disposable or otherwise reversible state
- **AND** if safe isolation is unavailable, the mutation scenario SHALL be handoff-blocked rather than run against ambiguous user configuration

### Requirement: Channels code-level review remains mandatory

The implementation SHALL include a code-level review pass regardless of whether real-stack verification fully passes.

#### Scenario: Channels review pass completes

- **WHEN** implementation and focused tests are complete
- **THEN** the review pass SHALL inspect channels panel code, API wrapper usage, Go adapter changes, contract source/generated drift, test mocks, visual evidence, and real verification evidence
- **AND** the result SHALL be recorded as findings with file references or as an explicit no-finding statement with residual risks

#### Scenario: Channels real verification is blocked

- **WHEN** one or more L2 real-stack scenarios are handoff-blocked
- **THEN** the review pass SHALL still run
- **AND** the final implementation evidence SHALL distinguish blocked real scenarios from code-review findings

### Requirement: Channels verification evidence distinguishes mock and real coverage

The implementation SHALL clearly separate L1 mock visual evidence from L2 real Gateway functional evidence.

#### Scenario: Channels mock visual E2E passes

- **WHEN** channels mock visual E2E passes
- **THEN** the evidence SHALL describe it as mock visual coverage only
- **AND** it SHALL NOT be used to claim real Gateway functionality

#### Scenario: Channels module is ready for archive with real blockers

- **WHEN** all static checks, code review, focused tests, and mock visual gates pass but one or more bounded real scenarios are handoff-blocked
- **THEN** the change MAY be considered implementation-complete for the module rollout
- **AND** the blocked real scenarios SHALL remain documented for the later cross-module real E2E audit
