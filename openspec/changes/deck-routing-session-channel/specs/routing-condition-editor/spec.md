## ADDED Requirements

### Requirement: Visual condition builder for routing rules

The system SHALL provide a tag-based visual condition builder for composing routing match conditions. Each match dimension (channel, accountId, peer, guildId, roles) SHALL be rendered as an addable/removable tag pill. Users SHALL click a "+" button to select a dimension and enter its value.

#### Scenario: Add a channel condition

- **WHEN** user clicks "+" on the condition builder and selects "channel"
- **THEN** a channel selector dropdown appears with all available channels from the channels store
- **THEN** upon selection, a tag pill with the channel name appears in the condition area

#### Scenario: Add a peer condition

- **WHEN** user clicks "+" and selects "peer", then enters a peer identifier
- **THEN** a "peer" tag pill with the entered value appears in the condition area

#### Scenario: Remove a condition dimension

- **WHEN** user clicks the "×" on any tag pill
- **THEN** that dimension is removed from the match condition
- **THEN** the binding is updated via `deck.routing.add` with the modified match

#### Scenario: Compose multi-dimension condition

- **WHEN** user adds both "channel: telegram" and "peer: 12345" tags
- **THEN** the condition builder displays both tags
- **THEN** the resulting match object contains `{ channel: "telegram", peer: "12345" }`

### Requirement: Drag-to-reorder rule priority

The system SHALL support drag-and-drop reordering of routing rules within the same tier. Rules SHALL be rendered in a sortable list using @dnd-kit. Reorder operations SHALL persist via `deck.routing.remove` + `deck.routing.add` with updated order.

#### Scenario: Drag rule up within same tier

- **WHEN** user grabs the drag handle of rule B and drops it above rule A (both in same tier)
- **THEN** rule B appears above rule A in the list
- **THEN** the new order is persisted to the backend

#### Scenario: Keyboard-accessible reorder

- **WHEN** user focuses a drag handle and presses Space, then ArrowUp, then Space
- **THEN** the rule moves up one position (same as mouse drag)

#### Scenario: Cross-tier drag is prevented

- **WHEN** user attempts to drag a "peer" tier rule into the "channel" tier section
- **THEN** the drop is rejected and the rule returns to its original position

### Requirement: Rule conflict detection

The system SHALL detect overlapping match conditions across routing rules and highlight conflicts. Conflict detection SHALL run client-side on the full rule set fetched from `deck.routing.list`. Two rules conflict when their match conditions overlap (same dimension values or one is a subset of another) but route to different agents.

#### Scenario: Two rules with identical match route to different agents

- **WHEN** rule A matches `{ channel: "telegram" }` → agent-1 and rule B matches `{ channel: "telegram" }` → agent-2
- **THEN** both rules are highlighted with a ConflictBadge showing "Conflict: overlapping match"

#### Scenario: Subset conflict detection

- **WHEN** rule A matches `{ channel: "telegram", peer: "123" }` → agent-1 and rule B matches `{ channel: "telegram" }` → agent-2
- **THEN** rule A is flagged as "shadowed by rule B" (B is broader and at same or higher tier)

#### Scenario: No conflict when same agent

- **WHEN** two overlapping rules both route to the same agent
- **THEN** no conflict badge is shown (overlap is harmless)

#### Scenario: Large rule set performance

- **WHEN** more than 100 rules are loaded
- **THEN** conflict detection completes within 500ms without blocking the UI thread
