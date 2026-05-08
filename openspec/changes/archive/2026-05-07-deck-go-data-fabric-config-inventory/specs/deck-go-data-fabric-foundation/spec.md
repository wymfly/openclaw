## ADDED Requirements

### Requirement: Data Fabric module migrations SHALL support config and inventory breadth

The Data Fabric foundation SHALL support repeated config/inventory module
migrations without adding a second server-state framework or broad module
special cases.

#### Scenario: Config and inventory modules reuse foundation primitives

- **WHEN** scoped config/inventory modules are implemented
- **THEN** they SHALL reuse the foundation query client, freshness presets,
  transport wrappers, error normalization, test provider, and conservative
  mutation defaults
- **AND** they SHALL only add module-local keys, hooks, mutations, and projection
  policies

#### Scenario: Cross-module reads are shared intentionally

- **WHEN** multiple scoped modules need the same server-state source such as
  channel inventory or configured models
- **THEN** they MAY reuse a single Data Fabric query source
- **AND** the shared key/invalidation owner SHALL be explicit in the module
  boundary
