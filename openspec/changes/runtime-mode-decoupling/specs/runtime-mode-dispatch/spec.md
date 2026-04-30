## ADDED Requirements

### Requirement: Boot-time runtime mode selection

Deck-go SHALL select between two runtime implementations (`bundled` or `remote`) once at boot based on the `RUNTIME_MODE` environment variable, and the selection SHALL be immutable until process restart.

#### Scenario: RUNTIME_MODE=bundled selects bundled implementation

- **WHEN** Deck-go starts with `RUNTIME_MODE=bundled` in its process environment
- **THEN** the runtime facade injected into HTTP routes SHALL be the `bundled` implementation, and the `remote` package SHALL not be invoked

#### Scenario: RUNTIME_MODE=remote selects remote implementation

- **WHEN** Deck-go starts with `RUNTIME_MODE=remote` in its process environment
- **THEN** the runtime facade injected into HTTP routes SHALL be the `remote` implementation, and the `bundled` package SHALL not be invoked (no Gateway subprocess is spawned)

#### Scenario: RUNTIME_MODE missing fails fast

- **WHEN** Deck-go starts with `RUNTIME_MODE` unset
- **THEN** Deck-go SHALL refuse to start, emit a stderr message naming the missing variable and pointing to `.env` examples, and exit with code 64

#### Scenario: RUNTIME_MODE invalid value fails fast

- **WHEN** Deck-go starts with `RUNTIME_MODE` set to a value other than `bundled` or `remote`
- **THEN** Deck-go SHALL refuse to start, emit a stderr message listing the accepted values, and exit with code 64

#### Scenario: Mode is not exposed as runtime-mutable

- **WHEN** any HTTP request attempts to switch `RUNTIME_MODE` after boot
- **THEN** no API endpoint SHALL accept such a request; the only way to change mode is to restart Deck-go with a different environment

### Requirement: Bundled mode environment-only configuration

In `bundled` mode, every Gateway-runtime parameter (command, args, working dir, bind host, bind port, gateway token, autoStart, pass-through env) SHALL be read exclusively from `.env`/process environment, and Deck-go SHALL NOT read or write any JSON-persisted runtime endpoint state.

#### Scenario: Bundled mode ignores JSON remote section

- **WHEN** Deck-go starts in `bundled` mode and `deck-state.json` contains a populated `remote` section
- **THEN** the `remote` section SHALL be ignored and the active endpoint SHALL be derived solely from `RUNTIME_BUNDLED_BIND_HOST` and `RUNTIME_BUNDLED_BIND_PORT`

#### Scenario: Required bundled vars must be present

- **WHEN** Deck-go starts with `RUNTIME_MODE=bundled` and `RUNTIME_BUNDLED_COMMAND` is unset
- **THEN** Deck-go SHALL refuse to start, emit a stderr message naming the missing variable, and exit with code 64

#### Scenario: Pass-through env vars forwarded to Gateway

- **WHEN** Deck-go starts in `bundled` mode with environment variables matching the prefix `RUNTIME_BUNDLED_ENV_*`
- **THEN** each matching variable SHALL be forwarded to the spawned Gateway process with the prefix stripped (e.g. `RUNTIME_BUNDLED_ENV_NO_PROXY=...` becomes `NO_PROXY=...` in Gateway's env)

#### Scenario: Disallowed pass-through env names rejected at boot

- **WHEN** Deck-go starts in `bundled` mode with any of `RUNTIME_BUNDLED_ENV_LD_PRELOAD`, `RUNTIME_BUNDLED_ENV_LD_LIBRARY_PATH`, `RUNTIME_BUNDLED_ENV_LD_AUDIT`, `RUNTIME_BUNDLED_ENV_DYLD_*` (any name beginning with `DYLD_`), or `RUNTIME_BUNDLED_ENV_PATH`
- **THEN** Deck-go SHALL refuse to start, emit a stderr message naming the offending key and the denylist category, and exit with code 64

#### Scenario: Operator-extended denylist honored

- **WHEN** Deck-go starts with `RUNTIME_BUNDLED_ENV_DENY=FOO,BAR` and an env var `RUNTIME_BUNDLED_ENV_FOO=...`
- **THEN** Deck-go SHALL refuse to start with the same exit-64 behavior; the denylist composition is "built-in ∪ operator-extended" and is not overridable

### Requirement: Remote mode env-default + JSON-override layering

In `remote` mode, `.env` SHALL provide first-run/fallback defaults (`RUNTIME_REMOTE_URL`, `RUNTIME_REMOTE_TOKEN`, `RUNTIME_REMOTE_TLS_VERIFY`); `deck-state.json`'s `remote` section, when present and complete, SHALL whole-section override those defaults.

#### Scenario: JSON remote section overrides env defaults when complete

- **WHEN** Deck-go starts in `remote` mode and `deck-state.json` contains `{remote: {url, token, tlsVerify}}` with `url` non-empty
- **THEN** the active endpoint SHALL be `JSON.remote` in its entirety, and `.env` defaults for URL/token/tlsVerify SHALL be ignored

#### Scenario: Env defaults used when JSON remote absent

- **WHEN** Deck-go starts in `remote` mode and `deck-state.json` does not contain a `remote` section
- **THEN** the active endpoint SHALL be derived from `.env` (`RUNTIME_REMOTE_URL`, `RUNTIME_REMOTE_TOKEN`, `RUNTIME_REMOTE_TLS_VERIFY`)

#### Scenario: First-run when both empty

- **WHEN** Deck-go starts in `remote` mode and neither `deck-state.json` nor `.env` provides a non-empty URL
- **THEN** Deck-go SHALL boot successfully, capabilities SHALL report `configured: false`, and Gateway RPC passthrough endpoints SHALL return `503 gateway_not_configured`

### Requirement: Whole-section override semantics for remote endpoint persistence

When persisting a remote endpoint to JSON, Deck-go SHALL accept only complete `{url, token, tlsVerify}` PUT bodies, then store a complete `{url, token, tlsVerify}` JSON triple. Missing PUT fields SHALL NOT be implicitly merged with prior JSON or `.env` values. The explicit `token: "__unchanged__"` sentinel is the only permitted token carry-forward mechanism: for PUT, the backend resolves it to the currently active token before writing the complete JSON triple; for `POST /api/runtime/endpoint:test`, the backend resolves it only for the transient candidate connection and SHALL NOT persist it.

#### Scenario: PUT endpoint writes complete triple

- **WHEN** the frontend submits a complete endpoint payload via `PUT /api/runtime/endpoint`
- **THEN** Deck-go SHALL resolve any token sentinel first, persist the resulting entire object to `deck-state.json` atomically (temp file + rename), and discard any prior JSON `remote` content

#### Scenario: PUT with missing field rejected

- **WHEN** the frontend submits a `PUT /api/runtime/endpoint` payload missing any of `url`, `token`, or `tlsVerify`
- **THEN** Deck-go SHALL reject the request with HTTP 400 and an error code from the set `{invalid_url, token_required, invalid_tls_verify}`

#### Scenario: PUT with token sentinel preserves stored token

- **WHEN** the frontend submits a `PUT /api/runtime/endpoint` body where `token` equals the literal byte sequence `"__unchanged__"` (UTF-8, exactly 13 bytes, case-sensitive, no surrounding whitespace trimming) and `url` / `tlsVerify` are present
- **THEN** Deck-go SHALL resolve the token from the currently active endpoint layer (JSON if active, otherwise `.env` defaults), then persist the new `url` / `tlsVerify` together with that resolved token as a complete JSON object; the response SHALL still report `tokenConfigured: true` and SHALL NOT echo the plaintext token

#### Scenario: Sentinel comparison is byte-exact and case-sensitive

- **WHEN** the frontend submits a `PUT /api/runtime/endpoint` body where `token` is `"__UNCHANGED__"`, `"__Unchanged__"`, `" __unchanged__ "` (with surrounding whitespace), or any byte sequence other than the exact 13-byte sentinel
- **THEN** Deck-go SHALL treat that value as a real plaintext token (replace path), not as the sentinel; if the operator legitimately wants to set the literal token value `__unchanged__`, they MUST do so via `.env` rather than the PUT path

#### Scenario: PUT with empty-string token rejected

- **WHEN** the frontend submits a `PUT /api/runtime/endpoint` body where `token` is the empty string (and not the sentinel)
- **THEN** Deck-go SHALL reject the request with HTTP 400 and `code: "token_required"`; the on-disk token SHALL NOT be cleared (token-clear is not a supported operation through this endpoint — operators clear tokens by editing `.env` or removing `deck-state.json` and restarting)

#### Scenario: Read returns active layer, never merge

- **WHEN** the frontend issues `GET /api/runtime/endpoint` in `remote` mode
- **THEN** the response SHALL report `source: "json"` if JSON.remote is the active layer, or `source: "env"` if `.env` defaults are the active layer, but SHALL NOT mix fields from both layers; if a prior PUT used the token sentinel while `.env` was active, the resolved token is now part of the complete JSON layer and `source` is `"json"`

### Requirement: Runtime facade single-interface contract for mode-aware handlers

The `RuntimeFacade` interface (in `internal/runtime/facade/`) SHALL cover the _mode-aware_ surface of deck-go runtime — capability discovery, endpoint configuration, the runtime gateway lifecycle that is being deleted, the small set of Gateway RPC routes whose behavior depends on whether deck-go owns a Gateway subprocess (passthrough health/status/describe), and the streaming primitives invoked from the 503 middleware. Route handlers in this mode-aware family SHALL depend only on `RuntimeFacade`; no concrete `bundled` or `remote` implementation SHALL be imported by these handlers. Mode-agnostic deck-go-internal surfaces (settings/onboarding/version, activity/monitor projection, devices, agent CRUD, config/schema CRUD, file-system access, sessions, event bus, etc.) SHALL continue to depend on the existing `ManagedRuntimeSurface` interface and its sub-surfaces; this requirement explicitly does NOT mandate funnelling them through `RuntimeFacade`.

#### Scenario: Mode-aware handlers compile against facade only

- **WHEN** the Deck-go test suite runs static-analysis checks on the mode-aware route registration files (the files that register `/api/runtime/capabilities`, `/api/runtime/endpoint{,:test}`, `/api/runtime/gateway/*`, `/api/runtime/gateway`, `/api/gateway/{health,status,describe}`, and the 503 middleware factory)
- **THEN** no imports from `internal/runtime/bundled/` or `internal/runtime/remote/` SHALL appear in those handler files

#### Scenario: Mode-agnostic handlers retain their existing interfaces

- **WHEN** the codebase is scanned for handler files registering `/api/settings`, `/api/agents/*`, `/api/config/*`, `/api/activity`, `/api/monitor/*`, `/api/devices/*`, `/api/onboarding/*`, `/api/v1/runtimes/{runtimeId}/...` admin routes
- **THEN** these handlers MAY continue to depend on `ManagedRuntimeSurface` (or its existing sub-surfaces such as `GatewayQueries`, `SessionCommands`, `SessionQueries`, `RuntimeRegistry`); they SHALL NOT be artificially routed through `RuntimeFacade`

#### Scenario: Bundled package does not import remote

- **WHEN** the codebase is scanned for cross-package imports
- **THEN** files under `internal/runtime/bundled/` SHALL NOT import `internal/runtime/remote/` (and vice versa)

#### Scenario: Both implementations satisfy the same interface

- **WHEN** the build runs
- **THEN** both `bundled.New(...)` and `remote.New(...)` SHALL produce values that satisfy `facade.RuntimeFacade`, including the unsupported-method contract (mode-incompatible methods return `facade.ErrUnsupported`)

#### Scenario: Shared package is leaf (no upward imports)

- **WHEN** the codebase is scanned for cross-package imports
- **THEN** files under `internal/runtime/shared/` SHALL NOT import `internal/runtime/bundled/`, `internal/runtime/remote/`, or `internal/runtime/facade/`; `shared/` SHALL contain only protocol-agnostic helpers (RPC client base, header injection, retry/backoff helpers, time/clock abstractions, drain helper) whose function signatures take only standard-library or `shared/`-internal types — `context.Context`, `io.Closer`, `time.Duration`, `func(...)` callbacks, primitive structs

#### Scenario: Drain helper accepts only primitives

- **WHEN** the drain helper is invoked from `internal/runtime/remote/` (Phase B of an endpoint switch, or admin reload-runtime in remote mode)
- **THEN** the helper SHALL accept its inputs as primitives: `context.Context`, old-connection `io.Closer`, new-connection `io.Closer`, drain timeout `time.Duration`, terminal-event-name string (not an enum imported from `facade/`); terminal-event-name constants such as `endpoint_switched` and `reconnect_requested` SHALL be defined in `internal/runtime/facade/` and passed by value into the helper, preserving the leaf rule

#### Scenario: Mode-switched assembly via single helper

- **WHEN** `cmd/deck-go/main.go` and `cmd/controld/main.go` build the runtime facade at boot
- **THEN** both binaries SHALL call a single `facade.BuildFacade(cfg, store) (RuntimeFacade, error)` helper; neither `main.go` SHALL contain its own `switch cfg.Mode { case bundled: ... case remote: ... }` block (such drift is the failure mode this scenario forbids)

### Requirement: Capabilities discovery endpoint

Deck-go SHALL expose a `GET /api/runtime/capabilities` endpoint that returns the active mode and feature flags driving UI rendering and API gating. The response SHALL contain exactly these top-level fields: `mode` (`"bundled"` | `"remote"`), `configured` (boolean), `endpointMutable` (boolean), `supervisorState` (boolean). No additional top-level fields SHALL be returned in v1; future extensions are added by adding fields, never by mutating the meaning of existing ones.

#### Scenario: Bundled configured response

- **WHEN** the frontend issues `GET /api/runtime/capabilities` in `bundled` mode with Gateway running
- **THEN** the response SHALL be `{mode: "bundled", configured: true, endpointMutable: false, supervisorState: true}`

#### Scenario: Remote configured response

- **WHEN** the frontend issues `GET /api/runtime/capabilities` in `remote` mode with a populated remote endpoint
- **THEN** the response SHALL be `{mode: "remote", configured: true, endpointMutable: true, supervisorState: false}`

#### Scenario: Remote first-run response

- **WHEN** the frontend issues `GET /api/runtime/capabilities` in `remote` mode and no endpoint is configured
- **THEN** the response SHALL be `{mode: "remote", configured: false, endpointMutable: true, supervisorState: false}`

### Requirement: Runtime gateway status endpoint shape

Deck-go's existing `GET /api/runtime/gateway` endpoint SHALL respond with a payload whose top-level field set is selected by the active `capabilities.supervisorState` flag, so the same external URL serves both bundled and remote modes without a mode branch in caller code. This requirement makes explicit the change captured by the proposal's `Modified APIs` entry for this route.

#### Scenario: Bundled mode payload

- **WHEN** the frontend issues `GET /api/runtime/gateway` while `capabilities.supervisorState === true`
- **THEN** the response SHALL include `pid` (number or null), `ownershipState` (string), `restartAttempts` (number), and a `mode: "bundled"` discriminator; the response SHALL NOT include `lastConnectedAt`, `latencyP50`, or `tlsVerified` fields

#### Scenario: Remote mode payload

- **WHEN** the frontend issues `GET /api/runtime/gateway` while `capabilities.supervisorState === false`
- **THEN** the response SHALL include `lastConnectedAt` (ISO 8601 string or null), `lastError` (string or null), `latencyP50` (number or null), `tlsVerified` (boolean), and a `mode: "remote"` discriminator; the response SHALL NOT include `pid`, `ownershipState`, or `restartAttempts` fields

#### Scenario: First-run remote payload

- **WHEN** the frontend issues `GET /api/runtime/gateway` while `capabilities.mode === "remote"` and `capabilities.configured === false`
- **THEN** the response SHALL be HTTP 503 with `code: "gateway_not_configured"` (this endpoint is part of the passthrough family covered by the 503 middleware); no field shape SHALL be returned in the body

### Requirement: Endpoint management API surface

Deck-go SHALL expose `GET /api/runtime/endpoint`, `PUT /api/runtime/endpoint`, and `POST /api/runtime/endpoint:test` endpoints with mode-aware behavior.

#### Scenario: GET endpoint returns active config with token redacted

- **WHEN** the frontend issues `GET /api/runtime/endpoint`
- **THEN** the response SHALL include `{url, tokenConfigured, tlsVerify, source}` and SHALL NOT include the plaintext token under any field name

#### Scenario: PUT endpoint in bundled mode rejected

- **WHEN** the frontend issues `PUT /api/runtime/endpoint` while Deck-go is in `bundled` mode
- **THEN** the response SHALL be HTTP 405 with `code: "endpoint_not_mutable"` and the on-disk `deck-state.json` SHALL NOT be modified

#### Scenario: PUT endpoint in remote mode persists and reconnects

- **WHEN** the frontend issues a valid `PUT /api/runtime/endpoint` payload while Deck-go is in `remote` mode
- **THEN** Deck-go SHALL persist the new endpoint atomically, drain in-flight Gateway RPC calls, swap the underlying RPC client to the new endpoint, and return HTTP 200 with the new GET response shape

#### Scenario: Test endpoint with candidate config

- **WHEN** the frontend issues `POST /api/runtime/endpoint:test` in `remote` mode with a candidate `{url, token, tlsVerify}` body
- **THEN** Deck-go SHALL open a transient connection to the candidate, return `{ok, latencyMs, gatewayVersion, tlsVerified, error}` without persisting the candidate

#### Scenario: Test endpoint with token sentinel uses active token

- **WHEN** the frontend issues `POST /api/runtime/endpoint:test` in `remote` mode with a candidate body where `token` equals the literal byte sequence `"__unchanged__"` (UTF-8, exactly 13 bytes, case-sensitive, no surrounding whitespace trimming) and `url` / `tlsVerify` are present
- **THEN** Deck-go SHALL resolve the token from the currently active endpoint layer for the transient candidate connection only, SHALL NOT persist the candidate or resolved token, and SHALL NOT echo the plaintext token
- **AND** any byte sequence other than the exact sentinel SHALL be treated as a real plaintext candidate token
- **AND** an empty-string `token` in the candidate body SHALL be rejected with HTTP 400 and `code: "token_required"`

#### Scenario: Test endpoint without body uses active config

- **WHEN** the frontend issues `POST /api/runtime/endpoint:test` with no body
- **THEN** Deck-go SHALL use the currently active endpoint (env in bundled, JSON or env in remote per layering rules) for the connection test

### Requirement: First-run guidance and 503 passthrough

When `remote` mode is in first-run state (`configured: false`), Deck-go SHALL surface a stable empty-state contract via `gateway_not_configured` HTTP responses and frontend banner UX.

#### Scenario: RPC passthrough returns 503 when not configured

- **WHEN** any Gateway RPC passthrough endpoint registered under deck-go's `/api/...` mux is called while `configured: false` in `remote` mode — concretely the v1 set is `/api/gateway/health`, `/api/gateway/status`, `/api/gateway/describe`, `/api/activity`, `/api/monitor/runs`, `/api/monitor/runs/{runId}`, `/api/agents`, `/api/agents/{agentId}/...`, plus controld's `/api/v1/runtimes/{runtimeId}/...` admin family — and any future endpoint that calls Gateway RPC under that mux
- **THEN** the response SHALL be HTTP 503 with `code: "gateway_not_configured"` and a human-readable `message`; the implementation SHALL apply the 503 via a single middleware that consults `facade.Capabilities().Configured`, mounted under both `/api/...` and `/api/v1/...` routers, so adding a new passthrough route does not require remembering to opt in

#### Scenario: Frontend treats 503 code as empty-state, not error

- **WHEN** the frontend receives a `503 gateway_not_configured` response
- **THEN** the affected panel SHALL render an empty-state element marked `data-testid="empty-state-not-configured"` whose visible text matches the i18n key `panel.notConfigured.empty`; the affected panel SHALL NOT mount any element with `role="alert"` or `data-testid` matching `error-toast-*`; testability assertion: `queryByRole('alert')` returns null and `queryByTestId(/^error-toast-/)` returns null on the rendered panel

#### Scenario: First-run banner directs user to Settings

- **WHEN** the frontend loads with `capabilities.configured: false` in `remote` mode
- **THEN** a top-of-page element marked `data-testid="first-run-banner"` SHALL render with copy from i18n key `banner.firstRun.title` and a link to Settings (resolvable by `data-testid="first-run-banner-cta"`); the Settings Endpoint section SHALL auto-expand on navigation, identifiable via `data-testid="endpoint-section"` having attribute `aria-expanded="true"` on initial mount

### Requirement: No UI lifecycle controls

Deck-go SHALL NOT expose any HTTP endpoint or frontend control that allows users to start, stop, or restart the Gateway from the management UI.

#### Scenario: Start/restart routes are not registered

- **WHEN** an HTTP client issues `POST /api/runtime/gateway/start` or `POST /api/runtime/gateway/restart` in any mode
- **THEN** the response SHALL be HTTP 404 (route not found), and no internal start/restart code path SHALL be reachable from HTTP

#### Scenario: Stop route is not exposed

- **WHEN** an HTTP client issues `POST /api/runtime/gateway/stop` in any mode
- **THEN** the response SHALL be HTTP 404; the internal stop function survives only as a graceful-shutdown hook called by `controld.RunServer` on SIGTERM/SIGINT

#### Scenario: Frontend has no lifecycle buttons

- **WHEN** the frontend renders `GatewayPanel` runtime tab in any mode
- **THEN** there SHALL be no Start, Stop, or Restart button rendered, and `api.ts` SHALL NOT expose `startRuntimeGateway`, `stopRuntimeGateway`, or `restartRuntimeGateway` functions

### Requirement: Token confidentiality across persistence and API

Deck-go SHALL persist tokens (gateway token, deck access token, remote token) but SHALL never return them in plaintext through any API response, and SHALL never log them at any log level.

#### Scenario: GET endpoint redacts token

- **WHEN** any GET endpoint that includes endpoint config (`/api/runtime/endpoint`, `/api/runtime/gateway`, `/api/settings`) returns a payload
- **THEN** the response SHALL substitute a `tokenConfigured: boolean` (or `accessTokenConfigured: boolean`) field for any token; no plaintext token field SHALL be present

#### Scenario: Logs do not contain tokens

- **WHEN** Deck-go writes any log entry at any level during normal operation, error handling, or panic recovery
- **THEN** no token value SHALL appear in the logged output, and structured-logger field redaction SHALL be exercised by tests

### Requirement: Capability-gated frontend rendering

Frontend components SHALL drive their rendering decisions exclusively from the boolean capability flags (`endpointMutable`, `supervisorState`), and SHALL NOT branch on the `mode` string for behavior decisions.

#### Scenario: Endpoint section editability gated by capability

- **WHEN** `<EndpointSection>` renders with `capabilities.endpointMutable: false`
- **THEN** all input fields SHALL be `disabled`, a lock icon and `set via .env` badge SHALL appear, and no Save button SHALL render

#### Scenario: Endpoint section editability with mutable capability

- **WHEN** `<EndpointSection>` renders with `capabilities.endpointMutable: true`
- **THEN** input fields SHALL accept user input, a Save button SHALL appear, and successful save SHALL invoke `PUT /api/runtime/endpoint`

#### Scenario: Runtime tab field set by supervisorState

- **WHEN** `GatewayPanel` runtime tab renders with `capabilities.supervisorState: true`
- **THEN** the panel SHALL display PID, Ownership, and RestartAttempts fields

#### Scenario: Runtime tab fields without supervisorState

- **WHEN** `GatewayPanel` runtime tab renders with `capabilities.supervisorState: false`
- **THEN** the panel SHALL display LastConnected, Latency, and TLS-verified fields, and SHALL NOT display PID, Ownership, or RestartAttempts

#### Scenario: No mode-string branching in non-display contexts

- **WHEN** the frontend codebase is statically scanned for `mode === "bundled"` or `mode === "remote"` outside _display contexts_ (display = JSX text/attribute interpolation that produces user-visible copy or class names; non-display = effects, hook callbacks, store reducers, route guards, mutation handlers, query keys)
- **THEN** no occurrences SHALL be found outside display contexts; the static-check rule SHALL accept `mode` reads inside `<ModeBadge>`, `<FirstRunBanner>`, status tooltips, and other purely-display components, and SHALL reject them inside `useEffect` bodies, `dispatch` calls, `if (...)` guards over data-fetch, and similar behavioral branches

#### Scenario: Display components may read mode for copy

- **WHEN** `<ModeBadge>` or `<FirstRunBanner>` renders text that varies by mode (e.g., "Bundled Gateway" vs "Remote Gateway")
- **THEN** the component MAY read `capabilities.mode` to select the copy; the lint allowlist explicitly covers components tagged as display-only (file path or component name pattern), and reviewers SHALL reject any expansion of that allowlist into behavioral components

#### Scenario: ModeBadge shows three distinct states

- **WHEN** `<ModeBadge>` renders, identifiable by `data-testid="mode-badge"`
- **THEN** the badge SHALL render in one of exactly three states distinguished by a `data-state` attribute: `data-state="bundled"` (when `mode === "bundled"`), `data-state="remote-configured"` (when `mode === "remote" && configured === true`), or `data-state="remote-first-run"` (when `mode === "remote" && configured === false`); each state SHALL select its copy and visual treatment from this attribute, never from a separate per-mode prop

#### Scenario: FirstRunBanner visible only in remote first-run

- **WHEN** the frontend renders the app shell and `capabilities.mode === "remote" && capabilities.configured === false`
- **THEN** an element with `data-testid="first-run-banner"` SHALL be present in the DOM

#### Scenario: FirstRunBanner absent in bundled and remote-configured

- **WHEN** the frontend renders the app shell and either `capabilities.mode === "bundled"` (any configured value) or `capabilities.mode === "remote" && capabilities.configured === true`
- **THEN** no element with `data-testid="first-run-banner"` SHALL be present in the DOM

### Requirement: Settings API field narrowing

Deck-go's `/api/settings` endpoint SHALL no longer accept or return runtime-configuration fields; only user-preference fields (`appearance`, `notifications`, `pairedDevices`) SHALL be readable and writable through the settings API.

#### Scenario: GET settings excludes runtime fields

- **WHEN** the frontend issues `GET /api/settings`
- **THEN** the response SHALL contain `appearance`, `notifications`, `pairedDevices`, and `accessTokenConfigured: boolean`, and SHALL NOT contain `managedGateway`, plaintext `accessToken`, or any field driven by `RUNTIME_*` env vars

#### Scenario: PUT settings rejects runtime fields

- **WHEN** the frontend issues `PUT /api/settings` with a body containing `managedGateway` or `accessToken` keys
- **THEN** Deck-go SHALL reject the request with HTTP 400 listing the unaccepted field name

### Requirement: Configuration file lifecycle

Deck-go SHALL manage `deck-state.json` lifecycle: it SHALL be created automatically on first write if absent, and all writes SHALL be atomic (temp file + rename).

#### Scenario: First write creates the file

- **WHEN** Deck-go writes to `deck-state.json` for the first time and the file does not exist
- **THEN** Deck-go SHALL create the file (and any missing parent directories) at the resolved path, and SHALL set restrictive file permissions on platforms that support them

#### Scenario: Atomic replace on update

- **WHEN** Deck-go updates `deck-state.json`
- **THEN** the new content SHALL be written to a temporary file in the same directory, fsynced, and renamed over the target atomically; partial writes SHALL NOT leave the file in a corrupt state

#### Scenario: Corrupt file does not auto-overwrite

- **WHEN** Deck-go starts and `deck-state.json` exists but cannot be parsed as JSON
- **THEN** Deck-go SHALL log a warning, treat the system as `configured: false` for the purposes of capability reporting, and SHALL NOT overwrite the file (preserving it for forensics)

#### Scenario: PUT after corrupt state preserves forensic copy

- **WHEN** Deck-go is in the corrupt-state condition above and the operator submits a `PUT /api/runtime/endpoint`
- **THEN** before performing the atomic temp-file + rename, Deck-go SHALL copy the corrupt file to `deck-state.json.corrupt-<unix-ts>.bak` next to the target (preserving original mode); the new payload SHALL then be written normally; the backup file SHALL retain `0600` permissions and SHALL NOT be auto-deleted

#### Scenario: Write failure surfaces real error

- **WHEN** Deck-go fails to persist `deck-state.json` (disk full, permission denied)
- **THEN** the failing API call SHALL return HTTP 5xx with an error message describing the underlying failure; Deck-go SHALL NOT silently succeed

### Requirement: Endpoint security boundaries

Deck-go SHALL enforce a documented set of security commitments around the remote endpoint configuration surface, covering URL schemes, transport assumptions, token at-rest protection, request-body redaction, and `.env` loading discipline.

#### Scenario: Only http and https schemes accepted

- **WHEN** the frontend submits a `PUT /api/runtime/endpoint` with `url` using a scheme other than `http` or `https` (e.g., `file://`, `unix://`, `ftp://`, `gopher://`)
- **THEN** Deck-go SHALL reject the request with HTTP 400 and `code: "invalid_url"`; persistence SHALL NOT be attempted

#### Scenario: HTTP listener loopback-only without TLS

- **WHEN** Deck-go starts with a non-loopback bind address (e.g., `0.0.0.0:8080`) and no TLS configuration
- **THEN** Deck-go SHALL refuse to start, emit a stderr message naming the bind address and pointing to the TLS-or-loopback requirement, and exit with code 64

#### Scenario: tlsVerify=false logged per request

- **WHEN** the active remote endpoint has `tlsVerify: false` and any outbound RPC fires against it
- **THEN** Deck-go SHALL emit exactly **one** WARN log line **per outbound request** (not per connection lifetime — log volume is the cost we accept here so a forgotten dev override stays loud) naming the endpoint URL and the request method/path; the log SHALL NOT include the token; the WARN level marker is the asserted observable in tests

#### Scenario: deck-state.json mode is 0600 on POSIX

- **WHEN** Deck-go writes `deck-state.json` for the first time on a POSIX host
- **THEN** the resulting file SHALL have mode `0600` (owner read/write only) and the parent directory SHALL have mode `0700`; a follow-up read of the file metadata in tests SHALL assert these modes

#### Scenario: Sensitive-body routes never recorded in any log sink

- **WHEN** any of `PUT /api/runtime/endpoint`, `POST /api/runtime/endpoint:test`, or `PUT /api/settings` is processed and any logging sink (access log, error log, structured logger output, panic recovery log) records the request
- **THEN** the captured log entry SHALL NOT contain any portion of the request body (specifically: no plaintext token value, no full body field map) for any of these routes; the `Authorization` header SHALL also be redacted globally; redaction SHALL be enforced via a `sensitiveBody` route tag rather than per-route opt-in so that newly added candidate-bearing routes pick up redaction by tagging at registration time

#### Scenario: .env file requires restrictive permissions on POSIX

- **WHEN** Deck-go is configured with `DECK_DOTENV_FILE=<path>` on a POSIX host and the referenced file has POSIX mode looser than `0600` (e.g., `0644`, `0666`)
- **THEN** Deck-go SHALL refuse to start, emit a stderr message naming the file and the required mode, and exit with code 64

#### Scenario: .env file requires owner-only ACL on Windows

- **WHEN** Deck-go is configured with `DECK_DOTENV_FILE=<path>` on a Windows host and the file's DACL grants read access to principals beyond the current user, `SYSTEM`, and `Administrators` (e.g., the file lives in a OneDrive sync folder shared with other users, or has `Everyone:Read`)
- **THEN** Deck-go SHALL refuse to start, emit a stderr message naming the file and the failing ACL principal, and exit with code 64

#### Scenario: RUNTIME_REMOTE_URL non-http/https rejected at boot

- **WHEN** Deck-go starts in `remote` mode with `RUNTIME_REMOTE_URL` set to a value whose scheme is not `http` or `https` (e.g., `file://`, `unix://`, `gopher://`, malformed strings)
- **THEN** Deck-go SHALL refuse to start, emit a stderr message naming the offending URL and `code: "invalid_url"`, and exit with code 64; the same scheme allowlist is enforced at PUT-body validation time, so the failure modes between env and PUT are symmetric

#### Scenario: Process env wins over .env file on conflict

- **WHEN** Deck-go boots with both `DECK_DOTENV_FILE=<path>` and a process-env value defined for the same key (e.g., `RUNTIME_MODE=bundled` in process env, `RUNTIME_MODE=remote` in the file)
- **THEN** the process-env value SHALL be used, the file value SHALL be ignored, and an INFO log line SHALL be emitted listing the conflicting keys at boot

### Requirement: Endpoint switch two-phase semantics with bounded drain

When `PUT /api/runtime/endpoint` changes the active remote endpoint, Deck-go SHALL execute the change as a two-phase operation (candidate validation, then atomic commit + drain) such that a failed candidate validation cannot expose external side effects on the new endpoint, and the active client swap is atomic.

#### Scenario: Phase A — candidate validation runs against a transient connection

- **WHEN** a `PUT /api/runtime/endpoint` is processed
- **THEN** Deck-go SHALL open a transient candidate connection to the new `(url, token, tlsVerify)` triple and issue `gateway.describe` against that candidate connection; the active client and `deck-state.json` SHALL be untouched during this phase

#### Scenario: Phase A — old client continues to serve all callers during validation

- **WHEN** Phase A is in progress and any caller (in-flight or freshly arriving) makes a Gateway RPC call
- **THEN** the call SHALL be dispatched against the **old** active client; the candidate connection SHALL NOT receive any caller-facing traffic, only the internal `describe` probe

#### Scenario: Phase A failure leaves system unchanged

- **WHEN** the candidate `gateway.describe` fails (network unreachable, auth rejected, TLS verification failed, schema mismatch)
- **THEN** Deck-go SHALL close the candidate connection, return HTTP 4xx/5xx with the matching error code (`gateway_unreachable`, `gateway_auth_failed`, `tls_verification_failed`, or similar) to the PUT caller, and SHALL NOT modify `deck-state.json` or the active client; no rollback step is necessary because no commit happened

#### Scenario: Phase B — atomic commit and client swap

- **WHEN** Phase A succeeded and Deck-go enters Phase B
- **THEN** Deck-go SHALL persist the new endpoint atomically (temp file + rename) and atomically swap the active client from old to new; from the swap instant onward newly arriving callers SHALL route to the new active client, while previously in-flight callers retain their reference to the old client and complete against it under the drain policy below

#### Scenario: Phase B — in-flight unary RPC drains within 5 seconds

- **WHEN** the swap occurs while an in-flight unary RPC is awaiting response on the old client
- **THEN** Deck-go SHALL allow that call to complete against the old client for up to 5 seconds; on completion within the window the response is returned normally; on timeout the pending call SHALL terminate with HTTP 503 and `code: "endpoint_switching"`

#### Scenario: Phase B — active SSE / WebSocket stream receives `endpoint_switched`

- **WHEN** the swap occurs while an SSE or WebSocket stream is active on the old client
- **THEN** Deck-go SHALL emit a terminal event (`event: endpoint_switched` for SSE, equivalent close-frame metadata for WS) within 1 second, then close the underlying connection; the frontend SHALL be expected to re-subscribe against the new endpoint without surfacing an error toast

#### Scenario: PUT returns 200 only after Phase A succeeds

- **WHEN** a `PUT /api/runtime/endpoint` completes both phases successfully
- **THEN** Deck-go SHALL return HTTP 200 with the new GET response shape; the response SHALL only be sent after Phase A's `describe` succeeded and Phase B's persistence + swap completed

### Requirement: Break-glass admin CLI on local socket

Deck-go SHALL ship a local-only admin CLI (`deck-go admin <verb>`) that talks to a Unix-domain socket (or named pipe on Windows) owned by the running Deck-go process; the same verbs SHALL NOT be reachable over HTTP under any condition.

#### Scenario: Admin socket is filesystem-permission gated

- **WHEN** Deck-go starts on a POSIX host and creates the admin socket with a configured `RUNTIME_ADMIN_GROUP` (e.g., `deck-admin`) that resolves successfully
- **THEN** the socket file SHALL be created with mode `0660`, in a directory mode `0700`, and group ownership SHALL be the resolved group; the socket SHALL NOT be exposed on a TCP port even if `RUNTIME_*` configuration appears to ask for it

#### Scenario: Admin socket falls back to 0600 when group unavailable

- **WHEN** Deck-go starts on a POSIX host and either `RUNTIME_ADMIN_GROUP` is unset, or the configured group cannot be resolved on the host (no such group, lookup fails)
- **THEN** the socket file SHALL be created with mode **`0600` owner-only** (NOT `0660` with whatever default group the process happens to be in); Deck-go SHALL emit an INFO log line at boot describing which mode took effect and whether `RUNTIME_ADMIN_GROUP` resolved

#### Scenario: reload-runtime in bundled mode re-spawns Gateway

- **WHEN** the operator runs `deck-go admin reload-runtime` against the admin socket while Deck-go is in `bundled` mode
- **THEN** the bundled supervisor SHALL gracefully stop the current Gateway subprocess (within its existing stop semantics) and spawn a fresh one using the current `.env` configuration; the CLI SHALL print a single success/failure line and exit non-zero on failure

#### Scenario: reload-runtime in remote mode reconnects RPC client without changing endpoint

- **WHEN** the operator runs `deck-go admin reload-runtime` while Deck-go is in `remote` mode
- **THEN** the remote impl SHALL drop and re-establish its RPC client against the **currently active** `(url, token, tlsVerify)` triple (no endpoint change, no `deck-state.json` write); the drain helper SHALL emit a `reconnect_requested` terminal event on active SSE/WS streams (NOT `endpoint_switched`, since the endpoint is unchanged); unary call drain follows the same 5s timeout policy; the CLI SHALL print a single success/failure line

#### Scenario: status command has read-only semantics

- **WHEN** the operator runs `deck-go admin status`
- **THEN** the CLI SHALL print mode, capability flags, configured/connected booleans, last-error string, and supervisor or remote tail metrics; the command SHALL NOT mutate runtime state in any observable way (no spawn, no client swap, no JSON write); whether the socket exposes a separate read-only ACL surface is a deployment-level concern outside this spec — the requirement here is the verb's side-effect-free contract

#### Scenario: Admin verbs are not reachable via HTTP

- **WHEN** an HTTP client probes any URL pattern such as `/admin/reload-runtime`, `/runtime/admin`, `/internal/admin/*`, `/api/admin/*`, `/api/v1/admin/*`
- **THEN** the response SHALL be HTTP 404; no admin verb SHALL be exposed over HTTP under any path
