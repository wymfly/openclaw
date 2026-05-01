## ADDED Requirements

### Requirement: TranscriptBlock is a discriminated union by `type`

`DeckGoTranscriptBlock` SHALL be a discriminated union keyed by a required `type: string` field. The variant set SHALL be exactly 8 known variants — `text` / `image` / `file` / `tool_use` / `tool_result` / `thinking` / `canvas` / `unknown` — mirroring the frontend `ContentBlock` Anthropic-compatible union (`deck-go/frontend-new/src/stores/chat-types.ts:15-32`). Each variant SHALL only expose the fields that variant actually carries.

> **Discriminator note**: the existing wide-shape already required `type: string`; `kind?: string` was a secondary tag used internally by the canvas variant only (`kind: "canvas"`), and is preserved within the canvas variant — it is NOT the union discriminator.

#### Scenario: Frontend renders a text block

- **WHEN** a frontend renderer receives a block with `type === "text"`
- **THEN** TypeScript SHALL narrow the block to a variant exposing `text: string` only, with no optional `toolUseId` / `mimeType` / etc. fields visible

#### Scenario: Frontend renders a tool_use block

- **WHEN** a frontend renderer receives a block with `type === "tool_use"`
- **THEN** TypeScript SHALL narrow the block to a variant exposing `id: string`, `name: string`, `input: Record<string, unknown>`, with no `text` / `mimeType` / `url` fields visible

#### Scenario: Frontend renders an unknown block

- **WHEN** a frontend renderer receives a block with `type === "unknown"`
- **THEN** TypeScript SHALL narrow the block to a variant exposing `rawType: string` and `summary: Record<string, unknown>`, NOT silently treated as one of the known variants

#### Scenario: Backend emits a typed block

- **WHEN** the backend serializes a `DeckGoTranscriptBlock`
- **THEN** the `type` field SHALL always be present and SHALL be one of the 8 documented variants — any block whose original wire `type` is not in the known set SHALL be normalized to `type: "unknown"` with the original `type` carried in `rawType`

### Requirement: Chat snapshot activeApproval is typed

`DeckGoChatSnapshotResponse.activeApproval` SHALL be `DeckGoApprovalRequest | null` — the field SHALL NOT remain `Record<string, unknown> | null`.

> **Out-of-scope (deferred)**: `a2uiState` SHALL remain `Record<string, unknown> | null` in this change. Tightening it requires upstream timeline RPC schema dig that is not in scope; a follow-up change `deck-go-chat-a2ui-state-typing` will own it.

#### Scenario: Snapshot consumer reads activeApproval

- **WHEN** a frontend consumer reads `snapshot.activeApproval`
- **THEN** TypeScript SHALL infer the field as `DeckGoApprovalRequest | null` with required fields `id: string`, `request: DeckGoApprovalRequestPayload`, `createdAtMs: number`, `expiresAtMs: number` (mirroring upstream `src/infra/exec-approvals.ts::ExecApprovalRequest`) typed, NOT as `Record<string, unknown> | null`

### Requirement: Chat block rendering uses discriminated narrowing only

Frontend chat block-rendering code SHALL narrow blocks via `switch (block.type)` on the discriminated union. Wide-shape ad-hoc property access SHALL NOT survive in production code paths.

#### Scenario: Renderer reaches into wide-shape via type cast

- **WHEN** code performs `(block as any).text` or `(block as Record<string, unknown>).text` to bypass the union
- **THEN** the code review or lint gate SHALL flag it as a violation

#### Scenario: Renderer dispatches via switch on type

- **WHEN** chat block rendering needs to handle multiple block kinds
- **THEN** the dispatch SHALL be a `switch (block.type)` whose default branch handles the `unknown` variant explicitly
