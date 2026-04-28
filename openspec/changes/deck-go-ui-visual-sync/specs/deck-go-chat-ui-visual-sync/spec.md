## ADDED Requirements

### Requirement: Old Deck Chat remains the visual reference

`deck-go` Chat SHALL use the old Next Deck Chat implementation as the visual and interaction reference for desktop parity work.

#### Scenario: Component parity ledger exists before implementation completion

- **scenario_id**: `deck-go-chat-ui-visual-sync.component-ledger`
- **WHEN** the change is ready to claim implementation completion
- **THEN** the implementation SHALL include a ledger mapping each relevant old Chat component to its `deck-go` target component
- **AND** the ledger SHALL classify each analyzed difference as synchronized, intentionally preserved with rationale, or blocked by a recorded backend/API gap

#### Scenario: Old reference is used for visual decisions

- **scenario_id**: `deck-go-chat-ui-visual-sync.old-reference-authority`
- **WHEN** a `deck-go` Chat visual detail conflicts with the old Deck Chat visual detail
- **THEN** the old Deck detail SHALL be treated as authoritative unless the implementation records an explicit non-parity exception

### Requirement: Chat shell and message layout match old Deck

`deck-go` Chat SHALL match old Deck's desktop Chat composition, transcript geometry, message bubble hierarchy, avatars, streaming placeholder, run metadata placement, and empty/loading/error states.

#### Scenario: Rich transcript message stack matches old layout

- **scenario_id**: `deck-go-chat-ui-visual-sync.message-stack`
- **WHEN** the Chat transcript contains user text, assistant text, streaming assistant state, run metadata, thinking blocks, tool calls, tool results, and file/image blocks
- **THEN** `deck-go` SHALL render the same visible message ordering, alignment, bubble widths, avatar treatment, timestamp/metadata placement, spacing, and scroll behavior as old Deck
- **AND** it SHALL NOT substitute simplified text avatars, inline placeholders, or alternate status placement unless recorded as an accepted exception

#### Scenario: Empty and loading states match old Chat

- **scenario_id**: `deck-go-chat-ui-visual-sync.empty-loading-states`
- **WHEN** Chat has no visible transcript, is loading history, or is reconnecting
- **THEN** `deck-go` SHALL render the old Deck empty/loading/reconnecting visual hierarchy, including iconography, text placement, spacing, and container treatment

### Requirement: Transcript markdown matches old Deck visible semantics

`deck-go` transcript and Artifact markdown rendering SHALL preserve the visible markdown semantics supported by old Deck's Streamdown and `.chat-prose` surfaces.

#### Scenario: Markdown corpus renders with old Deck semantics

- **scenario_id**: `deck-go-chat-ui-visual-sync.markdown-corpus`
- **WHEN** assistant text or a markdown Artifact contains headings, paragraphs, links, bold, emphasis, unordered lists, ordered lists, nested lists, blockquotes, horizontal rules, inline code, fenced code, tables, and images
- **THEN** `deck-go` SHALL render those constructs with old Deck-equivalent visible structure, spacing, wrapping, overflow behavior, and code/table/image treatment
- **AND** it SHALL NOT degrade unsupported constructs into plain paragraph text when old Deck rendered them structurally

#### Scenario: Streaming markdown does not corrupt final layout

- **scenario_id**: `deck-go-chat-ui-visual-sync.streaming-markdown`
- **WHEN** an assistant markdown message is received incrementally during streaming
- **THEN** `deck-go` SHALL preserve stable old Deck-equivalent layout during streaming
- **AND** the final rendered message SHALL match the static render of the same content

### Requirement: Tool result cards match old Deck chrome and views

`deck-go` tool-use and tool-result surfaces SHALL match old Deck card structure, collapsibility, status iconography, raw toggle behavior, specialized result views, artifact/download affordances, and structured nested block rendering.

#### Scenario: Tool result card chrome matches old Deck

- **scenario_id**: `deck-go-chat-ui-visual-sync.tool-card-chrome`
- **WHEN** a tool result is rendered for success, error, and structured-content cases
- **THEN** `deck-go` SHALL render old Deck-equivalent collapsible card chrome, default-open error behavior, summary row, status icon, tool title, raw toggle placement, borders, padding, and typography
- **AND** raw mode SHALL show the original result content without altering other cards

#### Scenario: Specialized tool views match old Deck

- **scenario_id**: `deck-go-chat-ui-visual-sync.tool-specialized-views`
- **WHEN** tool results represent bash output, file reads, diffs, highlighted code, virtualized long output, image previews, downloads, or detected Artifacts
- **THEN** `deck-go` SHALL render the old Deck specialized view for each result type
- **AND** structured content SHALL remain block-aware rather than collapsing to opaque JSON unless the user explicitly selects raw view

### Requirement: Canvas panel matches old Deck behavior and visual states

`deck-go` Canvas SHALL match old Deck's right-drawer sizing, header actions, iframe viewport, loading overlay, error overlay, debug panel, and A2UI bridge presentation.

#### Scenario: Canvas opens with old Deck panel chrome

- **scenario_id**: `deck-go-chat-ui-visual-sync.canvas-panel-chrome`
- **WHEN** a canvas Artifact or canvas tool block opens the right panel
- **THEN** `deck-go` SHALL render old Deck-equivalent drawer width behavior, resize handle, header title/actions, iframe frame, loading spinner/text, error recovery action, and debug toggle presentation

#### Scenario: Canvas bridge events preserve old visible behavior

- **scenario_id**: `deck-go-chat-ui-visual-sync.canvas-bridge`
- **WHEN** Canvas receives navigation, eval, A2UI push/reset, request tree, or present commands
- **THEN** `deck-go` SHALL preserve the old Deck visible response and debug output behavior for those commands

### Requirement: Artifact surfaces match old Deck shared renderer behavior

`deck-go` Artifact cards, panels, and shared renderers SHALL match old Deck's visible card/action chrome and content renderers for html, svg, markdown, code, json, table/csv, image, text, and unsupported content.

#### Scenario: Artifact panel actions match old Deck

- **scenario_id**: `deck-go-chat-ui-visual-sync.artifact-panel-actions`
- **WHEN** a detected Artifact is opened
- **THEN** `deck-go` SHALL render old Deck-equivalent card trigger, panel title, language/source metadata, copy/download/fullscreen/close actions, icon sizing, and fullscreen layout

#### Scenario: Shared renderer output matches old Deck

- **scenario_id**: `deck-go-chat-ui-visual-sync.shared-renderer`
- **WHEN** an Artifact contains html, svg, markdown, code, json, table/csv, image, plain text, or unsupported content
- **THEN** `deck-go` SHALL render content with old Deck-equivalent iframe/image/code/markdown/json/table/text behavior, overflow rules, spacing, and fallbacks

### Requirement: Composer and runtime controls match old Deck

`deck-go` SHALL match old Deck's visible Composer, context/status strip, block filters, transcript search, approval dialog, session sidebar, agent tabs, tool progress, Subagent cards, and Subagent tree behavior.

#### Scenario: Composer controls match old Deck

- **scenario_id**: `deck-go-chat-ui-visual-sync.composer-controls`
- **WHEN** the user composes text, attaches files, uses slash commands, mentions resources, sees context pressure, sends, or aborts streaming
- **THEN** `deck-go` SHALL render old Deck-equivalent control placement, iconography, textarea sizing, ghost hint alignment, active command tag, warning row, send/abort behavior, and disabled states

#### Scenario: Runtime control surfaces match old Deck

- **scenario_id**: `deck-go-chat-ui-visual-sync.runtime-controls`
- **WHEN** Chat shows context, filters, transcript search, approval requests, session sidebar actions, agent tabs, tool progress, Subagent cards, or Subagent lineage
- **THEN** `deck-go` SHALL render old Deck-equivalent visible hierarchy, labels, icons, default expanded/collapsed states, keyboard affordances, and action placement

### Requirement: Visual synchronization is browser-verified

The change SHALL include browser evidence proving the synchronized `deck-go` Chat states against old Deck references.

#### Scenario: Paired screenshot matrix covers analyzed gaps

- **scenario_id**: `deck-go-chat-ui-visual-sync.paired-screenshots`
- **WHEN** visual synchronization is complete
- **THEN** the implementation SHALL provide paired old Deck and `deck-go` desktop screenshots for rich transcript, markdown corpus, tool results, Canvas, Artifact, Composer, approval, sidebar, and Subagent states
- **AND** each screenshot pair SHALL identify remaining visual differences or explicitly state that no material visual difference remains for the scenario

#### Scenario: Automated checks cover non-visual renderer details

- **scenario_id**: `deck-go-chat-ui-visual-sync.renderer-tests`
- **WHEN** a renderer behavior cannot be reliably judged by screenshot alone
- **THEN** the implementation SHALL include focused tests for the underlying parser, renderer selection, card state, or action behavior
- **AND** those tests SHALL run through the repository's approved `deck-go` frontend verification path
