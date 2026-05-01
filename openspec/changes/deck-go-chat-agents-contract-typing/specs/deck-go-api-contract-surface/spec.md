## MODIFIED Requirements

### Requirement: Deck-facing API DTOs are generated

All stable Deck-facing HTTP request, HTTP response, and SSE event DTOs SHALL be defined in the Deck-facing contract source and generated for both frontend TypeScript and backend Go consumers. Coverage SHALL include both **read** and **write** surfaces of every active module.

#### Scenario: Frontend imports a Deck-facing DTO

- **WHEN** a frontend module needs a `DeckGo*` DTO for a stable Deck-facing endpoint
- **THEN** it SHALL import the generated DTO instead of defining the DTO in `deck-go/frontend/src/api.ts`, `deck-go/frontend-new/src/api.ts`, or any panel-local file

#### Scenario: Backend handler emits a Deck-facing DTO

- **WHEN** a backend handler emits a stable Deck-facing JSON response
- **THEN** it SHALL construct or return the generated Go DTO for that response unless the endpoint is a documented exception

#### Scenario: Contract generation is checked

- **WHEN** `make contracts-check` is executed in `deck-go`
- **THEN** generated TypeScript and Go Deck-facing artifacts SHALL be byte-equivalent to the contract source

#### Scenario: Write-surface coverage is enforced for chat and agents modules

- **WHEN** the contract gate runs in `deck-go`
- **THEN** every chat write endpoint (`reset` / `clear` / `delete` / `patch` / `projection` / `compaction` / canvas-bridge) and every agents write endpoint (`POST /agents` / `PATCH /agents/{agentId}`) SHALL have a corresponding `DeckGo*Request` DTO and the frontend call site SHALL use it
