## ADDED Requirements

### Requirement: Foundation SHALL provide Data Fabric governance support

The Data Fabric foundation SHALL support a narrow governance mechanism for
tracking and testing remaining intentional exceptions.

#### Scenario: Governance registry is available to tests and documentation

- **WHEN** the governance sweep is implemented
- **THEN** the Data Fabric layer SHALL expose or document an exception registry
  for residual raw server-state or stream patterns
- **AND** the registry SHALL be usable by focused tests without introducing a
  custom lint dependency

#### Scenario: Governance does not add deferred hardening features

- **WHEN** governance support is inspected
- **THEN** it SHALL NOT enable automatic mutation retry, offline mutation
  queueing, IndexedDB query persistence, DevTools, custom lint, or generated
  projection patch fields
