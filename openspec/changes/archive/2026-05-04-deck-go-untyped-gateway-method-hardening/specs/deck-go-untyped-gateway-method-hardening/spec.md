## ADDED Requirements

### Requirement: Documented P0 untyped Gateway methods are hardened

deck-go SHALL harden the documented P0 untyped Gateway methods used by control surfaces into generated contracts or typed envelopes.

#### Scenario: Existing schemas are wired into metadata

- **WHEN** a documented P0 method already has params and result schemas
- **THEN** the implementation SHALL wire those schemas into Gateway method metadata and regenerate deck-go Gateway artifacts

#### Scenario: Dynamic payload requires an envelope

- **WHEN** a documented P0 method has action-specific or request-specific dynamic payload content
- **THEN** the implementation SHALL expose a typed outer envelope and leave only the inner payload dynamic

### Requirement: Resolved untyped exceptions are removed

deck-go SHALL remove exception records for P0 methods after the method has generated contract coverage.

#### Scenario: Method becomes schema-backed

- **WHEN** a documented P0 untyped method has params/result coverage in generated Gateway artifacts
- **THEN** its `untyped-gateway-method` exception SHALL be removed from `deck-go/contracts/source/deck-exceptions.contract.json`

### Requirement: Completeness evidence is refreshed

deck-go SHALL refresh generated Gateway protocol artifacts and describe completeness evidence after hardening methods.

#### Scenario: Contract gate runs after hardening

- **WHEN** deck-go contract verification runs
- **THEN** generated TS/Go Gateway artifacts, exception docs, gateway typecheck, and describe completeness reports SHALL be synchronized

#### Scenario: Runtime describe test runs after hardening

- **WHEN** focused Gateway describe tests run
- **THEN** runtime `gateway.describe` SHALL expose the newly hardened methods through typed metadata rather than the untyped list
