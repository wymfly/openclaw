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

## Runtime Mode Architecture

`RUNTIME_MODE` is loaded once at process start. There is no runtime UI toggle
for switching modes; operators change mode by editing process environment and
restarting `deck-go`.

The mode boundary is the `internal/runtime/facade.RuntimeFacade` interface.
`cmd/deck-go` and `cmd/controld` both call `envconf.Load`, open the
`deck-state.json` store, and build exactly one facade via `facade.BuildFacade`.
HTTP handlers consume that facade for capabilities, endpoint configuration,
Gateway status, and mode-specific operations.

Implementation packages stay physically separated:

- `internal/runtime/local` owns local Gateway service lifecycle operations.
- `internal/runtime/remote` owns remote endpoint state and Gateway RPC access.
- `internal/runtime/shared` contains mode-neutral Gateway client helpers only.
- `internal/runtime/envconf` parses `.env` / process environment and rejects
  invalid runtime configuration.
- `internal/runtime/state` owns `deck-state.json` persistence.

Capability flags drive the frontend and API behavior:

- `mode`: `local` or `remote`
- `configured`: whether the active Gateway endpoint is usable
- `endpointMutable`: `false` for local `.env` endpoints, `true` for remote
  endpoints persisted through `deck-state.json`
- `supervisorState`: `true` when status includes local process fields, `false`
  when status includes remote connection fields

## Operations

Local mode operates a local Gateway service through this repository's
`dist/entry.js gateway install/start/stop/restart/status` CLI path. Gateway
token and port are read from `OPENCLAW_STATE_DIR/openclaw.json`, with
`OPENCLAW_GATEWAY_TOKEN` as the token fallback. Local endpoint fields are
read-only in the UI because `.env` and the Gateway-owned state file remain the
authority.

Remote mode never spawns or stops Gateway. If `RUNTIME_REMOTE_URL` is empty,
`deck-go` starts in first-run state and Gateway passthrough routes return
`503 gateway_not_configured` until the operator saves an endpoint in Settings.
When configured, remote endpoint overrides are stored in `deck-state.json`;
`GET /api/runtime/endpoint` redacts the token.

Break-glass runtime operations use the local admin socket, not HTTP. Configure
the socket path with `RUNTIME_ADMIN_SOCKET` (default `/run/deck-go/admin.sock`
on POSIX) and optionally set `RUNTIME_ADMIN_GROUP` for shared operator access.
When the group resolves, the socket mode is `0660`; otherwise it falls back to
owner-only `0600`.

Examples:

```bash
deck-go admin status
RUNTIME_ADMIN_SOCKET=/run/deck-go/admin.sock deck-go admin status
deck-go admin reload-runtime
```

`status` is read-only and works in both `local` and `remote` mode. The
`reload-runtime` verb is reserved for local operator recovery: local mode
restarts the Gateway service, while remote mode reconnects to the currently
active endpoint. Admin verbs are intentionally not exposed under
`/admin/*`, `/runtime/admin`, or `/internal/admin/*` HTTP routes.

Development examples live at:

- `../.env.local.example`
- `../.env.remote.example`
- `../scripts/dev/run-local.sh`
- `../scripts/dev/run-remote.sh`

## Security

Runtime mode configuration is intentionally fail-closed:

- `RUNTIME_MODE` is required at boot and must be `local` or `remote`.
- Remote endpoint URLs are restricted to `http` and `https` at both env-load
  time and API update time.
- The HTTP listener refuses non-loopback binds unless TLS certificate and key
  paths are configured.
- `deck-state.json` is private runtime state. POSIX writes use owner-only file
  permissions; Windows owner-only ACL parity remains part of the runtime-mode
  security checklist.

Token handling rules:

- `GET /api/runtime/endpoint`, `GET /api/runtime/gateway`, and
  `GET /api/settings` must never return plaintext tokens.
- Access logs redact `Authorization` globally.
- Routes tagged with `sensitiveBody` omit request bodies from access logs:
  `PUT /api/runtime/endpoint`, `POST /api/runtime/endpoint:test`, and
  `PUT /api/settings`.
- Remote Gateway RPCs issued with `tlsVerify: false` emit a WARN containing
  the endpoint URL and method, never the token.
