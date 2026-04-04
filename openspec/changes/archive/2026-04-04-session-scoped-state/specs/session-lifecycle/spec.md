## ADDED Requirements

### Requirement: Active-idle status machine

Each `SessionState` SHALL have a `status` field with values `'active'` or `'idle'`. Status SHALL transition to `'active'` when `setStreaming(sessionKey, true)` is called, and to `'idle'` when `setStreaming(sessionKey, false)` is called (on `final`, `error`, or `aborted` SSE events).

#### Scenario: Streaming sets active

- **WHEN** an SSE delta event arrives for session A
- **THEN** session A's status SHALL be `'active'`

#### Scenario: Final sets idle

- **WHEN** an SSE final event arrives for session A
- **THEN** session A's status SHALL be `'idle'`

#### Scenario: Approval keeps active

- **WHEN** session A has `isStreaming = true` and `activeApproval` is set (waiting for human approval)
- **THEN** session A's status SHALL remain `'active'` (the run has not ended)

### Requirement: LRU eviction of idle sessions

`evictStale(maxIdleMs)` SHALL scan the sessions Map and remove entries where: `status === 'idle'` AND `key !== activeSessionKey` AND `Date.now() - lastAccessedAt >= maxIdleMs`. The default `maxIdleMs` SHALL be 300000 (5 minutes).

#### Scenario: Active session never evicted

- **WHEN** `evictStale()` runs and session A has `status === 'active'`
- **THEN** session A SHALL NOT be evicted, regardless of `lastAccessedAt`

#### Scenario: Current session never evicted

- **WHEN** `evictStale()` runs and session B is the `activeSessionKey`
- **THEN** session B SHALL NOT be evicted, regardless of `status` or `lastAccessedAt`

#### Scenario: Stale idle session evicted

- **WHEN** `evictStale()` runs and session C has `status === 'idle'`, is not `activeSessionKey`, and `lastAccessedAt` is older than `maxIdleMs`
- **THEN** session C SHALL be removed from the sessions Map
- **AND** `abortSession(key)` SHALL be called to cancel pending fetches
- **AND** session C's `SessionMeta` entry SHALL be preserved in `sessionMeta[]`

### Requirement: Eviction via Zustand set()

`evictStale` SHALL create a new `Map` instance via `new Map(state.sessions)` and call `delete` on the copy, then update the store via `setState({ sessions: newMap })`. Direct mutation of the existing Map reference is prohibited.

#### Scenario: UI reacts to eviction

- **WHEN** `evictStale()` removes a session from the Map
- **THEN** Zustand subscribers SHALL be notified of the state change
- **AND** components consuming the evicted session's state SHALL re-render

### Requirement: Natural eviction triggers

`evictStale()` SHALL be called at the following trigger points instead of periodic timers: (1) inside `setActiveSession(key)`, (2) inside `ensureSession(key)` when `Map.size` exceeds `MAX_CACHED_SESSIONS` (default: 20), (3) on `document.visibilitychange` when page transitions to `'hidden'`, (4) when any session's status transitions from `'active'` to `'idle'` (i.e., inside `setStreaming(sessionKey, false)`).

#### Scenario: Eviction on session switch

- **WHEN** the user switches to session B via `setActiveSession('B')`
- **THEN** `evictStale()` SHALL run before the switch completes

#### Scenario: Eviction on page hide

- **WHEN** the browser tab becomes hidden (`visibilitychange` → `hidden`)
- **THEN** `evictStale()` SHALL run to aggressively clean up idle sessions

#### Scenario: Eviction on stream completion

- **WHEN** a session transitions from `'active'` to `'idle'` (streaming ends)
- **THEN** `evictStale()` SHALL run to clean up other stale idle sessions

### Requirement: MAX_CACHED_SESSIONS threshold

The `ensureSession` trigger SHALL use a configurable `MAX_CACHED_SESSIONS` constant with a default value of 20. When `Map.size >= MAX_CACHED_SESSIONS`, `evictStale()` SHALL be called before creating the new session.

#### Scenario: Threshold triggers eviction

- **WHEN** `ensureSession(key)` is called and `sessions.size >= 20`
- **THEN** `evictStale()` SHALL run before the new session is created

### Requirement: Transparent rehydration

When `setActiveSession(key)` is called for a session that has been evicted (not in the sessions Map), the system SHALL transparently create a new `SessionState` via `ensureSession(key)` and load history from the API.

#### Scenario: Evicted session rehydrated on access

- **WHEN** the user switches to session D which was previously evicted
- **THEN** a new empty `SessionState` SHALL be created
- **AND** `loadHistory(key, signal)` SHALL be called to fetch messages from `/api/chat/history`
- **AND** once loaded, messages SHALL be set via `setMessages` (with merge strategy)

#### Scenario: Rehydrate aborted on quick switch

- **WHEN** the user switches to evicted session D and then immediately switches to session E
- **THEN** the `loadHistory` fetch for session D SHALL be guarded (if `activeSessionKey !== key`, discard result)

### Requirement: lastAccessedAt tracking

`ensureSession(key)` SHALL set `lastAccessedAt = Date.now()` on creation. `setActiveSession(key)` SHALL update `lastAccessedAt` for the target session when it exists in the cache (cache hit).

#### Scenario: Access time updated on view

- **WHEN** the user switches to session A (cache hit)
- **THEN** session A's `lastAccessedAt` SHALL be updated to `Date.now()`

### Requirement: Eviction parameter for testability

`evictStale(maxIdleMs)` SHALL accept `maxIdleMs` as a parameter to allow tests to use short intervals (e.g., 100ms) instead of the 5-minute default.

#### Scenario: Fast eviction in tests

- **WHEN** `evictStale(100)` is called and a session has been idle for 150ms
- **THEN** the session SHALL be evicted

### Requirement: Session sidebar indicator derived from state

The system SHALL provide a `useSessionIndicator(key)` hook that derives a status indicator from `SessionState` fields: `activeApproval` → `'approval'`, `isStreaming` → `'streaming'`, `a2uiState` → `'canvas'`, else → `'idle'` or `'none'`.

#### Scenario: Approval indicator shown

- **WHEN** session A has `activeApproval !== null`
- **THEN** `useSessionIndicator('A')` SHALL return `'approval'`

#### Scenario: Streaming indicator shown

- **WHEN** session B has `isStreaming === true` and `activeApproval === null`
- **THEN** `useSessionIndicator('B')` SHALL return `'streaming'`
