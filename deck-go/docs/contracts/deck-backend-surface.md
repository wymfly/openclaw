# Deck Backend Surface

This document defines the Deck-facing surface the Go backend will own.

## Owned Surfaces

- frontend REST API
- frontend SSE stream
- local auth/bootstrap
- local persistence/projection/cache
- health/status surfaces
- compatibility façade for the React SPA

## Non-owned Surfaces

- Gateway protocol truth
- Gateway method semantics
- browser-only ephemeral panel state

## Legacy server/runtime footprint

Current core server files under `dashboard/server/`:

- `runtime.ts`
- `gateway-adapter.ts`
- `event-bus.ts`
- `access-gate.ts`
- `contracts.ts`
- `deck-settings.ts`
- `json-store.ts`
- `node-connection.ts`
- `approval-bridge.ts`
- `health-poller.ts`
- `rate-limit.ts`
- `run-aggregator.ts`

Observations:

- there are `18` top-level server files in `dashboard/server/`
- legacy Deck already contains a local control-plane runtime, not just UI helpers
- Go backend must absorb these responsibilities intentionally, not by route-by-route accident

## Initial backend responsibility split

### Must move to Go backend

- access token validation / local control-plane auth gate
- Gateway connection lifecycle and capability bootstrap
- Deck-facing REST façade currently implemented in `src/app/api/**`
- Deck-facing SSE stream, connection limiting, replay, and continuity signaling
- local settings persistence currently backed by JSON files
- local projection/cache/persistence for operator-facing continuity
- health/status aggregation

### Must stay outside Go backend

- Gateway runtime truth and method semantics
- browser-only transient view state
- purely visual component rendering and interaction

### Requires explicit compatibility façade

- `/api/stream` semantics
- `x-deck-token` and `Last-Event-ID` behavior
- chat snapshot/replay fetch behavior
- approval/canvas/session side-channel event handling expected by current stores

## Phase 1 Tasks

- inventory every legacy Next route under `dashboard/src/app/api/**`
- group routes by domain and runtime dependency
- classify each route as:
  - passthrough façade
  - normalized façade
  - local-only Deck state
  - obsolete / deferred

## Initial route-domain migration priority

1. `stream`
2. `chat`
3. `config`
4. `channels`
5. `deck`
6. `models`
7. `logs`
8. `sessions`

Rationale:

- these domains sit directly on cutover-critical workflows
- they expose the highest concentration of local control-plane semantics today
