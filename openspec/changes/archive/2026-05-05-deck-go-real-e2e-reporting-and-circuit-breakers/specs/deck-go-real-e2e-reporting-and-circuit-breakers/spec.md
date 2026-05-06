## ADDED Requirements

### Requirement: Real E2E evidence uses a bounded status vocabulary

deck-go real E2E SHALL use a shared status vocabulary for machine-readable scenario evidence.

#### Scenario: Evidence status is valid

- **WHEN** a scenario evidence helper writes evidence with `passed`, `degraded`, `empty-valid`, `skipped-safe`, or `handoff-blocked`
- **THEN** the helper SHALL accept the status and write redacted JSON evidence

#### Scenario: Evidence status is invalid

- **WHEN** a scenario evidence helper receives a status outside the bounded vocabulary
- **THEN** the helper SHALL fail before writing scenario evidence

### Requirement: Real E2E evidence records bounded attempts

deck-go real E2E SHALL record bounded retry metadata for scenarios that can retry.

#### Scenario: Attempts are within the circuit breaker

- **WHEN** scenario evidence includes `maxAttempts` and an attempts array whose length is less than or equal to `maxAttempts`
- **THEN** the helper SHALL record `attemptCount` and write the evidence

#### Scenario: Attempts exceed the circuit breaker

- **WHEN** scenario evidence includes more attempts than `maxAttempts`
- **THEN** the helper SHALL fail before writing scenario evidence

### Requirement: Real E2E blockers are handoff-friendly

deck-go real E2E SHALL record enough context to distinguish deterministic code failures from environment blockers.

#### Scenario: Environment blocker is reached

- **WHEN** a scenario cannot pass because credentials, configured model/channel access, network, runtime startup, or upstream service behavior blocks it after bounded attempts
- **THEN** evidence SHALL use `handoff-blocked` or `degraded` and include a reason, attempt count, and response/status context when available

### Requirement: Seed uses scenario evidence

deck-go SHALL use the shared scenario evidence helper for the isolated `cpa` + `main` seed.

#### Scenario: Seed writes evidence

- **WHEN** the seed completes or reaches its bounded attempts
- **THEN** the seed evidence SHALL include `scenarioId`, `runId`, `agentId`, `channel`, `model`, `status`, `sessionStatus`, `maxAttempts`, `attemptCount`, and supporting endpoint statuses

### Requirement: Head proposal matrix tracks reporting completion

deck-go SHALL keep the head contract-chain proposal matrix synchronized with the reporting child proposal lifecycle.

#### Scenario: Reporting child proposal is archived

- **WHEN** this child proposal passes validation and is archived
- **THEN** the head matrix SHALL mark `deck-go-real-e2e-reporting-and-circuit-breakers` as `archived`
