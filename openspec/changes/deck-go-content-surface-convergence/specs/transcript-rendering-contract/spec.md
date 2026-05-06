## MODIFIED Requirements

### Requirement: Every canonical transcript block type has an explicit renderer

Deck transcript views SHALL render canonical non-audio/video transcript blocks through an explicit renderer registry rather than through scattered ad-hoc branching. The canonical rendered block set SHALL include `text`, `thinking`, `tool_use`, `tool_result`, `image`, `file`, `canvas`, and `unknown`.

#### Scenario: Canonical blocks render without raw JSON leakage

- **scenario_id**: `transcript-rendering.known-blocks-no-json`
- **WHEN** a transcript message contains canonical `text`, `thinking`, `tool_use`, `tool_result`, `image`, `file`, `canvas`, or `unknown` blocks
- **THEN** Deck SHALL render each block through its corresponding explicit renderer selected from the registry
- **AND** known block types SHALL NOT leak raw `JSON.stringify(...)` output into the main conversation bubble
- **AND** `canvas` blocks SHALL render as explicit canvas embeds rather than as generic file, text, or JSON blocks

#### Scenario: Structured tool_result renders as structured content

- **scenario_id**: `transcript-rendering.structured-tool-result`
- **WHEN** a `tool_result` block contains structured content rather than a plain string
- **THEN** Deck SHALL render that result through a block-aware tool result renderer
- **AND** nested `text`, `image`, `file`, `canvas`, and `unknown` content SHALL preserve their own renderer semantics
- **AND** Deck SHALL NOT degrade structured tool content to an opaque JSON blob unless the user explicitly opens a raw fallback view

#### Scenario: Artifact-capable tool result exposes a stable entry point

- **scenario_id**: `transcript-rendering.tool-result-artifact-entry`
- **WHEN** a `tool_result` block contains content that Deck can classify as a supported artifact kind
- **THEN** the transcript SHALL expose a visible artifact entry point from the tool result renderer
- **AND** the artifact entry point SHALL use deterministic identity for the same session/message/tool/content position
- **AND** the raw tool result SHALL remain available without auto-opening the artifact panel

### Requirement: Unknown transcript blocks degrade through a fallback card

Deck SHALL degrade unknown or version-skewed transcript blocks through an explicit fallback block, not through silent drops or message-text corruption.

#### Scenario: Unknown block does not corrupt the message bubble

- **scenario_id**: `transcript-rendering.unknown-block-fallback`
- **WHEN** Deck receives a transcript block whose type is not recognized by the current renderer registry
- **THEN** Deck SHALL render a dedicated fallback block showing the block type and a readable summary
- **AND** SHALL NOT merge the raw JSON of that block into the surrounding user or assistant text bubble
- **AND** SHALL NOT silently drop the block from the rendered transcript

#### Scenario: Unknown nested tool result content remains visible

- **scenario_id**: `transcript-rendering.unknown-nested-tool-content`
- **WHEN** a structured `tool_result.content` array contains an unrecognized content block
- **THEN** the tool result renderer SHALL show that nested item through the unknown fallback renderer
- **AND** the surrounding recognized tool result content SHALL still render normally

### Requirement: Transcript surfaces render the same transcript contract consistently

Chat and session-detail transcript views SHALL consume the same transcript contract and preserve the same semantics for the same server state.

#### Scenario: Chat and Sessions detail agree on transcript meaning

- **scenario_id**: `transcript-rendering.chat-sessions-consistent`
- **WHEN** the same transcript message is shown in the chat page and in the Sessions detail transcript view
- **THEN** both surfaces SHALL preserve the same visible message semantics, including text, thinking, tool calls, tool results, files, images, canvas embeds, artifact entry points, and unknown fallbacks
- **AND** neither surface SHALL silently drop structured content that the other renders

#### Scenario: History reload preserves structured content

- **scenario_id**: `transcript-rendering.history-reload-preserves-structured-content`
- **WHEN** a streamed chat message is later reloaded from `/api/chat/history` or `/api/chat/snapshot`
- **THEN** Deck SHALL preserve non-audio/video structured blocks including `image`, `file`, `canvas`, `unknown`, and structured `tool_result.content`
- **AND** user-authored plain text SHALL remain plain text rather than being replaced by serialized metadata JSON
