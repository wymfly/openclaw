# frontend-config-hifi-redesign Specification

## Purpose

Defines the high-fidelity, contract-backed Config redesign for Deck BFF config snapshots, schema lookup, raw JSON apply, structured field editing, base-hash conflict recovery, mock/local visual verification, and design-system rollout evidence.

## Requirements

### Requirement: Config handoff package defines the visual contract

The config module SHALL have a complete handoff package under `deck-go/frontend-handoff/modules/config/` before the production UI rewrite is marked complete. The package SHALL use the Deck-facing config wrappers, `/api/config*` BFF routes, `DeckGoConfig*` DTOs, and hash/baseHash apply semantics as the source truth.

#### Scenario: Handoff package is reviewed

- **WHEN** the config handoff package is created
- **THEN** it SHALL include `README.md`, `prototype.html`, `components.md`, `states.md`, `interactions.md`, and `api-usage.md`
- **AND** the package SHALL document config snapshot loading, raw JSON editing, dirty state, reset, diff preview, apply, base-hash conflict recovery, schema section navigation, schema lookup, structured field editing, sensitive-field masking, JSON draft apply/reset, selected-section payload, lookup payload, loading/error/empty states, and mock visual states
- **AND** unsupported or uncertain schema authoring, schema migration generation, history/version restore, config import/export, secret vault integration, collaborative editing, and production rollback semantics SHALL be documented as follow-up rather than silently fabricated in the UI

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

### Requirement: Config UI aligns with the settled frontend design system

The config panel SHALL use the current settled frontend design-system posture: Inter/JetBrains Mono typography, `--ds-*` tokens, compact workbench density, low-radius surfaces, clear focus states, and local molecules only when canonical atoms or patterns are not yet justified.

#### Scenario: Config UI is rendered

- **WHEN** the config panel is rendered with contract-shaped mock/local data
- **THEN** the first viewport SHALL expose config metrics, raw editor safety controls, schema navigation, selected schema evidence, structured field editing, diff/conflict surfaces when active, and payload disclosures without overlapping text or nested decorative cards
- **AND** long config paths, hash values, schema hints, JSON values, error messages, and raw payload labels SHALL wrap or truncate in stable constrained regions without shifting the layout

### Requirement: Config mock visual verification is available

The config rewrite SHALL include focused mock/local visual verification that exercises the real frontend against contract-shaped config data without requiring a real Gateway config file, real production config mutation, LLM, secret vault, schema migration, or rollback assurance.

#### Scenario: Mock visual E2E runs

- **WHEN** the config mock/local visual E2E is executed
- **THEN** it SHALL load config and schema lookup through the normal frontend API path
- **AND** it SHALL capture or assert the ready workspace state and at least one interaction state such as schema lookup, structured field edit, diff preview, apply success, conflict preview, sensitive reveal, or raw payload expansion
- **AND** closeout evidence SHALL label the test as mock/local visual coverage, not real Gateway/LLM, production config mutation, secret vault, schema migration, or rollback assurance
