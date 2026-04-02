## ADDED Requirements

### Requirement: Full session hydrate uses authoritative session fields

The chat panel SHALL hydrate session state from both `sessions.list` and `chat.history`, preserving Gateway-provided session metadata instead of truncating it to a sidebar-only subset.

#### Scenario: sessions.list hydrates session meta

- **WHEN** the chat panel loads sessions via `sessions.list`
- **THEN** the client SHALL preserve `model`, `thinkingLevel`, `fastMode`, `verboseLevel`, `status`, `startedAt`, `endedAt`, `runtimeMs`, `totalTokens`, `estimatedCostUsd`, `parentSessionKey`, and `childSessions` in session state

#### Scenario: chat.history hydrates active session config

- **WHEN** the user opens a session and the client fetches `chat.history`
- **THEN** the client SHALL apply returned config fields such as `thinkingLevel`, `fastMode`, and `verboseLevel` to the active session projection

### Requirement: Runtime transcript sync includes session-scoped message events

The chat panel SHALL consume `session.message` and `session.tool` updates for opened sessions, not only `chat` and `agent` run events.

#### Scenario: External transcript update appears in opened session

- **WHEN** a session receives a new transcript message outside the current chat run
- **THEN** the chat panel SHALL update that session via `session.message` without requiring a manual refresh

#### Scenario: Session tool event updates tool blocks

- **WHEN** a `session.tool` event arrives for an opened session
- **THEN** the corresponding tool block and tool progress SHALL update in that session's projection

### Requirement: Thinking stream semantics use non-duplicating updates

The chat panel SHALL treat streaming thinking payloads as either delta updates or authoritative replacements, and SHALL NOT duplicate accumulated reasoning text in the rendered message.

#### Scenario: Repeated thinking stream does not append cumulative copies

- **WHEN** the backend emits thinking stream payloads with cumulative `text`
- **THEN** the client SHALL NOT render `A`, `AB`, `ABC` as three concatenated thinking blocks for the same message

### Requirement: Historical and live sessions render from the same projection model

Historical sessions and live sessions SHALL be rendered from the same session projection model so that identical server state yields identical UI state.

#### Scenario: Reopened historical session matches live session UI

- **WHEN** a previously live session is reopened from history
- **THEN** the session SHALL render the same message blocks, tool blocks, session meta, approval state, and A2UI/canvas-derived state as the live view for the same server state
