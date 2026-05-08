# sessions - API usage

## Deck-facing API

### `GET /sessions`

Wrapper: `fetchSessions(params)`.

Supported query params:

- `agentId`
- `search`
- `limit`
- `activeMinutes`

Usage rules:

- Render returned `sessions` as BFF-shaped `DeckGoSessionMeta[]`.
- The current UI fetches a broad limit and pages locally; do not imply a
  server-side cursor exists.

### `POST /chat/sessions/preview`

Wrapper: `fetchSessionPreviews(keys)`.

Usage rules:

- Request preview keys from the loaded inventory.
- Missing previews should not block inventory rendering.

### `GET /sessions/{sessionKey}`

Wrapper: `fetchSessionDetail({ sessionKey, agentId?, limit? })`.

Usage rules:

- Use only for the selected session key.
- Detail result may include `session` and `messages`.

### `GET /chat/history`

Wrapper: `fetchChatHistory({ sessionKey, limit? })`.

Usage rules:

- Check transcript cache first.
- Normalize fetched messages before caching.
- Invalidate cache after selected-session mutations.

### Usage/context

Wrappers:

- `fetchUsageSessions({ includeContextWeight: true, key, limit: 1 })`
- `fetchUsageSessionLogs({ key, limit: 50 })`

Usage rules:

- Context weight is optional.
- Usage logs are evidence rows, not the canonical transcript.

### Subagent lineage

Wrapper: `fetchSubagentLineage({ sessionKey })`.

Usage rules:

- Only load when selected session is subagent-like.
- Preserve local relation navigation to parent/child sessions.

### Session mutations

Wrappers:

- `resetSession({ sessionKey, reason })`
- `clearSession({ sessionKey })`
- `deleteSession({ sessionKey, agentId })`
- `patchSession({ sessionKey, model?, label?, thinkingLevel?, fastMode? })`
- `compactChatSession(sessionKey)`

Usage rules:

- Reset, clear, compact, delete, and compaction restore need confirmation.
- Patch stays scoped to product-backed model, label, thinking, fast mode, and
  similar safe fields; this module is not an exhaustive Gateway patch editor.
- Successful mutations invalidate selected transcript cache.
- Delete does not preserve selected detail/history.

### Compaction checkpoints

Wrappers:

- `fetchCompactionCheckpoints(sessionKey)`
- `branchCompactionCheckpoint(sessionKey, checkpointId)`
- `restoreCompactionCheckpoint(sessionKey, checkpointId)`

Usage rules:

- Fetch only when `compactionCount` is positive.
- Branch is mutating.
- Restore is destructive and must arm confirmation before executing.
- Restore refreshes checkpoint state after execution.

## Adjacent workflows

These Gateway session methods exist in the Deck contract chain but remain
Chat/runtime adjacent-owned in this module pass:

- `sessions.create` -> `createChatSession()` / `POST /chat/sessions/create`
- `sessions.send` -> `sendChatMessage()` / `POST /chat/send`
- `sessions.abort` -> `abortChatRun()` / `POST /chat/abort`
- `sessions.steer` -> `steerChatSession()` / `POST /chat/steer`

Sessions may show selected-session context or navigation only. It must not add
a second composer, live send, abort, or steer control.

## Gateway-only or product-deferred knobs

Do not expose these as guaranteed Sessions controls in this change:

- `sessions.list`: `includeGlobal`, `includeUnknown`, `label`, `spawnedBy`,
  derived title, and last-message options.
- `sessions.preview`: `limit`, `maxChars`.
- `sessions.create`: caller-supplied `key`, `task`.
- `sessions.compact`: `maxLines`.
- `sessions.delete`: `deleteTranscript`, `emitLifecycleHooks`.
- `sessions.patch`: execution, elevated, trace, spawn, subagent control,
  send-policy, and group-activation fields not already product-backed.

## Backend chain

```txt
SessionsPanel / session helpers
  -> frontend-new/src/api.ts
  -> deck-go Go BFF routes
  -> runtime openclaw managed adapter
  -> OpenClaw Gateway only behind the BFF/runtime boundary
```

## Current exploration notes

- No deterministic BFF forwarding drift was found before the proposal.
- Deterministic product/UI safety drift was found in the current production UI:
  reset, clear, and compaction restore need confirmation gates.
- `GET /sessions` and `GET /chat/sessions` share list parameter behavior.
- `GET /sessions/{sessionKey}` uses BFF detail shaping, not direct raw Gateway
  rendering.
- Session usage/context routes are BFF aggregates.
- The mock Gateway currently needs richer session detail/history/compaction data
  for visual E2E.

## Mock requirements

Focused mock visual E2E may need contract-shaped fixture data for:

- multiple sessions including direct and subagent sessions
- session previews
- selected session detail
- chat history messages
- usage totals and context weight
- usage session logs with one high-token row
- compaction checkpoints
- subagent lineage
- reset/clear/patch/compact/delete responses
- compaction branch/restore responses

Evidence should be labeled as mock visual coverage only.
