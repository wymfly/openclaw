## ADDED Requirements

### Requirement: Contract coverage report is produced

Deck Go SHALL produce a contract coverage report that summarizes Gateway protocol coverage, Deck-facing API DTO coverage, UI metadata coverage, and documented exceptions.

#### Scenario: Coverage report is generated

- **WHEN** the contract coverage command runs
- **THEN** it SHALL report counts for Gateway methods consumed through generated types, Deck-facing endpoints with generated DTOs, frontend DTO definitions still local to `api.ts`, UI metadata-covered DTOs or actions, and active exceptions

#### Scenario: Coverage report identifies gaps

- **WHEN** an endpoint or DTO is not covered by the expected contract source
- **THEN** the report SHALL identify the owning module and the missing contract layer

### Requirement: Exceptions are explicit and actionable

Every untyped Gateway method, dynamic Deck-facing payload, raw passthrough, or temporary frontend DTO shim SHALL be recorded as an exception with a reason and exit criteria.

#### Scenario: Untyped Gateway method remains

- **WHEN** Deck Go consumes a Gateway method that lacks an upstream result schema
- **THEN** the exception registry SHALL record the method, call site, reason, owner, and condition that allows removal of the exception

#### Scenario: Dynamic payload remains

- **WHEN** a Deck-facing contract uses `unknown`, `Record<string, unknown>`, `map[string]any`, or equivalent dynamic leaves
- **THEN** the contract or exception registry SHALL explain why the payload cannot currently be made stricter

#### Scenario: Temporary shim expires

- **WHEN** a migration shim is added for compatibility
- **THEN** it SHALL include an owner and removal condition so it cannot become permanent by omission

### Requirement: Governance checks prevent regressions

Deck Go SHALL provide checks that fail on new duplicate DTO authority, missing generated artifacts, unclassified endpoints, stale UI metadata, or new untyped Gateway calls without exceptions.

#### Scenario: New frontend-local DTO is added

- **WHEN** a developer adds a new exported `DeckGo*` DTO outside generated contract artifacts
- **THEN** the governance check SHALL fail unless the DTO is explicitly marked as a temporary migration shim

#### Scenario: Endpoint lacks classification

- **WHEN** a new browser-facing endpoint is added without an endpoint classification
- **THEN** the governance check SHALL fail

#### Scenario: New untyped Gateway call is added

- **WHEN** a new string-based Gateway call bypasses generated Gateway protocol bindings
- **THEN** the Gateway typecheck SHALL fail unless a documented exception exists

### Requirement: Gates can tighten incrementally

Contract governance SHALL support a reporting phase and a blocking phase so migration can proceed without breaking unrelated work.

#### Scenario: Reporting phase runs

- **WHEN** a module has not yet been migrated
- **THEN** governance tools SHALL report its gaps without blocking implementation unless the module is marked as migrated

#### Scenario: Blocking phase runs

- **WHEN** a module is marked as migrated
- **THEN** duplicate DTOs, stale metadata, and missing generated DTO usage in that module SHALL block verification
