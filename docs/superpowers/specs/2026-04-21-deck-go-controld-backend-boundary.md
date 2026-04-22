# Deck Go Stage 2 Controld Backend Boundary

## Purpose

Define the Stage 2 backend module map and responsibility boundaries for
`controld`, the successor identity of the current Stage 1 `deck-go` backend.

## Successor Rule

`controld` is not a second backend truth. It is the successor extraction and
restructure path of the current Stage 1 backend.

During transition:

- Stage 1 `deck-go` backend remains canonical until a Stage 2 slice is proven
- once a Stage 2 slice is cut over, that slice must have one runtime-facing
  backend owner only

## Package / Module Map

Recommended conceptual map:

```text
cmd/
  controld/                  # service entrypoint

internal/
  api/
    http/                    # query/command HTTP handlers
    ws/                      # realtime websocket handlers
  platform/
    auth/                    # local auth, future operator identity hooks
    audit/                   # audit/event recording hooks
    settings/                # control-plane config and runtime profiles
  runtime/
    openclaw/                # runtime adapter transport and command execution
    events/                  # runtime -> canonical event normalization
    projection/              # read-model / projection engine
    registry/                # runtime registry and liveness
```

## Responsibility Allocation

### `runtime/openclaw`

Owns:

- runtime connection lifecycle
- capability handshake
- runtime command execution
- transport-level auth and session handling

Does not own:

- UI-facing event schemas
- projection/read-model materialization

### `runtime/events`

Owns:

- canonical event envelope formation
- event-family normalization
- sequence / epoch metadata preservation
- lossy vs non-lossy mapping rules

Does not own:

- rendering-only UI state
- browser-specific normalization

### `runtime/projection`

Owns:

- runtime summary projections
- session list/detail projections
- timeline snapshots
- run summaries
- tool summaries
- canvas summaries

Does not own:

- runtime transport/session management

### `runtime/registry`

Owns:

- known runtime inventory
- runtime connection profiles
- liveness and capability snapshots

### `api/http`

Owns:

- `/api/v1` query and command handlers
- stable error envelopes
- request acknowledgement model

### `api/ws`

Owns:

- `/api/v1/ws` realtime stream
- reconnect/replay semantics
- scoped subscriptions by runtime and session

### `platform/auth`

Owns:

- local desktop auth in first delivery
- request scoping hooks
- future operator identity / RBAC seam

### `platform/settings`

Owns:

- runtime connection profiles
- control-plane preferences
- desktop-safe persisted settings

## Initial Extraction Targets

These current Stage 1 backend-like seams are the first retirement/migration
targets:

| Current seam | Stage 2 target |
| --- | --- |
| `frontend-next/server/runtime.ts` | split between `runtime/openclaw`, `runtime/events`, `runtime/registry`, and platform bootstrap |
| `frontend-next/src/app/api/activity/route.ts` | `api/http` backed by `runtime/projection` |
| `frontend-next/src/app/api/monitor/runs/route.ts` | `api/http` backed by `runtime/projection` |
| `frontend-next/src/app/api/monitor/runs/[runId]/route.ts` | `api/http` backed by `runtime/projection` |
| `frontend-next/src/app/api/monitor/stats/route.ts` | `api/http` backed by `runtime/projection` |
| `frontend-next/src/app/api/_deck-go-proxy.ts` | temporary compatibility seam only; not carried into target-state ownership |

## Staffing Implication

The first Stage 2 backend implementation lane should be split by these modules,
not by legacy Stage 1 file ownership. That prevents runtime transport,
canonical-event normalization, and projection logic from remaining tangled.
