## Why

Deck-go currently embeds a Gateway supervisor (~700 LOC: PID adoption, fingerprinting, ownership metadata, bounded backoff). This couples Deck-go's lifecycle with Gateway's: a Deck-go crash kills the agent runtime, and Deck-go can only manage a Gateway on the same host. As the repository's secondary-development focus has shifted to `deck-go/` as the new management/operations platform on top of OpenClaw's agent runtime (per the `2026-04-28` AGENTS.md update positioning `deck-go/` as the primary target and `dashboard/` as legacy), this coupling becomes a hard ceiling — ops platforms manage remote runtimes, and they should not sit on the critical path of runtime availability. Moreover, the existing UI mixes runtime configuration (host/port/command/args, only meaningful when Deck-go owns the process) with user preferences, with no way to point Deck-go at a Gateway running on another machine.

This change introduces a `RUNTIME_MODE` environment variable that picks between two physically isolated runtime implementations (`bundled/` and `remote/`) behind a single facade interface, with the rest of Deck-go entirely mode-agnostic. `.env` becomes the supreme source of truth; in `remote` mode users may additionally edit Gateway endpoint via UI (persisted to JSON, overrides `.env` defaults).

## What Changes

- **NEW**: `RUNTIME_MODE` environment variable (`bundled` | `remote`) decided once at boot, immutable at runtime.
- **NEW**: `internal/runtime/facade/` defines a single `RuntimeFacade` interface; `internal/runtime/bundled/` and `internal/runtime/remote/` are physically isolated implementations selected at boot. `bundled/` may not import `remote/` and vice versa.
- **NEW**: `internal/runtime/envconf/` parses `.env` into typed `RuntimeBundledConfig` / `RuntimeRemoteDefaults`.
- **NEW**: `internal/runtime/state/` reads/writes `deck-state.json` atomically; the `remote` section is only read/written in `remote` mode.
- **NEW**: `/api/runtime/capabilities` endpoint reports `{mode, configured, endpointMutable, supervisorState}`; UI gating reads from this single source. Frontend logic must not branch on `mode === ...` directly.
- **NEW**: `/api/runtime/endpoint` endpoint family (GET/PUT/`:test`). PUT only works in `remote` mode (returns `405 endpoint_not_mutable` in `bundled`); whole-section persistence semantics with one explicit token-preserve sentinel (`"__unchanged__"`). PUT resolves the sentinel before complete JSON persistence; `:test` may resolve the same sentinel for a transient candidate connection without persisting it. Missing fields are never merged implicitly.
- **NEW**: First-run UX in `remote` mode — empty endpoint state surfaces a banner + auto-expanded Endpoint section in Settings. Gateway RPC passthrough endpoints return `503 gateway_not_configured` while empty.
- **NEW**: `<EndpointSection>` / `<ModeBadge>` / `<FirstRunBanner>` / `useCapabilities()` hook in frontend; one component tree drives both modes via capability flags.
- **NEW**: Local-dev scripts under `deck-go/scripts/dev/run-bundled.sh` and `run-remote.sh`. **NEW** `.env` examples at `deck-go/.env.bundled.example` and `deck-go/.env.remote.example`.
- **MODIFIED**: Existing supervisor code (`runtime/supervisor.go`, `preflight.go`, ownership/fingerprint helpers) physically relocates from `internal/runtime/` to `internal/runtime/bundled/`. Logic is preserved; only the package path changes.
- **MODIFIED**: `cmd/deck-go/main.go` selects between `bundled.New(...)` and `remote.New(...)` based on `cfg.Mode`. `cmd/controld/main.go` aligns.
- **MODIFIED**: `controld/` HTTP routes depend only on `facade.RuntimeFacade`; no concrete runtime impl is imported by route handlers.
- **MODIFIED**: `/api/settings` GET response no longer contains `managedGateway`; `accessToken` is returned as `accessTokenConfigured: true` (never plaintext). PUT accepts only `appearance / notifications / pairedDevices`; other fields → 400.
- **MODIFIED**: `runtime/openclaw/legacy_admin_settings_onboarding.go` strips token carry-forward logic (no UI write path remains).
- **MODIFIED**: Frontend `SettingsPanel.tsx` — managedGateway form fields removed, `accessToken` rendered read-only with `(set via .env)` badge; new EndpointSection rendered in both modes (bundled shows derived URL, remote is editable).
- **MODIFIED**: Frontend `GatewayPanel.tsx` runtime tab — Start/Stop/Restart buttons removed; runtime tab is a structured summary card whose field set branches on `supervisorState` capability flag (PID/Ownership/RestartAttempts in bundled; LastConnected/Latency/TLS in remote).
- **REMOVED** (BREAKING): HTTP routes `POST /api/runtime/gateway/start` and `POST /api/runtime/gateway/restart`. Lifecycle is `autoStart`-driven; auto-restart is internal to the supervisor; no UI control.
- **REMOVED** (BREAKING): `POST /api/runtime/gateway/stop` HTTP route (the function survives only as an internal call path used by graceful shutdown in `controld.RunServer`).
- **REMOVED**: Frontend `startRuntimeGateway` / `stopRuntimeGateway` / `restartRuntimeGateway` in `api.ts`; `runtime.rawSettings` / `rawDiagnostics` raw-JSON cards in GatewayPanel; `managedGatewayArgsText` / `updateManagedGateway` mutation state in SettingsPanel.
- **REMOVED**: `internal/runtime/config_sync*` (the "config sync" concept disappears once UI cannot mutate runtime config; bundled config can only change in `.env`, requiring Deck-go restart).
- **NEW**: `deck-go admin reload-runtime` admin-only CLI as the sole break-glass path for forcing supervisor re-spawn (e.g., after replacing the Gateway binary in `bundled` mode without restarting Deck-go). The CLI talks to a local Unix socket / named pipe owned by Deck-go; it MUST NOT be reachable over HTTP. Production canonical recovery path remains `systemctl restart deck-go.service`.
- **NEW**: Security model commitments — `RUNTIME_REMOTE_URL` accepts only `http`/`https` schemes (no `file://` / `unix://`); plaintext token in HTTP listener body requires the listener to be loopback-only by default (any non-loopback bind requires TLS); `deck-state.json` is written with `0600` permissions on POSIX; the access-log middleware enforces a `sensitiveBody` route tag covering `PUT /api/runtime/endpoint`, `POST /api/runtime/endpoint:test`, and `PUT /api/settings` — request bodies for any tagged route are not recorded in access logs / error logs / structured-logger sinks; `RUNTIME_BUNDLED_ENV_*` rejects a denylist of process-loader-affecting names (`LD_PRELOAD`, `LD_LIBRARY_PATH`, `DYLD_*`, `PATH`).
- **BREAKING**: No backwards compatibility with prior `openclaw.json` `managedGateway` block. Deck-go refuses to start with `RUNTIME_MODE` missing or invalid (exit 64); operators must compose `.env` from the new examples.
- **DOC**: AGENTS.md positioning of `deck-go/` as the primary secondary-development target is already in place (commit `eed7ae1c8e`); the `dashboard/`-specific subsections are tagged `(legacy)`. This proposal extends that by recording the precise new endpoints, env vars, and code-deletion list as authoritative spec text. `dashboard/CLAUDE.md` and `deploy/CLAUDE.md` carry archival banners (commit `e5b…`); `deck-go/frontend-next/` has been removed from the workspace.
- **DOC**: Upstream-sync skill (`.agents/skills/deck-upstream-sync/SKILL.md`) updates path constants from `internal/runtime/supervisor.go` to `internal/runtime/bundled/supervisor.go` so future rebases mechanically follow the new layout.

## Capabilities

### New Capabilities

- `runtime-mode-dispatch`: Defines `RUNTIME_MODE` env-driven boot-time selection between `bundled` and `remote` runtime implementations, the `RuntimeFacade` interface contract, package isolation rules, configuration layering (`.env` supreme + JSON override in remote mode), the `/api/runtime/capabilities` discovery endpoint, the `/api/runtime/endpoint` GET/PUT/`:test` endpoints, the first-run UX in `remote` mode, the error-code taxonomy (`endpoint_not_mutable` / `gateway_not_configured` / `invalid_url` / `token_required` / `tls_verification_failed` / etc.), and the capability-gated frontend rendering rules (`endpointMutable`, `supervisorState`).

### Modified Capabilities

None. The breaking behavior is fully described inside the new `runtime-mode-dispatch` capability (route deletion / empty-state 503 / Settings field narrowing / GatewayPanel runtime tab redesign / `api.ts` function removals).

Scope verification (why no existing capability is affected at the spec level):

- `openspec/specs/gateway-communication/spec.md` currently contains only `SSE Stream Bridge` and `Typed client coverage` requirements; neither describes `/api/runtime/gateway/{start,stop,restart}`, so removing those routes does not contradict any of its requirements.
- `openspec/specs/deck-control-panel-parity/spec.md` describes the prior-generation `dashboard/` Channels/Config/Settings/Routing panel parity (now legacy per `dashboard/CLAUDE.md`); deck-go/ frontend rewrite work is outside its scope.

If at archive time any of those existing specs is later extended to describe the deleted surface, a follow-up change can introduce the matching delta without rewriting this proposal.

## Impact

### Code

- **Backend**:
  - New packages: `internal/runtime/{facade,envconf,state,bundled,remote,shared}/`.
  - `internal/runtime/supervisor.go`, `preflight.go`, `ownership.go`, `fingerprint.go`, `process_group_*.go`, and their `_test.go` files relocate into `internal/runtime/bundled/`.
  - `internal/runtime/config_sync.go` + tests deleted.
  - `internal/controld/` HTTP route handlers refactored to depend on `facade.RuntimeFacade`; new handlers for `/api/runtime/capabilities` and `/api/runtime/endpoint` family; deletions of `/api/runtime/gateway/start` / `/api/runtime/gateway/restart` / `/api/runtime/gateway/stop` routes; `/api/settings` field-narrowing.
  - `runtime/openclaw/legacy_admin_settings_onboarding.go`: token carry-forward deleted.
  - `runtime/openclaw/legacy_runtime_orchestration.go`: import-path-only update to follow supervisor relocation.
  - `cmd/deck-go/main.go` + `cmd/controld/main.go`: mode-switched assembly.
- **Frontend**:
  - `SettingsPanel.tsx`: removal of managedGateway form fields and `accessToken` `<input>`; introduction of `<EndpointSection>` and read-only badges.
  - `GatewayPanel.tsx`: removal of Start/Stop/Restart buttons; runtime tab redesign as structured summary card with capability-gated fields.
  - `useDeckUI` runtime bootstrap → discriminated union by mode.
  - `api.ts`: deletion of `startRuntimeGateway`, `stopRuntimeGateway`, `restartRuntimeGateway`; addition of capability/endpoint client methods.
  - New components: `<EndpointSection>`, `<ModeBadge>`, `<FirstRunBanner>`, hook `useCapabilities()`, generic `<ReadOnlyField>`.
- **Contracts**:
  - `deck-go/contracts/source/deck-api.contract.ts` extended with `Capabilities`, `EndpointGet/Put/Test` types and their generated TS / Go counterparts. Existing `failurePhase` enum etc. preserved.

### APIs

- **Added**: `GET /api/runtime/capabilities`, `GET /api/runtime/endpoint`, `PUT /api/runtime/endpoint` (remote only; 405 in bundled), `POST /api/runtime/endpoint:test`.
- **Removed**: `POST /api/runtime/gateway/start`, `POST /api/runtime/gateway/restart`, `POST /api/runtime/gateway/stop` (all 3 are BREAKING removals — no 410 stub).
- **Modified**: `GET /api/settings` (response field set narrowed); `PUT /api/settings` (request field set narrowed); `GET /api/runtime/gateway` (field set varies by `supervisorState` capability).

### Tests

- Relocated: `internal/runtime/supervisor_test.go`, `preflight_test.go`, etc. → `internal/runtime/bundled/`.
- New: `internal/runtime/envconf/*_test.go` (parser + boundary cases), `internal/runtime/state/*_test.go` (atomic write + corruption tolerance), `internal/runtime/remote/*_test.go` (first-run, reconnect on endpoint change, in-flight RPC during PUT).
- Frontend: `SettingsPanel.test.tsx` and `GatewayPanel.test.tsx` rewritten as capability-gated.
- E2E: new `bundled.spec.ts` / `remote.spec.ts` (remote uses a mock Gateway server fixture).
- Deleted: `runtime/config_sync_test.go`.

### Dependencies

- Backend may need a small `.env` file loader for dev (e.g., `github.com/joho/godotenv`); production deployments rely on process env from systemd / container.
- No new frontend dependencies anticipated.

### Documentation

- `deck-go/backend/README.md`: new Architecture section describing the two-mode layout and facade boundary.
- New: `deck-go/.env.bundled.example`, `deck-go/.env.remote.example`.
- `CLAUDE.md` (= `AGENTS.md`) "二次开发主目标" and "Deck-go 开发环境（新主目标）" sections updated to reference new run scripts and `.env` examples once Phase 5 lands.
- `.agents/skills/deck-upstream-sync/SKILL.md`: path constants updated to `internal/runtime/bundled/supervisor.go`.

### Out of scope (deferred)

- Production deployment artifacts for `deck-go/` (systemd unit, Docker image, packaging) — separate spec.
- Multi-profile remote support (`profiles[]` + activeProfileId) — single profile only in this change.
- Migration tooling (`deck-go migrate` CLI) — no automated migration; operators compose `.env` from examples.
- Backwards compatibility with prior `openclaw.json` `managedGateway` block.
