## ADDED Requirements

### Requirement: Chronological Event Timeline

The activity feed SHALL display a chronological timeline of all system events, delivered in real-time via SSE from the EventBus.

#### Scenario: Display event timeline

- **WHEN** the user navigates to the Activity Feed panel
- **THEN** the panel SHALL display a reverse-chronological list of events with timestamps, event types, and human-readable descriptions

#### Scenario: Real-time event arrival

- **WHEN** a new event occurs in the system (e.g., agent starts a task, tool call completes)
- **THEN** the event SHALL appear at the top of the timeline within 1 second via SSE delivery

### Requirement: Agent Event Display

The activity feed SHALL display agent-specific events including tool calls, chat messages, and status changes with agent identification.

#### Scenario: Tool call event

- **WHEN** an agent invokes a tool
- **THEN** the activity feed SHALL display an event entry showing the agent name, tool name, and invocation timestamp

#### Scenario: Agent status change

- **WHEN** an agent transitions between states (idle, running, error)
- **THEN** the activity feed SHALL display a status change event with the previous and new state

### Requirement: Event Filtering

The activity feed SHALL support filtering events by agent and by event type.

#### Scenario: Filter by agent

- **WHEN** the user selects a specific agent from the filter dropdown
- **THEN** the feed SHALL display only events associated with that agent

#### Scenario: Filter by event type

- **WHEN** the user selects an event type filter (e.g., "tool_call", "chat", "status")
- **THEN** the feed SHALL display only events of the selected type
