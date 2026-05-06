## ADDED Requirements

### Requirement: Config contract chain is verified before completion

The Config implementation SHALL be reviewed against the full contract chain before this change is marked complete.

#### Scenario: Contract chain matrix is recorded

- **WHEN** the Config module is implemented or reviewed
- **THEN** the handoff notes SHALL record the workflow-to-contract matrix for snapshot load, schema lookup, section navigation, structured editing, raw JSON editing, diff preview, apply confirmation, successful apply, conflict recovery, reset, sensitive-field reveal, lookup payload, raw payload, apply history, scaffold, import/export, rollback, and schema batching workflows
- **AND** every workflow SHALL be classified as supported, degraded, unsupported, environment-dependent, or handoff-blocked

### Requirement: Config production behavior stays contract-backed

The production Config panel SHALL expose only behavior backed by `DeckGoConfigSnapshotResponse`, `DeckGoConfigApplyResponse`, `DeckGoConfigLookupResponse`, `fetchDeckConfig()`, `applyDeckConfig()`, `postConfigSchemaLookup()`, `GET /api/config`, `POST /api/config/apply`, and `POST /api/config/schema-lookup`.

#### Scenario: Route and method truth is used

- **WHEN** Config handoff, frontend, backend, tests, or docs describe the contract chain
- **THEN** they SHALL name the real Deck BFF wrappers and routes
- **AND** they SHALL map Gateway methods as `config.get`, `config.apply`, and `config.schema.lookup`
- **AND** they SHALL NOT use non-existent method names such as `gateway.config.snapshot`, `gateway.config.apply`, or `gateway.config.lookup`

#### Scenario: Config apply is safe and base-hash gated

- **WHEN** an operator applies raw config
- **THEN** production SHALL validate that the raw draft is JSON object text
- **AND** production SHALL call `applyDeckConfig()` with the current raw draft and base hash
- **AND** production SHALL refresh snapshot/hash state after success
- **AND** production SHALL show conflict/reload guidance when the BFF/Gateway reports a base-hash conflict

#### Scenario: Unsupported config capabilities are handled

- **WHEN** the v2 handoff references durable apply history, schema lookup batching, config scaffold, import/export, rollback/version restore, secret vault integration, or a form-library stack choice without a verified Deck-facing contract
- **THEN** production SHALL keep those workflows local, disabled, or recorded as unavailable
- **AND** production SHALL NOT claim persisted audit/history, rollback, or scaffold behavior unless verified

### Requirement: Config has mock visual evidence

The Config implementation SHALL include L1 mock visual verification through the real frontend API path and contract-shaped mock Gateway data.

#### Scenario: Mock visual E2E verifies interaction states

- **WHEN** the Config mock visual E2E runs
- **THEN** it SHALL render the production Config panel with contract-shaped snapshot and schema lookup data
- **AND** it SHALL verify ready state plus at least two interaction states among section selection, schema lookup, structured edit, raw JSON edit, diff preview, apply confirmation, apply success, conflict preview, reset, sensitive reveal, or raw payload inspection
- **AND** closeout evidence SHALL label the test as mock visual coverage rather than real Gateway config mutation coverage

### Requirement: Config has bounded real-stack evidence

The Config implementation SHALL include bounded L2 real-stack verification for the BFF contract chain.

#### Scenario: Real stack exposes config read and schema lookup

- **WHEN** the real stack is available
- **THEN** the test SHALL verify runtime readiness, `GET /api/config` response shape, current hash/baseHash handling when present, `POST /api/config/schema-lookup` response shape for root or a safe path, and production UI rendering

#### Scenario: Real stack apply is safe to exercise

- **WHEN** a noop apply of the fetched raw config with current `baseHash` is safe and supported
- **THEN** the test SHALL verify `POST /api/config/apply` returns a contract-shaped response
- **AND** it SHALL avoid introducing user-visible config drift

#### Scenario: Real stack apply is blocked or risky

- **WHEN** real-stack apply verification fails or would require a non-noop config mutation after at most three fresh attempts without a deterministic Config-scoped fix
- **THEN** the blocking evidence SHALL be recorded in `verification.yaml` and handoff notes
- **AND** static review, focused tests, read-only L2 checks, and mock visual evidence SHALL still be completed before moving to the next module

### Requirement: Config deterministic drift is fixed directly

Clear Config-scoped issues found during explore or verification SHALL be fixed directly when the fix is low-risk and evidence-backed.

#### Scenario: Deterministic drift is found

- **WHEN** contract, backend, frontend, mock, i18n, handoff, or test drift is discovered and no material product ambiguity exists
- **THEN** the implementation SHALL fix the drift in the source-owned layer
- **AND** focused regression evidence SHALL be added or refreshed
