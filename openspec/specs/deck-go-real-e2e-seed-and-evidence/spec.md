# deck-go-real-e2e-seed-and-evidence Specification

## Purpose

Define the Deck Go real Gateway seed evidence contract that proves an isolated `cpa` + `main` seed can run through the normal deck-go BFF path, persist redacted machine-readable evidence, and avoid mutating operator state.

## Requirements

### Requirement: Focused real seed entrypoint

deck-go SHALL provide a focused verification entrypoint for the isolated real Gateway seed using the configured `cpa` channel and `main` agent.

#### Scenario: Seed command runs the focused smoke

- **WHEN** an operator runs the focused real seed verification command with `DECK_GO_REAL_GATEWAY_E2E=1`
- **THEN** deck-go SHALL start the isolated real Gateway stack and run the real control-plane seed smoke without requiring module-specific real E2E specs

#### Scenario: Real Gateway flag is absent

- **WHEN** the focused seed spec is run without `DECK_GO_REAL_GATEWAY_E2E=1`
- **THEN** the Playwright test SHALL skip the real Gateway seed instead of trying to contact real OpenClaw services

### Requirement: Seed evidence is machine-readable and redacted

deck-go SHALL record seed evidence as redacted JSON that can be inspected after the run when a persistent evidence directory is configured.

#### Scenario: Persistent evidence directory is configured

- **WHEN** the seed writes evidence and `DECK_GO_REAL_E2E_EVIDENCE_DIR` is set
- **THEN** deck-go SHALL write a redacted JSON evidence file to that directory using the current run id and evidence name

#### Scenario: Evidence includes sensitive fields

- **WHEN** seed evidence contains token, password, secret, authorization, credential, cookie, or API key fields
- **THEN** the persisted and attached evidence SHALL redact those field values

### Requirement: Seed attempts are bounded

deck-go SHALL bound real seed attempts and record the final status with enough context to debug environment or contract failures.

#### Scenario: Seed succeeds

- **WHEN** a bounded seed attempt creates a chat session through the deck-go BFF
- **THEN** evidence SHALL record `sessionStatus` as `passed` and include supporting read endpoint statuses for sessions, activity, logs, usage, and docs

#### Scenario: Seed is blocked

- **WHEN** all bounded seed attempts fail because the runtime, configured channel, selected model, network, or credentials are unavailable
- **THEN** evidence SHALL record `sessionStatus` as `handoff-blocked` and include the failed attempt responses without mutating operator state

### Requirement: Seed does not mutate operator state

deck-go SHALL run the seed against the isolated copied OpenClaw configuration and workspace, not the operator's original state.

#### Scenario: Seed writes a session

- **WHEN** the seed creates a real chat/session
- **THEN** the write SHALL target the isolated OpenClaw root prepared for that run and SHALL NOT modify the original `openclaw.json` or original workspace paths

### Requirement: Head proposal matrix tracks seed completion

deck-go SHALL keep the head contract-chain proposal matrix synchronized with the seed child proposal lifecycle.

#### Scenario: Seed child proposal is archived

- **WHEN** this child proposal passes validation and is archived
- **THEN** the head matrix SHALL mark `deck-go-real-e2e-seed-and-evidence` as `archived` and preserve the evidence command or handoff blocker in generated artifacts
