## ADDED Requirements

### Requirement: Session-scoped state container

The system SHALL maintain a `Map<string, SessionState>` in the Zustand store, where each key is a `sessionKey` and each value is an independent `SessionState` containing messages, streaming state, error, tool progress, approval, and A2UI state.

#### Scenario: Independent session state

- **WHEN** two sessions (A and B) exist simultaneously
- **THEN** modifying session A's messages SHALL NOT affect session B's messages

#### Scenario: Session auto-creation on unknown event

- **WHEN** an SSE event arrives with a `sessionKey` that does not exist in the Map
- **THEN** the system SHALL create a new `SessionState` via `ensureSession(key)`

### Requirement: SSE single connection with client-side routing

The system SHALL maintain a single EventSource connection with an empty dependency array (`[]`), and route all SSE events to the correct `SessionState` by `payload.sessionKey`.

#### Scenario: SSE connection survives session switch

- **WHEN** the user switches from session A to session B
- **THEN** the EventSource connection SHALL NOT be closed or recreated
- **AND** the browser Network panel SHALL show exactly 1 EventSource connection

#### Scenario: Background session receives events

- **WHEN** session A is streaming and the user switches to session B
- **THEN** SSE events for session A SHALL continue to be dispatched to session A's `SessionState`
- **AND** session A's messages SHALL be updated in the background

### Requirement: First-delta vs subsequent-delta dispatch

The SSE dispatcher SHALL distinguish the first delta event for a new run from subsequent deltas using `session.streamingRunId !== payload.runId`.

#### Scenario: First delta creates assistant message

- **WHEN** a delta event arrives with a `runId` that differs from `session.streamingRunId`
- **THEN** the dispatcher SHALL call `addMessage` to create a new assistant message with `id = runId`

#### Scenario: Subsequent delta updates existing message

- **WHEN** a delta event arrives with a `runId` that matches `session.streamingRunId`
- **THEN** the dispatcher SHALL call `updateStreamingBlocks` to append text to the existing message

### Requirement: Idempotent message addition

`addMessage` SHALL be idempotent — if a message with the same `id` already exists in the session's messages array, the call SHALL be a no-op.

#### Scenario: Duplicate message rejected

- **WHEN** `addMessage(sessionKey, msg)` is called and `msg.id` already exists in that session's messages
- **THEN** the messages array SHALL remain unchanged

### Requirement: Async operation cancellation via AbortController

Each session SHALL have an associated `AbortController` managed in a module-level `Map<string, AbortController>` (not in the Zustand store). All async fetch operations for a session SHALL use its `AbortController.signal`.

#### Scenario: Fetch cancelled on session eviction

- **WHEN** a session is evicted and its `AbortController.abort()` is called
- **THEN** all pending fetch operations for that session SHALL be cancelled
- **AND** their callbacks SHALL NOT modify the store

### Requirement: Globally unique message IDs

Historical messages loaded from `chat.history` SHALL use the ID format `msg.id ?? ${sessionKey}:${msg.timestamp}:${index}` instead of the previous `hist-${index}`.

#### Scenario: IDs unique within single load cycle

- **WHEN** historical messages are loaded from `chat.history` in a single call
- **THEN** each message SHALL receive a unique ID within that load result
- **AND** no two messages in the same session SHALL have the same ID at any point in time

### Requirement: Fine-grained selector hooks

The system SHALL provide fine-grained selector hooks (`useSessionMessages`, `useSessionStreaming`, `useSessionToolProgress`, `useSessionApproval`) that only trigger re-render when the specific field of the specific session changes.

#### Scenario: Cross-session re-render isolation

- **WHEN** session A receives a new message via SSE
- **THEN** a component subscribed to session B via `useSessionMessages('B')` SHALL NOT re-render

### Requirement: Session switch without clearMessages

`setActiveSession(key)` SHALL NOT call `clearMessages()`. Switching sessions SHALL only move the `activeSessionKey` pointer; the previous session's messages SHALL remain in the Map.

#### Scenario: Instant switch-back

- **WHEN** the user switches from session A to session B and back to session A
- **THEN** session A's messages SHALL be displayed immediately without a loading delay
- **AND** no fetch to `chat.history` SHALL be triggered (cache hit)

### Requirement: setMessages rehydrate strategy preserves SSE messages

`setMessages(sessionKey, msgs)` SHALL use a "history-then-append" strategy: replace the session's messages with the history-loaded messages, then append any messages that arrived via SSE during the load (identified by having an `id` that is a `runId` format, not a history-index format). This avoids relying on cross-channel ID deduplication, since SSE messages use `runId` as ID while history messages use `${sessionKey}:${timestamp}:${index}`.

#### Scenario: SSE message preserved during rehydrate

- **WHEN** session A is being rehydrated and a `loadHistory` fetch is in progress
- **AND** an SSE delta event adds a new message (with `id = runId`) to session A before the fetch completes
- **THEN** when the fetch completes and `setMessages` is called, the SSE-delivered message SHALL be appended after the history messages

#### Scenario: History messages fully replaced on rehydrate

- **WHEN** `setMessages` is called with history-loaded messages
- **AND** the session has no SSE-delivered messages (empty or only history messages)
- **THEN** the messages array SHALL be fully replaced with the new history messages

### Requirement: Compatibility bridge during migration

During Steps 2-4 of the migration, a `getActiveSession()` bridge function SHALL provide backward compatibility so un-migrated components can continue to access `messages`, `isStreaming`, etc. via the old API patterns.

#### Scenario: Un-migrated component works during transition

- **WHEN** Step 2 (store rewrite) is complete but Step 4 (component migration) has not yet reached `MessageList`
- **THEN** `MessageList` SHALL still render correctly using the compatibility bridge

### Requirement: SessionMeta separation from SessionState

The sidebar session list SHALL be driven by `sessionMeta: SessionMeta[]` (loaded from `/api/chat/sessions`), which is independent from the `sessions` Map. `ensureSession` SHALL NOT create a `SessionMeta` entry.

#### Scenario: Phantom session not in sidebar

- **WHEN** an SSE event creates a session via `ensureSession` for a `sessionKey` not in `sessionMeta`
- **THEN** the session SHALL NOT appear in the sidebar until the next `refreshSessionMeta()` call

### Requirement: Immutable Map updates for all session-scoped actions

All store actions that modify a `SessionState` within the sessions Map SHALL create a new `Map` instance (via `new Map(state.sessions)`) and a new `SessionState` object (via spread `{ ...session, ... }`), then update the store via `set({ sessions: newMap })`. Direct mutation of the existing Map or SessionState references is prohibited, as it would silently bypass Zustand's shallow equality check.

#### Scenario: Message addition triggers re-render

- **WHEN** `addMessage(sessionKey, msg)` adds a new message to session A
- **THEN** the `sessions` Map reference SHALL change (new Map instance)
- **AND** components subscribed to session A's messages SHALL re-render

#### Scenario: Direct mutation does not occur

- **WHEN** any session-scoped action is called
- **THEN** the action SHALL NOT call `sessions.get(key).messages.push(...)` or `sessions.set(key, ...)` on the existing Map reference

### Requirement: SSE dispatcher routes agent events by sessionKey

The SSE dispatcher SHALL route `agent` events to the correct `SessionState` by `payload.sessionKey`, calling `updateToolProgress(sessionKey, ...)` to track tool execution progress.

#### Scenario: Agent tool event routed to correct session

- **WHEN** an SSE `agent` event arrives with `sessionKey = 'A'` and contains tool execution data
- **THEN** the dispatcher SHALL call `updateToolProgress('A', ...)` on session A's state

### Requirement: SSE dispatcher routes A2UI events by sessionKey

The SSE dispatcher SHALL route `a2ui` events to the correct `SessionState` by `payload.sessionKey`, calling `setA2UIState(sessionKey, ...)`.

#### Scenario: A2UI event routed to correct session

- **WHEN** an SSE `a2ui` event arrives with `sessionKey = 'B'`
- **THEN** the dispatcher SHALL call `setA2UIState('B', ...)` on session B's state

### Requirement: reloadFullContent fetches complete content blocks after streaming

After an SSE `final` event, `reloadFullContent(sessionKey, runId)` SHALL fetch the complete content blocks from `chat.history` and replace the streaming message's content via `replaceMessageContent`. The fetch SHALL use the session's `AbortController.signal` and retry once on failure.

#### Scenario: Full content blocks loaded after stream completes

- **WHEN** an SSE `final` event arrives for session A with `runId = 'run-123'`
- **THEN** `reloadFullContent('A', 'run-123')` SHALL fetch from `/api/chat/history`
- **AND** replace the message with `id = 'run-123'` with complete content blocks (including tool_use, tool_result, thinking)

#### Scenario: Reload cancelled when session evicted

- **WHEN** `reloadFullContent` is in progress and the session is evicted
- **THEN** the fetch SHALL be cancelled via `AbortController.signal`
- **AND** no store modification SHALL occur
