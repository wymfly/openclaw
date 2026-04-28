## Context

`deck-go` currently runs as a Go control-plane/BFF plus a Vite frontend. The Go backend already has a managed Gateway supervisor with start/stop/restart APIs, health probes, runtime snapshots, and event publication. However, the current behavior is still operationally leaky:

- Gateway autostart depends on configuration instead of being the default deployment posture.
- The browser-facing Deck token and the Gateway token are separate values.
- The default Gateway command includes `--force`, which can kill an unrelated listener on the Gateway port.
- Gateway abnormal exits become failed state but are not automatically recovered.
- Managed Gateway ownership is in memory; Go restart/recovery cannot reliably distinguish its own previous Gateway from a user-started Gateway.
- Token-bearing settings are currently written with broad file permissions.

Official OpenClaw provides Gateway service management through CLI commands such as `openclaw gateway install/start/stop/restart/status`, backed by launchd on macOS, systemd on Linux, and Scheduled Tasks on Windows. The macOS app uses that service-management surface for general local Gateway operation. That approach is robust for a standalone Gateway service, but it adds a third operator-facing service for the `deck-go` deployment model.

This design keeps Gateway as a Go-owned internal dependency so operators only supervise `deck-go` backend and frontend.

## Goals / Non-Goals

**Goals:**

- Make `deck-go` backend startup sufficient to bring up a usable Gateway by default.
- Make the Go backend continuously maintain the Gateway it owns through health probes and bounded restart recovery.
- Use one canonical `deck-go` service token for frontend-to-Go API auth and Go-to-Gateway auth.
- Prevent accidental takeover or termination of Gateways not owned by the Go backend.
- Avoid exposing token values through process arguments or world-readable files.
- Preserve runtime status APIs so the frontend can show connected/reconnecting/degraded/failed states based on Go-owned truth.
- Provide tests and smoke coverage proving the operator only needs to manage Go backend and frontend.

**Non-Goals:**

- Replacing official `openclaw gateway install/start/stop/restart/status`.
- Making `deck-go` manage arbitrary externally installed Gateway services.
- Supporting multiple concurrently managed Gateways in one `deck-go` backend.
- Changing Gateway wire protocol semantics or generated typed Gateway client contracts.
- Requiring a new external process manager dependency inside the Go backend.

## Decisions

### Keep Gateway Go-owned for `deck-go`

The Go backend remains responsible for starting and maintaining its Gateway child process. It should not require users to install an official OpenClaw daemon/service first.

Rationale: the product boundary is simpler for `deck-go`: frontend calls Go, Go calls Gateway, Gateway remains internal. Operators can monitor and restart one backend service instead of coordinating Go, frontend, and a separately managed Gateway service.

Alternative considered: delegate to official `openclaw gateway install/start/restart/status`. Rejected for this change because it creates a third deployed service and splits lifecycle ownership. It remains a valid advanced deployment option outside this Go-owned mode.

### Use one canonical service token

`deck-go` SHALL resolve a canonical service token from the Deck access token configuration. The frontend sends this token to the Go backend, and the Go backend supplies the same token to its managed Gateway.

Resolution order should be:

1. `DECK_GO_ACCESS_TOKEN`, when set.
2. Persisted `settings.accessToken`.
3. A generated local token persisted to secure settings when no token exists and managed mode requires auth.

`DECK_GO_GATEWAY_TOKEN` and persisted `managedGateway.gatewayToken` should become compatibility inputs only. If provided, they may seed the canonical token during migration, but they should not remain an independent steady-state token.

Alternative considered: keep separate tokens and sync them in scripts. Rejected because it preserves two auth surfaces and keeps the frontend reconnection failure mode harder to diagnose.

### Do not pass token in Gateway argv

The supervisor SHALL pass the canonical token through `OPENCLAW_GATEWAY_TOKEN` or a protected config surface, not `--token <value>`.

Rationale: command-line arguments are commonly visible via process listing. Environment variables are not perfect secret storage, but they are less exposed than argv and match existing Gateway auth resolution.

Alternative considered: keep both env and `--token` for compatibility. Rejected because argv leaks the value without adding meaningful benefit when env is already supported.

### Remove default `--force` and add ownership checks

The default managed Gateway command SHALL NOT include `--force`. Before starting Gateway, the supervisor should check the target port:

- If no listener exists, start normally.
- If a listener exists and ownership metadata plus health probe prove it is the Go-owned Gateway, attach/adopt it.
- If a listener exists but ownership cannot be proven, fail with an actionable status and do not kill it.

Ownership metadata should live under the managed Gateway state directory and include PID, startedAt, bind host/port, state dir, launch fingerprint, token hash, and a generated owner ID.

Alternative considered: keep `--force` to guarantee startup. Rejected because it can terminate a user-managed Gateway or unrelated process, violating the Go-owned boundary.

### Add bounded restart supervision

The supervisor SHALL restart a managed Gateway after abnormal exit or sustained unhealthy probes using bounded exponential backoff with jitter. It should reset the backoff after a sustained healthy period.

The lifecycle states should distinguish:

- `starting`: process launched, not healthy yet.
- `running/healthy`: probes succeed.
- `degraded/unhealthy`: previously healthy Gateway now failing probes but within recovery threshold.
- `restarting`: supervisor is intentionally replacing an owned Gateway.
- `failed`: retry budget exhausted or configuration prevents launch.
- `stopped`: intentional stop or autostart disabled by explicit operator action.

Alternative considered: rely on external system service KeepAlive. Rejected for default `deck-go` deployment because it moves ownership out of the Go process.

### Secure local settings and managed state

The Go backend SHALL create the data directory and managed state directory with owner-only permissions where supported. Files containing tokens or token-derived material SHALL be written with `0600`; metadata that does not contain secrets may still be less restrictive if required, but default should be conservative.

Token hashes in metadata should use a one-way digest for comparison/debugging; raw tokens should only live in secure settings/config/env.

### Preserve observability through Go APIs

The frontend should continue to call Go APIs only. Runtime status endpoints should expose enough information to debug Gateway ownership and recovery without exposing secrets:

- status, health, PID, Gateway URL, autostart flag
- owner ID/fingerprint presence
- restart attempt count and next retry time
- last exit code/time
- last probe error and failure phase
- whether a port conflict blocked startup

## Risks / Trade-offs

- **Risk: Go supervisor becomes a partial service manager.** → Mitigation: keep scope narrow to one child process, add focused lifecycle tests, and document official daemon mode as the alternative for standalone Gateway operations.
- **Risk: generated token persistence changes existing local setups.** → Mitigation: migrate existing `DECK_GO_GATEWAY_TOKEN` / `managedGateway.gatewayToken` only when no access token exists, and report the active token source without logging the token.
- **Risk: refusing to kill port conflicts can make startup less “automatic.”** → Mitigation: this is intentional safety; surface exact conflict diagnostics and remediation through runtime status/logs.
- **Risk: environment variables are not a perfect secret boundary.** → Mitigation: remove argv exposure, use `0600` files, and avoid logging token values.
- **Risk: restart loops can hide persistent configuration errors.** → Mitigation: bound retries, classify failure phases, and stop retrying on static validation/preflight errors.
- **Risk: Go restart may find a stale metadata file.** → Mitigation: validate PID liveness, launch fingerprint, state dir, and successful Gateway auth/health probe before adopting.

## Migration Plan

1. Introduce canonical token resolution while preserving compatibility with existing separate Gateway token inputs.
2. Harden data directory, settings file, and managed Gateway state file permissions.
3. Remove `--force` from default managed Gateway args and add port ownership/adoption checks.
4. Add ownership metadata write/read/update around Gateway start, health, exit, and stop.
5. Add backoff restart supervision for abnormal exit and sustained probe failure.
6. Update runtime status DTOs and frontend/runtime display copy as needed.
7. Update `.env.example`, stack scripts, and smoke tests to use one token and default autostart.
8. Add unit, integration, and local stack smoke tests for startup, restart, ownership refusal, token propagation, and shutdown.

Rollback is safe at the code level if the change is kept in small slices. For deployed users, rollback should preserve the generated canonical token and avoid deleting managed Gateway state unless explicitly requested.

## Open Questions

- Should the generated canonical token be written only to `deck-go` settings, or also mirrored into managed Gateway `openclaw.json` for easier manual recovery?
- Should sustained unhealthy probes trigger process restart immediately after a threshold, or first attempt an in-process Gateway restart signal if the Gateway supports one safely?
- What exact retry budget should ship by default for production: fixed window, max attempts, or indefinite retry with capped backoff plus degraded status?
