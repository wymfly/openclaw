# Deck Go Stage 2 Projection / Read-Model Spec

## Purpose

Define the stable query models the frontend uses for first-load state and
recovery. Stage 2 follows a projection-first read strategy rather than
reconstructing state from raw events in the browser.

## Principles

1. First-load panel state comes from projections.
2. Realtime events patch projections incrementally after initial load.
3. Rendering-only client state stays out of canonical server models.
4. Durable event storage is deferred; durable projections/configuration are not.

## Core Read Models

| Read model | Used by | Required content |
| --- | --- | --- |
| Runtime summary | dashboard / runtime status | connectivity, health, capability summary, compatibility |
| Session list | chat sidebar / sessions panel | session identity, title, status, timestamps, preview |
| Session timeline snapshot | chat console | stable ordered messages plus active run summary |
| Active run summary | chat / monitor | run status, abortability, high-level progress |
| Tool execution summary | chat / inspector / monitor | tool lifecycle summaries required by first-class tool UI |
| Canvas state summary | canvas panel | current surface state, last snapshot, patch recovery anchor |

## Chat Model Split

### Timeline state

- durable ordered messages
- stable message identity
- completed tool summary entries

### Run state

- active run identity
- current run status
- streaming/progress summary
- abortability

### Rendering state

- selection
- viewport / expansion
- grouping affordances

Rendering state remains client-local and does not belong in canonical backend
contracts.

## Recovery and Replay

### On initial load

- query projection endpoint
- render stable snapshot immediately

### On reconnect

- reconnect realtime stream
- replay buffered canonical events when available
- if replay window is insufficient, re-query the relevant projection endpoint

### Explicit non-goal for first delivery

- rebuilding complete panel state from a durable canonical event log

## Persistence Decision

For the first Stage 2 delivery, the backend persists:

- projection state
- runtime profiles
- configuration state

It does **not** require durable canonical event-log persistence.
