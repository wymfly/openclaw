## MODIFIED Requirements

### Requirement: Boot-time runtime mode selection

Deck-go SHALL select between two runtime implementations (`local` or `remote`) once at boot based on the `RUNTIME_MODE` environment variable, and the selection SHALL be immutable until process restart. The previous `bundled` value is RENAMED to `local` and SHALL be rejected when supplied as `bundled`.

#### Scenario: RUNTIME_MODE=local selects local implementation

- **WHEN** Deck-go starts with `RUNTIME_MODE=local` in its process environment
- **THEN** the runtime facade injected into HTTP routes SHALL be the `local` implementation, and the `remote` package SHALL not be invoked

#### Scenario: RUNTIME_MODE=remote selects remote implementation

- **WHEN** Deck-go starts with `RUNTIME_MODE=remote` in its process environment
- **THEN** the runtime facade injected into HTTP routes SHALL be the `remote` implementation, and the `local` package SHALL not be invoked (no Gateway subprocess is spawned, no `openclaw gateway install/start` is invoked)

#### Scenario: RUNTIME_MODE=bundled rejected (RENAMED to local)

- **WHEN** Deck-go starts with the legacy value `RUNTIME_MODE=bundled`
- **THEN** Deck-go SHALL refuse to start, emit a stderr message stating "bundled mode has been renamed to local; update RUNTIME_MODE=local and consult `.env.local.example`", and exit with code 64

#### Scenario: RUNTIME_MODE missing fails fast

- **WHEN** Deck-go starts with `RUNTIME_MODE` unset
- **THEN** Deck-go SHALL refuse to start, emit a stderr message naming the missing variable and pointing to `.env.local.example` / `.env.remote.example`, and exit with code 64

#### Scenario: RUNTIME_MODE invalid value fails fast

- **WHEN** Deck-go starts with `RUNTIME_MODE` set to any value other than `local` or `remote`
- **THEN** Deck-go SHALL refuse to start, emit a stderr message listing the accepted values (`local`, `remote`), and exit with code 64

#### Scenario: Mode is not exposed as runtime-mutable

- **WHEN** any HTTP request attempts to switch `RUNTIME_MODE` after boot
- **THEN** no API endpoint SHALL accept such a request; the only way to change mode is to restart Deck-go with a different environment. (Runtime swap capability is reserved for the follow-up `runtime-mode-switching` change.)

### Requirement: Local mode environment-only configuration

In `local` mode, every Gateway-runtime parameter that Deck-go reads (entrypoint resolution inputs, isolated state dir, official-CLI invocation arguments) SHALL be read exclusively from `.env`/process environment, and Deck-go SHALL NOT read or write any JSON-persisted runtime endpoint state. Deck-go SHALL NOT directly spawn a Gateway subprocess; lifecycle SHALL be delegated to the official `openclaw gateway install/start/stop/restart/status` CLI provided by the local build of the repository (see `local-gateway-lifecycle`).

#### Scenario: Local mode ignores JSON remote section

- **WHEN** Deck-go starts in `local` mode and `deck-state.json` contains a populated `remote` section
- **THEN** the `remote` section SHALL be ignored and the active endpoint SHALL be the loopback endpoint reported by the local Gateway service

#### Scenario: Spawn-config env vars removed

- **WHEN** Deck-go starts in `local` mode with any of the legacy spawn-control vars (`RUNTIME_BUNDLED_COMMAND`, `RUNTIME_BUNDLED_ARGS`, `RUNTIME_BUNDLED_BIND_HOST`, `RUNTIME_BUNDLED_BIND_PORT`, `RUNTIME_BUNDLED_TOKEN`, `RUNTIME_BUNDLED_ENV_*`, `RUNTIME_BUNDLED_ENV_DENY`)
- **THEN** Deck-go SHALL ignore those variables and emit a single stderr deprecation warning naming the legacy keys observed (no exit-64). The active configuration SHALL be drawn from the new `OPENCLAW_REPO_ROOT` / `OPENCLAW_STATE_DIR` / `OPENCLAW_GATEWAY_TOKEN` (or equivalent) keys defined under `local-gateway-lifecycle`.

#### Scenario: Local Gateway endpoint and token resolved via official state file

- **WHEN** Deck-go starts in `local` mode and the official `openclaw.json` (under the isolated state dir) contains `gateway.auth.token` and `gateway.bind.{host,port}`
- **THEN** the active endpoint SHALL be derived from that state file (loopback host + bind port) and the token SHALL be read from `gateway.auth.token` or the `OPENCLAW_GATEWAY_TOKEN` env override

### Requirement: Runtime facade single-interface contract for mode-aware handlers

The `RuntimeFacade` interface (in `internal/runtime/facade/`) SHALL cover the _mode-aware_ surface of deck-go runtime — capability discovery, endpoint configuration, the Gateway lifecycle proxy methods (install/start/stop/restart/status forwarded to the official CLI in `local` mode and disabled with `ErrUnsupported` in `remote` mode), the small set of Gateway RPC routes whose behavior depends on whether deck-go owns a local Gateway service (passthrough health/status/describe), and the streaming primitives invoked from the 503 middleware. Route handlers in this mode-aware family SHALL depend only on `RuntimeFacade`; no concrete `local` or `remote` implementation SHALL be imported by these handlers. Mode-agnostic deck-go-internal surfaces (settings/onboarding/version, activity/monitor projection, devices, agent CRUD, config/schema CRUD, file-system access, sessions, event bus, etc.) SHALL continue to depend on the existing `ManagedRuntimeSurface` interface and its sub-surfaces.

#### Scenario: Mode-aware handlers compile against facade only

- **WHEN** the Deck-go test suite runs static-analysis checks on the mode-aware route registration files (the files that register `/api/runtime/capabilities`, `/api/runtime/endpoint{,:test}`, `/api/runtime/gateway/*`, `/api/runtime/gateway`, `/api/gateway/{health,status,describe}`, and the 503 middleware factory)
- **THEN** no imports from `internal/runtime/local/` or `internal/runtime/remote/` SHALL appear in those handler files

#### Scenario: Local package does not import remote

- **WHEN** the codebase is scanned for cross-package imports
- **THEN** files under `internal/runtime/local/` SHALL NOT import `internal/runtime/remote/` (and vice versa); `internal/runtime/bundled/` SHALL no longer exist as a Go package

#### Scenario: Both implementations satisfy the same interface

- **WHEN** the build runs
- **THEN** both `local.New(...)` and `remote.New(...)` SHALL produce values that satisfy `facade.RuntimeFacade`, including the unsupported-method contract (mode-incompatible methods return `facade.ErrUnsupported`); `local.New(...)` SHALL return `nil` Gateway lifecycle proxy methods on a `remote`-only build constraint and vice versa is disallowed at the import level

#### Scenario: Mode-switched assembly via single helper

- **WHEN** `cmd/deck-go/main.go` and `cmd/controld/main.go` build the runtime facade at boot
- **THEN** both binaries SHALL call a single `facade.BuildFacade(cfg, store) (RuntimeFacade, error)` helper; neither `main.go` SHALL contain its own `switch cfg.Mode { case local: ... case remote: ... }` block

### Requirement: Capabilities discovery endpoint

Deck-go SHALL expose a `GET /api/runtime/capabilities` endpoint that returns the active mode and feature flags driving UI rendering and API gating. The response SHALL contain exactly these top-level fields: `mode` (`"local"` | `"remote"`), `configured` (boolean), `endpointMutable` (boolean), `supervisorState` (boolean). No additional top-level fields SHALL be returned in this change; the runtime-switching capability adds new fields in the follow-up change. In `local` mode `supervisorState` SHALL ALWAYS be `true` regardless of `configured` (`configured` reflects whether RPC is currently ready; `supervisorState` reflects whether deck-go owns the lifecycle copilot surface — orthogonal concerns).

#### Scenario: Local configured response

- **WHEN** the frontend issues `GET /api/runtime/capabilities` in `local` mode with the local Gateway service in `running` state
- **THEN** the response SHALL be `{mode: "local", configured: true, endpointMutable: false, supervisorState: true}`

#### Scenario: Local not-installed / stopped / unhealthy response

- **WHEN** the frontend issues `GET /api/runtime/capabilities` in `local` mode and the local Gateway service is in `not-installed`, `stopped`, or `unhealthy` state
- **THEN** the response SHALL be `{mode: "local", configured: false, endpointMutable: false, supervisorState: true}`; `supervisorState: true` is preserved across all four local lifecycle states so the Operations Panel mounts and renders the corresponding affordance ([安装并启动] / [Start] / [Restart] / [Reinstall]) defined under `local-gateway-lifecycle`

#### Scenario: Remote configured response

- **WHEN** the frontend issues `GET /api/runtime/capabilities` in `remote` mode with a populated remote endpoint
- **THEN** the response SHALL be `{mode: "remote", configured: true, endpointMutable: true, supervisorState: false}`

#### Scenario: Remote first-run response

- **WHEN** the frontend issues `GET /api/runtime/capabilities` in `remote` mode and no endpoint is configured
- **THEN** the response SHALL be `{mode: "remote", configured: false, endpointMutable: true, supervisorState: false}`

### Requirement: Runtime gateway status endpoint shape

Deck-go's existing `GET /api/runtime/gateway` endpoint SHALL respond with a payload whose top-level field set is selected by the active `capabilities.supervisorState` flag, so the same external URL serves both local and remote modes without a mode-string branch in caller code. In `local` mode, the supervisor-state fields reflect the **official system service state** (launchd / systemd / schtasks) and the entrypoint locator, not legacy spawn metadata. The handler at `backend/internal/server/runtime.go` SHALL NOT short-circuit to `gateway_not_configured` 503 in `local` mode regardless of `configured` value — `local` mode lifecycle payload is always rendered because `not-installed` / `stopped` / `unhealthy` are valid product states the Operations Panel needs to read.

#### Scenario: Local mode payload always returned

- **WHEN** the frontend issues `GET /api/runtime/gateway` while `capabilities.mode === "local"` (any value of `capabilities.configured`)
- **THEN** the response SHALL be HTTP 200 with `lifecycleState` (`"running"` | `"stopped"` | `"not-installed"` | `"unhealthy"`), `serviceName` (string — the per-repo-hash service name), `entrypointPath` (absolute path), `lastError` (string or null), and a `mode: "local"` discriminator; the response SHALL NOT include `pid`, `ownershipState`, `restartAttempts`, `lastConnectedAt`, `latencyP50`, or `tlsVerified` fields; the existing `configured=false → 503 gateway_not_configured` short-circuit at `runtime.go:77-86` SHALL be carved out for `local` mode

#### Scenario: Remote mode payload

- **WHEN** the frontend issues `GET /api/runtime/gateway` while `capabilities.supervisorState === false`
- **THEN** the response SHALL include `lastConnectedAt` (ISO 8601 string or null), `lastError` (string or null), `latencyP50` (number or null), `tlsVerified` (boolean), and a `mode: "remote"` discriminator; the response SHALL NOT include `lifecycleState`, `serviceName`, or `entrypointPath` fields

#### Scenario: First-run remote payload returns 503

- **WHEN** the frontend issues `GET /api/runtime/gateway` while `capabilities.mode === "remote"` and `capabilities.configured === false`
- **THEN** the response SHALL be HTTP 503 with `code: "gateway_not_configured"`; no field shape SHALL be returned in the body; this 503 short-circuit applies to `remote` mode first-run only, NOT to `local` mode

### Requirement: Capability-gated frontend rendering

Frontend components SHALL drive their rendering decisions exclusively from the boolean capability flags (`endpointMutable`, `supervisorState`) and the `lifecycleState` payload, and SHALL NOT branch on the `mode` string for behavior decisions. Display components MAY read `mode` for copy and visual treatment.

#### Scenario: Endpoint section editability gated by capability

- **WHEN** `<EndpointSection>` renders with `capabilities.endpointMutable: false`
- **THEN** all input fields SHALL be `disabled`, a lock icon and `set via .env` badge SHALL appear, and no Save button SHALL render

#### Scenario: Endpoint section editability with mutable capability

- **WHEN** `<EndpointSection>` renders with `capabilities.endpointMutable: true`
- **THEN** input fields SHALL accept user input, a Save button SHALL appear, and successful save SHALL invoke `PUT /api/runtime/endpoint`

#### Scenario: Runtime tab field set by supervisorState (Operations Panel mount)

- **WHEN** `GatewayPanel` runtime tab renders with `capabilities.supervisorState: true`
- **THEN** the panel SHALL mount the Operations Panel sub-component, gated on `capabilities.supervisorState === true` (NOT on `capabilities.mode === "local"`); the Operations Panel SHALL display `lifecycleState`, `serviceName`, `entrypointPath`, and `lastError` from the `/api/runtime/gateway` payload; the panel SHALL display the lifecycle action buttons defined under `local-gateway-lifecycle` (Install / Start / Stop / Restart / Reinstall) per `lifecycleState`. The `mode` string MAY be read inside the Operations Panel for display copy only (e.g. tooltip text), NEVER for component mount or button visibility decisions

#### Scenario: Runtime tab fields without supervisorState

- **WHEN** `GatewayPanel` runtime tab renders with `capabilities.supervisorState: false`
- **THEN** the panel SHALL display LastConnected, Latency, and TLS-verified fields, and SHALL NOT display `lifecycleState` / `serviceName` / `entrypointPath`

#### Scenario: No mode-string branching in non-display contexts

- **WHEN** the frontend codebase is statically scanned for `mode === "local"` or `mode === "remote"` outside _display contexts_ (display = JSX text/attribute interpolation that produces user-visible copy or class names; non-display = effects, hook callbacks, store reducers, route guards, mutation handlers, query keys)
- **THEN** no occurrences SHALL be found outside display contexts; the static-check rule SHALL accept `mode` reads inside `<ModeBadge>`, `<FirstRunBanner>`, status tooltips, and other purely-display components

#### Scenario: ModeBadge shows three distinct states

- **WHEN** `<ModeBadge>` renders, identifiable by `data-testid="mode-badge"`
- **THEN** the badge SHALL render in one of exactly three states distinguished by a `data-state` attribute: `data-state="local"` (when `mode === "local"`), `data-state="remote-configured"` (when `mode === "remote" && configured === true`), or `data-state="remote-first-run"` (when `mode === "remote" && configured === false`); each state SHALL select its copy and visual treatment from this attribute, never from a separate per-mode prop

#### Scenario: FirstRunBanner visible only in remote first-run

- **WHEN** the frontend renders the app shell and `capabilities.mode === "remote" && capabilities.configured === false`
- **THEN** an element with `data-testid="first-run-banner"` SHALL be present in the DOM

#### Scenario: FirstRunBanner absent in local and remote-configured

- **WHEN** the frontend renders the app shell and either `capabilities.mode === "local"` (any configured value) or `capabilities.mode === "remote" && capabilities.configured === true`
- **THEN** no element with `data-testid="first-run-banner"` SHALL be present in the DOM. (The local-mode equivalent banner — install prompt — is rendered inside `GatewayPanel` based on `lifecycleState`, not as a global first-run banner.)

## REMOVED Requirements

### Requirement: No UI lifecycle controls

**Reason**: Reversed by the `gateway-launcher-rewrite` change. The "no UI lifecycle controls" rule was anchored in the assumption that deck-go BFF spawned and owned the Gateway subprocess; exposing start/stop/restart UI in that world risked race conditions with the BFF-internal supervisor. With the rewrite, the Gateway lifecycle is owned by the operating system service manager (launchd / systemd / schtasks) via the official `openclaw gateway install/start/stop/restart` CLI; deck-go is no longer in the critical path of process ownership, and a UI-facing lifecycle copilot (in `local` mode only) becomes both safe and necessary for the product's "图形化运维 instead of terminal-only" goal. See `local-gateway-lifecycle` for the new lifecycle-control contract; the legacy HTTP routes `POST /api/runtime/gateway/start|stop|restart` are reintroduced with new semantics (proxying to the official CLI) under that new capability.

**Migration**: Frontend code that relied on the absence of lifecycle buttons (e.g. tests asserting their non-presence in `bundled` mode) MUST be updated. New tests SHALL assert the presence of `[Install]` / `[Start]` / `[Stop]` / `[Restart]` / `[Reinstall]` buttons gated by `lifecycleState` in `local` mode, and their absence in `remote` mode (where the Gateway is not under deck-go's operational scope).
