## ADDED Requirements

### Requirement: Models catalog policy SHALL be represented as advanced config truth

Deck-go SHALL preserve OpenClaw `models.mode` truth while keeping normal
provider/model workflows centered on product concepts rather than raw catalog
resolution primitives.

#### Scenario: Normal product setup is shown

- **WHEN** the operator configures a provider or model through the common Models
  UI
- **THEN** the UI SHALL present configured providers and their nested models as
  the main writable surface
- **AND** Provider Library templates SHALL be copy sources inside Add Provider,
  not a separate main-page or right-panel management surface
- **AND** it SHALL not require raw `merge` or `replace` choice before ordinary
  provider setup can proceed.

#### Scenario: Advanced mode action is exposed

- **WHEN** the product exposes a `models.mode` action for advanced operators
- **THEN** it SHALL still use the existing typed mode-set BFF route and
  service-side impact guardrails
- **AND** it SHALL explain the product consequence of the mode change rather
  than relying only on raw enum labels.

### Requirement: Provider template configuration SHALL write authored config

Deck-go SHALL convert a copied provider-library template into an authored
provider config before applying operator-owned credentials, auth, headers, or
selected default/custom models.

#### Scenario: Template provider is configured

- **WHEN** the operator saves settings for a built-in provider template
- **THEN** deck-go SHALL write a `models.providers.<providerId>` entry through
  typed provider upsert behavior
- **AND** it SHALL preserve OpenClaw validation, secret handling, and optional
  field semantics.
- **AND** selected catalog models SHALL be written as authored provider model
  entries.

#### Scenario: Template-only provider is edited destructively

- **WHEN** the operator attempts to delete or destructively edit a provider that
  only exists in the implicit catalog
- **THEN** deck-go SHALL not issue a catalog mutation
- **AND** the UI SHALL explain that only authored configuration can be removed or
  changed.

### Requirement: Custom-provider wizard regression SHALL be protected

The Models frontend SHALL include regression evidence for the custom-provider
onboarding path.

#### Scenario: Custom provider or template option is clicked

- **WHEN** a component or browser test clicks the blank custom-provider option
  or a template-copy option
- **THEN** the test SHALL assert that the configuration form, selected state, or
  explicit enabled next action is visible
- **AND** the test SHALL fail if only hidden draft state changes.
