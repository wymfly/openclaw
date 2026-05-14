## 1. Pre-Stage gates

- [x] 1.1 Owner-confirm OQ2 / OQ3 defaults (hash length 12, combined `[安装并启动]` button). Defaults stand unless overridden. (OQ4 has been resolved post-R1c review: `cli-missing` state is removed from this change. D5 has been redirected to BFF reverse proxy per the design update; no Gateway-side static surface owner-confirm gate remains.)
- [x] 1.2 Verify current backend CLI surface at `src/cli/daemon-cli/register-service-commands.ts:72-119` does NOT define `--service-name` / `--entrypoint` flags (per R1c spot-check); confirm service-naming env var contract (`OPENCLAW_LAUNCHD_LABEL` / `OPENCLAW_SYSTEMD_UNIT` / `OPENCLAW_WINDOWS_TASK_NAME`) is the supported mechanism in the upstream CLI before Stage 1 begins.
- [x] 1.3 Snapshot current `RUNTIME_MODE` / `RUNTIME_BUNDLED_*` / `RUNTIME_REMOTE_*` env var inventory from `.env.bundled.example`, `.env.remote.example`, `.env.real-stack.example`, and the deck-go test harness; use snapshot in Stage 2 to verify nothing is silently lost.
- [x] 1.4 Capture baseline pass/fail of `make verify`, `make e2e-mock-runtime`, `make e2e-real-smoke` on `enhanced` branch before any edits; treat as Stage 3 regression target.

## 2. Stage 1 — In-place rewrite of `bundled/` + R2 violation cleanup (mode value still `bundled` until Stage 2)

Per design.md D9: Stage 1 rewrites `internal/runtime/bundled/` package internals in place. No alongside `local/` package is created, no internal feature flag is introduced. The package name and the `RUNTIME_MODE=bundled` value stay until Stage 2.

### 2.1 Local Gateway lifecycle proxy (backend, in-place rewrite of `bundled/`)

- [ ] 2.1.1 Inside `internal/runtime/bundled/`, delete the legacy spawn / supervisor / PID / fingerprint / ownership / lock-file / config-sync files (these are listed by name in design.md D1 and proposal.md REMOVED). Preserve the `facade.RuntimeFacade` implementation entry point file (rename methods internally as needed); the package SHALL still expose `bundled.New(...)` at the end of Stage 1 so callers compile.
- [x] 2.1.2 Implement entrypoint resolver (D3 three-tier) inside `bundled/`: `OPENCLAW_REPO_ROOT` env → relative path from BFF binary → install-time absolute path from persisted service metadata; emit clear errors when none resolve. (Code lives under `bundled/` during Stage 1; renamed to `local/` in Stage 2.)
- [x] 2.1.3 Implement service-name derivation (D4): `serviceName = "openclaw-gateway." + SHA256(absRepoPath).hex()[:12]`; expose via facade `Capabilities()` and the runtime gateway status payload.
- [x] 2.1.4 Implement lifecycle action proxies (`InstallService` / `StartService` / `StopService` / `RestartService` / `Reinstall`) — each shells out to `<service-naming env vars> node <absolute_entrypoint> gateway <action>` via `os/exec`. Service-naming env vars passed: `OPENCLAW_LAUNCHD_LABEL=openclaw-gateway.<hash>` (macOS), `OPENCLAW_SYSTEMD_UNIT=openclaw-gateway.<hash>` (Linux), `OPENCLAW_WINDOWS_TASK_NAME=openclaw-gateway.<hash>` (Windows) — all three are set on every invocation; only the platform-relevant one takes effect. Deck-go SHALL NOT pass `--service-name` or `--entrypoint` flags (the upstream CLI does not define them; verified at 1.2). Capture stderr; return structured errors with short codes.
- [x] 2.1.5 Implement four-state probe (D6): combine `openclaw gateway status` exit code with loopback `health` RPC response within a configurable timeout; classify into `running` / `stopped` / `not-installed` / `unhealthy` (exactly four states — no `cli-missing` per OQ4 resolution); populate `lastError` with codes from the spec (`probe_timeout` / `probe_refused` / `probe_non_ok` / `entrypoint_path_drift` / `service_not_registered` / `entrypoint_not_found`).
- [ ] 2.1.6 Implement probe trigger discipline (D7): probe at boot + each `/api/runtime/gateway` / `/api/runtime/capabilities` request + dedicated `/api/runtime/gateway/refresh` route + after every lifecycle action; assert via test that no `time.Ticker` is used for periodic probes.
- [x] 2.1.7 ~~Internal feature flag~~ — REMOVED per design.md D9 update. The rewrite happens in-place inside `bundled/`; there is no Stage 1 dual implementation.

### 2.2 HTTP route surface for lifecycle actions

- [x] 2.2.1 Add `POST /api/runtime/gateway/install`, `POST /api/runtime/gateway/start`, `POST /api/runtime/gateway/stop`, `POST /api/runtime/gateway/restart`, `POST /api/runtime/gateway/reinstall` routes on the mode-aware handler family.
- [x] 2.2.2 Add `POST /api/runtime/gateway/refresh` route that re-runs one probe and returns the result.
- [x] 2.2.3 In `remote` mode, each lifecycle action SHALL return HTTP 405 with `code: "lifecycle_unsupported_in_remote_mode"`; add tests.
- [x] 2.2.4 Extend `GET /api/runtime/gateway` to populate `lifecycleState` / `serviceName` / `entrypointPath` / `lastError` when supervisorState is true; preserve remote payload shape.
- [x] 2.2.5 **D10 carve-out (R1c H4 fix):** Modify `backend/internal/server/runtime.go:77-86` so that the `configured == false → writeGatewayNotConfigured` 503 short-circuit applies only when `caps.Mode == "remote"`. In `local` mode (`caps.Mode == "local"`), the handler SHALL ALWAYS call `runtimeFacade.RuntimeGatewayStatus(...)` and return its payload (200 OK), even when `caps.Configured == false`. Add a test asserting that `local` mode with `lifecycleState: "not-installed"` returns HTTP 200 with the lifecycle payload, NOT 503.

### 2.3 Canvas A2UI asset migration (D5 — BFF reverse proxy, Gateway-served at source)

Per design.md D5 (updated post-R1c H2): the browser SHALL fetch only from deck-go BFF; BFF reverse-proxies to Gateway. Browser → BFF → Gateway boundary preserved (`deck-go/AGENTS.md:23-24`).

- [x] 2.3.1 Identify the asset's current path and consumers; document the bytes flowing through `assets.go:269` and `legacy_admin_assets.go:249`.
- [ ] 2.3.2 Add Gateway-side static route in `src/gateway/server/` that serves the asset (record motivation/alternatives/lock-in tradeoff in the Gateway PR description; this is a newly-exposed Gateway HTTP surface but NOT classified as Rule R1 type-2 since R1 strictly governs `deck.*` RPC — record analogous tradeoff discipline without claiming the R1 label).
- [x] 2.3.3 Add deck-go BFF reverse-proxy route `/api/runtime/gateway-assets/*` that transparently forwards GET to `<gateway_endpoint>/admin/assets/...` (or equivalent path on the Gateway side). Implementation SHALL be a thin pipe (typically <50 LOC): forward URL path, headers (sanitized), and response stream. The BFF SHALL inject Gateway auth token internally; the browser SHALL NOT see token in any response.
- [ ] 2.3.4 Remove the asset-loading code in `backend/internal/server/assets.go:269` and `backend/internal/runtime/openclaw/legacy_admin_assets.go:249`; replace any caller with a fetch from the BFF reverse-proxy route (NOT direct Gateway URL).
- [ ] 2.3.5 Update frontend canvas component to fetch the asset from `/api/runtime/gateway-assets/...` (relative path on deck-go BFF origin, no cross-origin call to Gateway); ensure asset loads correctly in both `local` and (eventually-renamed) `remote` modes via `make e2e-mock-runtime` and `make e2e-real-smoke`.
- [x] 2.3.6 Add a static-check guard (grep-based) asserting that `frontend-new/src/**` contains no string literal matching `gateway_endpoint` URL pattern for the canvas asset; the only allowed asset URL pattern in frontend code SHALL be the relative `/api/runtime/gateway-assets/...` form.

### 2.4 Frontend R2 violation cleanup

- [x] 2.4.1 `frontend-new/src/deck-ui/HeaderBar.tsx:31` — remove the direct `runtime.mode === "remote"` branch; route the conditional through `capabilities.endpointMutable` / `capabilities.supervisorState` or move the conditional into a display-only sub-component.
- [x] 2.4.2 `frontend-new/src/api.ts:566/572/578` — keep the type guards as helpers in `api.ts` but tag them `@operationsSurface`; add an ESLint or grep-based rule (`scripts/check-r2.sh` or similar) that forbids `isBundledRuntimeStatus()` / `isLocalRuntimeStatus()` calls outside files matching a `operations-surface` path glob.
- [x] 2.4.3 Confirm `FirstRunBanner.tsx` and `ModeBadge.tsx` continue to be the only display-only mode readers; expand their `data-state` enum coverage in advance of Stage 2 rename (still emit `"bundled"` until 2 ships).

### 2.5 Operations Panel UI

- [x] 2.5.1 Add `OperationsPanel` component inside `GatewayPanel`'s runtime tab, gated on `capabilities.supervisorState === true` (NOT on `capabilities.mode === "bundled"` / `"local"` — per design.md D11 / R1c M2 fix); render `lifecycleState`, `serviceName`, `entrypointPath`, `lastError`. The `mode` string MAY be read inside the panel for display copy only.
- [x] 2.5.2 Implement state-driven button visibility (D6 table) — Stop/Restart for running, Start/Reinstall for stopped, single 安装并启动 for not-installed, Restart/Reinstall + error for unhealthy.
- [x] 2.5.3 Implement the combined "安装并启动" handler — sequential `install` then `start` with a single progress indicator; on failure, surface the CLI's stderr summary in the error region.
- [ ] 2.5.4 Add Playwright smoke tests against the OperationsPanel under each lifecycle state via mock fixtures returning seeded `lifecycleState` responses.
- [x] 2.5.5 Confirm the Operations Panel contains **only** the spec-listed fields and buttons; reviewers reject any additional widget (chart, log viewer, token control) per the scope-anchoring requirement.

### 2.6 Stage 1 verification

- [x] 2.6.1 `cd deck-go && make backend-test` passes including new lifecycle / probe / route tests.
- [x] 2.6.2 `cd deck-go && make frontend-build` passes including new OperationsPanel.
- [ ] 2.6.3 `cd deck-go && make verify` passes.
- [ ] 2.6.4 Manual smoke: `scripts/dev/run-stack-real.sh` reaches a working chat session via the new lifecycle path (still under `RUNTIME_MODE=bundled` env name).
- [x] 2.6.5 Rule R2 grep guard passes (no business-surface mode branches remain).

## 3. Stage 2 — Mode rename `bundled` → `local`

### 3.1 Backend rename (pure textual rename — behavior already swapped in Stage 1)

- [ ] 3.1.1 `git mv internal/runtime/bundled/ internal/runtime/local/`; update package declarations from `package bundled` → `package local`; update all imports across the codebase. Because Stage 1 already rewrote the package internals in place, this rename is purely textual; no behavior change SHALL occur in Stage 2.
- [ ] 3.1.2 Audit `git grep -i bundled` for any remaining occurrences in code identifiers (variable names, function names, type-guard names) and update; confirm via `go build ./...` and `make backend-test` passes after the rename.
- [ ] 3.1.3 Update `envconf` to accept only `RUNTIME_MODE ∈ {"local", "remote"}`; emit fatal exit-64 when `bundled` is supplied, with migration stderr message per Decision D2.
- [ ] 3.1.4 Strip `RUNTIME_BUNDLED_COMMAND` / `RUNTIME_BUNDLED_ARGS` / `RUNTIME_BUNDLED_BIND_HOST` / `RUNTIME_BUNDLED_BIND_PORT` / `RUNTIME_BUNDLED_TOKEN` / `RUNTIME_BUNDLED_ENV_*` / `RUNTIME_BUNDLED_ENV_DENY` from envconf; emit single stderr deprecation warning if any are observed at boot.
- [ ] 3.1.5 Remove the Stage 1 internal feature flag and select `internal/runtime/local/` purely by `RUNTIME_MODE=local`.

### 3.2 Contract / capability rename

- [ ] 3.2.1 Update `contracts/source/deck-api.contract.ts` so `Capabilities.mode` enum is `"local" | "remote"`.
- [ ] 3.2.2 Run `cd deck-go && make contracts-sync` and commit the generated TS + Go DTOs.
- [ ] 3.2.3 Run `cd deck-go && make protocol-update` and commit the generated Gateway artifacts.
- [ ] 3.2.4 Run `cd deck-go && make contract-gate` to validate.

### 3.3 Frontend rename

- [ ] 3.3.1 Rename `frontend-new/src/api.ts` helpers `isBundledRuntimeStatus()` → `isLocalRuntimeStatus()`, `normalizeRuntimeGatewayStatus()` internal `"bundled"` references → `"local"`; update callers.
- [ ] 3.3.2 `ModeBadge.tsx` `data-state="bundled"` → `data-state="local"`; update copy.
- [ ] 3.3.3 `OperationsPanel` capability gate `mode === "bundled"` → `mode === "local"`.
- [ ] 3.3.4 Update any tests asserting `mode === "bundled"` to `mode === "local"`.

### 3.4 Env, scripts, docs rename

- [ ] 3.4.1 `git mv deck-go/.env.bundled.example deck-go/.env.local.example`; rewrite content per the new env surface (drop `RUNTIME_BUNDLED_*` keys; add `OPENCLAW_REPO_ROOT` example as commented-out; add `OPENCLAW_STATE_DIR` example).
- [ ] 3.4.2 Update `deck-go/.env.real-stack.example` to use the new env keys; remove `RUNTIME_BUNDLED_COMMAND` / `RUNTIME_BUNDLED_ARGS`.
- [ ] 3.4.3 `.env.remote.example` left unchanged in this change (per Gap 5; revisited in `runtime-mode-switching`).
- [ ] 3.4.4 `git mv deck-go/scripts/dev/run-bundled.sh deck-go/scripts/dev/run-local.sh`; rewrite to call `openclaw gateway install + start` before launching BFF.
- [ ] 3.4.5 Update `deck-go/scripts/dev/run-stack-real.sh` per Decision D9 / Stage 2 to call `openclaw gateway install + start` against per-repo-hash service before BFF + Vite; preserve Vite dev mode for frontend hot reload.
- [ ] 3.4.6 Update `deck-go/AGENTS.md` Architecture + Runtime And Dev Scripts sections to reflect `local` mode and new env keys.
- [ ] 3.4.7 Update `deck-go/CLAUDE.md` (mirror of AGENTS.md) accordingly.
- [ ] 3.4.8 Update `deck-go/docs/project/e2e-stack-operations.md` to document the new install/start path for real stack.
- [ ] 3.4.9 Update `.agents/skills/deck-upstream-sync/SKILL.md` path constants — `internal/runtime/bundled/supervisor.go` removed; map any future upstream conflicts onto `internal/runtime/local/` (most paths are deletions).

### 3.5 Stage 2 verification

- [ ] 3.5.1 `cd deck-go && make verify` passes after rename.
- [ ] 3.5.2 Manual: set `RUNTIME_MODE=bundled` and confirm exit-64 with the migration stderr message.
- [ ] 3.5.3 Manual: set `RUNTIME_MODE=local` with stale `RUNTIME_BUNDLED_COMMAND=...` and confirm single deprecation warning, no exit.
- [ ] 3.5.4 `cd deck-go && make contract-gate` passes; no contract drift.

## 4. Stage 3 — E2E adaptation (Gaps 1–5)

### 4.1 Gap 1: Mock E2E independent boot

- [ ] 4.1.1 Refactor `test/fixtures/mock-gateway.mjs` so it can be started by a test-side helper (Node child process spawn or worker) on a known port, independently of BFF.
- [ ] 4.1.2 Add `test/e2e/helpers/mock-gateway-fixture.ts` exposing `startMockGateway(port)` / `stopMockGateway(handle)` for use in `beforeAll` / `afterAll` blocks.
- [ ] 4.1.3 Update existing `bundled.spec.ts` / `remote.spec.ts` to consume the new helper; verify both pass.

### 4.2 Gap 2: Merge mock specs

- [ ] 4.2.1 Create new `test/e2e/mock.spec.ts` covering the unified mock E2E surface (BFF behavior + frontend wiring against mock Gateway endpoint).
- [ ] 4.2.2 Move and dedupe scenarios from `bundled.spec.ts` and `remote.spec.ts` into `mock.spec.ts`; remove the originals; update any imports.
- [ ] 4.2.3 Consolidate `*-visual.spec.ts` similarly where appropriate (visual specs that purely differ on `bundled` vs `remote` chrome roll up into `mock-visual.spec.ts` or remain separate if they exercise distinct UI flows).

### 4.3 Gap 3: CI matrix simplification

- [ ] 4.3.1 Update `Makefile` so `make e2e-mock-runtime` runs the merged `mock.spec.ts` (and not the deleted specs).
- [ ] 4.3.2 Update `make e2e-mock-module MODULE=...` selector mapping.
- [ ] 4.3.3 Update CI workflow files (`.github/workflows/` or equivalent) so any matrix entry referencing `bundled` is removed; matrix entries referencing `local` (where helpful, e.g. real-stack matrix) are added.

### 4.4 Gap 4: Real E2E install isolation

- [ ] 4.4.1 Update `test/e2e/real-gateway.spec.ts` and the `*-real-gateway.spec.ts` family to set the platform-relevant service-naming env var (`OPENCLAW_LAUNCHD_LABEL=openclaw-gateway.<hash>` etc.) when invoking `openclaw gateway install` via the new lifecycle helper or directly through the CLI. Do NOT pass `--service-name` as a CLI flag (the upstream CLI does not define it; per R1c spot-check H1).
- [ ] 4.4.2 Add a global `afterAll` cleanup hook that invokes the uninstall via `<service-naming env vars> node <entrypoint> gateway uninstall` against the test fork's hash; if cleanup fails, the test run SHALL fail (no silent leak).
- [ ] 4.4.3 Set `OPENCLAW_STATE_DIR=<repo>/deck-go/.local/deck-go-real-stack/isolated/data/managed-gateway-state` in the real-stack fixture so test Gateway state stays isolated; document the path in `e2e-stack-operations.md`.
- [ ] 4.4.4 Confirm Rule R3 by code-search guard: grep the test tree for any pattern that spawns the Gateway directly via `node dist/entry.js gateway run` and assert zero occurrences in real E2E spec files (mock-side fixture spawns are allowed; real spec spawns are not).

### 4.5 Gap 5: Defer `.env.remote.example`

- [ ] 4.5.1 Confirm `deck-go/.env.remote.example` is unchanged at end of this change; the `runtime-mode-switching` follow-up change owns its evolution.

### 4.6 Stage 3 verification

- [ ] 4.6.1 `cd deck-go && make e2e-mock-runtime` passes.
- [ ] 4.6.2 `cd deck-go && make e2e-mock-visual` passes (or consolidated equivalent).
- [ ] 4.6.3 `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 make e2e-real-smoke` passes; cleanup hook removes the per-hash service.
- [ ] 4.6.4 `cd deck-go && make verify` plus baseline matrix from 1.4 still pass.

## 5. Cross-cutting verification + archival readiness

- [x] 5.1 Run `openspec validate` against this change directory; resolve any schema errors.
- [ ] 5.2 Run repo-wide `make verify` at the root if applicable (TypeScript core checks) and ensure no regression introduced by the D5 asset migration (Gateway-side static route + BFF reverse proxy).
- [ ] 5.3 Confirm the design-philosophy anchor: walk the diff against `CONTEXT.md` "Ensure 可用 + 生命周期可控" — any added feature that doesn't directly serve those two goals is reviewed for removal.
- [ ] 5.4 Update `CONTEXT.md` grill log Q9 status note if any decision in this change supersedes the captured resolution.
- [ ] 5.5 Prepare announcement note for the `runtime-mode-switching` follow-up change so the dependency chain is visible to anyone planning Stage-1 of that change.
- [ ] 5.6 Archive readiness: ensure `verification.yaml` (if maintained for this repo's OpenSpec workflow) captures Stage 1 / 2 / 3 acceptance evidence pointers.
