## ADDED Requirements

### Requirement: Gateway transcript content preserves non-audio/video known blocks

OpenClaw Gateway SHALL expose and canonicalize the non-audio/video transcript block set required by Deck: `text`, `thinking`, `tool_use`, `tool_result`, `image`, `file`, `canvas`, and `unknown`. Unknown or version-skewed non-audio/video blocks SHALL be normalized to `type: "unknown"` with `rawType` and a readable summary instead of being silently dropped.

#### Scenario: Gateway canonicalizes direct canvas blocks

- **WHEN** Gateway history or a session event contains a direct `canvas` block with `surface: "assistant_message"`, `render: "url"`, and `url`
- **THEN** the canonical transcript output SHALL preserve it as a `canvas` block
- **AND** the generated Gateway TypeScript protocol artifact SHALL include the `canvas` block variant

#### Scenario: Gateway canonicalizes preview-wrapped canvas blocks

- **WHEN** Gateway history augmentation produces `{ type: "canvas", preview: { kind: "canvas", surface: "assistant_message", render: "url", url } }`
- **THEN** Gateway or Deck projection SHALL normalize it to the direct Deck canvas shape before frontend rendering
- **AND** `viewId`, `title`, and `preferredHeight` SHALL be preserved when present

#### Scenario: Gateway preserves unknown non-audio/video blocks

- **WHEN** a transcript entry contains a block whose `type` is not one of the known non-audio/video variants
- **THEN** canonicalization SHALL emit an `unknown` block with `rawType` equal to the original block type
- **AND** SHALL include a bounded readable `summary`
- **AND** SHALL NOT drop the block or merge raw JSON into adjacent text

### Requirement: Deck-facing content DTOs are the product-level contract

Deck Go SHALL adapt Gateway content into Deck-facing DTOs that describe the product UI shape, not merely pass through raw Gateway records. `DeckGoTranscriptBlock`, frontend `ContentBlock`, Go projection output, and generated TypeScript DTOs SHALL agree on the non-audio/video block set.

#### Scenario: Deck contract and frontend block variants agree

- **WHEN** `deck-go/contracts/source/deck-api.contract.ts` is regenerated
- **THEN** `DeckGoTranscriptBlock` in generated TypeScript SHALL expose exactly `text`, `image`, `file`, `tool_use`, `tool_result`, `thinking`, `canvas`, and `unknown`
- **AND** `frontend-new/src/stores/chat-types.ts` SHALL expose the same product variants for rendered chat content

#### Scenario: Go projection preserves known block fields

- **WHEN** Go projection receives transcript blocks from `chat.history`, `sessions.get`, `session.message`, or `session.tool`
- **THEN** it SHALL preserve required fields for each known block variant
- **AND** SHALL recursively normalize structured `tool_result.content` arrays
- **AND** SHALL produce `unknown` fallback blocks for unrecognized non-audio/video blocks

#### Scenario: Generated Gateway and Deck contracts stay in sync

- **WHEN** protocol or Deck contract sources change for content blocks
- **THEN** `make protocol-check` and `make contract-gate` SHALL pass without generated-artifact drift
- **AND** generated files SHALL NOT be hand-edited to satisfy the checks

### Requirement: Attachments reflect OpenClaw-supported model input semantics

Deck chat upload UX and contracts SHALL distinguish image model attachments from unsupported generic file model attachments. Generic files SHALL NOT be silently sent to Gateway as if they were model-readable attachments.

#### Scenario: Image attachment is sent as model input

- **WHEN** the user selects or drops an image file within the configured size limit
- **THEN** the frontend SHALL send it as an attachment with `type: "image"`, `mimeType`, `fileName`, and base64 `content`
- **AND** the Go BFF SHALL forward it to Gateway `sessions.send` / `chat.send`
- **AND** Gateway SHALL either accept it for an image-capable model or return a visible error/unsupported state

#### Scenario: Generic file is not silently sent as model input

- **WHEN** the user selects a non-image file
- **THEN** Deck SHALL either reject it before send with visible UI feedback or stage it only in an explicitly non-model-input artifact/file surface
- **AND** SHALL NOT send it through the model attachment path unless Gateway support for generic file model input exists and is represented in the contract

#### Scenario: Attachment capability is testable

- **WHEN** frontend attachment tests run
- **THEN** they SHALL cover accepted image upload, size-limit rejection, and unsupported generic file behavior
- **AND** the visible UI state SHALL match the actual Gateway capability

### Requirement: Artifacts are deterministic Deck product views over transcript content

Deck artifacts SHALL be modeled as deterministic product views derived from transcript/tool-result content, not as an implicit Gateway transcript block. The supported artifact kinds SHALL be `html`, `svg`, `mermaid`, `json`, `csv`, `markdown`, `code`, `text`, and `image`.

#### Scenario: Tool result produces an artifact candidate

- **WHEN** a `tool_result` string or file-context result matches a supported artifact kind
- **THEN** Deck SHALL present an inline artifact entry point without auto-opening the right panel
- **AND** SHALL retain access to the raw tool result
- **AND** SHALL attach source metadata such as tool name, file path, message id, or tool use id when available

#### Scenario: Artifact identity is stable

- **WHEN** the same transcript is normalized and rendered more than once
- **THEN** the derived artifact id SHALL be deterministic for the same session/message/tool/content position
- **AND** SHALL NOT depend on a process-global incrementing counter

#### Scenario: Artifact renderer has safe fallback

- **WHEN** artifact detection cannot confidently classify content
- **THEN** Deck SHALL leave the content in the transcript/tool result raw view
- **AND** SHALL NOT create a misleading artifact panel

### Requirement: Canvas and A2UI projection round-trip through Deck BFF

Deck canvas state SHALL have one product contract across inline transcript canvas blocks, the right-side A2UI drawer, bridge events, and `/chat/projection` state persistence.

#### Scenario: Inline canvas renders from transcript

- **WHEN** a transcript message contains a Deck canvas block
- **THEN** the frontend SHALL render an inline iframe using the canvas URL
- **AND** SHALL honor `title` and `preferredHeight` when present

#### Scenario: A2UI drawer uses Gateway canvas host through Go BFF

- **WHEN** the right-side canvas drawer opens with a relative canvas URL
- **THEN** the browser SHALL load it through the Go BFF `/api/canvas/*` route
- **AND** the BFF SHALL proxy to the Gateway canvas host without exposing direct browser-to-Gateway calls
- **AND** the injected bridge SHALL support ready, action, surface-change, tree-data, eval-result, reset, push, and request-tree flows

#### Scenario: Projection persists visible canvas state

- **WHEN** the frontend posts a sanitized A2UI projection to `/api/chat/projection`
- **THEN** the Go BFF SHALL store it for that `sessionKey`
- **AND** a later `/api/chat/snapshot?sessionKey=...` response in the same backend process SHALL include the stored projection
- **AND** bridge-only ephemeral fields that the contract excludes SHALL not be persisted

#### Scenario: Canvas verification has mock and real evidence

- **WHEN** this change is marked complete
- **THEN** mock tests SHALL cover inline canvas and drawer state
- **AND** a bounded real Gateway smoke SHALL attempt to render a real or seeded Gateway canvas URL unless the environment is unavailable and the handoff documents the blocker
