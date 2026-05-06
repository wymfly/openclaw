## ADDED Requirements

### Requirement: Settings contract chain is verified before completion

The Settings implementation SHALL be reviewed against the full Deck Settings, runtime endpoint, runtime gateway, bootstrap, version, device, UI metadata, frontend wrapper, mock fixture, visual E2E, and real-stack evidence chain before this change is marked complete.

#### Scenario: Contract chain matrix is recorded

- **WHEN** the Settings module is implemented or reviewed
- **THEN** the handoff notes SHALL record the workflow-to-contract matrix for settings read, settings save, connection test, version read, bootstrap/runtime status, runtime endpoint read, runtime endpoint save, runtime endpoint test, runtime mutability, device list, self device, pending device actions, token rotate/revoke, stream updates, appearance/locale preferences, notifications, projected recent saves, and BFF-only browser behavior
- **AND** every workflow SHALL be classified as supported, degraded, unsupported, environment-dependent, empty-valid, skipped-safe, or handoff-blocked
- **AND** stale route, method, DTO, token, device, or runtime-mode assumptions SHALL be corrected or explicitly recorded as stale

### Requirement: Settings production behavior stays contract-backed

The production Settings panel SHALL expose only behavior backed by current Deck-facing DTOs, frontend wrappers, Go BFF/runtime routes, or documented Deck projections.

#### Scenario: Route and runtime truth is used

- **WHEN** Settings handoff, frontend, backend, tests, or docs describe the contract chain
- **THEN** they SHALL name current wrappers and routes for settings, version, bootstrap, runtime gateway, runtime capabilities, runtime endpoint, and device workflows
- **AND** they SHALL use `GET /settings` and `PUT /settings` for settings read/save route truth
- **AND** they SHALL use `POST /runtime/endpoint:test` for runtime endpoint test route truth
- **AND** they SHALL NOT claim token rotation, recent-save audit, keybindings, privacy, bundled `.env` mutation, or rich typed paired-device fields unless verified in code and tests

#### Scenario: Bundled runtime endpoint remains read-only

- **WHEN** runtime capabilities or bootstrap state indicate the endpoint is immutable or bundled-mode managed
- **THEN** runtime endpoint URL, token, TLS, command, bind, auto-start, and supervisor-owned fields SHALL render read-only or unavailable
- **AND** production SHALL NOT submit endpoint update calls from disabled UI controls
- **AND** any BFF rejection for bundled endpoint mutation SHALL be surfaced as a safe error rather than breaking the panel

#### Scenario: Settings save payload is constrained

- **WHEN** an operator saves local settings
- **THEN** the panel SHALL submit only allowed local preferences such as appearance, notifications, and paired-device projection data through `saveSettings`
- **AND** access token values, runtime endpoint values, and supervisor-managed fields SHALL NOT be sent through the settings save payload

### Requirement: Settings has mock visual evidence

The Settings implementation SHALL include L1 mock visual verification through the real frontend API path and contract-shaped settings, runtime, endpoint, device, and version data.

#### Scenario: Mock visual E2E verifies interaction states

- **WHEN** the Settings mock visual E2E runs
- **THEN** it SHALL render the production Settings panel with contract-shaped settings/runtime/device/version data
- **AND** it SHALL verify ready state plus at least one interaction state among endpoint test, device confirmation, token rotation dialog, save dialog, read-only endpoint state, or locale/appearance changes
- **AND** closeout evidence SHALL label the test as mock visual coverage rather than real Gateway/LLM, real token, or production device assurance

### Requirement: Settings has bounded real-stack evidence

The Settings implementation SHALL include bounded L2 real-stack verification for the Settings BFF and runtime-mode contract chain.

#### Scenario: Real stack exposes Settings route shapes

- **WHEN** the real stack is available
- **THEN** the test SHALL verify safe response shapes for settings, version, bootstrap/runtime, capabilities, runtime endpoint, endpoint test/rejection behavior, devices when available, and the production Settings UI
- **AND** the production Settings UI SHALL render against the real BFF without browser-side direct Gateway calls
- **AND** empty device lists, missing version fields, or immutable endpoint state SHALL be recorded as empty-valid or degraded when the route shape is correct

#### Scenario: Real Settings mutation is unsafe or unavailable

- **WHEN** real endpoint mutation, device mutation, token rotation, or settings save would affect uncontrolled operator state
- **THEN** the implementation SHALL skip the mutation safely or verify an expected rejection only
- **AND** the test SHALL record pass, degraded, skipped-safe, or handoff-blocked evidence after at most three fresh attempts

### Requirement: Settings deterministic drift is fixed directly

Clear Settings-scoped issues found during explore or verification SHALL be fixed directly when the fix is low-risk and evidence-backed.

#### Scenario: Deterministic drift is found

- **WHEN** contract, backend, frontend, mock, i18n, handoff, UI metadata, endpoint classification, or test drift is discovered and no material product ambiguity exists
- **THEN** the implementation SHALL fix the drift in the source-owned layer
- **AND** focused regression evidence SHALL be added or refreshed
