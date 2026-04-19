# Legacy Stream Semantics

This document captures the current Deck streaming and replay behavior before reimplementation.

## Critical legacy surfaces

- `dashboard/server/event-bus.ts`
- `dashboard/src/app/api/stream/route.ts`
- `dashboard/src/lib/deck-client.ts`
- `dashboard/src/components/panels/chat/useChatSSE.ts`

## Critical behaviors to preserve

- stream bootstrap
- event replay after reconnect
- replay gap signaling
- chat continuity after refresh
- in-app chat behavior without product split

## Phase 1 Tasks

- capture event taxonomy used by the frontend
- capture replay cursor and reconnect semantics
- capture failure/recovery semantics
- capture chat-specific stream assumptions that cannot be guessed later

## Legacy evidence snapshot

### Event bus

`dashboard/server/event-bus.ts`

- typed event union includes:
  - `chat`
  - `agent`
  - `agent.updated`
  - `approval.pending`
  - `approval.resolved`
  - `canvas`
  - `session-state`
  - `session-msg`
  - `session-tool`
  - other status/notification events
- keeps a replay buffer of `2000` events
- exposes `getEventsSince(lastId)` with `gapDetected`

### SSE route

`dashboard/src/app/api/stream/route.ts`

- authenticates with the same Deck access-gate model as JSON routes
- reads `x-deck-token`
- reads `Last-Event-ID`
- replays missed events from the in-memory ring buffer
- emits `projection.gap` when the requested cursor falls out of buffer
- sends heartbeat frames every `15s`
- enforces a concurrent connection limit

### Browser stream client

`dashboard/src/lib/deck-client.ts`

- sends `x-deck-token`
- sends `Last-Event-ID`
- tracks last seen event id client-side
- retries stream connection with reconnect loop
- prompts for token on `401`

### Chat SSE consumer

`dashboard/src/components/panels/chat/useChatSSE.ts`

- dispatches `chat`, `agent`, `session-tool`, `session-msg`, `session-state`
- handles `approval.pending`, `approval.resolved`, and `canvas`
- handles `projection.gap` by evicting stale sessions and refetching active snapshot
- treats SSE as source of truth during active streaming

## Immediate invariants for Go compatibility

- preserve `x-deck-token` request model
- preserve `Last-Event-ID` replay semantics
- preserve `projection.gap` explicit signaling
- preserve heartbeat keep-alive behavior
- preserve event taxonomy required by current chat stores
- preserve snapshot refill path when a replay gap is detected
