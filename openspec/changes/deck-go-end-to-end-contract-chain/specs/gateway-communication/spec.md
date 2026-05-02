## ADDED Requirements

### Requirement: Deck Go Gateway adapters use source-generated protocol types

Deck Go SHALL use generated Gateway protocol request, result, and event types at the Gateway adapter boundary for every consumed Gateway method or event that has an upstream schema.

#### Scenario: Gateway method has an upstream schema

- **WHEN** Deck Go calls a Gateway method with generated protocol bindings
- **THEN** the call SHALL use the generated Gateway typed client or generated protocol DTOs at the adapter boundary

#### Scenario: Gateway event has an upstream schema

- **WHEN** Deck Go subscribes to or adapts a Gateway event with a generated event payload type
- **THEN** the event payload SHALL be decoded into the generated Gateway event type before it is adapted into a Deck-facing event

#### Scenario: Adapter converts to Deck-facing shape

- **WHEN** a Gateway result is exposed through a Deck Go BFF endpoint
- **THEN** the adapter SHALL convert the generated Gateway result into a generated Deck-facing DTO unless the endpoint is a documented raw passthrough exception

### Requirement: Gateway adapter exceptions are bounded

Deck Go SHALL allow untyped Gateway adapter calls only for methods or events that lack usable upstream schemas or are intentionally dynamic.

#### Scenario: Untyped adapter call is present

- **WHEN** `make gateway-typecheck` finds an untyped Gateway call in Deck Go adapter code
- **THEN** the call SHALL have a documented exception with method name, reason, owner, and exit criteria

#### Scenario: Upstream schema becomes available

- **WHEN** an upstream schema is added for a previously untyped Gateway method consumed by Deck Go
- **THEN** the corresponding exception SHALL be removed and the adapter SHALL migrate to generated protocol types
