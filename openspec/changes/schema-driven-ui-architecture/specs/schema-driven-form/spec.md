## ADDED Requirements

### Requirement: MethodForm renders params form from JSON Schema

The system SHALL provide a `MethodForm` component that accepts a Gateway method name, fetches its params JSON Schema from `gateway.describe` (or cached registry), and renders an editable form using RJSF with the `@rjsf/shadcn` theme.

#### Scenario: Simple params form

- **WHEN** `MethodForm` is rendered with `method="deck.plugins.install"` and the params schema defines `{ name: string, version?: string }`
- **THEN** the form displays a required text input for `name` and an optional text input for `version`, using shadcn/ui Input components

#### Scenario: Nested object params

- **WHEN** the params schema contains a nested object (e.g., `match: { channel: string, peer?: { kind, id } }`)
- **THEN** the form renders a collapsible section for `match` with nested fields, including the optional `peer` sub-object

#### Scenario: Union/oneOf params

- **WHEN** the params schema contains a `oneOf` with discriminated variants
- **THEN** the form renders a select dropdown for the discriminator field and dynamically shows/hides variant-specific fields

#### Scenario: Form submission

- **WHEN** the user fills in form fields and clicks submit
- **THEN** the form validates against the JSON Schema, displays validation errors inline if invalid, or calls the typed client method with the form data if valid

### Requirement: MethodForm supports uiSchema overrides

The system SHALL allow per-field UI customization via a `fieldOverrides` prop that maps to RJSF `uiSchema` entries.

#### Scenario: Password field override

- **WHEN** `fieldOverrides` specifies `{ "apiKey": { "ui:widget": "password" } }`
- **THEN** the `apiKey` field renders as a password input with reveal toggle instead of a plain text input

### Requirement: MethodForm works without gateway.describe

The system SHALL support a fallback mode where the JSON Schema is passed directly as a prop, for use during development before `gateway.describe` is available.

#### Scenario: Static schema fallback

- **WHEN** `MethodForm` is rendered with `schema={...}` prop instead of `method="..."` prop
- **THEN** the form renders from the provided schema without calling `gateway.describe`
