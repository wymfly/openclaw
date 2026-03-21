## ADDED Requirements

### Requirement: Route hit log display

The system SHALL display a chronological log of the last N (default 20) actual routing decisions in the Routing panel. Each log entry SHALL show: timestamp, source channel, source peer, matched agent, matched tier, and session key.

#### Scenario: View recent routing decisions

- **WHEN** user opens the Routing panel and navigates to the "Hit Log" tab
- **THEN** the 20 most recent routing results are displayed in reverse chronological order
- **THEN** each entry shows timestamp, channel icon, peer identifier, matched agent name, tier badge, and session key

#### Scenario: Empty hit log

- **WHEN** no routing decisions have been recorded
- **THEN** the hit log shows an empty state with message "No routing activity yet"

#### Scenario: Hit log auto-refresh

- **WHEN** user is viewing the hit log
- **THEN** the log refreshes every 10 seconds via polling
- **THEN** new entries appear at the top of the list with a subtle animation

### Requirement: Hit log filtering

The system SHALL allow filtering hit log entries by channel and by agent.

#### Scenario: Filter by channel

- **WHEN** user selects "telegram" in the channel filter dropdown
- **THEN** only routing decisions from the telegram channel are displayed

#### Scenario: Filter by agent

- **WHEN** user selects "agent-1" in the agent filter dropdown
- **THEN** only routing decisions that resolved to agent-1 are displayed

#### Scenario: Combined filter

- **WHEN** user selects both channel "telegram" and agent "agent-1"
- **THEN** only entries matching both filters are displayed
