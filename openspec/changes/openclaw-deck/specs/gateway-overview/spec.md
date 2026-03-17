## ADDED Requirements

### Requirement: Connection Status Display

The Gateway Overview panel SHALL display the current connection status (connected / reconnecting / error) with a visual indicator. Status SHALL be derived from the WebSocket adapter state.

#### Scenario: Connected state display

- **WHEN** the Gateway WebSocket connection is established and authenticated
- **THEN** the panel SHALL display a green "Connected" status indicator with the Gateway URL

#### Scenario: Error state display

- **WHEN** the Gateway connection fails authentication or cannot reach the host
- **THEN** the panel SHALL display a red "Error" status indicator with the error description

### Requirement: Health Monitoring

The panel SHALL display a health card with link status, authentication age, and session statistics fetched via the `health` RPC.

#### Scenario: Health card rendering

- **WHEN** the user views the Gateway Overview panel
- **THEN** the panel SHALL call the `health` RPC and display link status, auth age (time since last authentication), and active session count

### Requirement: Heartbeat Monitor

The panel SHALL display heartbeat timing information showing the last heartbeat timestamp and latency, derived from WebSocket ping/pong frames.

#### Scenario: Heartbeat display

- **WHEN** the Gateway connection is active
- **THEN** the panel SHALL display the last heartbeat timestamp and round-trip latency in milliseconds, updated on each heartbeat cycle

### Requirement: Gateway State Display

The panel SHALL display the Gateway's current processing state (active / paused) as a read-only indicator. The state SHALL be derived from Gateway config (read via `config.get`), not controlled via `system-presence` RPC.

#### Scenario: Display active state

- **WHEN** the Gateway config indicates active processing state
- **THEN** the panel SHALL display a green "Active" indicator

#### Scenario: Display paused state

- **WHEN** the Gateway config indicates paused processing state
- **THEN** the panel SHALL display a yellow "Paused" indicator

### Requirement: Control Channel Diagnostics

The panel SHALL display a `StatusSummary` derived from the `status` RPC, containing: active session count, connected channel list, and last heartbeat timestamp. For WS roundtrip latency, the Deck Server SHALL self-measure ping/pong on its own WS connection (not rely on Gateway-reported metrics).

#### Scenario: Diagnostics display

- **WHEN** the user views the diagnostics section
- **THEN** the panel SHALL call the `status` RPC and display active sessions, connected channels, and last heartbeat timestamp, plus the Deck Server's self-measured WS roundtrip latency
