## ADDED Requirements

### Requirement: Model Catalog Display

The model management panel SHALL display all installed models grouped by provider, fetched via the `models.list` Gateway RPC.

#### Scenario: List models by provider

- **WHEN** the user navigates to the Models panel
- **THEN** the panel SHALL call `models.list` and display models grouped by provider (e.g., OpenAI, Anthropic, Google) with model name, context window size, and pricing info

### Requirement: Provider Configuration

The panel SHALL allow configuring provider settings (API key, base URL, pricing overrides) via `config.get`, `config.set`, and `config.patch` RPCs targeting model configuration in `openclaw.json`.

#### Scenario: Set provider API key

- **WHEN** the user enters an API key for a provider and saves
- **THEN** the panel SHALL call `config.patch` to update the provider's API key in the configuration

#### Scenario: Configure custom base URL

- **WHEN** the user sets a custom base URL for a provider
- **THEN** the panel SHALL call `config.patch` and the updated base URL SHALL be reflected in subsequent `models.list` responses

### Requirement: Model Cost Display

The panel SHALL display per-model cost information (input price per 1M tokens, output price per 1M tokens) using the token-pricing library.

#### Scenario: Display model pricing

- **WHEN** models are listed in the catalog
- **THEN** each model entry SHALL show input and output token pricing per 1M tokens

### Requirement: Default Model Selection

The panel SHALL allow selecting a default model for each agent via `config.patch`.

#### Scenario: Set default model for agent

- **WHEN** the user selects a model as the default for a specific agent
- **THEN** the panel SHALL call `config.patch` to update the agent's model configuration and display the selection as active
