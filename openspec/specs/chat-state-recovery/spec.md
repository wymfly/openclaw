## ADDED Requirements

### Requirement: Session UI state is recoverable

The system SHALL persist and restore chat-adjacent UI state per session, including approval state, A2UI surfaces, canvas visibility, and chat-side run metadata required to reproduce the conversation view.

#### Scenario: Page refresh restores session UI state

- **WHEN** the user refreshes the page while a session has active A2UI/canvas or pending approval state
- **THEN** reopening that session SHALL restore the corresponding chat UI state without requiring the original stream to remain connected

#### Scenario: Session switch restores prior right-panel state

- **WHEN** the user switches away from a session and later returns
- **THEN** the chat panel SHALL restore that session's recoverable UI state from the session projection rather than from component-local memory

### Requirement: Stream reconnect catches up from persistent projection

Realtime stream reconnect SHALL recover missed chat-related events from persistent storage rather than relying solely on a small in-memory replay buffer.

#### Scenario: Reconnect restores missed approval and A2UI events

- **WHEN** the realtime connection drops and reconnects after additional approval or A2UI events were emitted
- **THEN** the client SHALL receive and apply those missed events during catch-up

### Requirement: Canvas availability is session-scoped and bridge-aware

Canvas command availability SHALL be determined by the actual mounted and ready bridge for the relevant session, not by page-level registration alone.

#### Scenario: Eval rejected when no ready bridge exists

- **WHEN** a canvas eval command targets a session whose canvas bridge is not mounted and ready
- **THEN** the system SHALL reject the eval as unavailable instead of waiting for a timeout

#### Scenario: Ready bridge accepts eval

- **WHEN** a canvas eval command targets a session with a mounted and ready bridge
- **THEN** the system SHALL execute the eval and route the result back to the backend
