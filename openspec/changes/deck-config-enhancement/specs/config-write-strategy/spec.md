## ADDED Requirements

### Requirement: Write strategy selects between patch and apply

The config store SHALL analyze the nature of config changes and select the optimal RPC method: `config.patch` for incremental changes or `config.apply` for structural changes.

#### Scenario: Scalar field updated

- **WHEN** the user changes a single scalar value (string, number, boolean) and saves
- **THEN** the store SHALL use `config.patch` with a JSON Merge Patch containing only the changed path

#### Scenario: Object property added

- **WHEN** the user adds a new property to an object (via record editor or nested form) and saves
- **THEN** the store SHALL use `config.patch` with the new property in the merge patch

#### Scenario: Array item deleted

- **WHEN** the user removes an item from an array and saves
- **THEN** the store SHALL use `config.apply` with the full config (because JSON Merge Patch cannot express array element deletion)

#### Scenario: Array items reordered

- **WHEN** the user reorders items in an array and saves
- **THEN** the store SHALL use `config.apply` with the full config

#### Scenario: Mixed scalar and array changes

- **WHEN** the user has both scalar changes and array mutations pending
- **THEN** the store SHALL use `config.apply` for the entire save (safe fallback)

### Requirement: Patch failure falls back to apply

The config store SHALL automatically retry with `config.apply` if `config.patch` returns an error.

#### Scenario: Patch RPC returns error

- **WHEN** `config.patch` returns an error response (non-success status)
- **THEN** the store SHALL immediately retry the same save using `config.apply` with the full config
- **AND** the retry SHALL be transparent to the user (no extra confirmation)

#### Scenario: Patch RPC succeeds

- **WHEN** `config.patch` returns a success response with new config and baseHash
- **THEN** the store SHALL update `rawConfig` and `baseHash` from the response, matching the existing apply flow

### Requirement: Write strategy preserves baseHash conflict detection

The config store SHALL include `baseHash` in both patch and apply requests to maintain optimistic concurrency.

#### Scenario: Concurrent edit detected via patch

- **WHEN** `config.patch` returns a conflict error (baseHash mismatch)
- **THEN** the store SHALL show the existing ConflictDialog (same as apply conflict flow)

#### Scenario: Successful save updates baseHash

- **WHEN** any save (patch or apply) succeeds
- **THEN** the store SHALL update `baseHash` from the response to prevent stale conflict on next save

### Requirement: Change type detection classifies mutations

The config store SHALL provide a `classifyChanges(oldConfig, newConfig)` function that returns the change type: `"patch-safe"` (only scalar/object property changes) or `"apply-required"` (array mutations or mixed).

#### Scenario: Only scalar properties changed

- **WHEN** the diff between old and new config contains only added, changed, or removed scalar properties within objects
- **THEN** `classifyChanges` SHALL return `"patch-safe"`

#### Scenario: Array length changed

- **WHEN** the diff between old and new config includes any array where the length differs
- **THEN** `classifyChanges` SHALL return `"apply-required"`

#### Scenario: Array element order changed

- **WHEN** the diff between old and new config includes any array where elements are the same but in different order
- **THEN** `classifyChanges` SHALL return `"apply-required"`

#### Scenario: No changes detected

- **WHEN** old and new config are deeply equal
- **THEN** `classifyChanges` SHALL return `"patch-safe"` (patch with empty body is a no-op)
