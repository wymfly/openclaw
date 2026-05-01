## ADDED Requirements

### Requirement: Chat write request bodies have typed DTO export

Every chat write BFF endpoint SHALL have a corresponding typed `DeckGo*Request` DTO exported from `deck-go/contracts/source/deck-api.contract.ts`. The set of chat write endpoints covered: `POST /api/chat/sessions/reset`, `POST /api/chat/sessions/clear`, `DELETE /api/chat/sessions`, `POST /api/chat/sessions/patch`, `POST /api/chat/projection`, `POST /api/chat/compaction`, `POST /api/deck/canvas` (bridge ready / eval resolve).

#### Scenario: Frontend builds a chat write request

- **WHEN** frontend code calls a chat write endpoint
- **THEN** the request body SHALL be typed as the corresponding `DeckGoChat*Request` DTO, NOT as inline interface or `Record<string, unknown>`

#### Scenario: Backend handler shape matches the DTO

- **WHEN** the backend handler in `deck-go/backend/internal/server/chat.go` decodes the request body
- **THEN** its decoder struct SHALL be byte-equivalent (field names + types) to the corresponding `DeckGoChat*Request` DTO; for `patchSession` and `chat/projection` (which use `map[string]any`), the typed DTO SHALL include an explicit `extension: Record<string, unknown>` field

### Requirement: `DeckGoChatSessionPatchRequest` exposes both narrow and extension fields

Because `chat.go:171` decodes `patchSession` body as `var body map[string]any` and forwards everything to the upstream `sessions.patch` RPC, the DTO SHALL include narrow already-known fields AND an `extension: Record<string, unknown>` for forward-compatible dynamic keys.

#### Scenario: Frontend updates a known field

- **WHEN** frontend updates a known patch field (e.g. `title` / `archived` / `pinned`)
- **THEN** TypeScript SHALL provide field-level type checking on the narrow field

#### Scenario: Frontend forwards an unknown field

- **WHEN** an upstream `sessions.patch` RPC adds a new field not yet known to deck-go contract source
- **THEN** the frontend SHALL be able to forward it via `extension: { newField: value }` without a contract-source change blocking the fix

### Requirement: Agents create / patch request bodies have typed DTO export

`POST /api/agents` and `PATCH /api/agents/{agentId}` SHALL have `DeckGoAgentCreateRequest` and `DeckGoAgentPatchRequest` typed DTOs exported from `deck-go/contracts/source/deck-api.contract.ts`.

#### Scenario: Frontend builds an agent create request

- **WHEN** frontend code calls `POST /api/agents`
- **THEN** the request body SHALL be typed as `DeckGoAgentCreateRequest` exposing `name: string` (required) plus `workspace?: string` / `emoji?: string` / `avatar?: string` (optional), reflecting that `inventory.go:23` reads exactly these 4 fields and discards the rest

#### Scenario: Frontend builds an agent patch request

- **WHEN** frontend code calls `PATCH /api/agents/{agentId}`
- **THEN** the request body SHALL be typed as `DeckGoAgentPatchRequest`; because `inventory.go:117` is a pure pass-through to upstream `agents.update`, the DTO SHALL mirror the upstream `agents.update` typed schema if available, OR SHALL provide a narrow known-field set + `extension: Record<string, unknown>` if the upstream schema is unavailable

### Requirement: Frontend write call sites use the generated DTO

`deck-go/frontend-new/src/api.ts` and the `frontend/` mirror SHALL consume the generated DTO for every chat write + agents create/patch call site. Inline interface declarations and `Record<string, unknown>` body types SHALL be removed.

#### Scenario: New write call site is added

- **WHEN** a new write call site is added in `api.ts`
- **THEN** the contract gate SHALL reject the change unless the request body is typed as a generated `DeckGo*Request` DTO

#### Scenario: Existing inline body types are migrated

- **WHEN** this change lands
- **THEN** every existing `body: Record<string, unknown>` parameter on chat write + agents write functions in `api.ts` SHALL be replaced with the typed DTO; CI's `make contract-gate` SHALL fail if any remain

### Requirement: frontend / frontend-new mirror parity is preserved

Until the `frontend-legacy` rename change lands, `deck-go/frontend/src/api.ts` and `deck-go/frontend-new/src/api.ts` SHALL remain byte-identical. Any contract-driven change in this change set SHALL be applied to both files in the same commit.

#### Scenario: byte-identical check

- **WHEN** running `diff -q deck-go/frontend/src/api.ts deck-go/frontend-new/src/api.ts`
- **THEN** the command SHALL produce no output
