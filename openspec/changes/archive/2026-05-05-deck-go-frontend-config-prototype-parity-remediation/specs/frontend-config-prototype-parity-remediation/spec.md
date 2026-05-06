## ADDED Requirements

### Requirement: Config production UI matches the active v2 flow

The Config production panel SHALL use the active handoff prototype product flow
as its visual and interaction target while preserving current deck-go contract
truth.

#### Scenario: Operator opens Config workbench

- **WHEN** the operator navigates to Config
- **THEN** the first viewport SHALL show a config workbench with section
  navigation, structured editor, and a preview/raw/diff pane or a clear
  recoverable loading/error/read-only state
- **AND** the workbench SHALL use the active v2 handoff prototype as the visual
  target unless an accepted exception is recorded.

#### Scenario: Operator edits supported writable config

- **WHEN** the BFF returns writable raw text and an optimistic concurrency hash
- **THEN** structured edits and raw edits SHALL update local draft state, show a
  diff preview, and submit through the Config apply route only after explicit
  confirmation
- **AND** successful apply SHALL refresh the config snapshot and invalidate
  schema lookup cache.

#### Scenario: Operator opens read-only real config

- **WHEN** the BFF returns `raw: null`, omits writable raw text, or omits a
  usable hash
- **THEN** raw and structured write actions SHALL be disabled or guarded
- **AND** the UI SHALL explain that writable raw config text is unavailable
  instead of sending unsafe apply requests.

### Requirement: Config contract chain remains BFF-only

Config browser code SHALL call only the Deck BFF/API facade and SHALL NOT call
the OpenClaw Gateway directly.

#### Scenario: Config data and actions are loaded

- **WHEN** the panel loads config snapshot, performs schema lookup, or applies
  config changes
- **THEN** the browser SHALL use `frontend-new/src/api.ts` wrappers and Deck BFF
  routes
- **AND** real E2E SHALL record any direct browser Gateway HTTP request or
  websocket attempt as a failure.

### Requirement: Config unsupported projections are explicit

Prototype-only Config projections SHALL be labelled instead of silently claimed
as real Gateway-backed features.

#### Scenario: Prototype assumes unsupported or degraded data

- **WHEN** durable apply history, scaffold defaults, import/export, rollback,
  schema batch lookup, or field-level validation DTOs are unavailable from
  current Deck-facing contracts
- **THEN** the UI, tests, implementation notes, or accepted-exception ledger
  SHALL record them as disabled, local-only, degraded, skipped-safe, or
  follow-up contracts
- **AND** archive SHALL NOT claim those projections as real Gateway-backed
  product capabilities.

### Requirement: Config mock evidence covers editor prototype states

Config mock visual and unit evidence SHALL exercise the prototype-shaped product
flow with contract-shaped fixture data.

#### Scenario: Mock Config evidence is claimed

- **WHEN** the child proposal records mock evidence
- **THEN** tests SHALL cover section navigation, schema lookup, structured edit,
  raw JSON validation, sensitive reveal, diff/apply confirmation, reset or
  read-only fallback, localized UI, and empty/error states
- **AND** prototype-vs-current parity artifacts SHALL include a prototype
  screenshot, mock-current screenshot, contact sheet, structured verdict, and
  accepted-exception ledger.

### Requirement: Config real E2E verifies safe route shape and variants

Config real Gateway evidence SHALL exercise product behavior through the Deck
shell and real BFF/Gateway chain.

#### Scenario: Real Config UI variants are verified

- **WHEN** the real E2E verifies Config UI
- **THEN** it SHALL navigate from another shell panel into Config with the nav
  or handoff control
- **AND** it SHALL verify both theme axes and both locale axes, using all four
  combinations when the child identifies locale/density risk
- **AND** it SHALL interact with section navigation, schema/form surfaces,
  right-pane/raw/read-only states, and available dialogs or skipped-safe
  fallbacks
- **AND** it SHALL record unexpected console, page, BFF API, direct Gateway
  request, and direct Gateway websocket errors.

#### Scenario: Real Config API shape is verified

- **WHEN** the real E2E verifies Config API routes
- **THEN** it SHALL verify runtime readiness, `GET /api/config`, and
  `POST /api/config/schema-lookup`
- **AND** it SHALL execute bounded `POST /api/config/apply` only when the test
  has writable raw text and a valid current hash, otherwise record skipped-safe
  evidence.

### Requirement: Config real E2E attempts representative fixture data safely

Config real Gateway evidence SHALL attempt representative run-scoped data
creation before accepting read-only-only evidence.

#### Scenario: Safe Config fixture can be created

- **WHEN** the isolated real E2E environment can create a reversible
  run-scoped config fixture through Deck BFF, Gateway RPC, or isolated
  `openclaw.json` setup
- **THEN** the fixture SHALL include the current run id in a harmless config
  value or metadata-like field already supported by the schema
- **AND** cleanup SHALL restore the original safe config snapshot or refuse to
  mutate any target that does not include the current run id.

#### Scenario: Config fixture is too risky or read-only

- **WHEN** fixture creation would touch non-isolated user/global config, real
  credentials, external provider configuration, or a snapshot without writable
  raw text/hash
- **THEN** the real E2E SHALL mark that fixture skipped-safe or handoff-blocked
  with concrete evidence
- **AND** SHALL still run safe read/UI evidence and record what disposable
  fixture support is missing.

### Requirement: Config deterministic defects are fixed before archive

Deterministic Config defects found during remediation SHALL be fixed before this
child proposal archives.

#### Scenario: Config remediation finds local drift

- **WHEN** remediation discovers a reproducible UI mismatch, stale fixture,
  localized text gap, API facade mismatch, nullability issue, unsafe write
  guard, or BFF projection bug
- **THEN** the child proposal SHALL fix it with focused verification
- **AND** SHALL NOT hand it off as a real E2E uncertainty.
