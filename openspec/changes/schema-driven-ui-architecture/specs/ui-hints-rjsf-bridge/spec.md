## ADDED Requirements

### Requirement: uiHintsToRjsfSchema converts Gateway UiHints to RJSF uiSchema
The system SHALL provide a `uiHintsToRjsfSchema()` function that converts Gateway `ConfigUiHint` entries to RJSF-compatible `uiSchema` objects.

#### Scenario: Label mapping
- **WHEN** a UiHint has `label: "API Key"`
- **THEN** the generated uiSchema entry has `"ui:title": "API Key"`

#### Scenario: Sensitive field mapping
- **WHEN** a UiHint has `sensitive: true`
- **THEN** the generated uiSchema entry has `"ui:widget": "password"`

#### Scenario: Help text mapping
- **WHEN** a UiHint has `help: "Enter your provider API key"`
- **THEN** the generated uiSchema entry has `"ui:help": "Enter your provider API key"`

#### Scenario: Field ordering
- **WHEN** multiple UiHints have `order` values (e.g., `name: 1`, `model: 2`, `apiKey: 3`)
- **THEN** the generated root uiSchema has `"ui:order": ["name", "model", "apiKey", "*"]`

#### Scenario: Group mapping
- **WHEN** UiHints assign fields to groups (e.g., `group: "authentication"`)
- **THEN** the generated uiSchema includes `"ui:group": "authentication"` (custom RJSF extension) and the form renderer groups fields under a shared section header

### Requirement: Schema registry caches gateway.describe responses
The system SHALL maintain a client-side schema registry that caches the `gateway.describe` response and provides synchronous access to method schemas.

#### Scenario: Initial load
- **WHEN** the Deck connects to the Gateway
- **THEN** it calls `gateway.describe` once and caches the full response in memory

#### Scenario: Schema access
- **WHEN** a `MethodForm` or `MethodPanel` requests the schema for `"deck.plugins.install"`
- **THEN** the registry returns the cached params/result schemas synchronously without a network call

#### Scenario: Schema version mismatch
- **WHEN** the cached `schemaVersion` differs from the `hello-ok.features.schemaVersion` after a reconnect
- **THEN** the registry invalidates the cache and re-fetches `gateway.describe`
