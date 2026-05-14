## ADDED Requirements

### Requirement: Entrypoint path resolution with three-tier fallback

Deck-go in `local` mode SHALL resolve the local Gateway entrypoint (the JavaScript file to be invoked by `node`) through a deterministic three-tier fallback: (1) explicit `OPENCLAW_REPO_ROOT` environment variable; (2) repository-relative path resolved from the BFF binary directory (`<bff_dir>/../../../dist/entry.js`); (3) absolute path persisted into the system service plist / unit / scheduled-task at install time. The resolved entrypoint MUST be a JavaScript file produced by this repository's build pipeline; deck-go SHALL NOT accept an entrypoint that lives outside the repository tree, and SHALL NOT attempt to call a globally-installed `openclaw` binary.

#### Scenario: OPENCLAW_REPO_ROOT explicit override

- **WHEN** Deck-go starts in `local` mode with `OPENCLAW_REPO_ROOT=/some/path` set
- **THEN** the resolved entrypoint SHALL be `/some/path/dist/entry.js`, and the relative-path fallback SHALL NOT be consulted

#### Scenario: Relative resolution from BFF binary

- **WHEN** Deck-go starts in `local` mode without `OPENCLAW_REPO_ROOT` and the path `<bff_dir>/../../../dist/entry.js` exists
- **THEN** the resolved entrypoint SHALL be that absolute path

#### Scenario: Missing entrypoint surfaces actionable error

- **WHEN** Deck-go starts in `local` mode and neither tier resolves to an existing file
- **THEN** the `/api/runtime/gateway` response SHALL include `lifecycleState: "not-installed"`, `lastError: "entrypoint_not_found: <attempted paths>"`, and the frontend SHALL surface a prompt to rebuild the repository (`pnpm build` or equivalent)

#### Scenario: Install-time absolute path lock and drift detection

- **WHEN** `openclaw gateway install` is invoked from deck-go for the first time
- **THEN** the absolute path of the resolved entrypoint at install time SHALL be persisted into the plist / unit / scheduled-task; subsequent boots SHALL compare the persisted absolute path against the currently-resolved one; if they differ, `lifecycleState` SHALL be `"unhealthy"` and `lastError` SHALL include `"entrypoint_path_drift"` with both paths

#### Scenario: Reject paths outside repository

- **WHEN** `OPENCLAW_REPO_ROOT` is set to a path whose resolved `dist/entry.js` is outside the deck-go repository tree (determined by absence of a sibling `package.json` whose `name` field matches the OpenClaw root package name)
- **THEN** Deck-go SHALL refuse to start, emit a stderr message stating "local mode requires this repository's own build", and exit with code 64

### Requirement: Per-repository service name strategy

Deck-go SHALL generate the operating-system service identifier (launchd plist label / systemd unit name / Windows scheduled-task name) deterministically from the absolute repository root path so that multiple clones of this repository on the same machine can each install and operate their own local Gateway service without collision.

#### Scenario: Service name hashed from repo path

- **WHEN** deck-go invokes `openclaw gateway install` from a repository at `/home/user/work/openclaw-fork-a`
- **THEN** the service identifier SHALL be `openclaw-gateway.<hash>` where `<hash>` is the first 12 hex characters of `SHA-256(absolute repo path)`; the service registered on a different fork at `/home/user/work/openclaw-fork-b` SHALL have a different `<hash>` and SHALL NOT conflict

#### Scenario: Service name reported via API

- **WHEN** the frontend issues `GET /api/runtime/gateway` in `local` mode
- **THEN** the response SHALL include `serviceName: "openclaw-gateway.<hash>"` for the active fork; this value SHALL be displayed in the Operations Panel so that operators can locate the matching launchd plist / systemd unit on disk

#### Scenario: Uninstall cleanup uses the same service name

- **WHEN** deck-go invokes `openclaw gateway uninstall` (either via UI or via test fixture cleanup)
- **THEN** the uninstall target SHALL be the same `openclaw-gateway.<hash>` derived from the current repository path; uninstall SHALL NOT operate on a generic name that could affect other forks

### Requirement: Lifecycle state probe with four-state model

Deck-go in `local` mode SHALL classify the local Gateway service into exactly one of four `lifecycleState` values: `running`, `stopped`, `not-installed`, or `unhealthy`. The classification SHALL be derived by combining the result of `openclaw gateway status` (or platform-equivalent OS service query) with a connectivity probe of the loopback endpoint. There is NO fifth `cli-missing` state — entrypoint resolution failure is captured by `not-installed` + `lastError: entrypoint_not_found` (see Requirement: Entrypoint path resolution).

#### Scenario: Running state

- **WHEN** the OS service is active and the loopback Gateway RPC `health` probe returns a healthy response within timeout
- **THEN** `lifecycleState` SHALL be `running`

#### Scenario: Stopped state

- **WHEN** the OS service is installed but inactive (launchd reports load state but not running; systemd reports `inactive (dead)`; schtasks reports task disabled or stopped)
- **THEN** `lifecycleState` SHALL be `stopped`

#### Scenario: Not-installed state

- **WHEN** the OS service is not present under the per-repo-hash service name, OR the resolved entrypoint cannot be invoked by `node` (e.g. the repository build artifacts are absent)
- **THEN** `lifecycleState` SHALL be `not-installed`; `lastError` SHALL include either `service_not_registered` or `entrypoint_not_found` (with the attempted paths) to distinguish the cause

#### Scenario: Unhealthy state

- **WHEN** the OS service is active but the loopback Gateway RPC `health` probe fails (timeout, connection refused, or non-OK response), or the persisted entrypoint path has drifted from the currently-resolved one
- **THEN** `lifecycleState` SHALL be `unhealthy` and `lastError` SHALL include a short error code (`probe_timeout` / `probe_refused` / `probe_non_ok` / `entrypoint_path_drift`)

### Requirement: Probe trigger discipline (no background polling)

Deck-go SHALL execute the `lifecycleState` probe only at the following triggers: (a) BFF boot; (b) any HTTP request to `/api/runtime/gateway` or `/api/runtime/capabilities`; (c) the frontend explicitly issues a refresh request via a documented endpoint; (d) immediately after a lifecycle action (Install / Start / Stop / Restart / Reinstall) completes or fails. Deck-go SHALL NOT run a background polling timer that probes the Gateway at fixed intervals.

#### Scenario: Boot probe

- **WHEN** Deck-go starts in `local` mode
- **THEN** one probe SHALL be issued before the BFF reports readiness, and the result SHALL be cached for subsequent request handling

#### Scenario: User-initiated refresh

- **WHEN** the frontend issues `POST /api/runtime/gateway/refresh` (the dedicated probe-refresh route)
- **THEN** Deck-go SHALL execute one probe and return the updated payload as the response

#### Scenario: No background timer

- **WHEN** the backend test suite scans for `time.Ticker`, `time.AfterFunc`, or scheduler hooks in `internal/runtime/local/` related to the lifecycle probe
- **THEN** no such constructs SHALL be found that issue periodic Gateway probes; this is enforced by a code-search rule reviewed at PR time

### Requirement: Lifecycle action HTTP endpoints proxying to official CLI

Deck-go SHALL expose `POST /api/runtime/gateway/install`, `POST /api/runtime/gateway/start`, `POST /api/runtime/gateway/stop`, `POST /api/runtime/gateway/restart`, and `POST /api/runtime/gateway/reinstall` endpoints. Each endpoint SHALL be a thin proxy that invokes the corresponding `openclaw gateway <action>` CLI subcommand against the per-repo-hash service. The per-repo-hash service name SHALL be passed to the CLI via the existing service-naming environment variables (`OPENCLAW_LAUNCHD_LABEL` on macOS, `OPENCLAW_SYSTEMD_UNIT` on Linux, `OPENCLAW_WINDOWS_TASK_NAME` on Windows) — Deck-go SHALL NOT pass a `--service-name` CLI flag (which the existing CLI surface at `src/cli/daemon-cli/register-service-commands.ts` does not define) and SHALL NOT pass a `--entrypoint` flag (the entrypoint is communicated as the script argument to `node`, not as a flag). In `remote` mode all five endpoints SHALL return HTTP 405 with `code: "lifecycle_unsupported_in_remote_mode"`.

#### Scenario: Install action

- **WHEN** the frontend issues `POST /api/runtime/gateway/install` in `local` mode with `lifecycleState: "not-installed"`
- **THEN** Deck-go SHALL invoke the CLI as `OPENCLAW_LAUNCHD_LABEL=openclaw-gateway.<hash> OPENCLAW_SYSTEMD_UNIT=openclaw-gateway.<hash> OPENCLAW_WINDOWS_TASK_NAME=openclaw-gateway.<hash> node <absolute_entrypoint> gateway install` (the platform-relevant env var takes effect; the others are inert); on success, the response SHALL be HTTP 200 with `{lifecycleState: "stopped"}` (install does not auto-start), and the lifecycle action SHALL trigger a probe whose result is reflected in the next `GET /api/runtime/gateway` response

#### Scenario: Start action

- **WHEN** the frontend issues `POST /api/runtime/gateway/start` in `local` mode with `lifecycleState ∈ {"stopped", "unhealthy"}`
- **THEN** Deck-go SHALL invoke the CLI as `<service-naming env vars> node <absolute_entrypoint> gateway start`; on success, a probe SHALL be re-run and the response SHALL reflect the new state

#### Scenario: Stop action

- **WHEN** the frontend issues `POST /api/runtime/gateway/stop` in `local` mode with `lifecycleState ∈ {"running", "unhealthy"}`
- **THEN** Deck-go SHALL invoke the CLI as `<service-naming env vars> node <absolute_entrypoint> gateway stop`; on success, the response SHALL include `{lifecycleState: "stopped"}`

#### Scenario: Restart action

- **WHEN** the frontend issues `POST /api/runtime/gateway/restart` in `local` mode with `lifecycleState ∈ {"running", "unhealthy", "stopped"}`
- **THEN** Deck-go SHALL invoke the CLI as `<service-naming env vars> node <absolute_entrypoint> gateway restart`; on success, the response SHALL be the probe result

#### Scenario: Reinstall action (recovery from entrypoint drift)

- **WHEN** the frontend issues `POST /api/runtime/gateway/reinstall` in `local` mode
- **THEN** Deck-go SHALL invoke `<service-naming env vars> node <absolute_entrypoint> gateway uninstall` followed by `<service-naming env vars> node <absolute_entrypoint> gateway install` (the second invocation uses the **currently-resolved** entrypoint, so a moved repo gets the corrected absolute path persisted into the new plist/unit/task); on success, the response SHALL be `{lifecycleState: "stopped"}`

#### Scenario: Service-naming env vars are never user-overridable

- **WHEN** Deck-go shells out to the lifecycle CLI in `local` mode
- **THEN** Deck-go SHALL set `OPENCLAW_LAUNCHD_LABEL` / `OPENCLAW_SYSTEMD_UNIT` / `OPENCLAW_WINDOWS_TASK_NAME` from its own per-repo-hash derivation regardless of whether the operator's shell has those variables set; the inherited environment SHALL NOT be allowed to override them (this avoids a "two forks accidentally sharing a service name" footgun)

#### Scenario: Action endpoints rejected in remote mode

- **WHEN** any of the five action endpoints receive a request in `remote` mode
- **THEN** the response SHALL be HTTP 405 with body `{code: "lifecycle_unsupported_in_remote_mode"}`; Deck-go SHALL NOT invoke any `openclaw gateway` CLI subcommand

#### Scenario: No silent auto-restart on failure

- **WHEN** any lifecycle action returns a non-zero exit code from the underlying CLI
- **THEN** Deck-go SHALL return HTTP 5xx with the CLI's stderr summary in `lastError`, MUST NOT silently retry, and SHALL leave the surfaced `lifecycleState` accurate (typically `unhealthy` or `not-installed`)

### Requirement: Frontend Operations Panel lifecycle UI

The frontend SHALL render a dedicated Operations Panel inside `GatewayPanel` (gated by `capabilities.supervisorState === true`, NOT by `capabilities.mode === "local"`) that displays the current `lifecycleState`, `serviceName`, `entrypointPath`, and `lastError`, and exposes the lifecycle action buttons whose visibility is driven by `lifecycleState`. The Operations Panel SHALL NOT contain any field or button unrelated to the two anchored goals (ensure-available and lifecycle-controllable). The `mode` string MAY be read inside the panel for display copy only (e.g. tooltip text saying "本地 Gateway"); component mount and button visibility decisions SHALL be capability/state driven.

#### Scenario: Not-installed state shows Install button

- **WHEN** the Operations Panel renders with `lifecycleState: "not-installed"`
- **THEN** the panel SHALL display a single primary button labeled "安装并启动" (Install and start) which, when clicked, issues `POST /api/runtime/gateway/install` and on success follows up with `POST /api/runtime/gateway/start`; Stop / Restart / Reinstall buttons SHALL NOT be displayed

#### Scenario: Stopped state shows Start and Reinstall buttons

- **WHEN** the Operations Panel renders with `lifecycleState: "stopped"`
- **THEN** the panel SHALL display a primary `[Start]` button and a secondary `[Reinstall]` button

#### Scenario: Running state shows Stop and Restart buttons

- **WHEN** the Operations Panel renders with `lifecycleState: "running"`
- **THEN** the panel SHALL display `[Stop]` and `[Restart]` buttons; an Install button SHALL NOT be displayed

#### Scenario: Unhealthy state shows Restart and Reinstall + error summary

- **WHEN** the Operations Panel renders with `lifecycleState: "unhealthy"`
- **THEN** the panel SHALL display `[Restart]` and `[Reinstall]` buttons and SHALL render `lastError` content with a short error code and human-readable summary; Deck-go SHALL NOT auto-restart silently

#### Scenario: Single-click install and start

- **WHEN** the user clicks the "安装并启动" button in the not-installed state
- **THEN** the frontend SHALL issue the two requests sequentially with a visible progress indicator and SHALL NOT show an onboarding wizard or multi-step modal flow; on success the panel SHALL transition to the running state via the post-action probe

### Requirement: Real E2E install isolation

Real E2E tests that exercise the `local` mode lifecycle path SHALL install the local Gateway service under the per-repository-hash service name and SHALL register a cleanup hook that calls `openclaw gateway uninstall` against the same service name at the end of the test run. Tests SHALL NOT write to a globally-shared launchd plist path (`~/Library/LaunchAgents/openclaw-gateway.plist` without a hash suffix), SHALL NOT modify a globally-shared systemd unit, and SHALL NOT create a generically-named Windows scheduled task.

#### Scenario: Per-repo-hash service name in fixtures

- **WHEN** a real E2E fixture installs the local Gateway for testing
- **THEN** the plist / unit / scheduled-task name SHALL include the SHA-256 hash prefix of the repository absolute path, matching the production code path; the test SHALL NOT use any name that omits the hash suffix

#### Scenario: Uninstall cleanup runs on success and failure

- **WHEN** a real E2E test run completes (success or failure) and `DECK_GO_REAL_GATEWAY_E2E=1` was set
- **THEN** the test harness SHALL invoke the official CLI uninstall against the test fork's per-repo-hash service name via the platform-appropriate service-naming env var (e.g. `OPENCLAW_LAUNCHD_LABEL=openclaw-gateway.<hash> node <entrypoint> gateway uninstall`) — NOT via a non-existent `--service-name` CLI flag; a missing cleanup SHALL fail the test run

#### Scenario: No E2E-only shortcut path

- **WHEN** the real E2E test fixture starts the local Gateway
- **THEN** the fixture SHALL invoke the same `openclaw gateway install/start` CLI subcommands that release deployments invoke; the fixture SHALL NOT bypass `install/start` by spawning the Gateway entry point directly, even though doing so would be faster, because Rule R3 (Real E2E ≡ release + .env differences) forbids E2E-only spawn shortcuts

#### Scenario: Isolated state directory

- **WHEN** a real E2E fixture configures the local Gateway
- **THEN** it SHALL set `OPENCLAW_STATE_DIR=<repo>/deck-go/.local/deck-go-real-stack/isolated/data/managed-gateway-state` (or equivalent isolated path) so that the test Gateway state does not contaminate the operator's primary `~/.openclaw/` directory; this isolation is the only permitted divergence from release behavior beyond port and token overrides

### Requirement: Lifecycle scope anchoring (anti-scope-creep)

The `local-gateway-lifecycle` capability SHALL be limited to two anchored goals: (1) **ensure-available** — guarantee that opening Deck-go in `local` mode produces a usable local Gateway with at most a single user click; (2) **lifecycle-controllable** — give the user start, stop, restart, install, and reinstall controls inside the Operations Panel. Capabilities outside these two goals SHALL NOT be added under this capability without an explicit follow-up proposal.

#### Scenario: Rejected capability extensions

- **WHEN** a PR or follow-up change proposes to add monitoring dashboards / metric history graphs / Gateway upgrade management / token rotation UI / log aggregation / log search / multi-Gateway management UI / onboarding wizards under `local-gateway-lifecycle`
- **THEN** the proposal SHALL be rejected and redirected to either a dedicated follow-up capability or out-of-scope, citing this requirement; the test for inclusion is whether the feature "directly serves either ensure-available or lifecycle-controllable" — features that fail this test are scope creep

#### Scenario: Probe + UI live where the goals require

- **WHEN** reviewers evaluate the Operations Panel layout against this requirement
- **THEN** the panel SHALL contain `lifecycleState`, `serviceName`, `entrypointPath`, `lastError`, and the five action buttons — and nothing else (specifically: no charts, no historical timeline, no token-management widget, no upgrade banner)
