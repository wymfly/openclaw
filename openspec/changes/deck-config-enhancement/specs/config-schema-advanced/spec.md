## ADDED Requirements

### Requirement: Schema parser handles union types

The schema-parser SHALL detect `oneOf`/`anyOf` in JSON Schema and produce a `FormField` with `type: "union"` containing variant definitions. Each variant SHALL include its sub-schema parsed recursively.

#### Scenario: Discriminated union with const property

- **WHEN** the schema contains `oneOf` where all variants are objects sharing a property with `const` values (e.g., `type: "openai"` / `type: "anthropic"`)
- **THEN** the parser SHALL produce a union field with `discriminator` set to the shared property name, and `variants` as an array of `{value, label, fields}` objects

#### Scenario: Simple type union

- **WHEN** the schema contains `oneOf` with simple types (e.g., `[{type: "string"}, {type: "number"}]`)
- **THEN** the parser SHALL produce a union field with a type selector and corresponding input widget for each variant

#### Scenario: Unrecognized union pattern

- **WHEN** the schema contains `oneOf`/`anyOf` that does not match discriminated or simple patterns
- **THEN** the parser SHALL fall back to `type: "json"` (raw JSON editor) and log the unhandled pattern to console

### Requirement: Schema parser handles record types

The schema-parser SHALL detect `additionalProperties` (with a schema value, not just `true`) and produce a `FormField` with `type: "record"` containing the value schema.

#### Scenario: Record with typed values

- **WHEN** the schema contains `{type: "object", additionalProperties: {type: "string"}}`
- **THEN** the parser SHALL produce a record field where each entry has a text key input and a string value input

#### Scenario: Record with complex values

- **WHEN** the schema contains `additionalProperties` with an object or union schema
- **THEN** the parser SHALL recursively parse the value schema and render each record entry with the full subform

### Requirement: Schema parser handles array items

The schema-parser SHALL detect `items` in array schemas and produce a `FormField` with `type: "array"` containing the parsed item schema, enabling per-item form rendering.

#### Scenario: Array with object items

- **WHEN** the schema contains `{type: "array", items: {type: "object", properties: {...}}}`
- **THEN** the parser SHALL produce an array field where each element renders as an individual object form with all properties

#### Scenario: Array with simple items

- **WHEN** the schema contains `{type: "array", items: {type: "string"}}` (or number/boolean)
- **THEN** the parser SHALL produce an array field where each element renders as the corresponding simple input

#### Scenario: Array without items schema

- **WHEN** the schema contains `{type: "array"}` without an `items` property
- **THEN** the parser SHALL fall back to JSON textarea (current behavior)

### Requirement: Schema parser handles format keywords

The schema-parser SHALL detect `format` keywords on string schemas and include them in the `FormField` for specialized rendering.

#### Scenario: URI format

- **WHEN** a string field has `format: "uri"`
- **THEN** the field SHALL include `format: "uri"` and the SchemaForm SHALL render it with URL validation and an optional "Open" link

#### Scenario: Email format

- **WHEN** a string field has `format: "email"`
- **THEN** the field SHALL include `format: "email"` and the SchemaForm SHALL render it with email pattern validation

### Requirement: Schema parser extracts validation constraints

The schema-parser SHALL extract `minLength`, `maxLength`, `minimum`, `maximum`, and `pattern` from schemas and include them in a `validation` property on `FormField`.

#### Scenario: String with length constraints

- **WHEN** a string schema has `minLength: 1` and `maxLength: 255`
- **THEN** the FormField SHALL include `validation: {minLength: 1, maxLength: 255}`

#### Scenario: Number with range constraints

- **WHEN** a number schema has `minimum: 0` and `maximum: 65535`
- **THEN** the FormField SHALL include `validation: {minimum: 0, maximum: 65535}`

### Requirement: SchemaForm renders union fields

The SchemaForm SHALL render union-type fields with a discriminator dropdown (or type selector) that dynamically switches the visible subform.

#### Scenario: User switches union variant

- **WHEN** the user selects a different variant in the discriminator dropdown
- **THEN** the form SHALL display the fields for the selected variant and clear values from the previous variant

### Requirement: SchemaForm renders record fields

The SchemaForm SHALL render record-type fields as a dynamic key-value list with Add/Remove controls.

#### Scenario: User adds a record entry

- **WHEN** the user clicks "Add Entry" on a record field
- **THEN** a new row SHALL appear with an empty key input and a value input matching the record's value schema

#### Scenario: User removes a record entry

- **WHEN** the user clicks the remove button on a record entry
- **THEN** the entry SHALL be removed from the form and the underlying config value

### Requirement: SchemaForm renders typed array fields

The SchemaForm SHALL render array fields with item schemas as a list of individual item forms with Add/Remove/Reorder controls.

#### Scenario: User adds an array item

- **WHEN** the user clicks "Add Item" on a typed array field
- **THEN** a new item form SHALL appear at the end of the list, initialized with default values from the item schema

#### Scenario: User reorders array items

- **WHEN** the user uses reorder controls (up/down buttons or drag-and-drop) on an array item
- **THEN** the item SHALL move to the new position and the underlying array value SHALL reflect the new order

#### Scenario: User removes an array item

- **WHEN** the user clicks the remove button on an array item
- **THEN** the item SHALL be removed and remaining items SHALL reindex

### Requirement: SchemaForm shows inline validation errors

The SchemaForm SHALL validate field values against schema constraints on blur and display inline error messages below the field.

#### Scenario: Value violates minimum constraint

- **WHEN** a number field has `validation.minimum: 0` and the user enters `-1` then blurs
- **THEN** an error message SHALL appear below the field: "Value must be at least 0"

#### Scenario: Value violates pattern constraint

- **WHEN** a string field has `validation.pattern` and the user enters a non-matching value then blurs
- **THEN** an error message SHALL appear below the field indicating the expected format

#### Scenario: Save blocked by validation errors

- **WHEN** the user attempts to save with one or more validation errors
- **THEN** the save SHALL be blocked and the first error field SHALL be scrolled into view
