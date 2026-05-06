## ADDED Requirements

### Requirement: Settings production UI matches the active section flow

The Settings production panel SHALL use the active handoff prototype product
flow as its visual and interaction target while preserving current deck-go
contract truth.

#### Scenario: Operator opens Settings

- **WHEN** the operator navigates to Settings
- **THEN** the first viewport SHALL show a Settings topbar, saved or unsaved
  status, a searchable section rail, and a right-side active section renderer
- **AND** the section rail SHALL include identity/access, runtime, appearance,
  notifications, paired devices, and version entries with readable labels and
  descriptions.

#### Scenario: Operator changes sections

- **WHEN** the operator selects a section or filters the section rail
- **THEN** the active group renderer SHALL update without leaving the Settings
  panel
- **AND** unavailable or no-match states SHALL remain visible and recoverable.

### Requirement: Settings save scope remains write-safe

Settings local preference saves SHALL send only fields supported by the
Deck-facing settings contract and backend write-safety policy.

#### Scenario: Operator saves local Settings preferences

- **WHEN** the operator edits appearance, notifications, or paired-device local
  settings and confirms save
- **THEN** the browser SHALL call the deck-go BFF `PUT /api/settings`
- **AND** the payload SHALL include only `appearance`, `notifications`, and
  `pairedDevices`
- **AND** the payload SHALL NOT include `accessToken`, `managedGateway`, runtime
  supervisor fields, or device-token secrets.

#### Scenario: Unsupported Settings fields are attempted

- **WHEN** a real or mock verification attempts to save unsupported Settings
  fields
- **THEN** the backend SHALL reject the write with a structured error
- **AND** the module evidence SHALL record that rejection as safety evidence.

### Requirement: Runtime endpoint controls preserve runtime-mode semantics

The Settings runtime section SHALL expose endpoint status and controls without
violating bundled or remote runtime-mode ownership.

#### Scenario: Bundled runtime endpoint is shown

- **WHEN** runtime capabilities report bundled mode or `endpointMutable=false`
- **THEN** endpoint URL, token, TLS, command, bind, auto-start, and supervisor
  ownership fields SHALL be read-only
- **AND** the UI SHALL explain that these values are `.env` or supervisor owned.

#### Scenario: Remote runtime endpoint is editable

- **WHEN** runtime capabilities report remote mode and `endpointMutable=true`
- **THEN** endpoint edits SHALL use `PUT /api/runtime/endpoint`
- **AND** endpoint tests SHALL use `POST /api/runtime/endpoint:test`
- **AND** unchanged configured tokens SHALL use the existing token-preserve
  sentinel rather than exposing the secret.

### Requirement: Settings dialogs are interactive and scoped

Settings SHALL provide confirmation or evidence dialogs for meaningful prototype
actions without adding unsupported mutations.

#### Scenario: Operator confirms a safe Settings save

- **WHEN** draft settings differ from the loaded baseline and the operator
  chooses save
- **THEN** a confirmation dialog SHALL summarize changed sections
- **AND** confirming SHALL persist only the safe local settings payload.

#### Scenario: Operator opens destructive token or device actions

- **WHEN** a token rotation, device token rotation, revoke, or remove action is
  not safely backed by current disposable real fixtures
- **THEN** real E2E SHALL classify the mutation as skipped-safe
- **AND** mock or unit tests MAY exercise the dialog without claiming a real
  destructive mutation happened.

### Requirement: Settings mock evidence covers prototype states

Settings mock visual and unit evidence SHALL exercise the prototype-shaped
product flow.

#### Scenario: Mock Settings evidence is claimed

- **WHEN** the child proposal records mock evidence
- **THEN** tests SHALL cover section rail search, section switching,
  appearance/notification edits, reset, save confirmation, runtime section,
  paired-device state, version state, dialogs, empty or no-match state, and
  localized UI
- **AND** prototype-vs-current parity artifacts SHALL include a prototype
  screenshot, mock-current screenshot, contact sheet, structured verdict, and
  accepted-exception ledger.

### Requirement: Settings real E2E creates safe run-scoped settings data

Settings real Gateway evidence SHALL create representative safe settings data
before accepting empty-state-only evidence.

#### Scenario: Safe Settings fixture can be created

- **WHEN** the isolated real E2E stack exposes `PUT /api/settings`
- **THEN** the real E2E SHALL create a run-scoped fixture using only safe local
  settings fields
- **AND** the run-scoped fixture SHALL include the current run id in at least one
  paired-device id, name, label, or metadata field
- **AND** cleanup SHALL restore the original safe settings snapshot or refuse to
  mutate any target that does not include the current run id.

#### Scenario: Unsafe Settings fixture is requested

- **WHEN** a fixture would mutate an access token, device token, external
  account, user memory, installed skill, or non-isolated global config
- **THEN** the real E2E SHALL mark that fixture skipped-safe with concrete
  evidence
- **AND** SHALL still run safe read/UI evidence and record the missing fixture
  support.

### Requirement: Settings real E2E covers navigation, variants, and interactions

Settings real Gateway UI evidence SHALL exercise the product surface through
Deck shell navigation and supported variants.

#### Scenario: Real Settings UI variants are verified

- **WHEN** the real E2E verifies Settings UI
- **THEN** it SHALL navigate from another shell panel into Settings with the nav
  or handoff button
- **AND** SHALL verify one dark English render and one light Chinese render
- **AND** SHALL interact with section rail search, at least three child
  sections, safe draft edit or reset/save flow, and available dialogs or
  skipped-safe fallbacks
- **AND** SHALL record unexpected console, page, BFF API, direct Gateway
  request, and direct Gateway websocket errors.

### Requirement: Settings unsupported projections are explicit

Prototype-only Settings projections SHALL be labelled instead of silently
claimed.

#### Scenario: Recent saves, access-token rotation, keybindings, privacy, or notification delivery are not contract-backed

- **WHEN** recent-save history, access-token rotation, keybindings, privacy
  settings, notification delivery semantics, or destructive device-token actions
  are unavailable from current Deck-facing DTOs
- **THEN** the UI, tests, implementation notes, or accepted-exception ledger
  SHALL record them as unavailable, projected, skipped-safe, or follow-up
  contracts
- **AND** archive SHALL NOT claim those projections as real Gateway-backed
  product capabilities.
