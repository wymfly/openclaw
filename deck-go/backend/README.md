# Backend

This directory hosts the current Go control-plane backend for Deck.

Planned responsibilities:

- Gateway capability/bootstrap adapter
- Deck-facing REST API
- Deck-facing SSE stream
- local persistence, projection, and cache
- operator auth/bootstrap
- health and runtime status surfaces

Non-goals:

- redefining Gateway truth
- rendering frontend UI
- future enterprise-platform services

Entrypoints:

- `cmd/deck-go/` — Stage 1 canonical backend entrypoint
- `cmd/controld/` — Stage 2 successor entrypoint alias using the same backend
  handler while the `controld` boundary is being introduced

## Runtime lifecycle ownership seams

The current Stage 2 runtime stack is intentionally split across three backend
packages so lifecycle truth, runtime adaptation, and inventory surfaces do not
collapse together:

- `internal/runtime/supervisor`
  - owns the managed child-process lifecycle snapshot
  - owns start/stop/restart, probe state, exit bookkeeping, and lifecycle event
    emission
  - does **not** own deck-facing DTOs, runtime inventory summaries, or frontend
    contracts
- `internal/runtime/openclaw`
  - owns the Deck control-plane seam above the generic supervisor
  - binds supervisor + transport requester + session subscriptions + projection
    queries into the `ManagedRuntime` facade consumed by HTTP/SSE routes
  - is the correct home for Deck-specific lifecycle wiring and constructor
    defaults; new managed supervisors should be created through
    `NewManagedSupervisorWithOptions(...)` rather than reaching into the generic
    supervisor package directly
  - owns the legacy `/api/runtime/gateway*` route contract after the runtime
    route cutover; treat `openclaw.ManagedRuntime` as the lifecycle response
    authority even when `internal/server/runtime.go` still contains thin HTTP
    translation helpers
  - is also the external-consumption seam for lifecycle route/status behavior:
    downstream packages should use `ManagedRuntime` route/status helpers such as
    `RuntimeGatewayStatusResponse`, `StartRuntimeGateway`, `StopRuntimeGateway`,
    and `RestartRuntimeGateway` instead of reaching for raw supervisor lifecycle
    methods directly
  - is likewise the external-consumption seam for runtime inventory/replay
    views: downstream packages should depend on `ManagedRuntime` registry
    surfaces such as `ListRuntimes`, `GetRuntime`, `Replay`, `SupportsRuntime`,
    and `Subscribe` instead of depending on `RuntimeSupervisor()` or other raw
    supervisor accessors
- `internal/runtime/registry`
  - owns read-only runtime inventory summaries plus replay/subscribe feed
  - consumes supervisor snapshots and capability summaries
  - must never gain process-control responsibilities

This split preserves the intended authority model:

- OpenClaw runtime remains runtime truth
- `deck-go` owns bounded lifecycle supervision above that truth
- legacy runtime-gateway route ownership now flows through
  `openclaw.ManagedRuntime`, not `internal/server`
- external packages should depend on `ManagedRuntime` lifecycle route/status
  helpers, not raw supervisor lifecycle methods
- external packages should depend on `ManagedRuntime` registry/replay surfaces,
  not `RuntimeSupervisor()` or other raw supervisor accessors
- registry surfaces stay descriptive/read-only even when they are fed by
  supervisor lifecycle events

## Managed Gateway operations

`deck-go` default mode is Go-owned Gateway supervision: the backend resolves one
canonical service token from `DECK_GO_ACCESS_TOKEN` or persisted `accessToken`,
passes it to the child Gateway through `OPENCLAW_GATEWAY_TOKEN`, and starts the
managed Gateway automatically when `autoStart` is enabled. The legacy
`DECK_GO_GATEWAY_TOKEN` and `managedGateway.gatewayToken` inputs are
compatibility fallbacks only when no canonical service token exists.

The managed child process runs without `--force` and without token-bearing argv
arguments. The supervisor persists owner-only metadata under the managed state
directory, retries abnormal owned exits with bounded backoff, and stops only the
owned process tree during explicit stop/restart or backend shutdown.

Standalone OpenClaw Gateway service management remains available through the
official CLI path, for example `openclaw gateway install`, `openclaw gateway
start`, `openclaw gateway restart`, and `openclaw gateway status`. Use that path
when Gateway should be operated independently from `deck-go`; use the Go-owned
default when deploying `deck-go` backend + frontend as the operational unit.
