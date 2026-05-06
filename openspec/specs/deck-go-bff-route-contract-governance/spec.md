# deck-go-bff-route-contract-governance Specification

## Purpose

Define the Deck Go route-level governance contract that keeps registered Go BFF routes tied to endpoint classification, product ownership, contract authority, active frontend facades, and verification evidence.

## Requirements

### Requirement: BFF routes are governed by route contract metadata

Deck Go SHALL maintain route-level contract metadata for every registered product BFF route.

#### Scenario: New route is registered

- **WHEN** a Go server route is registered under `deck-go/backend/internal/server/`
- **THEN** contract governance SHALL require route metadata that names its owner, route category, contract authority, frontend facade or intentional non-frontend rationale, and evidence

#### Scenario: Route metadata is incomplete

- **WHEN** a route metadata record omits owner, contract authority, frontend facade, mock evidence, or real evidence/deferred rationale
- **THEN** the route governance check SHALL fail with the missing field

### Requirement: Route metadata is checked against Go registrations

Deck Go SHALL compare route governance metadata against the actual Go route registrations.

#### Scenario: Registered route is missing from governance source

- **WHEN** the route scanner finds a registered method/path that is not covered by route governance metadata
- **THEN** the generated check SHALL fail and report the missing route with file and line evidence

#### Scenario: Governance source references a stale route

- **WHEN** route governance metadata references a method/path that is no longer registered and is not explicitly marked as retired or gateway-transport-only
- **THEN** the generated check SHALL fail and report the stale route

### Requirement: Frontend facade truth uses frontend-new

Deck Go SHALL tie frontend-consumed BFF routes to the active `frontend-new` facade, not legacy frontend paths.

#### Scenario: Frontend facade route is governed

- **WHEN** a route is consumed by the active frontend
- **THEN** route metadata SHALL reference `deck-go/frontend-new/src/api.ts` or a more specific active frontend facade file

#### Scenario: Route is intentionally not frontend facade backed

- **WHEN** a route is SSE, binary/static, callback, retired, or transport-only
- **THEN** route metadata SHALL record an explicit non-frontend rationale instead of a legacy frontend reference

### Requirement: Route governance evidence stays synchronized

Deck Go SHALL keep route governance source, generated report, endpoint classification, contract inventory, and head matrix evidence synchronized.

#### Scenario: Contract gate runs

- **WHEN** `cd deck-go && make contract-gate` runs
- **THEN** route governance report/check, endpoint classification, contract inventory, and head matrix SHALL be synchronized
