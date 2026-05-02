## ADDED Requirements

### Requirement: Deck-facing API DTOs are generated

All stable Deck-facing HTTP request, HTTP response, and SSE event DTOs SHALL be defined in the Deck-facing contract source and generated for both frontend TypeScript and backend Go consumers.

#### Scenario: Frontend imports a Deck-facing DTO

- **WHEN** a frontend module needs a `DeckGo*` DTO for a stable Deck-facing endpoint
- **THEN** it SHALL import the generated DTO instead of defining the DTO in `deck-go/frontend/src/api.ts` or a panel-local file

#### Scenario: Backend handler emits a Deck-facing DTO

- **WHEN** a backend handler emits a stable Deck-facing JSON response
- **THEN** it SHALL construct or return the generated Go DTO for that response unless the endpoint is a documented exception

#### Scenario: Contract generation is checked

- **WHEN** `make contracts-check` is executed in `deck-go`
- **THEN** generated TypeScript and Go Deck-facing artifacts SHALL be byte-equivalent to the contract source

### Requirement: Endpoint categories are complete

Every Deck Go browser-facing endpoint SHALL be classified as `gateway-protocol-adapter`, `deck-go-bff`, `stream-binary-upload`, or `documented-exception`.

#### Scenario: Gateway adapter endpoint is classified

- **WHEN** an endpoint exists primarily to expose an upstream Gateway method or event to the browser
- **THEN** it SHALL be classified as `gateway-protocol-adapter` and list the Gateway methods or events it adapts

#### Scenario: Deck Go control-plane endpoint is classified

- **WHEN** an endpoint manages Deck Go settings, runtime mode, devices, local state, deployment, or other BFF-owned behavior
- **THEN** it SHALL be classified as `deck-go-bff` and use Deck-facing DTOs

#### Scenario: Stream or binary endpoint is classified

- **WHEN** an endpoint serves SSE, binary downloads, uploads, or health probes that do not map cleanly to JSON DTOs
- **THEN** it SHALL be classified as `stream-binary-upload` and define its stream event, media, or status contract explicitly

### Requirement: Frontend API module stops owning DTOs

`deck-go/frontend/src/api.ts` SHALL become a transport and convenience wrapper module, not the source of Deck-facing DTO definitions.

#### Scenario: Duplicate frontend DTO is introduced

- **WHEN** a new exported `DeckGo*` interface or type is added to `deck-go/frontend/src/api.ts`
- **THEN** the contract governance check SHALL fail unless the definition is an import/re-export from generated contract artifacts or a documented temporary migration shim

#### Scenario: Module migration completes

- **WHEN** a module domain is migrated to the contract chain
- **THEN** its frontend consumers SHALL use generated DTOs and its old local DTO definitions SHALL be removed

### Requirement: SSE events are part of the Deck-facing contract

Deck-facing SSE event shapes SHALL be defined, generated, and versioned like HTTP DTOs.

#### Scenario: Browser stream event is consumed

- **WHEN** the frontend handles a Deck Go SSE event
- **THEN** the event payload type SHALL come from generated Deck-facing event DTOs

#### Scenario: New event type is added

- **WHEN** a new Deck Go SSE event type is added
- **THEN** the event SHALL be added to the Deck-facing contract source before frontend consumers depend on it
