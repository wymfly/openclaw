## ADDED Requirements

### Requirement: MethodDefinition supports fork deprecation metadata

`MethodDefinition` (in `src/gateway/method-registry.ts`) SHALL accept four optional fork-scoped metadata fields: `forkDeprecated: boolean`, `forkDeprecationReplacement: string`, `forkDeprecationSince: string` (ISO date), `forkDeprecationRemovalTarget: string` (ISO date). These fields SHALL be passed through `gateway.describe` so clients can surface deprecation hints. Methods marked `forkDeprecated: true` SHALL continue to function unchanged at runtime.

#### Scenario: gateway.describe surfaces forkDeprecated metadata for affected methods

- **WHEN** a client calls `gateway.describe` after this change
- **THEN** the result entry for each of `deck.routing.list`, `deck.subagents.list`, `deck.subagents.lineage`, `deck.identity.list`, `deck.threads.list` includes `forkDeprecated: true`, `forkDeprecationReplacement: "deck-go-bff/views.<Name>"`, and ISO date strings for `forkDeprecationSince` and `forkDeprecationRemovalTarget`

#### Scenario: Deprecated handler still produces correct results at runtime

- **WHEN** a client invokes `deck.routing.list` after this change
- **THEN** the handler executes exactly as before and returns identical output to pre-change behavior; no warning is emitted to gateway logs

### Requirement: Public RPC surface documents BFF as the official C3 view successor

The protocol documentation (`docs/gateway/protocol.md`) SHALL state that for the 5 C3 light-view methods, deck-go BFF view layer is the official successor and that openclaw fork handlers are scheduled for removal in a follow-up release.

#### Scenario: Documentation references deck-go BFF view path

- **WHEN** a developer reads `docs/gateway/protocol.md` after this change
- **THEN** the section covering `deck.*.list` methods explicitly notes the `forkDeprecated` status and points to `deck-go/docs/protocol-adaptation.md` for the BFF view replacement strategy

### Requirement: Client SDK guidance promotes BFF batch endpoint over individual round-trips

The protocol documentation SHALL recommend that typed clients composing multiple read RPCs use the deck-go BFF batch endpoint (or `gateway.batch` over WebSocket) rather than N individual HTTP RPCs to amortise round-trip cost.

#### Scenario: Documentation includes batch usage example

- **WHEN** a developer reads the batch RPC section of `docs/gateway/protocol.md`
- **THEN** the documentation includes a worked example showing 3 read methods being composed into a single `gateway.batch` call via the deck-go BFF

### Requirement: deck-go BFF endpoints are listed as part of the public client-edge protocol

The deck-go BFF endpoints `/api/v1/runtimes/{rt}/gateway/rpc`, `/api/v1/runtimes/{rt}/gateway/batch`, and `/api/v1/runtimes/{rt}/gateway/ws` SHALL be considered part of the public client-edge protocol surface; their request/response shapes SHALL be documented and version-controlled.

#### Scenario: Endpoints documented in deck-go protocol doc

- **WHEN** a developer reads `deck-go/docs/protocol-adaptation.md` after this change
- **THEN** the document includes an "Endpoints" section enumerating the three endpoints, their auth model, request/response shape, and link to OpenAPI-style typed contracts in `deck-go/contracts/source/deck-api.contract.ts`
