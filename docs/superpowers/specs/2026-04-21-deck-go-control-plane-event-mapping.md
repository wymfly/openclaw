# Deck Go Stage 2 Event Mapping Spec

## Purpose

Define how runtime-native signals map into canonical Stage 2 control-plane
events. The React frontend must consume these canonical events, not raw runtime
frames.

## Mapping Rules

1. Runtime transport details stay inside the backend adapter.
2. Every canonical event must carry:
   - `schemaVersion`
   - `eventId`
   - `type`
   - `runtimeId`
   - `occurredAt`
3. `sessionId` is present when the event is session-scoped.
4. `seq` is present when ordering matters.
5. The mapping layer may be lossy only when the loss is explicit and does not
   harm the supported baseline.

## Initial Canonical Families

| Canonical family | Source runtime domain | Stage 2 use |
| --- | --- | --- |
| `connection.*` | transport/session lifecycle | reconnect/auth/availability UX |
| `runtime.*` | runtime health and capabilities | dashboard/runtime summary |
| `session.*` | session metadata changes | session list/detail |
| `chat.message.*` | message streaming / completion | chat timeline |
| `chat.run.*` | run state transitions | run state and abortability |
| `tool.*` | tool lifecycle summaries | chat timeline + run summaries |
| `canvas.*` | canvas initialization / patch / reset / snapshot | canvas panel |
| `log.*` | runtime log stream | log viewer |
| `alert.*` | alert and webhook-related operator notifications | alert surfaces |

## First-Class vs Inspector-Only Tool Signals

### First-class in the first Stage 2 cutover

- tool call started
- tool completed
- tool failed
- tool progress/state summaries required by run/timeline state

### Inspector-only in the first Stage 2 cutover

- raw tool stdout/stderr append streams
- verbose intermediary transport frames
- tool families not already required by the Stage 1 supported baseline

## Lossy / Non-Lossy Guidance

### Non-lossy for first delivery

- runtime health state
- session identity
- message ordering
- run identity and status
- tool success/failure summaries
- canvas patch/snapshot identity

### Acceptable lossy normalization for first delivery

- transport-specific reconnect chatter that collapses into canonical
  `connection.*` states
- low-level runtime frame structure not needed by any Stage 2 UI contract

## Recovery Rule

Canonical realtime events are not the first-load source of truth.

The system uses:

- projections for initial panel state
- canonical events for live incremental updates
- replay buffers / reconnect windows for short-gap recovery

Durable event-store replay is explicitly deferred.
