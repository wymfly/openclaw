## ADDED Requirements

### Requirement: Streams contract declares every SSE event the frontend subscribes to

`deck-go/contracts/source/deck-streams.contract.json` SHALL declare every SSE event type that the frontend can receive on `GET /api/stream`. Any frontend subscriber referencing an event type that is not declared in the streams contract SHALL fail the contract gate.

#### Scenario: Frontend subscribes to a declared event

- **WHEN** a frontend subscriber matches on `event.event === "<name>"`
- **THEN** `<name>` SHALL appear in the `streams[].events[].event` list of `deck-streams.contract.json`

#### Scenario: Frontend subscribes to an undeclared event

- **WHEN** the contract gate scans frontend code for `event.event === "<name>"` patterns
- **THEN** any name not appearing in the streams contract SHALL fail the gate with a pointer to the offending source line

#### Scenario: deck-go middleware passes through an event

- **WHEN** the deck-go middleware SSE pipe (`backend/internal/server/stream.go`) receives an event from upstream
- **THEN** the middleware SHALL NOT filter events by name (it is a transparent pipe), so contract correctness depends on declaring upstream-emitted event names that frontend subscribes to

### Requirement: `activity.event` has a typed payload contract

`activity.event` SHALL be declared in `deck-streams.contract.json` and have a typed payload DTO `DeckGoActivityStreamEvent` exported from `deck-api.contract.ts`.

#### Scenario: Frontend reads activity event payload

- **WHEN** the frontend handles `event.event === "activity.event"`
- **THEN** the payload SHALL conform to `DeckGoActivityStreamEvent` exposing at least `agentId: string` and `type: string`

#### Scenario: Backend narrowing test exists

- **WHEN** running `cd deck-go/backend && go test ./internal/server/...`
- **THEN** there SHALL be a test that emits a representative upstream `activity.event` payload through the SSE pipe and asserts the narrowed shape conforms to the contract

### Requirement: `agent.status.changed` has a typed payload contract

`agent.status.changed` SHALL be declared in `deck-streams.contract.json` and have a typed payload DTO `DeckGoAgentStatusChangedStreamEvent` exported from `deck-api.contract.ts`.

#### Scenario: Frontend reads agent status changed payload

- **WHEN** the frontend handles `event.event === "agent.status.changed"`
- **THEN** the payload SHALL conform to `DeckGoAgentStatusChangedStreamEvent` exposing at least `agentId: string` and `status: "busy" | "idle" | (string & {})`

#### Scenario: Frontend handles an unknown status string

- **WHEN** the upstream emits a status value other than `busy` / `idle`
- **THEN** the frontend SHALL still type-check (via `(string & {})` extension) and the renderer SHALL gracefully fall back to a neutral display

### Requirement: `stream-contract.ts` parser narrows new events

`deck-go/frontend-new/src/stream-contract.ts` and the `frontend/` mirror SHALL extend `parseServerEvent` and `DeckGoParsedServerEvent` union to include the two new event kinds.

#### Scenario: Parser receives a new event

- **WHEN** `parseServerEvent` is called with `event.event === "activity.event"` or `"agent.status.changed"`
- **THEN** the returned `DeckGoParsedServerEvent` SHALL be a `kind: "activity.event"` or `kind: "agent.status.changed"` variant carrying the typed payload, NOT a `kind: "unknown"` variant
