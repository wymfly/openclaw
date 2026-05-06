## ADDED Requirements

### Requirement: Real seed evidence SHALL include command convergence samples

Deck Go real Gateway seed evidence SHALL include representative Chat command convergence samples in addition to baseline session creation/read checks.

#### Scenario: Command convergence smoke runs

- **WHEN** the isolated real Gateway stack is available with the configured `cpa` channel and `main` agent
- **THEN** the real E2E command smoke SHALL execute safe representative command samples through the normal deck-go frontend/BFF path
- **AND** evidence SHALL record command name, source class, expected backend path, frontend assertion, final status, and redacted response summary

#### Scenario: Gateway builtin command is sampled

- **WHEN** the command smoke samples a safe Gateway builtin such as `/status`
- **THEN** evidence SHALL prove it was not rejected as an unknown frontend command
- **AND** evidence SHALL prove the response came from the real OpenClaw/Gateway execution path
- **AND** evidence SHALL prove the frontend rendered the expected output class

#### Scenario: Stateful mutation command is sampled

- **WHEN** the command smoke samples a safe mutation command such as compact against a disposable session
- **THEN** evidence SHALL prove request dispatch, in-flight UI state, final UI state, and durable metadata reconciliation

### Requirement: Real command E2E SHALL use circuit breakers

Deck Go SHALL bound real command E2E attempts and persist blockers instead of hanging implementation progress.

#### Scenario: Command sample fails repeatedly

- **WHEN** a command sample fails because of runtime startup, Gateway connection, credentials, model/channel availability, or fixture preparation
- **THEN** the runner SHALL stop after the configured bounded attempts
- **AND** evidence SHALL mark the command sample as handoff-blocked with the redacted failure reason

#### Scenario: Command sample is unsafe

- **WHEN** a command sample is classified as unsafe for real execution
- **THEN** the runner SHALL skip real execution
- **AND** evidence SHALL include the safety classification and the non-real verification performed instead

### Requirement: Real command evidence SHALL be reviewable

Deck Go SHALL make real command evidence sufficient for review without requiring a human to replay the entire test manually.

#### Scenario: Evidence file is generated

- **WHEN** command real E2E writes evidence
- **THEN** the evidence SHALL include machine-readable rows for each sampled command and a human-readable summary
- **AND** sensitive values such as tokens, credentials, cookies, authorization headers, API keys, and local secret paths SHALL be redacted

#### Scenario: Human visual verification follows automated smoke

- **WHEN** the user performs manual visual verification after automated command smoke
- **THEN** the automated evidence SHALL identify the browser URL, selected session, sampled commands, and UI assertions already checked
