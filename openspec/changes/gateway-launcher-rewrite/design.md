## Context

deck-go's current `bundled` mode owns the Gateway subprocess directly: it spawns `node dist/entry.js gateway run ...` through `RUNTIME_BUNDLED_COMMAND` / `RUNTIME_BUNDLED_ARGS`, runs a Go-side supervisor (PID adoption, lock file, fingerprint, ownership metadata, bounded backoff), and ties the Gateway's life to its own. The earlier `runtime-mode-decoupling` change isolated this implementation behind a `RuntimeFacade` interface, but two things stayed wrong:

1. **The wrong process model** — Gateway is a long-running agent runtime that should outlive any single UI client. Coupling it to deck-go's lifetime made every deck-go restart an unnecessary agent runtime restart and made every deck-go crash a Gateway crash. OpenClaw's official CLI already ships a complete OS-service lifecycle (`gateway install/start/stop/restart/status` on launchd / systemd / Windows schtasks), with a PID lock at `$STATE_DIR/.locks/gateway.$HASH.lock` and stale-PID cleanup. deck-go was reimplementing a subset of that, badly.
2. **Mode leakage** — Although the proposal frame called for `mode-agnostic` upper layers, in practice four frontend sites (`HeaderBar.tsx:31`, `api.ts:566/572/578`) and two backend sites (`assets.go:269`, `legacy_admin_assets.go:249`) carried direct `mode === "bundled"` branches. The canvas A2UI asset path is loaded only in `bundled` mode — a **functional leak** that means the asset has never been validated under `remote`.

Phase 3 of the project's grill session (2026-05-13, captured in repo-root `CONTEXT.md`) decided the convergence path:

- A3 is resolved: bundled → local, keep the mode binary, change the implementation. "本地 Gateway" is **the build of this repository's own `dist/entry.js`**, not a globally-installed `openclaw` binary. deck-go acts as a Gateway client + graphical lifecycle copilot, calling the official CLI.
- R2 modifies: the control surface is layered — business surface is mode-agnostic, operations surface is explicitly mode-aware (and that's where the lifecycle UI lives).
- R3 is introduced: real E2E paths must equal release paths up to `.env` differences only; no E2E-only spawn shortcuts.
- The convergence is split into two OpenSpec changes: this one (clean-up / rewrite), and a follow-up `runtime-mode-switching` that adds runtime mode switching as a new capability.

The product design anchor is the user's own framing: "It's about ensuring there's an available local Gateway and making its lifecycle controllable — nothing fancy." Anything beyond `ensure-available` and `lifecycle-controllable` is scope creep.

## Goals / Non-Goals

**Goals:**

- Replace deck-go BFF's `bundled/` Go package with a `local/` package whose Gateway operations are thin proxies around `openclaw gateway install/start/stop/restart/status` invoked against this repository's `dist/entry.js`.
- Rename the `RUNTIME_MODE=bundled` value to `local`; reject `bundled` at boot with an explicit migration message.
- Fix the six identified R2 violations and migrate the canvas A2UI asset out of its `bundled`-only path.
- Add an Operations Panel UI in `local` mode with status display + Install / Start / Stop / Restart / Reinstall controls.
- Implement per-repository-hash service naming so multiple clones of this repository on the same machine do not collide.
- Restructure real E2E fixtures to install the per-hash service and clean up after themselves, while continuing to run the same install/start path that release deployments run (Rule R3).
- Merge / restructure the mock E2E specs so the spawn-vs-connect distinction disappears.
- Preserve all behavior on the `remote` mode side: `remote` mode is untouched semantically — only the type identifier values change from `bundled` to `local` in capabilities.

**Non-Goals:**

- **Runtime mode switching** is explicitly deferred to the follow-up `runtime-mode-switching` change. After this change, `RUNTIME_MODE` is still decided at boot and is still immutable.
- **Monitoring dashboards, upgrade management, token rotation UI, log aggregation, multi-Gateway management UI, onboarding wizards** — all out of scope (see the scope-anchoring requirement in `local-gateway-lifecycle`).
- **Auto-restart** of an unhealthy local Gateway by deck-go itself is out of scope; recovery is user-initiated via the Restart / Reinstall buttons. Silent retry is forbidden because it would hide systemic failures.
- **Background polling** of the local Gateway status is out of scope; probes run only at boot, on user-triggered refresh, on request to the runtime API, and immediately after a lifecycle action. A periodic poll loop is forbidden by the probe-trigger requirement.

## Decisions

### D1. Replace the `bundled/` package with a `local/` package that shells out to the official CLI

**Decision:** `internal/runtime/bundled/` is removed. A new `internal/runtime/local/` package is created. The new package exposes the same `facade.RuntimeFacade` interface and behaves identically from the facade's perspective, but every method that used to spawn / supervise / monitor a child Gateway process is replaced by a shell exec of `node <entrypoint> gateway <action> --service-name <per-repo-hash>`. The Go-side supervisor, PID adoption, lock file, fingerprint, and ownership tracking are deleted; we rely on the official CLI's own lock file at `$STATE_DIR/.locks/gateway.$HASH.lock` and on the OS service manager (launchd / systemd / schtasks) for lifecycle.

**Alternatives considered:**

- _Detached spawn (`exec.Cmd` with `Setpgid` / `unref`)_: Would have kept Gateway alive past deck-go restart but would have re-implemented (badly) what launchd already does correctly. Rejected; it would also be confusable with the rejected bundled model and create review-time ambiguity.
- _Embed Gateway in deck-go BFF as a goroutine via cgo or process-level fork_: Out of question; the project's R2 / R3 / fork-rebase friction rules all push the other way.
- _Use a Go library to read / write launchd plists directly, bypassing the `openclaw gateway install` CLI_: Rejected because it duplicates the official CLI's logic and creates upstream-sync drift risk; the CLI is the source of truth for OS-service registration semantics.

**Rationale:** The CLI is already a production-grade, cross-platform, well-tested implementation. We delegate everything we can.

### D2. Mode value rename `bundled` → `local` with hard rejection of the legacy value

**Decision:** `RUNTIME_MODE=bundled` is no longer accepted; deck-go exits 64 with a stderr message pointing operators to `.env.local.example` and explaining the rename. The capability response field `mode` and all related type guards (`isBundledRuntimeStatus()` etc.) are renamed accordingly. The `Capabilities.mode` enum becomes `"local" | "remote"` everywhere on the contract surface.

**Alternatives considered:**

- _Accept `bundled` as an alias for `local` for one release cycle_: Rejected. The implementation has changed; a `bundled` env value can no longer be honored correctly because the spawn-control vars (`RUNTIME_BUNDLED_COMMAND`, etc.) are also removed. An alias would invite confusion.
- _Keep the legacy `bundled` name and only update the implementation_: Rejected because the name actively misleads — the new mode does not bundle anything into the BFF binary.

**Rationale:** Names should reflect implementation. The user's grill response explicitly called `bundled` a misleading legacy term.

### D3. Three-tier entrypoint path resolution with install-time absolute path lock

**Decision:** Entrypoint resolution proceeds in order: (1) `OPENCLAW_REPO_ROOT` env var override; (2) relative path from the BFF binary directory (`<bff_dir>/../../../dist/entry.js`); (3) absolute path stored in the plist / unit / scheduled-task at install time. At boot, deck-go compares the persisted absolute path against the currently-resolved one; mismatch marks the lifecycle state as `unhealthy` with `entrypoint_path_drift` so the user can hit Reinstall.

**Alternatives considered:**

- _Always require explicit `OPENCLAW_REPO_ROOT`_: Forces operator burden; rejected because the relative-path default works correctly for the common case (no repo move).
- _Always rely on the install-time absolute path with no relative fallback_: Would break developer workflows that haven't done a fresh install (e.g. fresh clone, then `make run-local`).
- _Symlink-based indirection_: Adds operational complexity for marginal benefit; rejected.

**Rationale:** Defense in depth. The relative path handles the happy path; the env var override handles symlink / non-standard layouts; the install-time absolute path handles cases where the OS service is invoked from an environment that doesn't have the BFF directory in scope.

### D4. Per-repository-hash service name (`openclaw-gateway.<hash>`)

**Decision:** Service identifiers are derived by `serviceName = "openclaw-gateway." + SHA256(absRepoPath).hex()[:12]`. Multiple clones of this repository on the same machine each get a distinct service. Uninstall always operates on the per-hash name.

**Alternatives considered:**

- _Single global service name `openclaw-gateway`_: Causes collision when two forks coexist; one fork's `install` overwrites the other's plist.
- _Random UUID per install_: Loses the deterministic mapping from repo location to service; uninstall cleanup would need an external registry.
- _Hash by `package.json` content_: Too easy to drift between updates of the same fork.

**Rationale:** Deterministic and collision-resistant. The hash prefix is short enough to be readable in the Operations Panel and in `launchctl list` output.

### D5. Canvas A2UI asset migration — BFF reverse-proxy, Gateway-served at source

**Decision:** The canvas A2UI asset bundle that lived behind the `bundled`-only branch in `assets.go:269` and `legacy_admin_assets.go:249` SHALL be served by the Gateway itself via its existing static-assets surface AND fronted by deck-go BFF as a **reverse-proxy passthrough route** at `/api/runtime/gateway-assets/*`. The browser SHALL fetch only from deck-go BFF (`/api/runtime/gateway-assets/...`); the BFF SHALL transparently proxy each request to `<gateway_endpoint>/admin/assets/...` (or equivalent Gateway path). This preserves the boundary rule (browser → BFF → Gateway) recorded in `deck-go/AGENTS.md:23-24` and Rule R2 (corrected).

**Alternatives considered:**

- _Browser directly fetches `<gateway_endpoint>/admin/assets/...`_: Violates `deck-go/AGENTS.md:23-24` ("Browser code talks only to the deck-go backend. It must not directly call Gateway.") and Rule R2. Rejected.
- _BFF static packaging (embed via `embed.FS` in deck-go)_: Keeps the asset behind deck-go's authentication boundary, but duplicates the asset across two repositories' build pipelines and adds upstream-sync drift (the asset is owned by the OpenClaw side). Rejected — the BFF reverse-proxy route gives the same boundary benefit without duplication.
- _Frontend-bundled static asset_: Would put what is conceptually a runtime artifact into the frontend build, breaking the boundary that separates UI from runtime-supplied content. Rejected.
- _Move to a Gateway RPC that returns the asset bytes inline_: Adds RPC overhead; the asset is a binary blob best served over plain HTTP. Rejected.

**Rationale:** The asset originates in the OpenClaw runtime and SHOULD be served by it at source. The BFF reverse-proxy route is a thin pipe (typically <50 LOC) and preserves the boundary discipline R2 demands. The asset stops being mode-gated because the same BFF route serves both `local` and `remote` flows (local → proxies to loopback Gateway; remote → proxies to remote Gateway).

**Rule classification:** Adding a new HTTP static-asset route to Gateway falls **outside** Rule R1 (R1 strictly governs new `deck.*` RPC methods, not HTTP routes). The Gateway-side route SHALL be recorded as a newly-exposed Gateway HTTP surface in its own PR description with the analogous tradeoff discipline (motivation / alternatives / lock-in), without claiming R1 type-2 classification. The deck-go BFF reverse-proxy route at `/api/runtime/gateway-assets/*` is internal HTTP plumbing, not a `deck.*` RPC, and is not subject to R1.

### D6. Four-state lifecycle probe with state-driven UI button visibility

**Decision:** The lifecycle state is exactly one of `running` / `stopped` / `not-installed` / `unhealthy`. The previously-reserved `cli-missing` state is removed per OQ4 resolution: in this repository `node <entrypoint>` is always invocable (entrypoint resolution failure is already captured by `not-installed` + `lastError: entrypoint_not_found`). Keeping a reserved-but-never-emitted enum value is dead spec surface. UI button visibility is driven entirely by `lifecycleState`:

| State           | Buttons rendered                          |
| --------------- | ----------------------------------------- |
| `running`       | `[Stop]` `[Restart]`                      |
| `stopped`       | `[Start]` `[Reinstall]`                   |
| `not-installed` | `[安装并启动]` (single combined action)   |
| `unhealthy`     | `[Restart]` `[Reinstall]` + error display |

**Alternatives considered:**

- _Three states (`running` / `not-running` / `not-installed`)_: Loses the distinction between `stopped` (user intent) and `unhealthy` (system fault) that drives different UI affordances.
- _Show all five buttons always, disable irrelevant ones_: More chrome, more confusion; the user's anti-scope-creep directive says less is more.

**Rationale:** Five states capture the meaningful product distinctions. State-driven button visibility removes per-action availability logic from the UI components.

### D7. No background polling; probes only at boot / on request / after action

**Decision:** The lifecycle probe runs at four well-defined times: BFF boot (cached for early request handling); each request to `/api/runtime/gateway` or `/api/runtime/capabilities`; explicit `POST /api/runtime/gateway/refresh`; immediately after any lifecycle action completes. There is no `time.Ticker` or background goroutine polling Gateway health.

**Alternatives considered:**

- _Background ticker every N seconds_: Constant CPU cost, observable in idle deck-go processes; the user explicitly said the goal is lifecycle-controllable, not real-time monitoring.
- _WebSocket push from Gateway when state changes_: Over-engineering for a state machine that changes on user action.

**Rationale:** Matches user intent (no monitoring dashboard); matches resource budget (deck-go should idle quietly when Gateway is healthy).

### D8. Mock E2E unifies `bundled.spec.ts` + `remote.spec.ts` into `mock.spec.ts`

**Decision:** Because deck-go BFF no longer spawns anything in `local` mode, the historical reason for having two mock specs (one to verify spawn semantics, one to verify connect-only semantics) disappears. The two specs are merged into a single `test/e2e/mock.spec.ts` that boots a `mock-gateway.mjs` fixture independently (test-side spawn) and points the deck-go BFF at its endpoint. The visual specs (`*-visual.spec.ts`) are likewise consolidated.

**Alternatives considered:**

- _Keep two specs with `local` and `remote` env configurations to exercise both modes through deck-go's facade_: Worth doing for the `remote` side, but the `local` mock spec would have to mock out `openclaw gateway install/start` CLI invocations — bringing complexity without verification value. Decision: the `local` mode is verified end-to-end via real E2E (Rule R3); mock E2E focuses on remote-mode and pure BFF / frontend wiring.

**Rationale:** Eliminates a redundancy created by the old spawn vs. connect distinction. Reduces CI runtime.

### D9. Stage 1 (`local-gateway-lifecycle`) precedes Stage 2 (mode rename) for safer migration

**Decision:** Stages within this change run in the order:

- **Stage 1:** In-place rewrite of `internal/runtime/bundled/` package internals — the package name and `RUNTIME_MODE=bundled` value stay; the implementation inside is replaced (supervisor / PID / fingerprint / ownership / lock files deleted; lifecycle proxy + CLI shell-out + per-repo-hash service derivation added). R2 violations are fixed; canvas A2UI asset migrates via D5. No new alongside `local/` package, no internal feature flag — the rewrite happens directly inside `bundled/` so end-to-end behavior swaps atomically at Stage 1 merge. After Stage 1, deck-go in `bundled` mode still works (no user-visible breaking change yet) but its internal mechanism is the official-CLI path.
- **Stage 2:** Pure rename — `git mv internal/runtime/bundled/ internal/runtime/local/`; flip `RUNTIME_MODE=bundled` to rejected with exit-64 migration message; rename type-guards (`isBundledRuntimeStatus()` → `isLocalRuntimeStatus()`); regenerate contracts (`make protocol-update` + `make contracts-sync`); rewrite `.env.bundled.example` to `.env.local.example`; rename dev scripts. Stage 2 has no behavior change — it's a textual rename across already-rewritten code.
- **Stage 3:** Adapt E2E (Gaps 1–5); ensure both mock and real specs pass; verify Rule R3 with a code-search guard.

**Alternatives considered:**

- _Big-bang single PR_: Reviewer fatigue; rollback granularity poor.
- _Stage 2 before Stage 1_: Would force users to set `RUNTIME_MODE=local` against the still-spawn-based implementation, creating a confusing transient state.
- _Stage 1 creates alongside `local/` package + internal feature flag, Stage 2 deletes `bundled/`_: Initially considered. Rejected — two concurrent implementations + a feature flag adds review surface, creates collision when Stage 2 tries to `git mv bundled → local`, and produces an ambiguous "which one is active in Stage 1 dev/CI?" question. In-place rewrite is cleaner.

**Rationale:** Lets functional changes land first (under the old name) so any regression caught in CI is unambiguously caused by the rewrite rather than the rename; Stage 2 then becomes pure textual rename with zero behavior risk.

### D10. `local` mode lifecycle payload returned even when `capabilities.configured: false`

**Decision:** The existing `/api/runtime/gateway` handler at `backend/internal/server/runtime.go:77-86` currently short-circuits to `writeGatewayNotConfigured(...)` (HTTP 503 `gateway_not_configured`) whenever `caps.Configured == false`. This SHALL be carved out for `local` mode: when `caps.Mode == "local"`, the handler SHALL ALWAYS return the lifecycle payload (`lifecycleState` / `serviceName` / `entrypointPath` / `lastError`) regardless of `configured` value, because in `local` mode `configured=false` is a valid product state (`not-installed` / `stopped`) that the Operations Panel needs to render in order to surface the `[安装并启动]` / `[Start]` affordance. The 503 `gateway_not_configured` short-circuit SHALL apply only to `remote` mode first-run (`mode == "remote" && configured == false`).

**Alternatives considered:**

- _Set `capabilities.configured: true` even when `local` lifecycle is `not-installed` / `stopped`_: Would let the existing handler logic stand unchanged, but breaks the semantics of `configured` (it would no longer mean "Gateway is usable for RPC right now"). Reject — semantic erosion is worse than a route carve-out.
- _Move the lifecycle payload to a separate endpoint (`/api/runtime/lifecycle`)_: Adds a second endpoint for the frontend to coordinate; reject — the existing `/api/runtime/gateway` route is already the runtime-status surface and SHOULD carry mode-appropriate fields per D6.
- _Always return 200 from `/api/runtime/gateway` and represent first-run-remote as a payload state_: Loses the explicit `gateway_not_configured` error code that the 503 middleware relies on across the wider passthrough family.

**Rationale:** Distinguishes "RPC not ready" (correctly 503 in remote first-run; non-issue in local because RPC isn't the entrypoint to lifecycle UI) from "lifecycle controller has data to render" (always true in local). Codex R1c spot-check H4 verified the current 503 short-circuit at `runtime.go:83-85`.

### D11. Capability gating uses `supervisorState` / lifecycle payload, never the `mode` string

**Decision:** Frontend behavioral gates (component mount, mutation handlers, route guards, effect bodies) SHALL gate on `capabilities.supervisorState` and on the existence of lifecycle payload fields (e.g. `lifecycleState !== undefined`), NOT on `capabilities.mode === "local"` or `=== "remote"`. The `mode` field is reserved exclusively for display-only consumers (`<ModeBadge>`, `<FirstRunBanner>`, status copy). This rule applies to the Operations Panel mount condition in particular, which codex R1c M2 flagged was being gated on `mode === "local"` in the local-gateway-lifecycle spec.

**Alternatives considered:**

- _Gate Operations Panel on `mode === "local"`_: Concise to read in code, but creates a behavioral mode branch in frontend (violates R2 corrected even though "operations surface mode-aware" was carved out — the lint-friendly form prefers capability-driven gating because it survives future mode additions without code change).
- _Gate Operations Panel on `mode === "local" && supervisorState`_: Redundant — `supervisorState: true` already implies `local` mode in this change. Keep the gate minimal.

**Rationale:** R2 (corrected) tolerates ops-surface mode-awareness, but tolerating it is not preferring it. Capability-flag gating ages better and aligns with the "no mode-string branching in non-display contexts" scenario already in the runtime-mode-dispatch spec.

## Risks / Trade-offs

- **[Multi-fork service-name collision on the same machine]** → Mitigated by the SHA-256 hash service-name strategy (D4). Test coverage in `local-gateway-lifecycle` enforces it.
- **[Repository directory move after install breaks the plist's hard-coded absolute path]** → Mitigated by entrypoint path drift detection on boot (D3); user sees `lifecycleState: "unhealthy"` with the error code and can hit Reinstall.
- **[Canvas A2UI asset migration adds a BFF reverse-proxy route + a Gateway-side static route]** → Mitigated by D5: the BFF route is a thin pipe (<50 LOC), the Gateway-side route is recorded in its own PR description with motivation/alternatives/lock-in tradeoff discipline (R1-analogous, but explicitly **not** claimed as R1 type-2 since R1 governs `deck.*` RPC).
- **[Real E2E install side-effects on operator's launchd / systemd]** → Mitigated by `local-gateway-lifecycle` requirement: per-repo-hash service name + uninstall cleanup hook + isolated `OPENCLAW_STATE_DIR`. Test harness fails the run if cleanup is skipped.
- **[E2E-only spawn shortcut creep]** → Mitigated by Rule R3 + explicit anti-shortcut scenario in `local-gateway-lifecycle`. Reviewers SHALL reject any PR that adds an `if (e2e) {...spawn fast path...}`.
- **[Contract regeneration drift between Stage 2 mode rename and Stage 3 E2E changes]** → Mitigated by gate ordering in `tasks.md`: `make contract-gate` + `make protocol-check` run inside Stage 2 and Stage 3 boundaries.
- **[Users running prior `bundled` deck-go instances need a migration path]** → Mitigated by stderr message at boot under D2 that tells them what `.env` key to switch and that the spawn-control vars are gone.

## Migration Plan

1. **Pre-Stage-1:** Update `.agents/skills/deck-upstream-sync/SKILL.md` to map old `internal/runtime/bundled/supervisor.go` path to "deleted". (D5 owner-confirm gate is removed — the BFF reverse-proxy resolution per D5 keeps the asset move inside this repo's normal boundary discipline; the corresponding Gateway-side static route is still recorded with its own tradeoff note when the Gateway PR lands.)
2. **Stage 1 deploy / merge:** Land the lifecycle proxy and Operations Panel behind the still-current `bundled` mode value. Existing operators see new buttons but `RUNTIME_MODE=bundled` is unchanged. No user-visible breaking change.
3. **Stage 2 deploy / merge:** `RUNTIME_MODE=bundled` becomes a fatal config error. Operators MUST update `.env`:
   - Rename `RUNTIME_MODE=bundled` → `RUNTIME_MODE=local`
   - Remove all `RUNTIME_BUNDLED_*` keys (a deprecation warning is emitted if any remain).
   - Add `OPENCLAW_REPO_ROOT` if their repository sits at a non-default location.
   - Run `node dist/entry.js gateway uninstall` (legacy) if any legacy plist exists; re-run `[安装并启动]` from the Operations Panel.
4. **Stage 3 deploy / merge:** E2E suites flip to the new fixture model; CI ratchet on Rule R3 conformance.
5. **Rollback strategy:** Stages 1, 2, 3 are independent reverts. The most likely rollback is Stage 2 (mode rename) → revert leaves Stage 1 lifecycle controls live under `bundled` mode, which is still functional.

## Open Questions

- **OQ1.** Should we offer a `deck-go admin migrate-bundled-to-local` CLI helper that rewrites a user's `.env` and uninstalls the legacy plist in one step? Default position: **no**, the stderr message is enough; the population of users on `bundled` is small (developers, not end users). Revisit if migration friction is reported.
- **OQ2.** Does owner want the per-repo-hash service name's hash length to be 12 hex chars (D4 default) or longer? Shorter is more readable in `launchctl list`; longer is more collision-resistant. Default `12` chosen because `SHA-256` collision probability over realistic fork counts remains negligible.
- **OQ3.** Should the `not-installed` state's single button say "安装并启动" (current default) or split into `[Install]` then `[Start]` two-click? Default is the combined button because the install-only state is not useful by itself (the user always wants to start after installing). Revisit if usability feedback disagrees.
- **OQ4.** ~~The `cli-missing` lifecycle state is defined in the spec but never emitted in this change (D6).~~ **Resolved (2026-05-13 post-R1c review): removed.** Codex review caught inconsistency between proposal (5 states), spec (5 states defined but `cli-missing` "never emitted in this change"), and runtime-mode-dispatch payload (4 states). Reviewer-friendly action is to delete the reserved-but-impossible enum. If a future sibling-package scenario re-surfaces, it can be reintroduced as an additive change at that time.
