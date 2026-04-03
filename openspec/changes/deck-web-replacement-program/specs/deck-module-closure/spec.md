## ADDED Requirements

### Requirement: Each Deck module SHALL satisfy a shared closure checklist before being considered replacement-ready

Deck modules SHALL NOT be considered complete merely because a page exists or an action can be triggered. Each module SHALL satisfy a shared closure checklist.

#### Scenario: Module defines authoritative sources

- **WHEN** a Deck module is prepared for replacement work
- **THEN** it SHALL document its authoritative Gateway or Deck contracts, hydration path, runtime sync path, and recovery path

#### Scenario: Module proves history and live consistency

- **WHEN** a module supports entities that can be viewed historically and updated live
- **THEN** the module SHALL define how identical server state yields identical UI state in both historical and live views

#### Scenario: Module adopts shared interaction quality

- **WHEN** a module reaches replacement-ready status
- **THEN** it SHALL use the program's shared loading, error, empty, permission, and mutation feedback patterns

### Requirement: Runtime-critical modules SHALL be prioritized ahead of peripheral modules

Deck replacement work SHALL prioritize modules with the highest runtime state complexity and trust requirements ahead of peripheral management pages.

#### Scenario: Runtime core is scheduled before peripheral automation

- **WHEN** the program sequences implementation phases
- **THEN** `chat`, `approval`, `canvas / A2UI`, `sessions / logs`, and other runtime-core modules SHALL be scheduled before lower-risk peripheral modules

#### Scenario: Peripheral modules depend on platform completion

- **WHEN** a peripheral module depends on shared platform state, transport, or UI primitives
- **THEN** it SHALL wait for the relevant platform track to stabilize before being marked ready for large-scale implementation
