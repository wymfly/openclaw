## ADDED Requirements

### Requirement: uiHints are fetched and stored

The config store SHALL fetch the `uiHints` map from the `config.schema` API response and store it as `uiHints: Record<string, UiHint>` keyed by dot-path field identifiers.

#### Scenario: Schema response includes uiHints

- **WHEN** `GET /api/config/schema` returns `{schema, uiHints, version, generatedAt}`
- **THEN** the config store SHALL store `uiHints` and make it available to the SchemaForm

#### Scenario: Schema response has empty uiHints

- **WHEN** `GET /api/config/schema` returns `uiHints: {}` or omits it
- **THEN** the config store SHALL set `uiHints` to an empty object and all fields SHALL render with default behavior

### Requirement: Sensitive fields render as password inputs

The SchemaForm SHALL render fields marked `sensitive: true` in uiHints as password inputs with a toggle-visibility button.

#### Scenario: Sensitive field displays masked

- **WHEN** a field path matches a uiHints entry with `sensitive: true`
- **THEN** the input SHALL render as `type="password"` with a show/hide toggle icon button

#### Scenario: User toggles sensitive field visibility

- **WHEN** the user clicks the show/hide toggle on a sensitive field
- **THEN** the input type SHALL toggle between `password` and `text`

### Requirement: Advanced fields render collapsed by default

The SchemaForm SHALL render fields or sections marked `advanced: true` in uiHints as collapsed by default, with an expand toggle.

#### Scenario: Advanced section is initially collapsed

- **WHEN** a section or field group matches a uiHints entry with `advanced: true`
- **THEN** the section SHALL render collapsed with a "Show advanced" toggle

#### Scenario: User expands advanced section

- **WHEN** the user clicks the "Show advanced" toggle
- **THEN** the advanced fields SHALL become visible

### Requirement: Placeholder hints display on inputs

The SchemaForm SHALL render fields with `placeholder` in uiHints using the placeholder text as the input's placeholder attribute.

#### Scenario: Field has placeholder hint

- **WHEN** a field path matches a uiHints entry with `placeholder: "https://api.openai.com/v1"`
- **THEN** the input SHALL display the placeholder text when empty

### Requirement: uiHints path matching supports wildcards

The uiHints mapper SHALL support wildcard segments in paths (e.g., `models.providers.*.apiKey`) to match array-indexed paths like `models.providers.0.apiKey`.

#### Scenario: Wildcard path matches array element

- **WHEN** uiHints contains `"models.providers.*.apiKey": {sensitive: true}` and the form renders `models.providers.0.apiKey`
- **THEN** the field SHALL be treated as sensitive

#### Scenario: Exact path takes precedence over wildcard

- **WHEN** uiHints contains both `"models.providers.0.apiKey": {sensitive: false}` and `"models.providers.*.apiKey": {sensitive: true}`
- **THEN** the exact path match SHALL take precedence (sensitive: false)
