## MODIFIED Requirements

### Requirement: Every canonical transcript block type has an explicit renderer

Deck transcript views SHALL render canonical transcript blocks through an explicit renderer registry rather than through scattered ad-hoc branching. The Vite renderer registry SHALL preserve old Deck visual renderer parity for known block types, including Markdown text, thinking, tool use, tool result, image, file, canvas, and unknown/fallback blocks.

#### Scenario: Canonical blocks render without raw JSON leakage

- **scenario_id**: `transcript-rendering.known-blocks-no-json`
- **WHEN** a transcript message contains canonical `text`, `thinking`, `tool_use`, `tool_result`, `image`, or `file` blocks
- **THEN** Deck SHALL render each block through its corresponding explicit renderer selected from the registry
- **AND** SHALL NOT leak raw `JSON.stringify(...)` output into the main conversation bubble for those known block types
- **AND** SHALL preserve old Deck visual hierarchy and spacing for those block types.

#### Scenario: Structured tool_result renders as structured content

- **scenario_id**: `transcript-rendering.structured-tool-result`
- **WHEN** a `tool_result` block contains structured content rather than a plain string
- **THEN** Deck SHALL render that result through a block-aware tool result renderer
- **AND** SHALL NOT degrade it to an opaque JSON blob unless the user explicitly opens a raw fallback view.

### Requirement: Unknown transcript blocks degrade through a fallback card

Deck SHALL degrade unknown or version-skewed transcript blocks through an explicit fallback block, not through silent drops or message-text corruption. The fallback card SHALL match old Deck visual treatment where the old client defined one.

#### Scenario: Unknown block does not corrupt the message bubble

- **scenario_id**: `transcript-rendering.unknown-block-fallback`
- **WHEN** Deck receives a transcript block whose type is not recognized by the current renderer registry
- **THEN** Deck SHALL render a dedicated fallback block showing the block type and a readable summary
- **AND** SHALL NOT merge the raw JSON of that block into the surrounding user or assistant text bubble.

### Requirement: Transcript surfaces render the same transcript contract consistently

Chat and session-detail transcript views SHALL consume the same transcript contract and preserve the same semantics for the same server state. Vite Deck SHALL preserve old Deck transcript visual semantics across Chat and Sessions, including specialized renderers, nested blocks, and raw/expanded states.

#### Scenario: Chat and Sessions detail agree on transcript meaning

- **scenario_id**: `transcript-rendering.chat-sessions-consistent`
- **WHEN** the same transcript message is shown in the chat page and in the Sessions detail transcript view
- **THEN** both surfaces SHALL preserve the same visible message semantics, including text, thinking, tool calls, tool results, files, and images
- **AND** neither surface SHALL silently drop structured content that the other renders.
