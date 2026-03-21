## ADDED Requirements

### Requirement: DM scope strategy selector

The system SHALL display the four DM scope strategies as selectable cards in the Sessions panel. Each card SHALL show a diagram illustrating the session isolation granularity for that mode. The current active strategy SHALL be highlighted.

The four modes are:

1. **main** — single shared session per agent
2. **per-peer** — one session per unique peer
3. **per-channel-peer** — one session per (channel, peer) pair
4. **per-account-channel-peer** — one session per (account, channel, peer) triple

#### Scenario: View scope strategies

- **WHEN** user opens the Sessions panel and navigates to the "Scope" tab
- **THEN** four cards are displayed, each with a title, description, and mini-diagram
- **THEN** the currently active strategy is highlighted with a primary border

#### Scenario: Understand scope via diagram

- **WHEN** user views the "per-channel-peer" card
- **THEN** the diagram shows separate session boxes for each channel×peer combination
- **THEN** a tooltip explains "Messages from the same peer on different channels get separate sessions"

#### Scenario: Select a different scope strategy

- **WHEN** user clicks on the "per-peer" card (not currently active)
- **THEN** a confirmation dialog appears: "Change DM scope to per-peer? This affects how new sessions are created."
- **THEN** upon confirmation, the strategy is updated and the card becomes highlighted

### Requirement: Session key parser and explainer

The system SHALL parse session keys in the format `agent:{agentId}:{scopeKey}` and display a structured breakdown showing each segment's meaning.

#### Scenario: Parse a DM session key

- **WHEN** user views a session with key `agent:bot-1:telegram:user123`
- **THEN** the key is displayed as structured segments: Agent=bot-1, Channel=telegram, Peer=user123
- **THEN** each segment has a label and tooltip explaining its role

#### Scenario: Parse a main-scope session key

- **WHEN** user views a session with key `agent:bot-1:main`
- **THEN** the key breakdown shows Agent=bot-1, Scope=main (shared session)

#### Scenario: Parse an unknown key format

- **WHEN** user views a session with a non-standard key format
- **THEN** the raw key is displayed with a "Custom format" label
