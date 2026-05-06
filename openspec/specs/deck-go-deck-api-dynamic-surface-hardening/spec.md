# deck-go-deck-api-dynamic-surface-hardening Specification

## Purpose

TBD - created by archiving change deck-go-deck-api-dynamic-surface-hardening. Update Purpose after archive.

## Requirements

### Requirement: Deck API dynamic leaves are classified

Deck Go SHALL classify every remaining dynamic leaf in the Deck-facing API contract as either an intentional dynamic envelope or a deferred product DTO gap.

#### Scenario: New dynamic leaf is introduced

- **WHEN** `deck-go/contracts/source/deck-api.contract.ts` introduces a new `unknown`, `Record<string, unknown>`, or index-signature leaf
- **THEN** the contract governance check SHALL require a classification record with owner, reason, and exit criteria

#### Scenario: Dynamic leaf is intentional

- **WHEN** a dynamic leaf carries Gateway schemas, plugin payloads, config fragments, extension data, action-specific payloads, or canvas results
- **THEN** the generated report SHALL document the leaf as an intentional envelope rather than a missing stable DTO

### Requirement: Stable product DTO gaps are narrowed

Deck Go SHALL narrow dynamic Deck-facing fields to named DTO fields when the stable product shape is clear from code truth.

#### Scenario: Stable field shape is deterministic

- **WHEN** backend adapters, frontend usage, generated Gateway bindings, and tests consistently depend on named fields inside a dynamic leaf
- **THEN** the source contract SHALL define those named fields and regenerated TS/Go artifacts SHALL expose them

#### Scenario: Stable field shape is not yet deterministic

- **WHEN** a dynamic leaf depends on unresolved product decisions, Gateway evolution, or module-specific action schemas
- **THEN** the leaf SHALL remain dynamic only with explicit deferred ownership and exit criteria

### Requirement: Deck API generated artifacts stay synchronized

Deck Go SHALL keep Deck-facing contract source, generated artifacts, frontend facades, and governance reports synchronized after dynamic-surface changes.

#### Scenario: Contract gate runs after hardening

- **WHEN** deck-go contract verification runs
- **THEN** Deck API generated TS/Go artifacts, dynamic-surface report, contract inventory, and head matrix SHALL be synchronized

#### Scenario: Frontend facade exposes a route

- **WHEN** `frontend-new/src/api.ts` wraps a route with a generated Deck API DTO
- **THEN** the wrapper SHALL use the named generated DTO type unless the route is classified as intentionally dynamic
