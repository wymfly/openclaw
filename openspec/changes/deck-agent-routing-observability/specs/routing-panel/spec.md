## ADDED Requirements

### Requirement: Routing panel displays all bindings sorted by priority

The Routing panel SHALL display a table of all routing bindings sorted by tier priority (peer → peer.parent → guild+roles → guild → team → account → channel), with a fixed Default row at the bottom. Each row SHALL show the tier badge, match conditions summary, and target Agent with badge.

#### Scenario: Display bindings table

- **WHEN** user navigates to the Routing panel
- **THEN** system loads bindings via `deck.routing.list` and renders them sorted by tier priority with the Default agent row fixed at the bottom

#### Scenario: Filter by channel

- **WHEN** user selects "Discord" in the channel filter dropdown
- **THEN** table shows only bindings matching the Discord channel

### Requirement: Routing panel provides route simulator

The right column of the Routing panel SHALL contain a route simulator where users can input channel, account, peer type, peer ID, guild, and roles to test which Agent would handle the message.

#### Scenario: Simulate route with peer match

- **WHEN** user fills in channel=Discord, type=channel, id=dev-help and clicks "Simulate"
- **THEN** system calls `deck.routing.simulate` and displays the matched Agent, matched tier, generated session key, and an 8-row tier checklist showing which tier matched

#### Scenario: Simulate route with default fallback

- **WHEN** user fills in parameters that match no binding and clicks "Simulate"
- **THEN** system displays the default Agent with `matchedBy: "default"` and all 7 binding tiers showing "—" (unchecked)

### Requirement: Binding Dialog supports add/edit with real-time validation

A shared BindingDialog component SHALL be used for adding and editing bindings. The dialog SHALL show channel-specific fields dynamically and validate in real-time via `deck.routing.validate`.

#### Scenario: Add binding with validation

- **WHEN** user fills in the binding dialog and the match conflicts with an existing binding
- **THEN** the validation result area shows the conflict warning with the conflicting binding details before the user saves

#### Scenario: Channel-specific fields

- **WHEN** user selects "Discord" as the channel
- **THEN** the dialog shows Guild ID and Roles fields; when user selects "Slack", those fields are replaced with Team ID

### Requirement: Routing panel shows DM scope configuration

The bottom of the routing rules table SHALL display the current DM merge strategy (`dmScope`) with a link to modify it.

#### Scenario: Display DM scope

- **WHEN** user views the Routing panel
- **THEN** the bottom area shows the current dmScope value (e.g., "per-channel-peer") with a clickable link to modify

### Requirement: Routing panel is responsive

The panel SHALL use side-by-side columns on desktop (≥1280px) and stacked layout on narrower screens.

#### Scenario: Desktop layout

- **WHEN** viewport width is ≥1280px
- **THEN** rules table is on the left and simulator is on the right

#### Scenario: Narrow layout

- **WHEN** viewport width is <1280px
- **THEN** rules table is on top and simulator is collapsible below
