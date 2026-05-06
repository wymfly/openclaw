## ADDED Requirements

### Requirement: Gateway describe completeness report

deck-go SHALL maintain a Gateway describe/schema completeness report that compares static Gateway metadata with runtime `gateway.describe` evidence.

#### Scenario: Static and runtime methods are compared

- **WHEN** the completeness report is generated
- **THEN** it SHALL compare static known Gateway methods with runtime `gateway.describe` methods plus untyped methods and report missing or extra method names

#### Scenario: Static and runtime events are compared

- **WHEN** the completeness report is generated
- **THEN** it SHALL compare static known Gateway events with runtime `gateway.describe` events and report missing or extra event names

### Requirement: Schema coverage dimensions are separated

deck-go SHALL distinguish method presence, typed membership, params schema coverage, result schema coverage, and event payload coverage.

#### Scenario: Method has partial schema metadata

- **WHEN** a Gateway method has params metadata but no result schema, or result metadata but no params schema
- **THEN** the completeness report SHALL record the missing dimension instead of treating typed membership as complete schema coverage

#### Scenario: Event lacks payload schema

- **WHEN** a Gateway event lacks a payload schema
- **THEN** the completeness report SHALL record the event as missing payload schema coverage

### Requirement: Dynamic surfaces require documented exceptions

deck-go SHALL allow dynamic Gateway surfaces only when they are documented in the deck-go exception contract or explicitly out of scope for this proposal.

#### Scenario: Method lacks complete schema coverage

- **WHEN** a Gateway method lacks complete params/result schema coverage and deck-go uses or exposes it as part of the control surface
- **THEN** the completeness gate SHALL require a matching exception record or fail with actionable evidence

#### Scenario: Known dynamic method remains unresolved

- **WHEN** a known dynamic method is documented as an exception
- **THEN** the completeness gate SHALL keep the method usable and SHALL surface it as a follow-up item for method hardening

### Requirement: Completeness gates are verifiable

deck-go SHALL include focused verification for Gateway describe/schema completeness.

#### Scenario: Contract gate runs

- **WHEN** deck-go contract verification runs
- **THEN** it SHALL check that the generated completeness report is synchronized with source metadata and documented exceptions

#### Scenario: Runtime describe test runs

- **WHEN** focused Gateway tests run
- **THEN** they SHALL verify that runtime `gateway.describe` output aligns with static metadata for method names, event names, typed membership, and untyped membership
