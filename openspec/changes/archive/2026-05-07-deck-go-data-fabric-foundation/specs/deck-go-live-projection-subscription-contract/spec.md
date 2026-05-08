## ADDED Requirements

### Requirement: Data Fabric SHALL consume live projection metadata for invalidation

Data Fabric SHALL use existing live projection metadata as an advisory invalidation and gap-recovery source for server-state queries.

#### Scenario: Projection event is received

- **WHEN** a Data Fabric live invalidation bridge receives a known projection event
- **THEN** it SHALL invalidate or mark stale the matching authoritative query keys according to the module policy
- **AND** it SHALL preserve cached data while the authoritative read model refreshes

#### Scenario: Projection gap is received

- **WHEN** a subscribed projection receives `projection.gap`
- **THEN** Data Fabric SHALL mark the projection stale
- **AND** if the projection contract has `gapPolicy` set to `refresh`, Data Fabric SHALL refresh the authoritative read model through the projection's configured refresh behavior

### Requirement: Data Fabric SHALL NOT require nonexistent projection patch fields

Data Fabric SHALL NOT depend on generated `patchStrategy` or `patchKeys` fields until a separate contract proposal adds those fields to `contracts/source/deck-live-projections.contract.json` and updates the generator.

#### Scenario: Foundation live projection handling is implemented

- **WHEN** the foundation change integrates live projection metadata
- **THEN** it SHALL use current fields such as projection id, stream, events, refresh endpoints, stale threshold, gap policy, and cursor storage key
- **AND** it SHALL NOT require generated `patchStrategy` or `patchKeys` metadata to compile or run
