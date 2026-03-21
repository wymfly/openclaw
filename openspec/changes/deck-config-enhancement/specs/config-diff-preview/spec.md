## ADDED Requirements

### Requirement: Diff preview dialog before save

The Config panel SHALL show a diff preview dialog when the user clicks Save, displaying all changes between the current saved config and the edited config.

#### Scenario: User saves with changes in one section

- **WHEN** the user has modified fields in the "models" section and clicks Save
- **THEN** a dialog SHALL appear showing the changed fields with old → new values, grouped by section

#### Scenario: User saves with changes across multiple sections

- **WHEN** the user has modified fields in "gateway" and "channels" sections and clicks Save
- **THEN** the dialog SHALL show changes grouped by section, with each section collapsible

#### Scenario: User confirms save from diff preview

- **WHEN** the user reviews the diff preview and clicks "Confirm"
- **THEN** the config SHALL be saved using the appropriate write strategy

#### Scenario: User cancels save from diff preview

- **WHEN** the user reviews the diff preview and clicks "Cancel"
- **THEN** the dialog SHALL close and no save SHALL occur; edited values SHALL be preserved

### Requirement: Diff preview shows structured field-level changes

The diff preview SHALL display changes at the field level (not raw text diff), showing the field path, old value, and new value with visual indicators.

#### Scenario: Scalar field changed

- **WHEN** `gateway.port` changed from `18789` to `18790`
- **THEN** the diff SHALL show the field path, old value (red/strikethrough), and new value (green)

#### Scenario: Array field changed

- **WHEN** an array item was added, removed, or reordered
- **THEN** the diff SHALL show the array path with individual item-level add/remove/move indicators

#### Scenario: New field added

- **WHEN** a field that had no value now has a value
- **THEN** the diff SHALL show the field as "added" with only the new value (green)

#### Scenario: Field removed (set to default/empty)

- **WHEN** a field value was cleared or reset to default
- **THEN** the diff SHALL show the field as "removed" with only the old value (red/strikethrough)

### Requirement: Diff preview can be dismissed for session

The Config panel SHALL allow users to skip the diff preview for the remainder of the session.

#### Scenario: User opts out of diff preview

- **WHEN** the user checks "Don't show again this session" in the diff preview dialog and confirms
- **THEN** subsequent saves in the same session SHALL skip the diff preview and save directly

#### Scenario: Session reset restores diff preview

- **WHEN** the user reloads the page (new session)
- **THEN** the diff preview SHALL be shown again on save (opt-out is not persisted)

### Requirement: Single-field change uses inline confirmation

The Config panel SHALL use a lightweight inline confirmation (not the full dialog) when only one field has changed.

#### Scenario: Single field change save

- **WHEN** the user has changed exactly one field and clicks Save
- **THEN** an inline toast or compact confirmation SHALL appear near the Save button showing `"fieldName: oldValue → newValue"` with Confirm/Cancel
