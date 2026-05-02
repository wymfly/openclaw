## ADDED Requirements

### Requirement: Deck Go-consumed Gateway methods have schemas or exceptions

Every Gateway method consumed by Deck Go SHALL either have generated upstream request/result schemas or be listed as a documented schema exception.

#### Scenario: New Gateway method is consumed by Deck Go

- **WHEN** Deck Go adds a caller for a Gateway method
- **THEN** the method SHALL appear in the generated Gateway protocol artifacts or in the schema exception registry before the caller is accepted

#### Scenario: Consumed method lacks result schema

- **WHEN** a consumed Gateway method lacks a result schema
- **THEN** the exception SHALL identify the upstream schema gap and the Deck Go call sites that depend on it

#### Scenario: Schema gap is closed

- **WHEN** the upstream result schema is added for an exception method
- **THEN** the Deck Go generated Gateway artifacts SHALL include the method result and the exception SHALL be removed

### Requirement: Gateway event payload schemas are tracked

Gateway events consumed by Deck Go SHALL have generated payload types or documented payload exceptions.

#### Scenario: New Gateway event is consumed

- **WHEN** Deck Go starts consuming a Gateway event
- **THEN** the event payload SHALL be generated from Gateway source metadata or recorded as a payload exception

#### Scenario: Event payload exception remains

- **WHEN** an event payload remains dynamic
- **THEN** the exception SHALL describe which fields are known, which fields are unknown, and which frontend or BFF behavior depends on the event
