## ADDED Requirements

### Requirement: Models reference projection SHALL parse OpenClaw model selection shapes

The Models BFF SHALL parse and project OpenClaw model references from both string model refs and object-shaped model selections with primary/fallback fields.

#### Scenario: String model ref is scanned

- **WHEN** a model-bearing config field contains a string reference such as `provider/model`
- **THEN** the reference index SHALL record provider id, model id, config path, owner kind, and label when available.

#### Scenario: Object model ref is scanned

- **WHEN** a model-bearing config field contains an object with `primary` and `fallbacks`
- **THEN** the reference index SHALL record the primary model reference
- **AND** it SHALL record each fallback model reference with fallback role metadata.

#### Scenario: Unsupported or malformed model ref is scanned

- **WHEN** a model-bearing config value cannot be parsed into a provider/model reference
- **THEN** the scanner SHALL skip or mark it degraded without crashing the Models detail or impact preview endpoint.

### Requirement: Models defaults projection SHALL reflect OpenClaw agent default truth

The Models config-detail projection SHALL derive default-role information from verified OpenClaw config paths rather than from frontend assumptions.

#### Scenario: Agent default model is configured

- **WHEN** `agents.defaults.model` is configured as a string or `{ primary, fallbacks }`
- **THEN** the Models config detail SHALL surface the text/default model reference and fallback references where representable.

#### Scenario: Role-specific defaults are configured

- **WHEN** role-specific model defaults such as image, pdf, summary, compaction, memory search, media generation, or subagent defaults are configured in OpenClaw-supported paths
- **THEN** the projection SHALL surface their model references with role labels when code truth confirms the paths.

#### Scenario: First agent model is used as compatibility fallback

- **WHEN** no explicit `agents.defaults.model` exists but the implementation derives a display fallback from the first configured agent model
- **THEN** the projection SHALL label that value as derived compatibility display
- **AND** it SHALL not claim that the first agent model is an authored global default.

### Requirement: Destructive impact previews SHALL include primary and fallback usage

Provider/model delete and catalog policy impact previews SHALL include both primary/default and fallback usage references when they are present in OpenClaw config.

#### Scenario: Delete target is used as fallback

- **WHEN** a provider or model targeted for deletion appears in a fallback chain
- **THEN** the impact preview SHALL include that fallback reference
- **AND** the delete commit SHALL re-scan and protect against stale fallback references before mutating config.

#### Scenario: Delete target is used as primary/default

- **WHEN** a provider or model targeted for deletion appears as a primary/default model
- **THEN** the impact preview SHALL identify the owner path and role
- **AND** the UI SHALL present that impact before enabling destructive confirmation.
