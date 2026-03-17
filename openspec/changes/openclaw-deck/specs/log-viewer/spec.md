## ADDED Requirements

### Requirement: Real-Time Log Streaming

The log viewer SHALL display real-time streaming logs from the Gateway. The Deck Server SHALL periodically call the `logs.tail` RPC to poll for new log entries and forward them to the browser as SSE events. No direct WS log event subscription is used.

#### Scenario: Stream logs in real-time

- **WHEN** the user opens the Log Viewer panel
- **THEN** the Deck Server SHALL poll `logs.tail` RPC at a configurable interval (default 2s) and push new log entries to the browser via SSE, with automatic scroll-to-bottom behavior

#### Scenario: Log entry format

- **WHEN** a log entry is displayed
- **THEN** it SHALL show timestamp, log level (with color coding), source identifier, and the log message

### Requirement: Level Filter

The log viewer SHALL support filtering logs by level: debug, info, warn, error.

#### Scenario: Filter by log level

- **WHEN** the user selects "error" from the level filter
- **THEN** the panel SHALL display only log entries with level "error" and hide all other levels

#### Scenario: Multiple level selection

- **WHEN** the user selects both "warn" and "error" levels
- **THEN** the panel SHALL display log entries matching either level

### Requirement: Source Filter

The log viewer SHALL support filtering logs by source (gateway / agent / channel).

#### Scenario: Filter by source

- **WHEN** the user selects "agent" from the source filter
- **THEN** the panel SHALL display only log entries originating from agent processes

### Requirement: Session Filter

The log viewer SHALL support filtering logs by session ID to isolate logs from a specific conversation.

#### Scenario: Filter by session

- **WHEN** the user enters or selects a session ID in the session filter
- **THEN** the panel SHALL display only log entries associated with that session ID
