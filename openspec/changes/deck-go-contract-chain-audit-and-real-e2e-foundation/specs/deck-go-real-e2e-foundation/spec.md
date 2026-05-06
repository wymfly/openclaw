## ADDED Requirements

### Requirement: Real E2E uses isolated OpenClaw state

deck-go real E2E SHALL run against an isolated temporary OpenClaw configuration and workspace copy instead of mutating the operator's real configuration or workspace.

#### Scenario: Isolated root is created

- **WHEN** a real E2E run starts
- **THEN** the test harness SHALL create a run-id-scoped temporary root and copy only the required configuration and workspace inputs into that root

#### Scenario: Operator state is protected

- **WHEN** a real E2E test performs a write operation
- **THEN** the write SHALL target the isolated root or a run-id-scoped disposable resource and SHALL NOT mutate the operator's original OpenClaw configuration or workspace

### Requirement: CPA seed creates real contract evidence

deck-go real E2E SHALL provide a seed flow that uses the configured `cpa` channel and `main` agent to create real chat/session evidence in the isolated environment.

#### Scenario: Basic seed succeeds

- **WHEN** the isolated runtime can use the configured `cpa` channel
- **THEN** the seed SHALL create at least one real chat session suitable for sessions, activity, logs, usage, and docs verification

#### Scenario: Seed is environment-blocked

- **WHEN** the `cpa` channel, model, runtime, or network is unavailable after bounded attempts
- **THEN** the test harness SHALL record degraded or handoff-blocked evidence and SHALL leave mock visual and static contract verification mandatory

### Requirement: Disposable fixtures are run-id scoped

deck-go real E2E SHALL create writable module fixtures with run-id-scoped identifiers and cleanup rules.

#### Scenario: Writable fixture is created

- **WHEN** a test creates an agent, cron job, budget rule, alert rule, webhook, routing binding, document, or similar writable resource
- **THEN** the resource SHALL include a run-id-scoped name, label, id prefix, or metadata marker that allows safe cleanup

#### Scenario: Cleanup is constrained

- **WHEN** cleanup runs
- **THEN** it SHALL delete or revert only resources created by the current run and SHALL ignore resources without the run-id marker

### Requirement: Unsafe mutations remain skipped-safe

deck-go real E2E SHALL keep mutation scenarios skipped-safe when no disposable or reversible fixture can be proven.

#### Scenario: No safe fixture exists

- **WHEN** a mutation would affect channel accounts, installed skills, device tokens, user memory, or any other operator-sensitive state without a disposable fixture
- **THEN** the test SHALL skip the mutation safely and SHALL record the missing fixture capability as the blocker

#### Scenario: Rejection shape is safe to verify

- **WHEN** an unsafe mutation route can be exercised with an invalid or missing resource id without changing state
- **THEN** the test MAY verify the rejection shape and SHALL still classify the real mutation itself as skipped-safe

### Requirement: Real E2E evidence uses bounded statuses

deck-go real E2E SHALL use a bounded evidence vocabulary so module results are comparable.

#### Scenario: Real scenario is evaluated

- **WHEN** a real E2E scenario completes or reaches its circuit breaker
- **THEN** it SHALL record one of `passed`, `degraded`, `empty-valid`, `skipped-safe`, or `handoff-blocked` with the command, attempt count, and reason

#### Scenario: Circuit breaker is reached

- **WHEN** a scenario fails after the configured bounded attempts without a deterministic fix
- **THEN** the test harness SHALL stop retrying that scenario, record evidence, and continue with independent scenarios

### Requirement: Browser remains BFF-only

deck-go real E2E SHALL verify that frontend browser code talks to deck-go BFF routes rather than directly to the OpenClaw Gateway origin.

#### Scenario: Frontend opens a real panel

- **WHEN** a real E2E test opens a frontend-new panel
- **THEN** the test SHALL monitor browser HTTP and WebSocket requests and fail or record a blocker if the browser directly calls the real Gateway origin
