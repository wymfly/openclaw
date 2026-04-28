## Why

`deck-go` is intended to be deployed as a Go backend plus frontend, but its current managed Gateway path still behaves like a partial developer convenience: Gateway autostart is optional, API and Gateway tokens are split, and abnormal Gateway exits are reported instead of being recovered. This creates an operational gap where users may still need to understand and manage `openclaw gateway` directly.

This change makes the OpenClaw Gateway an internal dependency owned by the Go service so operators only need to run and monitor the `deck-go` backend and frontend.

## What Changes

- Make the Go backend the owner of its managed Gateway lifecycle: auto-start on backend boot, keep it healthy while the backend is running, and stop only the Gateway instance it owns when requested.
- Replace the split Deck access token / Gateway token model with one canonical `deck-go` service token; the frontend uses it for Go API access and the Go backend uses it when starting and probing Gateway.
- Default managed Gateway autostart to enabled for `deck-go` deployments.
- Remove default Gateway launch `--force` behavior so Go never kills an unrelated process on the Gateway port.
- Add durable managed Gateway ownership metadata, including PID/process identity, state directory, launch config fingerprint, and last known lifecycle status.
- Add supervisor recovery behavior: health probes, abnormal-exit detection, bounded exponential backoff restart, and clear degraded/failed status reporting.
- Keep token material out of Gateway command-line arguments; pass the token through environment/config surfaces that are not exposed through normal process listings.
- Harden local settings and managed state permissions so tokens and runtime metadata are not world-readable.
- Preserve official OpenClaw daemon/service management as an alternative external deployment model, but do not require operators to install or manage it for `deck-go`.

## Capabilities

### New Capabilities

- `deck-go-managed-gateway`: Defines how `deck-go` owns, secures, starts, monitors, restarts, and exposes status for its internally managed OpenClaw Gateway runtime.

### Modified Capabilities

None. Existing Gateway communication and typed protocol specs remain unchanged; this change defines the `deck-go` runtime ownership and operational contract around Gateway.

## Impact

- **Go backend**:
  - `deck-go/backend/internal/config`
  - `deck-go/backend/internal/runtime`
  - `deck-go/backend/internal/runtime/openclaw`
  - `deck-go/backend/internal/server`
  - `deck-go/backend/internal/access`
- **Frontend**:
  - Token unlock/storage behavior may need copy and API alignment, but frontend should continue calling the Go backend only.
- **Scripts/config**:
  - `deck-go/.env.example`
  - `deck-go/scripts/manage-local-stack.sh`
  - local stack smoke scripts that currently pass separate Deck and Gateway tokens.
- **Security**:
  - Token persistence and managed state file permissions must be tightened.
  - Gateway token must not be passed via process argv.
- **Operations**:
  - Operators should only need to supervise the Go backend and frontend.
  - Gateway status and recovery evidence must be observable through Go runtime APIs and logs.
- **Dependencies**:
  - No new external dependencies are expected.
