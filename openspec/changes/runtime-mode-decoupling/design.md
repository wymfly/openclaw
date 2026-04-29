## Context

Deck-go is the new openclaw secondary-development primary target (per AGENTS.md "二次开发主目标" section, commit `eed7ae1c8e`). It currently embeds a Gateway supervisor (~700 LOC under `internal/runtime/`) that spawns and supervises a Gateway subprocess on the same host. The supervisor work is recent (PID adoption, fingerprinting, ownership metadata, bounded backoff restart, authenticated probe-based adoption) and was reviewed thoroughly before this change.

The design rationale (and the broader rejection of "Deck-go owns Gateway lifecycle as a control-plane base") is captured in `docs/superpowers/specs/2026-04-28-runtime-mode-decoupling-design.md`. This OpenSpec change is the implementation contract for that spec.

Current frontend state to be reshaped:

- `deck-go/frontend/src/components/panels/settings/SettingsPanel.tsx` (1072 LOC). About 60% of the file is `managedGateway.*` form fields and `accessToken` editing — both will become read-only or removed.
- `deck-go/frontend/src/components/panels/gateway/GatewayPanel.tsx` (661 LOC). Tabs `overview/timeline/history` are mode-agnostic Gateway RPC passthrough and survive intact. Tab `runtime` is supervisor-state visualization with Start/Stop/Restart buttons; this tab will be redesigned as a structured summary card without buttons, with field set varying by `supervisorState` capability.

Concurrent context: `deck-go/frontend-next/` (a parallel Next.js frontend that was de facto deprecated) was removed from the workspace in this same brainstorm session (commits `405670131e` + `1b066c46f7`); `dashboard/CLAUDE.md` and `deploy/CLAUDE.md` carry archival banners. The 4 dashboard-specific subsections in AGENTS.md are tagged `(legacy)`.

## Goals / Non-Goals

### Goals

- Make `RUNTIME_MODE` env-driven and decided once at boot — there is no runtime mode switch.
- Physically isolate `bundled` and `remote` runtime implementations so neither imports the other; the rest of Deck-go (HTTP routes, frontend) is mode-agnostic.
- Preserve all current `bundled` mode behavior (PID adoption, fingerprinting, auto-restart) — supervisor logic is RELOCATED, not rewritten.
- Make Gateway endpoint configuration `.env`-driven in `bundled` mode (UI read-only) and `.env`-default + JSON-override in `remote` mode (UI editable).
- Provide a single source of truth for UI gating: `/api/runtime/capabilities`. No `mode === ...` branching in frontend.
- Provide a clean first-run UX for `remote` mode when no endpoint is configured.
- Deliver `.env` examples and local-dev scripts for both modes.

### Non-Goals

- Production deployment artifacts for `deck-go/` (systemd unit, Docker image, packaging).
- Multi-profile support in `remote` mode (`profiles[]` + activeProfileId). Single profile only.
- Migration tooling (`deck-go migrate` CLI). No automated migration; operators compose `.env` from examples.
- Backwards compatibility with prior `openclaw.json` `managedGateway` block. This is a breaking change.
- "Mode switch via UI." Mode is a deployment property, not a runtime knob.
- Reusing the legacy `deploy/` directory for `deck-go/`. The new deployment story is a separate spec.

## Decisions

### Decision 1 — Boot-time mode selection (vs runtime-switchable)

**Chosen**: Boot-time only via `RUNTIME_MODE` env var; immutable after boot.

**Alternatives**:

- Runtime-switchable mode via UI / API: rejected. Increases attack surface (operator can trigger spawn of Gateway subprocess from UI), conflates deployment concern (where Gateway lives) with user concern (where to point Deck-go).
- Auto-detection (try local Gateway, fall back to remote URL): rejected. Implicit behavior is hostile to ops; explicit failure (refuse to start without `RUNTIME_MODE`) is preferred.

### Decision 2 — Two impl packages behind a single facade with clean package boundary

**Chosen**: `internal/runtime/facade/` defines `RuntimeFacade` interface; `internal/runtime/bundled/` and `internal/runtime/remote/` live as sibling packages with a clean compile-time boundary — neither imports the other, and both compile into the single `deck-go` binary. `cmd/deck-go/main.go` selects one at boot via a `facade.BuildFacade(cfg, store)` helper shared by `cmd/controld/main.go`.

**Scoping note**: "physical isolation" in this design means _package boundary discipline_ (CI-enforced no-cross-import + a leaf `shared/` rule), not binary-level segregation. Both impls ship in the same binary; the runtime never exercises the unused impl, but the unused code is still on disk. Build-tag-based binary segregation or a plugin loader was considered for true attack-surface reduction and rejected as out-of-scope (doubles CI work, conflicts with `.env`-selected mode). The benefits we _do_ claim:

- Code evolves independently (a refactor inside `bundled/` cannot break `remote/` and vice versa).
- Future excision of one impl (e.g., bundled-only deployments stripping remote, or the inverse) is mechanical: delete the package + the helper branch.
- Static analysis answers "what does X mode actually run?" by the import graph alone.

**Alternatives**:

- Single mode-aware impl with `if mode == ...` branches: rejected. Branching scatters across the supervisor codebase; future "remove supervisor" path is harder.
- Two binaries (`deck-go` for bundled, `deck-go-remote` for remote): rejected. Conflicts with the requirement that mode is selected by `.env`, not by which binary is installed. Doubles CI/release work.
- Build-tag-based segregation: rejected (out of scope). Achievable later if attack-surface concerns demand it; the package boundary established here is the prerequisite.

### Decision 3 — `.env` is supreme; JSON overrides only in `remote` mode

**Chosen**:

- `bundled` mode: only `.env` is read for runtime config. JSON file's `remote` section, if present, is ignored.
- `remote` mode: `.env` provides defaults; if `JSON.remote` is present and `url` is non-empty, use the entire JSON section (whole-section override, no implicit field-level merge between `.env` and JSON).
- First-run state when both are empty: Deck-go boots, capabilities reports `configured: false`, UI surfaces a guided endpoint configuration banner, RPC passthrough returns `503 gateway_not_configured`.

**Alternatives**:

- Implicit field-level merge: rejected. "URL from JSON, token from .env" creates confusing debug surfaces; whole-section is auditable. The PUT sentinel in Decision 6 is the only permitted explicit pre-write token resolution, after which JSON is still written as a complete section.
- JSON wins always (incl. mode): rejected. Conflicts with user requirement that `.env` decides mode.
- `.env` wins always: rejected. Then UI edits to endpoint don't persist across restart, defeating the remote-mode use case.

### Decision 4 — No lifecycle controls in UI

**Chosen**: Pure observatory. No Start/Stop/Restart buttons; supervisor manages itself via `autoStart` + auto-restart + graceful shutdown. `POST /api/runtime/gateway/start` and `POST /api/runtime/gateway/restart` HTTP routes are deleted; `POST /api/runtime/gateway/stop` route deleted (the function survives only as an internal call path used by `controld.RunServer` on SIGTERM).

**Alternatives**:

- Keep emergency Restart button in `bundled`: rejected. Once Deck-go owns supervisor + is itself supervised by systemd, "restart Gateway from UI" overlaps with "restart Deck-go from systemd"; the latter is the canonical path. Removing the UI button enforces single-source-of-truth lifecycle.
- Bundled with start, remote with start (manage remote process via SSH): rejected. Out of scope; remote process supervision is the remote host's concern.

### Decision 5 — Capability-gated UI; no `mode` checks in frontend behavior

**Chosen**: `/api/runtime/capabilities` returns `{mode, configured, endpointMutable, supervisorState}`. Frontend _behavior_ (rendering decisions, store reducers, hook branches, route guards) consumes only the boolean capability flags. `mode` is permitted in _display contexts_ — `<ModeBadge>` copy, `<FirstRunBanner>` headline, status tooltip strings — and only there. A single component tree drives both modes.

**Display-vs-behavior rule** (explicit, since static lint enforces it):

- **Allowed**: `<span>{capabilities.mode === "bundled" ? "Bundled Gateway" : "Remote Gateway"}</span>` — pure display.
- **Disallowed**: `if (capabilities.mode === "remote") { dispatch(reconnect()) }` — behavioral branch must consult `capabilities.configured` / `endpointMutable` / `supervisorState`.

**Alternatives**:

- Per-mode component variants (`<BundledSettingsPanel>` / `<RemoteSettingsPanel>`): rejected. Code duplication for ~80% identical UI; capability-gated layout is more maintainable.
- Frontend reads `mode` and branches behaviorally: rejected. Couples UI to mode taxonomy; capability flags are extensible (e.g., a future "endpoint preview" capability can be added without touching mode enum).
- Forbid `mode` in frontend entirely (only badge derives from a derived `displayLabel` field): rejected. Adds plumbing without removing the surface — `mode` ends up encoded in `displayLabel` anyway. Simpler to allow `mode` in display contexts and lint the rest.

### Decision 6 — Remote endpoint token-preserve sentinel

**Chosen**: PUT body must contain `{url, tlsVerify, token}` where `token` is **either** a non-empty plaintext value (replace) **or** the explicit sentinel `"__unchanged__"` (preserve the currently active token verbatim). Missing `url` / `tlsVerify` → 400. Missing or empty-string `token` → 400 (the sentinel must be explicit so token-preservation is opt-in, never accidental). The handler resolves the sentinel before persistence, then writes `JSON.remote` as a complete `{url, token, tlsVerify}` object. No missing PUT field is implicitly merged, and after the write there is no mixed active layer.

`POST /api/runtime/endpoint:test` candidate bodies may use the same exact sentinel when the operator edits URL/TLS but wants to test with the currently active token. In that path the backend resolves the token only for the transient test connection and does not persist the candidate or resolved token.

**Why sentinel over PATCH**: a literal PATCH body with field-presence semantics conflates "didn't include the field" with "wanted to preserve" and "wanted to clear". The explicit sentinel:

1. Resolves the conflict with Decision 8 (GET never returns plaintext) — the frontend, holding only `tokenConfigured: true`, can submit URL-only edits by sending `{url, tlsVerify, token: "__unchanged__"}`.
2. Keeps the write auditable: the request body either supplies the replacement token or explicitly asks the backend to resolve the existing active token before the complete-object write.
3. Closes the accidental-clear footgun (an empty form field doesn't silently wipe the token).

**Alternatives**:

- PATCH semantics for partial update: rejected. Field-presence ambiguity (token absent = unchanged? or = clear?); also makes audit trails harder.
- Force the user to re-paste the token on every URL change: rejected. Hostile UX; users will paste tokens from password managers in plaintext repeatedly, multiplying paste-leak surface.
- Sentinel value of empty string: rejected. Indistinguishable from "user cleared the field intentionally"; explicit `__unchanged__` is unambiguous.

**Sentinel comparison rules (normative)**:

- Comparison is **byte-exact** against the literal string `__unchanged__` (UTF-8 encoded, 13 bytes).
- **Case-sensitive**: `__UNCHANGED__` or `__Unchanged__` is treated as a real token, not a sentinel.
- **No whitespace trimming**: `" __unchanged__ "` (with surrounding spaces) is treated as a real token.
- If an operator legitimately wants to set or test the literal token value `__unchanged__`, they MUST do so by editing `.env` directly and then using the active endpoint path; candidate bodies for both PUT and `endpoint:test` always interpret that exact byte sequence as the sentinel. This trade-off is documented for operators in `.env.remote.example`.

### Decision 7 — First-run state surface via 503 + UI banner

**Chosen**: When `configured: false` in remote mode, Gateway RPC passthrough endpoints under deck-go's `/api/...` mux — concretely `/api/gateway/health`, `/api/gateway/status`, `/api/gateway/describe`, `/api/agents/*`, `/api/activity`, `/api/monitor/runs`, `/api/monitor/runs/{runId}`, plus controld's `/api/v1/runtimes/{runtimeId}/...` — return `503 gateway_not_configured`. Frontend treats this code as empty-state guidance, not an error toast. A persistent first-run banner steers users to Settings → Endpoint section (auto-expanded).

**Alternatives**:

- Hard-block boot until configured: rejected. User cannot reach the very Settings page they need to configure.
- Soft-redirect to Settings on every page: rejected. Confuses users who navigated intentionally; banner is less invasive.

### Decision 8 — Token never returned plaintext

**Chosen**: All token-bearing fields (gateway token, deck access token, remote token) return `*Configured: true` only. Backend persists in JSON or reads from env; frontend never sees plaintext after writes.

**Alternatives**:

- Return masked plaintext (`abc...xyz`): rejected. Browser memory + dev-tools network panel still leak the masked form; full opacity is safer.

### Decision 9 — No backwards compatibility with prior `openclaw.json` managedGateway block

**Chosen**: Deck-go refuses to start if `RUNTIME_MODE` missing or invalid (exit 64), even if a legacy `openclaw.json` exists. Operators must compose `.env` from examples. No auto-migration.

**Alternatives**:

- Auto-translate legacy `managedGateway` block on first boot: rejected. Implicit data movement is hostile to ops; explicit `.env` composition is auditable.
- Keep legacy compatibility behind a flag for one release: rejected. Adds dead-code branches; the user base is small (enhanced fork) and can absorb a clean break.

### Decision 10 — Supervisor relocation, not rewrite

**Chosen**: Move all of `internal/runtime/supervisor.go`, `preflight.go`, `ownership.go`, `fingerprint.go`, `process_group_*.go`, and their tests into `internal/runtime/bundled/`. Update import paths. Logic untouched.

**Alternatives**:

- Rewrite supervisor as part of the change: rejected. The supervisor was just reviewed and stabilized; rewriting it conflates two changes and dilutes test coverage.

### Decision 11 — Break-glass operations via admin CLI on local Unix socket, not HTTP

**Chosen**: The canonical recovery path is `systemctl restart deck-go.service` (production) or restarting the dev script (local). Beyond that, Deck-go ships a `deck-go admin reload-runtime` CLI that talks to a local Unix socket (`/run/deck-go/admin.sock` POSIX, named pipe on Windows) owned by the running Deck-go process. This CLI is the only break-glass path for forcing supervisor re-spawn after replacing the Gateway binary in `bundled` mode without restarting Deck-go itself, or for forcibly closing/reconnecting a remote client. The admin socket is filesystem-permission-gated (`0660` + a `deck-admin` group, or equivalent ACL on Windows) and SHALL NOT be reachable over HTTP under any condition.

**Why a CLI, not a button**:

- The HTTP listener may itself be wedged (e.g., the panic the operator is recovering from); break-glass must be reachable when HTTP is not.
- Filesystem permissions are a stronger authn surface than HTTP token (which can be exfiltrated and replayed); a Unix socket scoped by group + mode is harder to misuse remotely.
- Removes the "did UI lifecycle controls really go away?" question — they did, and the new path is a separate channel with separate audience (operator on the host, not browser user).

**Scope of the CLI** (kept narrow on purpose):

- `deck-go admin reload-runtime` — bundled: re-spawn Gateway. remote: drop client + reconnect against the _currently active_ endpoint (not a switch).
- `deck-go admin status` — read-only semantics: prints mode, capability flags, configured/connected, last error. Does not mutate runtime state. (Whether the socket exposes a separate read-only ACL is a deployment choice; the spec mandates only that the verb has no side effects.)
- No `start` / `stop` / `kill` verbs in v1; if needed, lifted from `systemctl` semantics later.

**Socket permission fallback**:

- Default mode `0660` with optional `deck-admin` group ownership for shared admin access.
- If `deck-admin` group is unavailable on the host or `RUNTIME_ADMIN_GROUP` is unset / unresolvable, the socket falls back to mode **`0600` owner-only** rather than expanding to `0660` with the wrong group (which would silently widen access to whatever default group the Deck-go user happens to be in). Operators see an INFO log line at boot describing which mode took effect.

**`reload-runtime` is not an endpoint switch**:

- In remote mode, `reload-runtime` re-establishes the RPC client against the _same_ `(url, token, tlsVerify)` triple that was active before the call. Because the endpoint is unchanged, the drain helper emits a **`reconnect_requested`** terminal event on active SSE/WS streams (not `endpoint_switched`). Frontend re-subscribe behavior is identical (no error toast); the event-name distinction lets analytics, logs, and any consumer that cares about endpoint-changed-vs-restarted treat the two cases differently.

**Alternatives**:

- Re-introduce `/runtime/admin/*` HTTP routes guarded by an admin token: rejected. Doubles the auth surface; "is this token compromised?" investigations take longer; HTTP listener may be the wedged subsystem.
- **Hardened separate admin HTTP listener** on a different localhost port (`127.0.0.1:NNNN`) bound only to loopback, gated by a separate admin token + per-request rate limit: rejected. Slightly more familiar to operators than a Unix socket and avoids the "must be on the host" prerequisite, but (a) the wedged-HTTP-subsystem failure mode still applies (the panic operators are recovering from often _is_ in the listener stack); (b) admin token rotation/storage adds a second secret to manage; (c) rate-limit policies become an attack surface of their own. The Unix-socket-with-filesystem-perms path achieves the same authn strength (or better) without spinning up another HTTP stack.
- Rely solely on `systemctl restart`: rejected. Non-systemd hosts (Windows, dev macOS, container runtimes that supervise differently) lose the recovery path; binary-replacement workflows would force a full Deck-go restart.
- SSH-into-host break-glass (no CLI): rejected. Operators are already on the host; we should give them an explicit verb instead of forcing them to `kill -USR1` or similar undocumented ritual.

### Decision 12 — Two-phase endpoint switch with bounded drain

**Chosen**: `RemoteFacade.UpdateRemoteEndpoint` is a deterministic two-phase operation, never a single atomic swap. The phases exist precisely so that a failed `gateway.describe` against the new endpoint cannot leave external side effects on the new endpoint.

#### Phase A — Candidate validation (active client unchanged)

1. Open a **transient candidate connection** to the new `(url, token, tlsVerify)` triple.
2. Issue `gateway.describe` against the candidate.
3. While Phase A runs, **all callers (in-flight and freshly arriving) continue to use the old active client**. New requests are NOT routed to the candidate; the candidate is a side-channel.
4. If `describe` fails: close the candidate, leave persistence and active client untouched, return the appropriate error code (`gateway_unreachable` / `gateway_auth_failed` / `tls_verification_failed`). Caller observes HTTP 4xx/5xx; no rollback needed because no commit happened.

#### Phase B — Atomic commit + drain

Only entered if Phase A succeeded.

1. Persist the new endpoint atomically to `deck-state.json` (temp file + rename).
2. Atomically swap the active client from old to candidate. From this instant:
   - Newly arriving callers route to the new active client.
   - Previously in-flight callers (captured before the swap) keep their reference to the old client and finish against it under the drain policy below.
3. Apply the drain policy keyed by call shape:

| Call shape                                       | Drain policy                                                                                                   | Timeout | On timeout                                                                    |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------- |
| Unary RPC (HTTP request/response)                | Wait for in-flight calls to complete against the _old_ client.                                                 | 5s      | Cancel context, return `endpoint_switching` (HTTP 503) to the pending caller. |
| Server-streaming SSE / WebSocket                 | Emit a graceful terminal event on the old stream (`event: endpoint_switched`); do **not** wait for client ACK. | 1s      | Hard-close the underlying connection.                                         |
| Long-poll / blocking RPC (>5s expected duration) | Old client remains alive for the in-flight call until it returns or its own timeout fires; no extra wait.      | n/a     | Same `endpoint_switching` code on eventual return.                            |

4. Return HTTP 200 to the original `PUT /api/runtime/endpoint` caller.

**Phase B crash-recovery semantics**: persistence (step 1) and the active-client swap (step 2) are not a single atomic step from the OS perspective — a panic / OOM kill / hardware fault between them can leave `deck-state.json` populated with the new endpoint while the in-memory client remains the old one (which is then discarded by process exit). On the next Deck-go boot, `envconf.Load` reads the new endpoint from JSON and the remote impl performs an implicit "first connection" `gateway.describe` against it before serving any caller-facing RPC. If that boot-time `describe` fails, the system enters first-run-style state (`configured: true` from the JSON layer but `connected: false` semantically — the existing `503 gateway_not_configured` empty-state contract is reused with a clearer last-error string). Operators recover by editing `.env` defaults or issuing a fresh `PUT /api/runtime/endpoint`; no data corruption is possible because the only "external action" Phase B took was a `describe` (idempotent, read-only).

**Why two phases instead of one**:

- A single-phase swap "describe-then-rollback" exposes the failure window where new requests have already hit the new endpoint by the time `describe` fails. Rolling back the JSON file does not undo writes that the new endpoint may have absorbed (e.g., a chat message that was forwarded to a wrong gateway).
- The candidate connection in Phase A is internal and has no externally observable side effects beyond the `describe` call itself, which is by design idempotent and read-only.

**Drain helper placement**:

- Lives in `internal/runtime/shared/` to avoid divergence between the two impls.
- Accepts only **primitives** as input: `context.Context`, `io.Closer` for old/new connection handles, `time.Duration` for timeouts, and a function value of type `func(streamID string)` invoked when a stream needs a terminal event.
- The terminal-event names (`endpoint_switched` for swap, `reconnect_requested` for admin reload — see Decision 11) are constants defined in `internal/runtime/facade/`. Callers pass the chosen constant in. This preserves the "shared is leaf" rule while keeping the helper deterministic.

**Why explicit timing**:

- Without a documented timeout, the two impl packages could diverge over time and behavior under endpoint switch becomes undefined.
- Browser SSE consumers can detect a terminal event and re-subscribe without showing an error toast.
- 5s unary / 1s stream are short enough to stay within typical user-perceived latency budgets and long enough to cover a clean WAN round-trip.

**Alternatives**:

- Single-phase atomic swap with rollback on `describe` failure: rejected (the race condition above). Surface area: any new caller during the unconfirmed-swap window can write side effects on the new endpoint.
- Three-phase (validate → drain old → swap → confirm): rejected. Symmetric drain timing matters less than getting the validate-vs-commit ordering right; an extra phase only adds operations that can fail independently.
- Hard-cut all in-flight calls instantly: rejected. Active chat streams would 502 mid-token.
- Wait indefinitely for in-flight to drain: rejected. A stuck stream blocks the endpoint switch forever.

### Decision 13 — `.env` loading discipline

**Chosen**: Process environment is the source of truth for all `RUNTIME_*` vars. Optional `.env` file loading is a _development convenience only_, gated by an explicit opt-in and never enabled by default in production:

1. Production (`systemd` / container) supplies env via `Environment=` / `--env-file` / Compose env section. Deck-go does **not** auto-discover `./.env` in this case.
2. Development opt-in: `DECK_DOTENV_FILE=/path/to/.env` (env var, not a CLI flag) instructs `envconf.Load` to merge that file. Convention: `deck-go/scripts/dev/run-bundled.sh` exports `DECK_DOTENV_FILE=$(pwd)/.env.dev` before exec.
3. If both process env and `DECK_DOTENV_FILE` define the same key, **process env wins** (file is fallback only). On any conflict, Deck-go logs an INFO line listing the conflicting keys at boot. This way ops can spot dev defaults bleeding into a system unit.
4. `.env` files MUST have mode `<= 0600` on POSIX. Looser permissions cause `envconf.Load` to error out (refusing to read tokens from a world-readable file).
5. **Windows ACL parity**: on Windows hosts, `envconf.Load` checks the file's ACL and refuses to read the file unless its DACL grants read access only to the current user (and `SYSTEM`/`Administrators` as standard inherited principals). Files synced to OneDrive or other multi-user shares typically fail this check, which is the desired behavior. Failure mode is the same as POSIX: refuse to boot with exit 64 and a stderr message naming the path.

**Why this is a Decision, not an Open Question**:

- Token confidentiality (Decision 8) leans on the env layer being trustworthy. If `.env` could be picked up implicitly from `cwd` in production, an attacker who plants a `.env` in a working directory wins; opt-in via `DECK_DOTENV_FILE` is the smallest fix.
- Operators need to know whether process env or file wins to debug "I set RUNTIME_REMOTE_URL in the unit file, why is the old value loaded?" The answer is "process env wins; check the boot INFO line for conflicts."

**Alternatives**:

- Auto-load `./.env` if present: rejected (silent footgun in production).
- Auto-load `./.env` only when `DECK_ENV=dev`: rejected. Two opt-in knobs (`DECK_ENV` + `.env` file presence) for the same effect; one explicit knob is clearer.
- Refuse to support `.env` at all, force operators to `export` manually: rejected. Local dev ergonomics are real, and the dev-only opt-in costs little.

## Security Model

This change widens the "ops platform" surface by allowing a remote endpoint to be configured at runtime. The following commitments scope that surface; each maps to a spec scenario in `runtime-mode-dispatch`.

### Endpoint URL constraints

- `RUNTIME_REMOTE_URL` (env) and PUT `/api/runtime/endpoint` body MUST be parseable as `http://` or `https://`. Any other scheme (`file://`, `unix://`, `ftp://`, …) → reject with `invalid_url`.
- Hostname-only URLs (`http://gateway:8080`) are accepted; literal IPs are accepted; rejection of internal/private ranges is **not** part of this spec — a Deck-go ops platform legitimately needs to point at internal Gateway hosts.
- `gateway.describe` is performed at PUT time as a connectivity check; failure rolls back persistence and returns `gateway_unreachable` / `gateway_auth_failed` / `tls_verification_failed` per the error taxonomy.

### Transport assumptions

- Deck-go's HTTP listener binds **loopback-only by default** (`127.0.0.1:<port>`). Any non-loopback bind requires TLS to be configured on the listener (Deck-go refuses to start on a non-loopback bind without TLS). This is the only way the PUT-body-carries-plaintext-token contract is acceptable.
- Outbound to remote Gateway: `tlsVerify: true` is the default; setting it to `false` is allowed but logged as a WARN line per request to the affected endpoint (so a forgotten dev override is loud in production logs).
- `endpoint:test` and any reconnect performed during PUT are subject to the same TLS policy.

### Token at-rest

- `deck-state.json` is written with mode `0600` on POSIX (owner-only read/write). Parent directory created with `0700`. Windows: equivalent ACL (owner-only) via `icacls` or `os.MkdirAll` defaults audited; tested.
- `.env` files loaded via `DECK_DOTENV_FILE` likewise must be `<= 0600`; Deck-go errors out otherwise.
- Tokens never appear in any GET response (Decision 8) and never in any log line (`Risk: Token leaks in logs` mitigation, tested via redaction unit test).

### Pass-through env denylist

- `RUNTIME_BUNDLED_ENV_*` forwards env to the spawned Gateway. The forwarded keys are filtered against a denylist of process-loader-affecting names:
  - POSIX: `LD_PRELOAD`, `LD_LIBRARY_PATH`, `LD_AUDIT`, `LD_BIND_NOW`
  - macOS: `DYLD_INSERT_LIBRARIES`, `DYLD_LIBRARY_PATH`, `DYLD_FALLBACK_LIBRARY_PATH`, `DYLD_*` (prefix match)
  - All: `PATH`
  - Plus an additive operator-controlled extra denylist via `RUNTIME_BUNDLED_ENV_DENY=A,B,C` (default empty).
- Forwarded keys with denylisted names cause Deck-go to refuse to start (exit 64) with a stderr message naming the offending key. Silent skipping was rejected — operator intent must be explicit.

### Request-body redaction in access logs

- The HTTP middleware that records access logs MUST NOT record request bodies for any route whose handler is tagged `sensitiveBody`. The tagged set in v1: `PUT /api/runtime/endpoint`, `POST /api/runtime/endpoint:test`, `PUT /api/settings`. (`endpoint:test` carries plaintext token in its candidate-config body, identical exposure to PUT.) Headers like `Authorization` are redacted globally.
- A unit test asserts that requests carrying a known token to _each_ tagged route do not surface that token in the captured access-log buffer.

### Admin socket

- The admin CLI socket (Decision 11) is created with mode `0660` + group ownership when `RUNTIME_ADMIN_GROUP` is set and resolves on the host. When the group is unset or unresolvable, the socket falls back to mode **`0600` owner-only** rather than `0660` with the process's default group (which would silently widen access).
- The Deck-go process refuses to expose this socket on a TCP port under any condition.

## Risks / Trade-offs

| Risk                                                                                                                                                                    | Likelihood | Impact | Mitigation                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supervisor relocation breaks implicit test imports                                                                                                                      | Medium     | Medium | Phase 1 must run `go test ./internal/runtime/bundled/...` before any Phase 2 work; CI gate enforces import-cycle checks                                                                                                                               |
| `/api/runtime/endpoint` PUT triggers reconnect mid-flight RPC                                                                                                           | Medium     | High   | Phase 3 unit test covers in-flight RPC during endpoint switch; remote facade drains in-flight calls before swapping client                                                                                                                            |
| Capability-gated UI misses cases (a button or input that should be hidden but isn't)                                                                                    | High       | Low    | Both-mode E2E (`bundled.spec.ts` / `remote.spec.ts`) with explicit assertions on Start/Stop/Restart absence; spec scenarios are the test plan                                                                                                         |
| First-run state confuses users (RPC 503s look like outage)                                                                                                              | Medium     | Medium | Frontend treats `gateway_not_configured` code as empty-state with explicit "Configure to use this feature" copy; spec scenarios cover this distinction                                                                                                |
| Upstream rebase conflicts with relocated supervisor path                                                                                                                | Medium     | Medium | `.agents/skills/deck-upstream-sync/SKILL.md` updated in Phase 5 with new path constants; rebase-time path rewrites are mechanical                                                                                                                     |
| Breaking the API (`/api/runtime/gateway/start` etc. removal) breaks any out-of-tree consumer                                                                            | Low        | Medium | Acceptable: enhanced fork is a small audience; users informed via release notes; upgrade is composing `.env` once                                                                                                                                     |
| `.env` parsing edge cases (multi-value vars like `RUNTIME_BUNDLED_ENV_*`, escaping)                                                                                     | Medium     | Medium | `envconf/*_test.go` covers each branch; documented in `.env.example` files                                                                                                                                                                            |
| Token leaks in logs                                                                                                                                                     | Medium     | High   | Token-bearing config fields tagged `// never logged, never returned` in Go; structured logger redaction tested; security review before merging Phase 1                                                                                                |
| Two impl packages diverge over time (different timeout values, different retry policies)                                                                                | Low        | Medium | `internal/runtime/shared/` houses common types and helpers; spec scenarios that apply to both modes (e.g., "Health passthrough") are tested against both impls                                                                                        |
| `shared/` package becomes a dumping ground that re-couples the impls (one impl's leaked type returns through `shared/` and the other has to depend on it)               | Medium     | Medium | Spec Scenario "Shared package is leaf" forbids `shared/` from importing `bundled/`, `remote/`, or `facade/`; CI lint enforces; PR review checklist includes "does this `shared/` change introduce mode-aware logic?"                                  |
| `cmd/deck-go/main.go` and `cmd/controld/main.go` drift apart (one updated, the other not) so a route handler runs against `bundled` while another runs against `remote` | Medium     | High   | Both `main.go` files call a single `facade.BuildFacade(cfg, store) (RuntimeFacade, error)` helper; mode-switch logic lives in exactly one place; Phase 1 task explicitly extracts this helper                                                         |
| Token in PUT request body is captured by access logs / nginx logs / proxy logs                                                                                          | Medium     | High   | Access-log middleware excludes `sensitiveBody` routes; redaction tested; HTTP listener binds loopback-only by default and refuses non-loopback bind without TLS                                                                                       |
| `RUNTIME_BUNDLED_ENV_*` is abused to inject `LD_PRELOAD` / `PATH` / `DYLD_*` into Gateway process                                                                       | Medium     | High   | Pass-through denylist enforced at boot; Deck-go refuses to start with exit 64 if a denylisted key is forwarded; spec scenario covers the rejection                                                                                                    |
| `deck-state.json` left world-readable (mode `0644` or worse) leaks tokens at rest                                                                                       | Medium     | High   | Atomic write helper sets `0600` and parent dir `0700` on POSIX; ACL equivalent on Windows; unit test asserts mode after write                                                                                                                         |
| Endpoint switch leaves an active SSE / WebSocket consumer in undefined state (some impls hang, some 502)                                                                | Medium     | Medium | Decision 12 fixes drain semantics with a 5s unary / 1s stream timeout and a terminal `endpoint_switched` event; both impls share the drain helper in `shared/`                                                                                        |
| Operator runs `deck-go admin reload-runtime` against an instance that does not own the admin socket (e.g., second instance, stale socket file)                          | Low        | Medium | CLI checks PID inside socket peer credentials before sending; stale socket detection at startup; documented in admin CLI reference                                                                                                                    |
| Supervisor relocation changes log `caller=` field and PID-file dir paths (anything that sniffs file paths in logs / metrics breaks)                                     | Low        | Medium | Phase 1 includes a grep for hardcoded `internal/runtime/supervisor` strings in metrics labels and dashboards; relocation includes a one-line note in upgrade docs                                                                                     |
| In remote mode, JSON `deck-state.json` corruption + first-time PUT erases the corrupt-file forensics promise                                                            | Low        | Low    | Spec scenario: PUT after corrupt state writes `deck-state.json.corrupt-<ts>.bak` next to the target before atomic replace                                                                                                                             |
| Phase B half-commit: persist succeeds but client swap aborts (panic / OOM kill) so next boot reads new endpoint without ever having validated it via Phase A            | Low        | Medium | Decision 12 crash-recovery clause: boot-time `gateway.describe` is mandatory before serving any caller-facing RPC; failure surfaces as `503 gateway_not_configured`-style empty state with last-error string; tested by 3.13 "crash recovery" subcase |

## Migration Plan

This is a breaking change executed in 7 sequential phases with a feature branch per phase or a stacked branch series. Total budget: **15–19 days**.

### Phase 1 — Backend foundation (3–4 days)

Create new packages (facade / envconf / state / shared / bundled / remote skeletons), relocate supervisor, mode-switched main via `facade.BuildFacade(...)`. Includes `envconf` permission checks (POSIX 0600 + Windows ACL parity), `RUNTIME_BUNDLED_ENV_*` denylist enforcement, and the boot-time URL scheme allowlist for `RUNTIME_REMOTE_URL`. End state: `RUNTIME_MODE=bundled` boots with all current bundled-mode behavior preserved. `RUNTIME_MODE=remote` boots but most operations return `ErrUnsupported`.

### Phase 2 — API surface skeleton (2–3 days)

Implement `/api/runtime/capabilities` and the `/api/runtime/endpoint` family **as request-routing + validation skeletons** that return `ErrUnsupported` for the remote-impl-specific behavior (the actual two-phase commit + drain logic lives in Phase 3). Delete `/api/runtime/gateway/start`, `/api/runtime/gateway/restart`, `/api/runtime/gateway/stop` routes. Narrow `/api/settings`. Strip token carry-forward. Define the unified error-code taxonomy (`endpoint_not_mutable`, `gateway_not_configured`, `invalid_url`, `token_required`, `invalid_tls_verify`, `gateway_unreachable`, `gateway_auth_failed`, `tls_verification_failed`, `endpoint_switching`).

**Phase 2 ↔ Phase 3 dependency**: `PUT /api/runtime/endpoint` and `POST /api/runtime/endpoint:test` handlers in tasks 2.3 / 2.5 depend on the two-phase commit logic in tasks 3.3 / 3.12 / 3.4. Phase 2 produces handler scaffolding + body validation + error mapping that returns `ErrUnsupported` for the deeper paths; Phase 3 wires those handlers to real implementations. The two phases can begin in parallel only if there is sufficient headcount (≥2) and a clear interface freeze: Phase 2 owns the HTTP boundary contract (route shapes, error codes), Phase 3 consumes that contract. Single-developer execution should treat Phase 2 → Phase 3 as serial.

### Phase 3 — Remote mode implementation (3–4 days)

Real RPC client for remote, reconnect logic, two-phase `UpdateRemoteEndpoint` (Phase A candidate `describe` + Phase B atomic commit + drain), `TestRemoteEndpoint`, first-run state detection, 503 passthrough middleware. Drain helper (primitives-only) lives in `internal/runtime/shared/`; terminal-event constants live in `internal/runtime/facade/`. End state: `RUNTIME_MODE=remote` first-run → save endpoint → connect → run a chat round-trip end-to-end against a mock Gateway.

### Phase 4 — Frontend rewrite (3–4 days)

`useCapabilities()` hook, `<EndpointSection>`, `<ModeBadge>`, `<FirstRunBanner>`, `<ReadOnlyField>`. Refactor `SettingsPanel.tsx` (drop managedGateway form fields, redact accessToken) and `GatewayPanel.tsx` (drop Start/Stop/Restart buttons, capability-gated runtime tab fields). Discriminated-union types in stores. Both-mode E2E (`bundled.spec.ts` / `remote.spec.ts`). Frontend save-flow always submits `token` (sentinel `__unchanged__` when unchanged); endpoint test-flow may submit the same sentinel for an edited candidate when the token field is unchanged.

### Phase 5 — Local dev + docs (1 day)

`.env` examples (`.env.bundled.example`, `.env.remote.example`), `deck-go/scripts/dev/run-bundled.sh` / `run-remote.sh`, `deck-go/backend/README.md` Architecture + Operations + Security sections, `AGENTS.md` "Deck-go 开发环境" updates with concrete file paths, `deck-upstream-sync` skill path constants.

### Phase 6 — Admin CLI (2 days)

`deck-go admin <verb>` CLI + local-socket server, `reload-runtime` (bundled re-spawn / remote reconnect-with-`reconnect_requested`), `status` (read-only semantics), socket permission rules (0660 with group / 0600 fallback when group unavailable), HTTP-non-reachability assertion. Tests covering both modes, both permission paths, and the HTTP probe-404 behavior.

### Phase 7 — Security enforcement hardening (1–2 days)

HTTP listener loopback-vs-TLS check, URL scheme allowlist at PUT layer (boot layer covered in Phase 1), `deck-state.json` mode `0600` POSIX + Windows ACL parity, `sensitiveBody` route-tag access-log redaction (covering `PUT /api/runtime/endpoint`, `POST /api/runtime/endpoint:test`, `PUT /api/settings`), `tlsVerify=false` per-request WARN logging, redaction unit tests for each tagged route, GET-response token-leak fixture tests.

### Rollback Strategy

If a critical issue surfaces post-merge:

- **Phase 1–2 revert**: `git revert` the relocation + capability commits; restore old `internal/runtime/supervisor.go` location (file content unchanged, only path differs); old endpoints can be reinstated by reverting the deletion commits.
- **Phase 3 revert** (remote impl): Disable `RUNTIME_MODE=remote` (refuse to start with that value). Bundled mode still works.
- **Phase 4 revert** (frontend): UI rolls back to capability-blind rendering; backend can keep capabilities endpoint without breakage.
- **Phase 6 revert** (admin CLI): `git revert` the admin-socket creation + CLI commits; runtime continues to function (admin CLI is opt-in, never on the critical path).
- **Phase 7 revert** (security hardening): individual sub-controls (loopback-vs-TLS check, denylist, redaction middleware) can be reverted independently; reverting redaction does NOT affect functional behavior, only log fidelity.

Each phase commits independently for clean revert granularity.

## Resolved Implementation Notes

- `/api/runtime/endpoint:test` performs a lightweight `gateway.describe` call. This confirms protocol compatibility, not just TCP/TLS reachability, and matches the `Endpoint management API surface` scenarios plus Phase 3 tasks.
- Remote mode displays `lastConnectedAt` in the GatewayPanel runtime tab even before any successful connection. The "never connected" state renders as `n/a`, matching the runtime-gateway payload scenarios.
- A richer capabilities state machine (`connecting | connected | degraded | error` plus `errorCode` / `lastConnectedAt`) is deferred to a follow-up change. The v1 contract remains `{configured, endpointMutable, supervisorState}` plus the `503 gateway_not_configured` empty-state path; richer connection-state UX can layer on top later without changing existing capability meanings.
