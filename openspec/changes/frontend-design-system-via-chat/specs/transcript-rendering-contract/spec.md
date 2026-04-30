## ADDED Requirements

### Requirement: User messages support right-aligned IM bubble layout

Deck transcript SHALL support rendering user messages as right-aligned IM-style bubbles with accent-tinted background, in addition to the existing left-aligned plain layout.

#### Scenario: Default user message alignment is right

- **WHEN** a transcript renders a user message under default configuration
- **THEN** the message body SHALL be visually right-aligned within the message row
- **AND** the message bubble SHALL apply an accent-tinted background and rounded corners
- **AND** SHALL constrain the bubble's max-width so long messages wrap rather than fill the entire transcript width

#### Scenario: User message alignment is configurable

- **WHEN** a tweak or preference sets user-message alignment to `left` or `center`
- **THEN** the transcript SHALL re-layout user messages accordingly without losing message semantics or breaking other block renderers

#### Scenario: Assistant messages remain left-aligned

- **WHEN** the user-message alignment setting is changed
- **THEN** assistant messages SHALL remain left-aligned regardless of the user-message setting

### Requirement: Tool-use and tool-result render as a paired visual unit

When a `tool_use` block is immediately followed by its corresponding `tool_result` block in a message, deck transcript SHALL render them as a single paired visual unit with a shared outer border.

#### Scenario: Successful tool pair shares neutral border

- **WHEN** a `tool_use` is immediately followed by a non-error `tool_result` in the same message
- **THEN** both blocks SHALL render inside one outer container with a single shared border
- **AND** the inner separator between use and result SHALL be a subtle divider (not a full border)

#### Scenario: Errored tool pair tints the entire pair

- **WHEN** a `tool_use` is immediately followed by a `tool_result` with `isError: true`
- **THEN** the entire pair container SHALL receive an error tint on its outer border
- **AND** both halves SHALL be visually identifiable as belonging to the failed call

#### Scenario: Pairing is configurable

- **WHEN** the tool-card style preference is set to `split` instead of `paired`
- **THEN** the transcript SHALL render `tool_use` and `tool_result` as separate independent cards as before
- **AND** the segmentation between blocks SHALL not depend on the paired-mode container

#### Scenario: Orphan tool blocks render standalone

- **WHEN** a `tool_use` is not immediately followed by a `tool_result` (e.g., still running, or `tool_result` arrives later via streaming)
- **THEN** the `tool_use` SHALL render as a standalone card with no paired container
- **AND** the standalone view SHALL transition into a paired view once the matching `tool_result` arrives, without losing scroll position

### Requirement: Transcript renderers consume design-system primitives exclusively

All transcript block renderers SHALL render shared visual concerns (cards, badges, chips, code views, tabs, popovers) through `frontend-design-system` atoms only.

#### Scenario: Renderers import shared atoms from design-system

- **WHEN** a transcript block renderer needs a shared visual primitive
- **THEN** the renderer SHALL import the corresponding atom from `@/design-system`
- **AND** SHALL NOT define a private chat-specific equivalent for that primitive

#### Scenario: Renderer styling uses design-system tokens

- **WHEN** a transcript block renderer applies any visual style
- **THEN** colors, spacing, and typography SHALL reference design-system tokens (`var(--bg-2)`, `var(--text-1)`, etc.)
- **AND** SHALL NOT contain raw hex or unscaled px values for token-equivalent properties
