## MODIFIED Requirements

### Requirement: Config production panel follows Deck BFF config workflows

The production config panel SHALL render and operate from contract-backed Deck config data while preserving the existing panel registry and API facade boundaries. The production implementation SHALL treat the v2 handoff as the visual target, but it SHALL follow route/method code truth, keep real writes base-hash gated, and record audit/history/scaffold/import/export/rollback/schema-batch assumptions unless they are verified against a Deck-facing contract.

#### Scenario: Config snapshot and schema are loaded

- **WHEN** `fetchDeckConfig` and `postConfigSchemaLookup` resolve with contract-shaped data
- **THEN** the panel SHALL show load state, top-level key count, schema section count, selected schema path, current hash/baseHash, dirty state, raw JSON, schema sections, selected section payload, structured child fields, and lookup payload evidence
- **AND** missing optional fields such as raw config, config object, hash/baseHash, schema, hints, children, or child hints SHALL render as unavailable evidence or empty states rather than fabricated values
- **AND** the documented Gateway method chain SHALL use `config.get`, `config.apply`, and `config.schema.lookup`

#### Scenario: Raw config apply is used

- **WHEN** an operator edits raw JSON and chooses apply
- **THEN** the panel SHALL validate that raw JSON is an object, show a diff preview before applying, and call `applyDeckConfig` with the current raw text and current base hash
- **AND** a successful apply SHALL refresh the visible raw text, loaded baseline, dirty state, hash, and action result
- **AND** invalid raw JSON SHALL block the apply and show validation copy
- **AND** production SHALL NOT use direct Gateway calls or non-existent `gateway.config.snapshot/apply/lookup` wrapper names

#### Scenario: Config conflict recovery is used

- **WHEN** an apply fails with a config-changed or base-hash conflict
- **THEN** the panel SHALL fetch the latest config, compute a remote-vs-local diff preview, show the latest hash, and offer reload latest and retry with latest hash actions
- **AND** retry SHALL continue to call the existing apply wrapper without inventing a new endpoint

#### Scenario: Structured field editing is used

- **WHEN** an operator edits boolean, string, number, enum, or JSON structured fields
- **THEN** the panel SHALL update the raw config draft through the existing local path-writing helpers
- **AND** sensitive fields SHALL remain masked until the operator toggles visibility
- **AND** JSON field apply/reset SHALL stay local to the raw draft until the operator applies the full config

#### Scenario: Prototype-only config workflows are reviewed

- **WHEN** the handoff package references durable apply history, schema lookup batching, config scaffold, import/export, rollback/version restore, secret vault integration, or form-library adoption
- **THEN** production SHALL keep those workflows out of guaranteed active behavior unless a matching Deck-facing contract or verified BFF endpoint exists
- **AND** unresolved workflow assumptions SHALL be recorded in `deck-go/frontend-handoff/modules/config/implementation-notes.md`
