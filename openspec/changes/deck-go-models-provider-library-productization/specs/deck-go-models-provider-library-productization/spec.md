## ADDED Requirements

### Requirement: Models UI SHALL distinguish provider templates from configured providers

The Models control plane SHALL present built-in or implicit OpenClaw providers
as provider-library templates and user-authored `openclaw.json` providers as
configured provider assets with nested model lists. Provider templates SHALL be
used in the Add Provider wizard, not as a separate main-page or right-panel
management surface.

#### Scenario: Main page is configured provider grouped

- **WHEN** the operator opens the Models module
- **THEN** the primary list SHALL show configured providers from
  `openclaw.json` and the models nested under each provider
- **AND** it SHALL not show provider template cards as primary page content
- **AND** it SHALL not require opening a duplicate provider-management drawer to
  edit configured providers or their models.

#### Scenario: Built-in provider is not configured

- **WHEN** a provider exists only in OpenClaw's implicit or generated catalog
- **THEN** the Models UI SHALL show it as a configurable template
- **AND** it SHALL not present delete, uninstall, or edit-in-place actions for
  that template.

#### Scenario: Built-in provider has authored configuration

- **WHEN** a catalog provider id also exists in `models.providers`
- **THEN** the Models UI SHALL show the provider as configured
- **AND** edits SHALL write to the authored `models.providers.<id>` entry through
  typed deck-go BFF actions.

#### Scenario: Provider source is ambiguous

- **WHEN** deck-go cannot determine whether a provider came from catalog truth,
  authored config, or both
- **THEN** the UI SHALL degrade explicitly instead of offering unsupported write
  actions.

### Requirement: Custom provider onboarding SHALL be directly actionable

The Add Provider workflow SHALL make blank custom creation and template-copy
creation visibly selected or open the provider configuration form when the
operator chooses either path.

#### Scenario: Operator clicks custom provider

- **WHEN** the operator clicks the blank custom-provider option in the Add Provider
  workflow
- **THEN** provider id, base URL/API, auth, and secret-ref controls SHALL become
  visible immediately or after one explicit, visually enabled next action
- **AND** the workflow SHALL not leave the operator on an unchanged-looking
  provider selection screen.

#### Scenario: Operator copies a provider template

- **WHEN** the operator selects any provider template as a starting point
- **THEN** the Add Provider workflow SHALL copy editable API, base URL, auth, and
  provider id defaults into the configuration draft
- **AND** it SHALL allow the operator to change those values before saving the
  authored provider.

#### Scenario: Operator selects template models

- **WHEN** the selected provider template includes catalog model entries
- **THEN** the workflow SHALL expose selectable default models
- **AND** the selected models SHALL be sent through typed provider upsert as
  authored provider model entries.

#### Scenario: Custom provider is saved

- **WHEN** the operator submits a valid custom provider
- **THEN** the frontend SHALL call the typed provider upsert path
- **AND** deck-go SHALL write an authored `models.providers.<id>` entry to
  `openclaw.json` through Gateway config read/write semantics.

#### Scenario: Custom provider id already exists

- **WHEN** the submitted custom provider id already exists in authored config
- **THEN** the workflow SHALL offer product choices such as edit existing, choose
  another id, or update the configured provider with impact awareness
- **AND** it SHALL not expose a raw `merge` versus `replace` catalog-mode choice
  as the collision resolver.

### Requirement: Custom model management SHALL write configured provider assets

Custom model operations SHALL target authored provider configuration and SHALL
not mutate or pretend to mutate OpenClaw's implicit provider catalog.

#### Scenario: Custom model is added to configured provider

- **WHEN** the operator adds a custom model under a configured provider
- **THEN** the frontend SHALL call the typed model upsert path
- **AND** deck-go SHALL update that provider's authored `models` array while
  preserving unrelated optional fields.

#### Scenario: Custom model starts from template-only provider

- **WHEN** the operator starts adding a custom model from a built-in provider
  template that has no authored provider config
- **THEN** the workflow SHALL first require or perform creation of an authored
  provider entry
- **AND** the model SHALL be saved under that authored provider config rather
  than under the built-in catalog.

#### Scenario: Custom model save fails

- **WHEN** Gateway validation or base-hash conflict rejects a custom model write
- **THEN** the UI SHALL preserve the operator's draft
- **AND** it SHALL expose a recoverable error or conflict state without silently
  overwriting newer config.

### Requirement: Models normal UI SHALL not productize raw catalog mode primitives

The common Models product surface SHALL avoid making OpenClaw `merge` and
`replace` values the primary operator-facing decision.

#### Scenario: Mode is unset or merge

- **WHEN** `models.mode` is unset or `merge`
- **THEN** the normal Models UI SHALL focus on configured providers and nested
  models first, with Provider Library templates available through Add Provider
- **AND** raw `merge` text MAY appear only as secondary technical detail,
  advanced diagnostics, or raw config evidence.

#### Scenario: Mode is replace

- **WHEN** `models.mode` is `replace`
- **THEN** the Models UI SHALL show a truthful strict-configured-only or
  advanced-policy state
- **AND** any mode-changing action SHALL remain impact-aware and guarded by the
  existing typed BFF preview/commit semantics.

#### Scenario: Operator configures built-in provider

- **WHEN** the operator chooses a built-in provider template and configures
  credentials or models
- **THEN** the workflow SHALL write an authored provider config
- **AND** it SHALL not require the operator to choose raw `merge` or `replace`
  semantics as part of ordinary setup.

### Requirement: Productized Models verification SHALL cover mock and real paths separately

Provider Library productization SHALL include verification that separately proves
visual/interaction behavior and real Gateway contract behavior.

#### Scenario: Mock verification runs

- **WHEN** mock/component/browser verification is run for Models
- **THEN** it SHALL cover configured provider/model grouped rendering, absence
  of a separate provider-library main panel, template-copy onboarding with
  selectable default models, blank custom-provider onboarding, custom-model
  authoring, collision or conflict state, and existing `replace` mode display.

#### Scenario: Real-safe verification runs

- **WHEN** real Gateway verification is run
- **THEN** it SHALL use an isolated config/workspace and run-scoped provider or
  model ids
- **AND** it SHALL create, read, update or impact-check, and clean up only
  reversible Models config data through typed deck-go routes.

#### Scenario: Verification is circuit-broken

- **WHEN** real Gateway verification is blocked by environment startup, external
  credentials, or fixture safety
- **THEN** the change SHALL record the blocker and completed lower-level evidence
  instead of marking real behavior as proven.
