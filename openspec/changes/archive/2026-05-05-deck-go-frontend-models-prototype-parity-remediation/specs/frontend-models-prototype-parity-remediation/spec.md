## ADDED Requirements

### Requirement: Models production UI matches the active product flow

The Models production panel SHALL use the active handoff prototype product flow
as its visual and interaction target while preserving current deck-go contract
truth.

#### Scenario: Operator opens Models

- **WHEN** the operator navigates to Models
- **THEN** the first viewport SHALL show a model registry list with page title,
  KPI strip, search/filter controls, provider-grouped model rows, and an add
  from catalog action
- **AND** provider auth, usage pressure, defaults, fallbacks, local models, and
  reasoning-capable models SHALL be visible through row or KPI affordances
- **AND** raw config editing SHALL remain available as an advanced authority,
  not as the dominant first-viewport layout.

#### Scenario: Operator drills into a model

- **WHEN** the operator selects a configured model row
- **THEN** the panel SHALL show a model detail surface with back navigation,
  model hero, status pills, and tabs for Overview, Limits, Pricing, Usage, Auth,
  and Audit
- **AND** tabs with unavailable contract data SHALL show explicit empty or
  projected-unavailable states rather than fabricated backend data.

### Requirement: Models contract chain remains BFF/Gateway scoped

The Models frontend SHALL continue to use deck-go BFF and generated runtime
Gateway transport wrappers for all data and mutations.

#### Scenario: Models data loads

- **WHEN** Models loads model config, runtime inventory, auth overview, catalog
  providers, usage cost, and usage provider status
- **THEN** it SHALL use the existing frontend wrappers for those surfaces
- **AND** browser code SHALL NOT call the OpenClaw Gateway origin directly.

#### Scenario: Models config mutation is saved

- **WHEN** an operator edits provider config, catalog apply, defaults,
  fallbacks, allowlist, auth config, or raw config
- **THEN** the mutation SHALL update a raw config draft and submit through
  `PATCH /models/config` with the current base hash when available
- **AND** parse, BFF, and hash conflict errors SHALL render without collapsing
  list/detail navigation.

### Requirement: Models real E2E uses run-scoped config fixture data

Models real Gateway evidence SHALL create representative run-scoped fixture data
in the isolated real E2E OpenClaw config when the `/models/config` route is
available.

#### Scenario: Real Models fixture is created

- **WHEN** the real E2E starts with an isolated OpenClaw config
- **THEN** the test SHALL add a provider and at least one model whose id or name
  includes the current run id
- **AND** SHALL save the change through deck-go `/models/config`
- **AND** SHALL verify the run-scoped model through the user-visible Models UI.

#### Scenario: Real Models fixture is cleaned up

- **WHEN** the real E2E completes or fails after fixture creation
- **THEN** cleanup SHALL remove only provider/model/default/fallback/allowlist
  entries that include the current run id
- **AND** SHALL refuse cleanup of any target that does not include the current
  run id.

### Requirement: Models real E2E covers navigation, variants, and interactions

Models real Gateway UI evidence SHALL exercise the product UI through Deck shell
navigation and supported variants.

#### Scenario: Real Models UI variants are verified

- **WHEN** the real E2E verifies Models UI
- **THEN** it SHALL navigate from another shell panel into Models with the nav
  button
- **AND** SHALL verify one dark English render and one light Chinese render
- **AND** SHALL interact with search/filter, model detail, tabs, catalog dialog,
  auth/probe surfaces when safe, and back navigation
- **AND** SHALL record unexpected console, page, BFF API, direct Gateway request,
  and direct Gateway websocket errors.

### Requirement: Models unsupported projections are explicit

Prototype-only Models projections SHALL be labelled instead of silently claimed.

#### Scenario: Pricing or audit data is not contract-backed

- **WHEN** pricing snapshot or PATCH audit history is unavailable from current
  Deck-facing DTOs
- **THEN** the UI, tests, or implementation notes SHALL record it as projected,
  unavailable, or accepted exception
- **AND** archive SHALL NOT claim those projections as real Gateway-backed
  product capabilities.
