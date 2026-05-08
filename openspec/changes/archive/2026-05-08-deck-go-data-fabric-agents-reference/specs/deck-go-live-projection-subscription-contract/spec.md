## ADDED Requirements

### Requirement: Agent-status projection SHALL map to Agents Data Fabric invalidation

The `agent-status` live projection SHALL have an explicit Data Fabric
invalidation policy for the Agents reference module based on the existing live
projection contract metadata.

#### Scenario: Agent-status event maps to Agents keys

- **WHEN** Data Fabric handles an `agent-status` event listed in the live
  projection contract
- **THEN** it SHALL invalidate or mark stale the Agents list/detail/status keys
  selected by the Agents module policy
- **AND** it SHALL preserve cached data while the refresh is in flight

#### Scenario: Agent-status gap uses refresh policy

- **WHEN** Data Fabric handles a `projection.gap` for `agent-status`
- **THEN** it SHALL follow the current contract `gapPolicy` and refresh the
  authoritative Agents read model
- **AND** it SHALL NOT require generated `patchStrategy` or `patchKeys` fields
