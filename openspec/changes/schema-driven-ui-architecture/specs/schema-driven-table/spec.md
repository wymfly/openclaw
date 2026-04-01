## ADDED Requirements

### Requirement: DataTable renders columns from result schema

The system SHALL provide a `DataTable` component built on TanStack Table that auto-generates `ColumnDef[]` from a result JSON Schema's top-level properties.

#### Scenario: Flat object array

- **WHEN** `DataTable` receives data `[{id, name, status}]` and result schema defining `{ id: string, name: string, status: string }`
- **THEN** the table renders three columns with headers derived from property names (or schema `title` if present), with sortable headers

#### Scenario: Nested property display

- **WHEN** a result schema property is an object (e.g., `skills: { effective: [...] }`)
- **THEN** the column renders a summary (e.g., count badge "3 skills") instead of `[object Object]`

#### Scenario: Column type inference

- **WHEN** a property has `type: "boolean"`
- **THEN** the column renders a check/cross icon instead of "true"/"false" text
- **WHEN** a property has `type: "number"` or `type: "integer"`
- **THEN** the column right-aligns the value

### Requirement: DataTable supports column visibility and ordering

The system SHALL allow consumers to specify which columns to show, hide, or reorder via a `columns` prop that overrides auto-generation.

#### Scenario: Column selection

- **WHEN** `columns={["name", "status"]}` is specified on a schema with 5 properties
- **THEN** only the `name` and `status` columns are visible

### Requirement: ResultView auto-selects display mode

The system SHALL provide a `ResultView` component that chooses between DataTable (for arrays), detail card (for single objects), or raw JSON viewer (for unknown shapes) based on the result schema type.

#### Scenario: Array result

- **WHEN** the result schema has `type: "array"` with `items: { type: "object" }`
- **THEN** `ResultView` renders a `DataTable`

#### Scenario: Single object result

- **WHEN** the result schema has `type: "object"` (not wrapped in array)
- **THEN** `ResultView` renders a key-value detail card

#### Scenario: Unknown or missing schema

- **WHEN** no result schema is available for the method
- **THEN** `ResultView` renders a collapsible JSON tree viewer
