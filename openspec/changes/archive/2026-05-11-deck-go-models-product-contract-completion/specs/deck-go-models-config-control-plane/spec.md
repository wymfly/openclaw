## MODIFIED Requirements

### Requirement: Provider and model lifecycle SHALL preserve OpenClaw semantics

The product UI and BFF SHALL support provider/model lifecycle operations while preserving OpenClaw validation, optionality, and advanced-field boundaries.

#### Scenario: Provider fields are edited

- **WHEN** a provider is created or edited
- **THEN** deck-go SHALL support product controls for typed provider fields that are safe and supported by the current contract, including `baseUrl`, `apiKey`, `auth`, `api`, `authHeader`, `injectNumCtxForOpenAICompat`, and contained `models`
- **AND** provider `headers` and `request` SHALL remain read-only summaries or explicit follow-ups unless separately productized through typed, secret-safe controls.
- **AND** the Models UI SHALL NOT route the operator to a Models-page raw editor as the way to edit unsupported provider leaves.

#### Scenario: Model fields are edited

- **WHEN** a model is created or edited
- **THEN** deck-go SHALL support product controls for supported model fields including `id`, `name`, `api`, `reasoning`, `input`, `cost`, `contextWindow`, `contextTokens`, and `maxTokens`
- **AND** `input` SHALL remain limited to the OpenClaw model input modalities accepted by the config schema
- **AND** model `headers` and `compat` SHALL remain read-only summaries or explicit follow-ups unless separately productized through typed controls.
- **AND** the Models UI SHALL NOT route the operator to a Models-page raw editor as the way to edit unsupported model leaves.

#### Scenario: Existing partial config is saved

- **WHEN** an existing provider/model omits fields that zod treats as optional
- **THEN** deck-go SHALL preserve omitted fields unless the operator explicitly edits them
- **AND** it SHALL not silently expand authored config to frontend defaults.

### Requirement: Frontend Models UI SHALL use Data Fabric and product components

The frontend Models module SHALL consume typed Models data through Data Fabric queries/mutations and SHALL present a design-system-aligned product UI.

#### Scenario: Normal UI renders configured models

- **WHEN** the Models page loads
- **THEN** it SHALL render a catalog header, provider-grouped list, model rows, provider/model drawers, add-provider wizard, usage-policy overview, and impact dialogs from typed DTOs
- **AND** loading, error, true-empty, filtered-empty, stale-data, and degraded states SHALL be explicit.

#### Scenario: Normal UI mutates model config

- **WHEN** the operator creates, edits, deletes, or changes mode from the product UI
- **THEN** the component SHALL call typed model mutation hooks/facades
- **AND** raw config save SHALL NOT appear as a Models-page product action.
