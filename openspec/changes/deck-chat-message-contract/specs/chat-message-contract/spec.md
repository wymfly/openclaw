## ADDED Requirements

### Requirement: Deck-facing transcript surfaces use canonical block arrays

The Gateway SHALL expose chat transcript messages to Deck as canonical block arrays instead of width-unknown message content.

#### Scenario: chat.history canonicalizes plain user text

- **WHEN** a session transcript stores a plain user message as a legacy string
- **THEN** `chat.history` SHALL return that message as `content: [{ type: "text", text: ... }]`
- **AND** SHALL NOT expose the legacy string shape directly to Deck consumers

#### Scenario: session.message matches chat.history message contract

- **WHEN** the Gateway emits a `session.message` event for a transcript message
- **THEN** the event payload SHALL use the same canonical message/block contract as `chat.history`
- **AND** the same message SHALL not require Deck to maintain a second normalization path

#### Scenario: legacy alias block types are normalized before egress

- **WHEN** transcript history or live events contain legacy aliases such as `toolCall`, `toolResult`, `input_text`, `output_text`, `reasoning`, or `analysis`
- **THEN** the Gateway SHALL normalize them to the canonical Deck-facing transcript block types before returning or broadcasting them

#### Scenario: image and file blocks are preserved before egress

- **WHEN** transcript history or live events contain `image` or `file` blocks
- **THEN** the Gateway SHALL return or broadcast them as canonical `image` or `file` blocks with their media metadata preserved
- **AND** SHALL NOT coerce those blocks into plain text or JSON fallback content merely to fit the Deck wire shape

### Requirement: Structured tool results are preserved across transcript surfaces

Structured tool results SHALL remain structured on Deck-facing history and event surfaces.

#### Scenario: session.tool preserves structured result content

- **WHEN** a tool emits a structured result containing nested content blocks or metadata objects
- **THEN** the `session.tool` payload SHALL preserve that structure
- **AND** SHALL NOT flatten the result into a single JSON string merely to fit the Deck wire shape

#### Scenario: chat history preserves structured tool_result content

- **WHEN** a transcript message contains a `tool_result` block whose content is structured rather than plain text
- **THEN** `chat.history` SHALL return that `tool_result` content in structured form
- **AND** the Deck client SHALL be able to distinguish it from a plain text result
