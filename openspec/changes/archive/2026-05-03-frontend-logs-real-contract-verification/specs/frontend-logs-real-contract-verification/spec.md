## ADDED Requirements

### Requirement: Logs contract chain is verified before completion

The Logs implementation SHALL be reviewed against the full contract chain before this change is marked complete.

#### Scenario: Contract chain matrix is recorded

- **WHEN** the Logs module is implemented or reviewed
- **THEN** the handoff notes SHALL record the workflow-to-contract matrix for tail load, SSE stream, pause/resume, clear local buffer, level filtering, source filtering, session filtering, correlation filtering, free-text filtering, selected row details, raw payload, export preview, and unavailable server-filter/export workflows
- **AND** every workflow SHALL be classified as supported, degraded, unsupported, environment-dependent, or real-empty-valid

### Requirement: Logs production behavior stays contract-backed

The production Logs panel SHALL expose only behavior backed by `DeckGoLogsTailResponse`, `DeckGoLogStreamEvent`, `fetchLogsTail()`, `streamLogEvents()`, `GET /api/logs`, `GET /api/logs/stream`, and local defensive parsing.

#### Scenario: Dynamic log lines are parsed defensively

- **WHEN** `DeckGoLogsTailResponse.lines` contains strings, object-like rows, or unexpected values
- **THEN** production SHALL parse supported fields into local display rows
- **AND** production SHALL preserve raw payload inspection for parsed object rows
- **AND** production SHALL omit unsupported or empty rows rather than throwing or fabricating required fields

#### Scenario: Unsupported server-side capabilities are handled

- **WHEN** the v2 handoff references server-side level/source/session/correlation filtering, durable log export, or a stable typed `DeckGoLogLine` shape without a verified Deck-facing contract
- **THEN** production SHALL keep those workflows local, disabled, or recorded as unavailable
- **AND** production SHALL NOT claim that Gateway received filters or produced a typed line schema unless verified

### Requirement: Logs has mock visual evidence

The Logs implementation SHALL include L1 mock visual verification through the real frontend API path and contract-shaped mock Gateway data.

#### Scenario: Mock visual E2E verifies interaction states

- **WHEN** the Logs mock visual E2E runs
- **THEN** it SHALL render the production Logs panel with contract-shaped tail data and stream events
- **AND** it SHALL verify ready state plus at least two interaction states among local filtering, row selection, correlation narrowing, export preview, pause/resume, live tape, raw payload, empty state, or error state
- **AND** closeout evidence SHALL label the test as mock visual coverage rather than real Gateway coverage

### Requirement: Logs has bounded real-stack evidence

The Logs implementation SHALL include L2 real-stack verification for the read-only BFF contract chain.

#### Scenario: Real stack returns log data

- **WHEN** the real stack is available and `GET /api/logs` returns one or more contract-shaped log lines
- **THEN** the test SHALL verify runtime readiness, response shape, production render, local filter behavior, selected row detail, raw payload availability, and non-mutating controls

#### Scenario: Real stack has no current log lines

- **WHEN** the real stack is available but `GET /api/logs` returns an empty or missing `lines` array with a valid response shape
- **THEN** the test SHALL verify runtime readiness, valid response shape, production empty-state rendering, and no fabricated rows
- **AND** the scenario SHALL be recorded as `real-empty-valid`

#### Scenario: Real stream is blocked or quiet

- **WHEN** `/api/logs/stream` cannot produce a `log.batch`/`log.reset` frame after at most three fresh attempts without a deterministic Logs-scoped fix
- **THEN** the blocking or quiet-stream evidence SHALL be recorded in `verification.yaml` and handoff notes
- **AND** static review, focused tests, and mock visual evidence SHALL still be completed before moving to the next module

### Requirement: Logs deterministic drift is fixed directly

Clear Logs-scoped issues found during explore or verification SHALL be fixed directly when the fix is low-risk and evidence-backed.

#### Scenario: Deterministic drift is found

- **WHEN** contract, backend, frontend, mock, i18n, handoff, or test drift is discovered and no material product ambiguity exists
- **THEN** the implementation SHALL fix the drift in the source-owned layer
- **AND** focused regression evidence SHALL be added or refreshed
