## ADDED Requirements

### Requirement: Data Fabric reference modules SHALL use a repeatable module shape

Data Fabric module migrations SHALL expose query keys, query option factories or
hooks, mutation wrappers, and live projection mapping from a module-local
directory under `frontend-new/src/data/modules/<module>/`.

#### Scenario: Agents establishes reference module shape

- **WHEN** the Agents reference migration is implemented
- **THEN** it SHALL place Agents query keys, read hooks/options, mutation
  wrappers, and projection invalidation policy under
  `frontend-new/src/data/modules/agents/`
- **AND** later modules SHALL be able to copy that shape without adding a second
  server-state framework

#### Scenario: Module hooks use foundation defaults

- **WHEN** an Agents Data Fabric hook or mutation is inspected
- **THEN** it SHALL use the foundation query client, freshness presets,
  conservative mutation defaults, and test provider support
- **AND** it SHALL NOT enable deferred hardening features unless a later
  OpenSpec change explicitly adds them
