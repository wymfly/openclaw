## ADDED Requirements

### Requirement: Data Fabric module migrations SHALL support live workbench breadth

The Data Fabric foundation SHALL support live and historical workbench module
migrations without adding a second server-state framework or broad module
special cases.

#### Scenario: Live workbench modules reuse foundation primitives

- **WHEN** scoped live workbench modules are implemented
- **THEN** they SHALL reuse the foundation query client, freshness presets,
  transport wrappers, error normalization, test provider, and conservative
  mutation defaults
- **AND** they SHALL only add module-local keys, hooks, mutations, and projection
  policies

#### Scenario: Stream-owned renderers remain specialized

- **WHEN** a panel has existing stream-owned rendering such as log tail or chat
  transcript rendering
- **THEN** Data Fabric SHALL migrate the authoritative refresh/read-model
  boundary without forcing stream bytes into query cache unless a separate
  proposal proves the reducer and rollback behavior
