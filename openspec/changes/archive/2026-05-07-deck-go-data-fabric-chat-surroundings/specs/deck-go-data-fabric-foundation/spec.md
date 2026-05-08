## ADDED Requirements

### Requirement: Foundation SHALL support Chat surrounding server-state boundaries

The Data Fabric foundation SHALL support Chat surrounding read models and
invalidation without requiring transcript streams to move into query cache.

#### Scenario: Stream-owned renderers keep specialized reducers

- **WHEN** Chat transcript or canvas stream renderers are inspected
- **THEN** they SHALL be allowed to keep specialized reducer/store logic for
  streaming bytes and local projection state
- **AND** Data Fabric SHALL own only the authoritative snapshot, list,
  discovery, mutation, and invalidation boundaries introduced by scoped changes

#### Scenario: Chat modules reuse existing foundation primitives

- **WHEN** Chat and command Data Fabric modules are implemented
- **THEN** they SHALL reuse the foundation query client, freshness presets,
  transport wrappers, error normalization, test provider, and conservative
  mutation defaults
- **AND** they SHALL NOT add a second server-state framework
