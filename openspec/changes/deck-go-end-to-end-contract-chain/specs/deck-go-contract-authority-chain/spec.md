## ADDED Requirements

### Requirement: Contract authority order is explicit

Deck Go SHALL define a contract authority order in which Gateway protocol shapes come from OpenClaw Gateway source schemas, Deck-facing BFF shapes come from `deck-go/contracts/source/`, generated artifacts are derived outputs, and frontend-local DTO definitions are not authoritative.

#### Scenario: Gateway protocol shape is consumed by Deck Go

- **WHEN** Deck Go needs to call a Gateway method that has an upstream schema
- **THEN** the Gateway request, result, and event shapes SHALL be consumed from generated Gateway protocol artifacts, not hand-redefined in Deck Go BFF contracts

#### Scenario: Deck-facing response shape is owned by Deck Go

- **WHEN** Deck Go exposes an HTTP or SSE response that aggregates, redacts, enriches, or normalizes Gateway data
- **THEN** the response shape SHALL be defined in the Deck-facing contract source and generated into frontend TypeScript and backend Go artifacts

#### Scenario: Contract conflict is found

- **WHEN** a frontend-local DTO, generated Deck-facing DTO, and backend handler disagree on the same Deck-facing response shape
- **THEN** the Deck-facing contract source SHALL be treated as the source of truth and the local DTO or handler SHALL be updated or documented as an exception

### Requirement: Gateway adapters preserve protocol boundary

Deck Go Gateway adapter code SHALL translate between generated Gateway protocol DTOs and Deck-facing BFF DTOs at explicit adapter boundaries.

#### Scenario: Adapter returns a Deck-facing DTO

- **WHEN** a backend handler serves a Deck-facing endpoint backed by Gateway data
- **THEN** the handler SHALL receive or construct a generated Deck-facing DTO after the Gateway adapter has consumed generated Gateway protocol data

#### Scenario: Raw Gateway passthrough is used

- **WHEN** a handler returns raw Gateway data without adapting it into a Deck-facing DTO
- **THEN** the endpoint SHALL be classified as a documented exception with a reason and exit criteria

### Requirement: Contracts expose traceability

Each Deck-facing endpoint contract SHALL be traceable to its endpoint category, backend handler, generated DTOs, and, when applicable, Gateway method or event sources.

#### Scenario: Endpoint inventory is generated

- **WHEN** the contract inventory report is generated
- **THEN** each endpoint SHALL list its category, request DTO, response DTO or event DTO, backend owner, and Gateway source methods or events if present

#### Scenario: Missing traceability is detected

- **WHEN** an endpoint is present in route registration but absent from the contract inventory
- **THEN** the contract governance check SHALL report the endpoint as uncovered
