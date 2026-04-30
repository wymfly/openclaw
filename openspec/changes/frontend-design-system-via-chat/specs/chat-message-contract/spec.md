## ADDED Requirements

### Requirement: Forward-compatible optional metadata fields

The Gateway-to-Deck chat message contract SHALL be forward-compatible with optional run/tool/lineage metadata fields that may be added by the Gateway over time. Deck consumers SHALL tolerate such fields being absent without UI degradation.

#### Scenario: Run metadata may include optional cache and cost fields

- **WHEN** the Gateway emits run-level metadata for an assistant message
- **THEN** the metadata payload MAY include optional Gateway-truth fields such as `cacheRead`, `cacheWrite`, `totalCost`, `inputCost`, `outputCost` (per `usage-result-schemas.ts` `CostUsageTotals`) in addition to the baseline `model`, `input` and `output` token counts
- **AND** Deck MAY derive view-shape fields (e.g., `cacheHit = cacheRead / (input + output + cacheRead + cacheWrite)`) for display, since Gateway does not emit a precomputed cache-hit ratio
- **AND** the contract SHALL NOT require Deck to receive these optional fields for a message to be valid

#### Scenario: Deck tolerates missing optional fields

- **WHEN** Deck renders a transcript message whose run metadata is missing one or more optional fields
- **THEN** the chat UI SHALL render successfully without errors
- **AND** SHALL hide the visual elements (chips, badges) corresponding to the missing fields
- **AND** SHALL NOT render placeholder values ("—", "0", "$0.000") for missing optional fields

#### Scenario: Subagent lineage tolerates view-shape extensions

- **WHEN** Deck renders subagent lineage from `subagent.lineage` Gateway endpoint
- **THEN** Deck MAY enrich the wire-shape (flat list of nodes with `parentRunId`) into a view-shape (recursive tree with `children`) without requiring the Gateway to emit the recursive shape
- **AND** the Gateway-emitted wire shape SHALL remain the canonical source

#### Scenario: Tool input fields tolerate optional context

- **WHEN** a `tool_use` block is rendered by Deck
- **THEN** the renderer SHALL tolerate optional context fields in `input` (such as `cwd`, `reason`, `description`) being present or absent
- **AND** SHALL render only the fields present, without crashing or showing empty rows for absent fields

### Requirement: Frontend type extension is non-breaking

When the Deck frontend extends `chat-types.ts` to declare Gateway-truth optional fields ahead of go-service forwarding, the extensions SHALL be non-breaking for existing consumers.

#### Scenario: New fields are declared optional

- **WHEN** the frontend chat-types adds a Gateway-truth field that is not yet forwarded by the go service
- **THEN** the field SHALL be declared with a TypeScript optional marker (`field?: T` or `field: T | undefined`)
- **AND** all existing consumers of the type SHALL continue to compile without modification

#### Scenario: Missing optional fields do not crash UI

- **WHEN** the go service forwards a message without an optional field declared in chat-types
- **THEN** the Deck UI SHALL render the message normally
- **AND** SHALL NOT throw runtime errors due to the absent field
