## ADDED Requirements

### Requirement: Deck replacement work SHALL be organized around shared platform tracks

The Deck replacement program SHALL organize future work into shared platform tracks instead of treating each panel as an isolated implementation effort.

#### Scenario: New Deck change declares its track

- **WHEN** a new Deck change is proposed
- **THEN** it SHALL be mapped to one of `Core Platform`, `Session Runtime`, `UI Framework`, `Domain Modules`, or `Replacement Validation`

#### Scenario: Shared dependency is promoted before downstream modules

- **WHEN** multiple Deck modules depend on the same transport, projection, or UI infrastructure
- **THEN** that dependency SHALL be scheduled in a platform track before downstream modules are considered replacement-ready

### Requirement: Business semantics, browser adaptation, and UI projection SHALL have explicit boundaries

Deck SHALL explicitly separate Gateway business semantics, Deck browser adaptation, and client-facing projection state.

#### Scenario: Shared business semantics become Gateway methods

- **WHEN** a capability introduces shared business semantics used by multiple modules
- **THEN** the primary contract SHALL live in a typed Gateway method or Gateway-owned schema contract

#### Scenario: Browser-specific concerns stay in Deck routes

- **WHEN** a concern exists only because the browser cannot directly or safely consume the Gateway surface
- **THEN** the concern SHALL be implemented in Deck routes or Deck transport infrastructure instead of polluting module components

#### Scenario: Recovery-specific UI state stays in projection

- **WHEN** state exists to restore or reconcile UI behavior across refresh, reconnect, or history replay
- **THEN** that state SHALL be modeled as Deck projection state instead of being left in local component or iframe memory

### Requirement: Shared transport and state models SHALL be reusable across modules

Deck replacement work SHALL converge on reusable transport, stream, replay, projection, and mutation patterns instead of per-module variants.

#### Scenario: Module uses shared transport stack

- **WHEN** a Deck module performs Gateway-backed reads, mutations, or realtime sync
- **THEN** it SHALL use the shared typed transport and stream infrastructure chosen by the program

#### Scenario: Module uses shared recovery model

- **WHEN** a Deck module needs cold-start hydrate plus live updates
- **THEN** it SHALL define its flow in terms of snapshot, stream, replay, and projection rather than module-specific ad hoc recovery behavior
