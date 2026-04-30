# Deck-go Runtime Mode Decoupling — Design Spec

**Date**: 2026-04-28
**Status**: Approved (brainstorm complete; awaiting implementation plan)
**Author**: claude-opus-4-7 + user
**Related**: `docs/plans/2026-03-16-openclaw-deck-design.md`, `docs/plans/2026-03-27-gateway-protocol-sdk-design.md`

## Motivation

Deck-go currently embeds a Gateway supervisor (~700 LOC: PID adoption, fingerprinting, ownership metadata, bounded backoff). This couples Deck-go's lifecycle with Gateway's: a Deck-go crash kills the agent runtime; Deck-go can only manage a Gateway on the same host. As we position Deck-go as the management/operations platform on top of OpenClaw's agent runtime, this coupling is a hard ceiling — ops platforms manage remote runtimes, and they should not sit on the critical path of runtime availability.

This spec decouples the two via a `RUNTIME_MODE` environment variable that picks one of two runtime implementations behind a single interface, with the rest of Deck-go entirely mode-agnostic.

## Design Decisions (locked through brainstorm)

| Q                                  | Decision                                                                                                                                            |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lifecycle controls in bundled mode | **Pure observatory** — no Start/Stop/Restart UI, supervisor manages itself                                                                          |
| Read-only scope in bundled mode    | `managedGateway.*` + `accessToken`; UI prefs and paired devices stay editable                                                                       |
| .env vs JSON precedence            | `.env` is supreme truth; bundled mode reads only `.env`; remote mode uses `.env` as defaults, JSON overrides whole-section                          |
| First-run UX (remote, no config)   | Wizard banner + auto-expand Endpoint section in Settings                                                                                            |
| Bundled UI display strategy        | One panel structure for both modes; capability flags drive readonly-vs-editable; GatewayPanel runtime tab is a structured summary card (no buttons) |
| Multi-profile in remote mode       | Out of scope (single profile only)                                                                                                                  |
| Architecture approach              | Facade interface + two impl packages (`bundled/`, `remote/`) — physical isolation                                                                   |
| Backwards compatibility            | Breaking change; no legacy fallbacks                                                                                                                |

## Architecture

### Mode flow

```
┌─────────────────────── BUNDLED MODE ────────────────────────┐
│   .env  (sole source of truth)                              │
│     │                                                       │
│     ▼                                                       │
│   Deck-go  ───spawn───►  Gateway (local subprocess)         │
│     ▲ │                       │                             │
│     │ └──── RPC client ──────┘                             │
│   Browser ◄── HTTP ── Deck-go (UI is read-only for runtime) │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────── REMOTE MODE ─────────────────────────┐
│   .env  (mode + first-run defaults)                         │
│     │                                                       │
│     ▼                                                       │
│   deck-state.json  (UI overrides; active config source)     │
│     │                                                       │
│     ▼                                                       │
│   Deck-go  ─── RPC over HTTP(S) ──►  Gateway (remote host)  │
│   Browser ◄── HTTP ── Deck-go (UI editable for runtime)     │
└─────────────────────────────────────────────────────────────┘
```

### Invariants

1. `RUNTIME_MODE` is read once at boot and is **immutable at runtime**. There is no UI control to switch modes.
2. **Bundled mode does not read JSON for runtime config.** All runtime parameters come from `.env` only.
3. **Remote mode never imports the supervisor package.** No PID management, no fingerprinting, no process-signaling code in remote mode binaries' execution path.
4. **Browser only talks to Deck-go**, never directly to Gateway. Deck-go remains the auth/aggregation layer.
5. **`/runtime/capabilities` is the single source of truth for UI gating.** No `if (mode === ...)` branching in frontend logic.

### Layered split

| Layer                      | Bundled                              | Remote                                   |
| -------------------------- | ------------------------------------ | ---------------------------------------- |
| Runtime Facade (interface) | same                                 | same                                     |
| Runtime Impl (package)     | `bundled/` — supervisor + RPC client | `remote/` — RPC client only              |
| HTTP Routes                | mode-agnostic + bundled-only summary | mode-agnostic + remote endpoint mutation |

## Configuration

### `.env` schema

```dotenv
# ─── Required: mode selection ────────────────────────────────
RUNTIME_MODE=bundled                          # bundled | remote

# ─── Deck-go itself (both modes) ─────────────────────────────
DECK_LISTEN_ADDR=127.0.0.1:3000               # Deck-go HTTP listen address
DECK_ACCESS_TOKEN=<token>                     # token clients use to access Deck-go

# ─── Bundled mode (RUNTIME_MODE=bundled) ─────────────────────
RUNTIME_BUNDLED_COMMAND=openclaw              # binary path (PATH lookup if relative)
RUNTIME_BUNDLED_ARGS=gateway run --bind loopback --port 18789
RUNTIME_BUNDLED_WORKING_DIR=/var/lib/openclaw
RUNTIME_BUNDLED_BIND_HOST=127.0.0.1
RUNTIME_BUNDLED_BIND_PORT=18789
RUNTIME_BUNDLED_GATEWAY_TOKEN=<token>         # token Deck-go injects into Gateway
RUNTIME_BUNDLED_AUTOSTART=true                # auto-spawn at Deck-go boot
RUNTIME_BUNDLED_ENV_<KEY>=<value>             # passed through to Gateway process (multi)

# ─── Remote mode first-run defaults (optional) ───────────────
RUNTIME_REMOTE_URL=https://gateway.example.com:18789
RUNTIME_REMOTE_TOKEN=<token>
RUNTIME_REMOTE_TLS_VERIFY=true
```

Loading order: process env > `.env` file (dev mode only). `.env` file path defaults to `./.env`, overridable via `DECK_DOTENV_FILE`.

### `deck-state.json` schema

Read/written only in remote mode for the `remote` section. Always read/written for user-preference sections.

```jsonc
{
  "appearance": { "theme": "auto" | "light" | "dark", "fontSize": "sm" | "md" | "lg" },
  "notifications": { "browserPush": false, "soundOn": true },
  "pairedDevices": [ { "id": "...", "name": "...", "tokenHash": "...", "pairedAt": "..." } ],

  // Remote mode only — absent in bundled mode
  "remote": {
    "url": "https://...",
    "token": "<token>",
    "tlsVerify": true,
    "lastConnectedAt": "2026-04-28T05:30:00Z",
    "lastError": null
  }
}
```

File path:

- macOS / Linux: `${XDG_DATA_HOME:-~/.local/share}/deck-go/deck-state.json`
- Windows: `%LOCALAPPDATA%\deck-go\deck-state.json`
- Override: `DECK_STATE_FILE=/explicit/path`

Written atomically via temp file + rename. Created on first write if absent.

### Resolution rules

```
At boot:
  1. Parse process env → RuntimeMode
  2. mode == bundled:
       parse RuntimeBundledConfig from env → inject into bundled facade impl
       JSON: read only appearance/notifications/pairedDevices sections
  3. mode == remote:
       parse RuntimeRemoteDefaults from env (defaults)
       read JSON.remote section:
         JSON.remote present and url non-empty  → use JSON whole section
         else                                   → use env defaults
         both empty                             → first-run state: UI prompts to configure
       inject into remote facade impl

At runtime:
  - bundled: env changes are ignored until Deck-go restart
  - remote: UI writes to JSON take effect immediately (reconnect Gateway)
```

### Whole-section override semantics

JSON.remote, when written, must include all of `{url, token, tlsVerify}`. Partial writes are rejected with HTTP 400. Reads use JSON whole-section if present, otherwise env whole-section. **No field-level merge.**

### First-run state

```
isFirstRun(remote mode) =
  (JSON.remote missing OR JSON.remote.url empty)
  AND env.RUNTIME_REMOTE_URL empty
```

When `isFirstRun=true`:

- Deck-go boots normally (does not block).
- `/runtime/capabilities` returns `{ mode: "remote", configured: false }`.
- Gateway RPC passthrough endpoints return `503 Gateway Not Configured`.
- UI shows first-run banner + auto-expanded Endpoint section.

### Boundary cases

| Case                                                         | Behavior                                                                             |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `RUNTIME_MODE` missing                                       | Refuse to start; log `RUNTIME_MODE must be 'bundled' or 'remote'`; exit 64           |
| `RUNTIME_MODE=bundled` but `RUNTIME_BUNDLED_COMMAND` missing | Same as above                                                                        |
| `deck-state.json` corrupted / unreadable                     | Boot warning; treat as first-run; **do not** auto-overwrite (preserve for forensics) |
| Failed write to `deck-state.json` (disk/permission)          | UI receives 5xx with real error; **never** silent-fail                               |

## Backend module split

### Package layout

```
deck-go/backend/internal/runtime/
├── facade/
│   ├── facade.go              # RuntimeFacade interface + Capabilities type
│   └── errors.go              # ErrNotConfigured / ErrUnsupported / ...
├── envconf/
│   ├── envconf.go             # env parsing → typed configs
│   ├── envconf_test.go
│   └── godotenv_loader.go     # dev-mode .env file loader
├── state/
│   ├── store.go               # deck-state.json atomic read/write
│   ├── store_test.go
│   └── schema.go              # DeckState struct
├── bundled/
│   ├── facade.go              # implements RuntimeFacade
│   ├── supervisor.go          # (relocated from runtime/supervisor.go, mostly unchanged)
│   ├── supervisor_test.go
│   ├── ownership.go
│   ├── fingerprint.go
│   └── ...                    # other relocated supervisor code
├── remote/
│   ├── facade.go              # implements RuntimeFacade
│   ├── facade_test.go
│   ├── client.go              # Gateway RPC client (HTTP/WS, TLS verify, token header)
│   └── reconnect.go           # backoff reconnect, lastConnectedAt/lastError tracking
└── shared/
    ├── rpc_client.go          # generic Gateway RPC client (used by both impls)
    └── health.go              # mode-agnostic Health/Status DTOs
```

### Hard constraints

- `cmd/deck-go/main.go` imports `facade` + `envconf` + `state` + exactly one of `bundled` / `remote` (selected by mode).
- `bundled/` must not import `remote/`, and vice versa.
- `controld/` HTTP routes depend only on the `facade.RuntimeFacade` interface.
- Enforce with import-cycle detection in CI.

### RuntimeFacade interface

```go
package facade

type RuntimeFacade interface {
    // Capability discovery
    Capabilities() Capabilities

    // Health / status (both modes)
    Health(ctx context.Context) (deckapi.DeckGoGatewayHealthResponse, error)
    Status(ctx context.Context) (deckapi.DeckGoGatewayStatusResponse, error)
    Summary(ctx context.Context) (deckapi.DeckGoRuntimeSummaryResponse, error)

    // Gateway RPC passthrough (both modes)
    Call(ctx context.Context, method string, params any) (json.RawMessage, error)
    Stream(ctx context.Context, method string, params any) (<-chan StreamEvent, error)

    // Lifecycle (bundled only; remote returns ErrUnsupported)
    StopRuntimeGateway(ctx context.Context) (deckapi.DeckGoRuntimeGatewayActionResponse, error)

    // Remote endpoint mutation (remote only; bundled returns ErrUnsupported)
    UpdateRemoteEndpoint(ctx context.Context, cfg RemoteEndpointInput) error
    TestRemoteEndpoint(ctx context.Context, cfg RemoteEndpointInput) (TestResult, error)
}

type Capabilities struct {
    Mode             string `json:"mode"`              // "bundled" | "remote"
    Configured       bool   `json:"configured"`        // remote first-run state
    LifecycleControl bool   `json:"lifecycleControl"`  // always false (no UI controls)
    EndpointMutable  bool   `json:"endpointMutable"`   // bundled=false, remote=true
    SupervisorState  bool   `json:"supervisorState"`   // bundled=true, remote=false
}
```

Note: `runtime.start` and `runtime.restart` are intentionally absent from the interface — they are deleted from the API entirely.

### Core types

```go
package envconf

type RuntimeMode string
const (
    ModeBundled RuntimeMode = "bundled"
    ModeRemote  RuntimeMode = "remote"
)

type RuntimeBundledConfig struct {
    Command        string
    Args           []string
    WorkingDir     string
    BindHost       string
    BindPort       int
    GatewayToken   string            // never logged, never returned in responses
    AutoStart      bool
    PassThroughEnv map[string]string // RUNTIME_BUNDLED_ENV_*
}

type RuntimeRemoteDefaults struct {
    URL       string
    Token     string  // never logged, never returned in responses
    TLSVerify bool
}

type Loaded struct {
    Mode            RuntimeMode
    Bundled         *RuntimeBundledConfig    // non-nil iff Mode==Bundled
    RemoteDefaults  *RuntimeRemoteDefaults   // non-nil iff Mode==Remote
    DeckListenAddr  string
    DeckAccessToken string
}
```

```go
package state

type DeckState struct {
    Appearance    AppearanceState    `json:"appearance"`
    Notifications NotificationsState `json:"notifications"`
    PairedDevices []PairedDevice     `json:"pairedDevices"`
    Remote        *RemoteState       `json:"remote,omitempty"` // remote mode only
}

type RemoteState struct {
    URL             string `json:"url"`
    Token           string `json:"token"`              // persisted; never returned plaintext
    TLSVerify       bool   `json:"tlsVerify"`
    LastConnectedAt string `json:"lastConnectedAt,omitempty"`
    LastError       string `json:"lastError,omitempty"`
}
```

### main.go assembly

```go
func main() {
    cfg, err := envconf.Load(envconf.Options{
        ProcessEnv: os.Environ(),
        DotEnvPath: os.Getenv("DECK_DOTENV_FILE"),
    })
    if err != nil { log.Fatal(err) }

    store, err := state.Open(stateFilePath())
    if err != nil { log.Fatal(err) }

    var rt facade.RuntimeFacade
    switch cfg.Mode {
    case envconf.ModeBundled:
        rt, err = bundled.New(cfg.Bundled)
    case envconf.ModeRemote:
        rt, err = remote.New(cfg.RemoteDefaults, store)
    }
    if err != nil { log.Fatal(err) }
    defer rt.Close()

    handler := controld.NewHandler(controld.Dependencies{
        Runtime: rt,
        State:   store,
        Auth:    auth.New(cfg.DeckAccessToken),
    })
    server := &http.Server{ Addr: cfg.DeckListenAddr, Handler: handler, /* ... */ }

    ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
    defer stop()
    if err := controld.RunServer(ctx, server, rt, "deck-go"); err != nil {
        log.Fatal(err)
    }
}
```

### Code deletion list

| Item                                                                 | Reason                                                            |
| -------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `/runtime/start` HTTP handler + route                                | Lifecycle controls deleted (autoStart driven by .env)             |
| `/runtime/restart` HTTP handler + route                              | Auto-restart driven by supervisor internally                      |
| `settings.update` handling for `managedGateway.*` fields             | Config is .env-only                                               |
| `settings.update` handling for `accessToken`                         | env-driven, UI cannot mutate                                      |
| Token carry-forward logic in `legacy_admin_settings_onboarding.go`   | No write path for token from UI                                   |
| `runtime/config_sync*` files                                         | "Config sync" concept disappears (UI never writes runtime config) |
| `startRuntimeGateway` / `restartRuntimeGateway` in frontend `api.ts` | Endpoints deleted                                                 |

### Code preserved / refactored from supervisor

- ✅ PID adoption / fingerprinting / ownership metadata — still useful when systemd restarts deck-go and existing Gateway is alive
- ✅ Auto-restart with bounded backoff — still useful for health-failure recovery
- ✅ Graceful shutdown on Deck-go exit
- ❌ "User-triggered manual restart" path — deleted
- ❌ "Config-change-triggers-restart" path — deleted (config can only change in .env, requires Deck-go restart)

## Frontend final form

### Shared structure, capability-gated

`SettingsPanel` and `GatewayPanel` are **single component trees** for both modes; differences are driven entirely by:

```ts
type Capabilities = {
  mode: "bundled" | "remote";
  configured: boolean;
  endpointMutable: boolean;
  supervisorState: boolean;
};
```

Components only consume `endpointMutable` / `supervisorState` booleans. No `if (mode === ...)` branching in frontend logic.

### SettingsPanel structure

```
┌─ Settings ────────────────────────────────────────────────┐
│  Runtime: bundled | remote (top status badge)             │
│                                                           │
│  ┌─ Gateway endpoint ────────────────────────────────┐    │
│  │  URL        [.....]         🔒/✏️                  │    │
│  │  Token      [(configured)]  🔒/✏️                  │    │
│  │  TLS verify [✓]             🔒/✏️                  │    │
│  │                              [ Test connection ]  │    │
│  └───────────────────────────────────────────────────┘    │
│                                                           │
│  ┌─ Deck access token ───────────────────────────────┐    │
│  │  Token  [(configured) — set via .env]   🔒        │    │
│  └───────────────────────────────────────────────────┘    │
│                                                           │
│  ┌─ Appearance ─ Notifications ─ Paired devices ────┐    │
│  │  (always editable, JSON-persisted)                │    │
│  └───────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────┘
```

Conventions:

- Endpoint section is present in both modes; bundled shows derived local URL (`http://bindHost:bindPort`).
- 🔒 lock icon + tooltip: `Configured via .env (RUNTIME_BUNDLED_BIND_PORT). To change, edit your environment file and restart Deck-go.`
- Token fields never return plaintext — backend returns `tokenConfigured: true`; input shows `(configured)` placeholder.
- Test connection works in both modes: bundled uses live config; remote uses form-current values (preview before save).

### GatewayPanel runtime tab

Bundled mode (`supervisorState: true`):

```
┌─ Runtime ──────────────────────────────────────────────────┐
│  Mode: bundled                                             │
│  Endpoint: http://127.0.0.1:18789                          │
│  Status: ● running    Health: ● healthy                    │
│  Uptime: 3h 24m       Restart attempts: 0                  │
│  PID: 12345           Ownership: managed                   │
│                                                            │
│  ─── Configured via .env ────────────────────────────────  │
│  Command: openclaw gateway run --bind loopback --port ...  │
│  Working dir: /var/lib/openclaw                            │
│                                                            │
│  ─── Last 6 supervisor events ───────────────────────────  │
│  • [10:23:45] gateway started (PID 12345)                  │
│  • ...                                                     │
└────────────────────────────────────────────────────────────┘
```

Remote mode (`supervisorState: false`):

```
┌─ Runtime ──────────────────────────────────────────────────┐
│  Mode: remote                                              │
│  Endpoint: https://gateway.example.com:18789               │
│  Status: ● connected  Health: ● healthy                    │
│  Last connected: 2026-04-28 10:24:01                       │
│                                                            │
│  ─── Connection diagnostics ─────────────────────────────  │
│  Latency: 23ms (p50) / 41ms (p99)                          │
│  TLS: verified ✓                                           │
│  Last error: none                                          │
└────────────────────────────────────────────────────────────┘
```

No Start/Stop/Restart buttons in either mode.

### First-run UX (remote, not configured)

When `capabilities.mode === "remote" && capabilities.configured === false`:

1. Top-of-page banner: `Remote Gateway not configured. Configure now →`
2. Settings Endpoint section auto-expands; Save enabled only after URL/token/TLS all valid.
3. On successful Save + Test, banner disappears.
4. Other Gateway-data panels show empty state (`Connect to Gateway to view ...`); no error toast.

### Mode badge

Persistent top-right badge:

- bundled: `● bundled (local)` — green, no action
- remote (configured): `● remote · gateway.example.com` — green, hover for full URL
- remote (first-run): `◐ remote · not configured` — yellow, click → Settings

### Frontend deletions

| File                                                                                                     | Action                                  |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `SettingsPanel.tsx` — managedGateway.command/args/workingDir/env/autoStart/bindHost/bindPort form fields | Delete                                  |
| `SettingsPanel.tsx` — accessToken `<input>` element                                                      | Replace with read-only display          |
| `SettingsPanel.tsx` — managedGatewayArgsText / managedGatewayArgsError / updateManagedGateway state      | Delete                                  |
| `GatewayPanel.tsx` — Start/Stop/Restart buttons + runAction dispatch                                     | Delete                                  |
| `GatewayPanel.tsx` — runtime.rawSettings / rawDiagnostics raw-JSON cards                                 | Remove (replaced by structured display) |
| `api.ts` — startRuntimeGateway / restartRuntimeGateway                                                   | Delete (endpoints gone)                 |
| `useDeckUI` — bootstrap.runtime supervisor fields                                                        | Convert to discriminated union          |

### Frontend additions

- `<EndpointSection capabilities={...} value={...} onSave={...} />` — encapsulates Endpoint section, renders read-only or editable per `endpointMutable`.
- `<ReadOnlyField label value badge="set via .env" />` — generic component.
- `<ModeBadge capabilities={...} />` — top-right badge.
- `<FirstRunBanner />` — full-width banner for remote not-configured state.
- `useCapabilities()` — `/runtime/capabilities` query hook.

## API surface

### Endpoint matrix

| Endpoint                                                                        | Method | Bundled                              | Remote            | Notes                                                                                                 |
| ------------------------------------------------------------------------------- | ------ | ------------------------------------ | ----------------- | ----------------------------------------------------------------------------------------------------- |
| **New**                                                                         |        |                                      |                   |                                                                                                       |
| `/runtime/capabilities`                                                         | GET    | ✅                                   | ✅                | UI's source of truth                                                                                  |
| `/runtime/endpoint`                                                             | GET    | ✅                                   | ✅                | Effective endpoint; token redacted                                                                    |
| `/runtime/endpoint`                                                             | PUT    | ❌ 405                               | ✅                | Whole-section overwrite of JSON.remote; triggers reconnect                                            |
| `/runtime/endpoint:test`                                                        | POST   | ✅                                   | ✅                | Connection test; remote accepts candidate body                                                        |
| **Deleted**                                                                     |        |                                      |                   |                                                                                                       |
| `/runtime/start`                                                                | POST   | ❌ deleted                           | ❌ deleted        | autoStart from .env, no UI entrypoint                                                                 |
| `/runtime/restart`                                                              | POST   | ❌ deleted                           | ❌ deleted        | Auto-restart from supervisor                                                                          |
| **Preserved / modified**                                                        |        |                                      |                   |                                                                                                       |
| `/runtime/stop`                                                                 | POST   | ⚠️ internal only (graceful shutdown) | ❌ not registered | Not exposed to browser                                                                                |
| `/runtime/summary`                                                              | GET    | ✅                                   | ✅                | Fields branch on supervisorState                                                                      |
| `/runtime/health`, `/runtime/status`, `/runtime/activity`, `/runtime/monitor/*` | GET    | ✅                                   | ✅                | Mode-agnostic Gateway RPC passthrough                                                                 |
| `/settings`                                                                     | GET    | ✅                                   | ✅                | Response no longer contains `managedGateway`; `accessToken` returned as `accessTokenConfigured: true` |
| `/settings`                                                                     | PUT    | ✅ (limited)                         | ✅ (limited)      | Accepts only `appearance / notifications / pairedDevices`; other fields → 400                         |

### `/runtime/capabilities` examples

```json
// Bundled, healthy
{ "mode": "bundled", "configured": true, "endpointMutable": false, "supervisorState": true }

// Remote, configured
{ "mode": "remote", "configured": true, "endpointMutable": true, "supervisorState": false }

// Remote, first-run
{ "mode": "remote", "configured": false, "endpointMutable": true, "supervisorState": false }
```

### `/runtime/endpoint` GET examples

```json
// Bundled
{ "url": "http://127.0.0.1:18789", "tokenConfigured": true, "tlsVerify": false, "source": "env" }

// Remote, configured
{
  "url": "https://gateway.example.com:18789",
  "tokenConfigured": true,
  "tlsVerify": true,
  "source": "json",
  "lastConnectedAt": "2026-04-28T10:24:01Z",
  "lastError": null
}

// Remote, first-run
{ "url": "", "tokenConfigured": false, "tlsVerify": true, "source": "json", "lastConnectedAt": null, "lastError": null }
```

### `/runtime/endpoint` PUT body

```jsonc
{
  "url": "https://staging.gw:18789",
  "token": "<plaintext>",
  "tlsVerify": true,
}
```

Validation:

- Bundled mode → 405 `endpoint_not_mutable`
- Missing `url`, non-http(s) URL → 400 `invalid_url`
- Empty `token` → 400 `token_required`
- Non-boolean `tlsVerify` → 400 `invalid_tls_verify`

### `/runtime/endpoint:test` body

```jsonc
// Bundled — body empty (uses .env effective config)
{}

// Remote — body optional; supplied = candidate preview, omitted = current JSON
{ "url": "...", "token": "...", "tlsVerify": true }
```

Response:

```json
{ "ok": true, "latencyMs": 23, "gatewayVersion": "0.7.3", "tlsVerified": true, "error": null }
```

### Error code taxonomy

| code                                                    | HTTP | Meaning                                         |
| ------------------------------------------------------- | ---- | ----------------------------------------------- |
| `endpoint_not_mutable`                                  | 405  | Bundled mode PUT endpoint                       |
| `gateway_not_configured`                                | 503  | Remote first-run; passthrough endpoint accessed |
| `invalid_url` / `token_required` / `invalid_tls_verify` | 400  | Endpoint PUT validation                         |
| `gateway_unreachable`                                   | 502  | RPC client cannot connect                       |
| `gateway_auth_failed`                                   | 401  | Wrong token                                     |
| `tls_verification_failed`                               | 502  | TLS verify failed (remote, tlsVerify=true)      |

### Passthrough first-run handling

In remote mode with `configured=false`, all Gateway RPC passthrough endpoints (`/runtime/health`, `/runtime/status`, `/agents/*`, `/runtime/monitor/*`, etc.) return:

```http
HTTP/1.1 503 Service Unavailable
{ "code": "gateway_not_configured", "message": "Configure remote Gateway endpoint to use this feature." }
```

Frontend treats this code as empty-state guidance, not error toast.

## Local development environment

### New scripts under `deck-go/scripts/dev/`

These are new files specific to deck-go. The pre-existing top-level `scripts/dev/deck-dev.sh` (which boots the previous-generation Deck client + Gateway) is preserved untouched and will be archived alongside the rest of the legacy Deck tree (see follow-up archival pass).

`deck-go/scripts/dev/run-bundled.sh`:

```bash
export RUNTIME_MODE=bundled
export RUNTIME_BUNDLED_COMMAND="$(repo_root)/dist/openclaw"
export RUNTIME_BUNDLED_ARGS="gateway run --bind loopback --port 18789 --force"
export RUNTIME_BUNDLED_BIND_HOST=127.0.0.1
export RUNTIME_BUNDLED_BIND_PORT=18789
export RUNTIME_BUNDLED_GATEWAY_TOKEN="$(cat .gateway-token 2>/dev/null || openssl rand -hex 32 | tee .gateway-token)"
export RUNTIME_BUNDLED_AUTOSTART=true
export DECK_LISTEN_ADDR=127.0.0.1:3000
export DECK_ACCESS_TOKEN="dev-only"
export NO_PROXY=localhost,127.0.0.1

# Deck-go spawns Gateway itself; do not start Gateway separately.
exec deck-go
```

`deck-go/scripts/dev/run-remote.sh` (remote mode for multi-host dev):

```bash
export RUNTIME_MODE=remote
export DECK_LISTEN_ADDR=127.0.0.1:3000
export DECK_ACCESS_TOKEN="dev-only"
# Leave URL/token empty — UI first-run wizard prompts.
export NO_PROXY=localhost,127.0.0.1

exec deck-go
```

### `.env` examples

Deliverables under `deck-go/`:

- `deck-go/.env.bundled.example`
- `deck-go/.env.remote.example`

Contents follow Section 2's schema verbatim.

### Test relocations

| File                                                         | Action                                                |
| ------------------------------------------------------------ | ----------------------------------------------------- |
| `internal/runtime/supervisor.go` + `supervisor_test.go` etc. | Move to `internal/runtime/bundled/`                   |
| `internal/runtime/preflight*`                                | Move to `internal/runtime/bundled/`                   |
| `internal/runtime/config_sync*`                              | Delete (concept gone)                                 |
| `internal/controld/runserver_test.go`                        | Mock implements `facade.RuntimeFacade` minimal subset |
| `internal/server/server_test.go`                             | Both-mode fixtures                                    |
| Frontend `SettingsPanel.test.tsx` / `GatewayPanel.test.tsx`  | Rewrite as capability-gated                           |
| **New** `internal/runtime/envconf/*_test.go`                 | Parser coverage                                       |
| **New** `internal/runtime/state/*_test.go`                   | Atomic write, fault tolerance                         |
| **New** `internal/runtime/remote/*_test.go`                  | First-run, reconnect                                  |
| **New** `bundled.spec.ts` / `remote.spec.ts`                 | Both-mode E2E                                         |

### Boot-time validation

Missing or invalid `RUNTIME_MODE` → fatal exit. **No** legacy-JSON compatibility attempts. Error message points to `.env.example`.

### Upstream rebase impact

Update `.agents/skills/deck-upstream-sync/SKILL.md` so its path constants reflect the new `internal/runtime/bundled/supervisor.go` location. No other rebase-flow changes.

### Out of scope

- Production deployment (systemd unit, Docker image, packaging) — deferred to a follow-up spec
- Migration tooling (`deck-go migrate` CLI) — not built; users on enhanced fork manually compose `.env`
- Backwards compatibility with prior `openclaw.json` `managedGateway` block — none

## Roadmap

### Phase 1 — Backend foundation (3–4 days)

Goal: facade interface in place, bundled mode functional, remote mode stubbed.

- [ ] New `internal/runtime/facade/` + interface
- [ ] New `internal/runtime/envconf/` + `.env` parsing (incl. RUNTIME_MODE validation)
- [ ] New `internal/runtime/state/` + atomic JSON read/write
- [ ] Move all current supervisor code to `internal/runtime/bundled/`, fix imports
- [ ] Implement `bundled.New(...)` wrapping existing supervisor, satisfying `RuntimeFacade`
- [ ] `internal/runtime/remote/` skeleton (interface methods returning `ErrNotImplemented`)
- [ ] `cmd/deck-go/main.go` mode-switched assembly

Acceptance: `RUNTIME_MODE=bundled` boots with all current bundled-mode behavior preserved. `pnpm test ./internal/runtime/...` green.

### Phase 2 — API surface refactor (2–3 days)

Goal: HTTP endpoints adopt new shape.

- [ ] `/runtime/capabilities` endpoint
- [ ] `/runtime/endpoint` GET / PUT / `:test`
- [ ] Delete `/runtime/start` / `/runtime/restart` routes + handlers
- [ ] Remove `/runtime/stop` route (preserve internal call path for graceful shutdown)
- [ ] Narrow `/settings` GET/PUT to `appearance/notifications/pairedDevices` only
- [ ] Strip token carry-forward from `legacy_admin_settings_onboarding.go`
- [ ] Update `legacy_runtime_orchestration.go` import paths
- [ ] Implement error-code taxonomy

Acceptance: backend tests green; contract regenerated; `pnpm protocol:gen:check` green.

### Phase 3 — Remote mode implementation (3–4 days)

Goal: remote facade actually connects to a remote Gateway.

- [ ] `internal/runtime/remote/client.go` — Gateway HTTP RPC client (TLS verify, token header)
- [ ] `internal/runtime/remote/reconnect.go` — backoff reconnect + lastConnectedAt/lastError
- [ ] `UpdateRemoteEndpoint` writes JSON.remote → triggers reconnect
- [ ] `TestRemoteEndpoint` opens a transient connection with candidate config
- [ ] First-run state detection + 503 passthrough strategy
- [ ] `internal/runtime/remote/*_test.go` unit coverage
- [ ] Both-mode E2E fixture (remote uses mock Gateway server)

Acceptance: `RUNTIME_MODE=remote` boots; first-run → save → connect → run an Agent end-to-end via chat.

### Phase 4 — Frontend rewrite (3–4 days)

Goal: UI renders by capabilities; all panels adopt new API.

- [ ] `useCapabilities()` hook + `<ModeBadge />` + `<FirstRunBanner />`
- [ ] `<EndpointSection />` (read-only and editable forms)
- [ ] `SettingsPanel.tsx` refactor: remove managedGateway form fields; accessToken read-only; add EndpointSection
- [ ] `GatewayPanel.tsx` runtime tab refactor: remove buttons; field set branches on supervisorState
- [ ] `useDeckUI` runtime bootstrap type → discriminated union
- [ ] `api.ts` remove `startRuntimeGateway` / `restartRuntimeGateway`
- [ ] Test rewrites: `SettingsPanel.test.tsx` / `GatewayPanel.test.tsx`
- [ ] `bundled.spec.ts` / `remote.spec.ts` E2E

Acceptance: manual browser smoke for both modes' core flows; type-check + lint green; E2E green.

### Phase 5 — Docs + scripts (1 day)

- [ ] `deck-go/.env.bundled.example` + `deck-go/.env.remote.example`
- [ ] `deck-go/scripts/dev/run-bundled.sh` new (.env-driven)
- [ ] `deck-go/scripts/dev/run-remote.sh` new
- [ ] `deck-go/backend/README.md` Architecture section
- [ ] `CLAUDE.md` "Deck 开发环境" section update (alongside the related archival pass)

### Dependencies

```
Phase 1 ─┬─► Phase 2 ─► Phase 4
         └─► Phase 3 ─►   ↑
                         Phase 5
```

Phases 2 and 3 may run in parallel after Phase 1. Phase 4 depends on both 2 and 3. Phase 5 follows Phase 4.

### Total budget

~12–16 days focused single-developer work; ~7–10 calendar days with ralplan + ralph automation.

## Risks

| Risk                                                      | Probability | Impact | Mitigation                                                                        |
| --------------------------------------------------------- | ----------- | ------ | --------------------------------------------------------------------------------- |
| Supervisor relocation breaks implicit test deps           | Medium      | Medium | Phase 1 runs `pnpm test ./internal/runtime/bundled/` in isolation                 |
| `/runtime/endpoint` PUT triggers reconnect mid-flight RPC | Medium      | High   | Phase 3 unit covers in-flight RPC during endpoint switch                          |
| Frontend capability-gated rendering misses cases          | High        | Low    | Both-mode E2E catches them                                                        |
| Upstream rebase collides with supervisor path             | Medium      | Medium | Sync update to `deck-upstream-sync` skill; mechanical path rewrite at rebase time |

## Open Questions

None. All major decisions locked in brainstorm.
