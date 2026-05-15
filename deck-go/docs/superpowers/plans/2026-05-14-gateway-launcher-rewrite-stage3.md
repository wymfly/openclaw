# Gateway Launcher Rewrite — Stage 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land Stage 3 of OpenSpec change `gateway-launcher-rewrite`: adapt the E2E layer (mock + real) to the post-rename world that Stage 2 produced, finalize the four outstanding Stage 1/2 tails (D5 legacy asset deletion, OperationsPanel Playwright smoke, real-stack manual chat, Gateway-side static route handoff), and run the cross-cutting closeout (root `make verify`, CONTEXT philosophy check, grill-log update, follow-up announce, archival readiness).

**Architecture:** Stage 2 already renamed the runtime mode `bundled` → `local` end-to-end (backend package, envconf, contracts, frontend type guards, env files, dev scripts, docs) — _do not redo any of that_. Stage 3 is strictly the bottom slice of `tasks.md`: section 4 (Gaps 1–5) plus the four un-`[x]` items in sections 2 and 5. Two structural moves dominate this stage:

1. **Mock E2E independent boot + spec merge** (4.1 + 4.2): `test/fixtures/mock-gateway.mjs` is currently boot-coupled to `make e2e-mock-runtime` invocation. Stage 3 carves out a standalone fixture handle, then collapses `bundled.spec.ts` + `remote.spec.ts` (and their visual siblings where dedup-applicable) into a single `mock.spec.ts` matrix. Test code files still spell `bundled` by intent (Stage 2 left them out-of-scope); Stage 3 is the rename moment for those.
2. **Real E2E install isolation + cleanup hook** (4.4): real-gateway specs currently default to `node dist/entry.js gateway run --bind loopback --port {gatewayPort} --allow-unconfigured` (helpers.ts:331,341), bypassing the new service lifecycle. Stage 3 swaps this to the service-naming-env-driven `gateway install` + `gateway start` path, adds a `gateway uninstall` cleanup hook, pins `OPENCLAW_STATE_DIR` to a per-fork isolated path, and installs a Rule R3 grep guard.

The two Stage 1/2 tails 2.3.2 (upstream Gateway static route) and 2.6.4 (real-stack manual smoke) are not deck-go-side coding work; they are owner-gated handoffs and exit the plan as documented evidence pointers rather than code commits.

**Tech Stack:** Playwright (deck-go E2E), Node fixture harness (`test/fixtures/mock-gateway.mjs`), bash dev scripts (`run-stack-real.sh`, `make e2e-*`), Go (legacy backend asset deletion in `backend/internal/server/assets.go` + `backend/internal/runtime/openclaw/legacy_admin_assets.go`), Markdown docs (`docs/project/e2e-stack-operations.md`, `CONTEXT.md`).

**Related:**

- OpenSpec change: `openspec/changes/gateway-launcher-rewrite/` (tasks.md sections 2.3.2 / 2.3.4 / 2.5.4 / 2.6.4 / 4.1–4.6 / 5.2–5.6)
- Stage 2 plan (predecessor): `deck-go/docs/superpowers/plans/2026-05-14-gateway-launcher-rewrite-stage2.md`
- Stage 1 handoff log: `docs/handoff-agent/gateway-launcher-rewrite-stage1.md`
- D5 BFF reverse-proxy landed: `backend/internal/server/gateway_assets_proxy.go` + `backend/internal/server/gateway_assets_proxy_test.go` + `frontend-new/src/components/panels/chat/canvas-asset-config.ts`
- Stage 2 plan: rule R2 / R3 enforcement context

**Order constraint:**

- Phase A (mock E2E independent boot) MUST land before Phase B (spec merge), because the merged `mock.spec.ts` consumes the new fixture helper.
- Phase B MUST land before Phase C (CI matrix), because Makefile / workflow updates point at the merged spec file names.
- Phase D (real E2E install isolation) is independent of A/B/C — can run in parallel; it MUST land before Phase F (verification gates) because `make e2e-real-smoke` must exercise the new lifecycle path.
- Phase E (Stage 1/2 outstanding tails) is independent. 2.3.4 (asset code deletion) is the only one that touches backend code; 2.5.4 (OperationsPanel Playwright) extends Phase A's fixture helper.
- Phase F (cross-cutting closeout) runs last and is the archival gate.

---

## File Structure

### Created

- `deck-go/test/e2e/helpers/mock-gateway-fixture.ts` — exposes `startMockGateway({ port })` / `stopMockGateway(handle)` for Playwright `beforeAll` / `afterAll`. Wraps `child_process.spawn("node", ["test/fixtures/mock-gateway.mjs"], { env: { MOCK_GATEWAY_PORT: ... } })`, captures stderr, polls readiness, returns a typed handle.
- `deck-go/test/e2e/mock.spec.ts` — unified mock E2E covering the BFF + frontend wiring against mock Gateway endpoint, replacing `bundled.spec.ts` and `remote.spec.ts`. Two top-level `test.describe` blocks for the two scenario classes (`local mock` and `remote mock`), sharing the fixture helper.
- `deck-go/test/e2e/operations-panel.spec.ts` — Playwright smoke against OperationsPanel under each lifecycle state (`running` / `stopped` / `not-installed` / `unhealthy`) using fixture-seeded `RuntimeStatus` responses (closes task 2.5.4).
- `deck-go/test/e2e/helpers/real-gateway-lifecycle.ts` — service-naming-env + `gateway install` / `gateway start` / `gateway uninstall` shell helper for real-gateway specs; owns the cleanup hook (closes 4.4.1 / 4.4.2).
- `deck-go/scripts/check-r3-real-spec-gateway-run.sh` — grep guard asserting that no `*-real-gateway.spec.ts` (or shared real-gateway helper) spawns the Gateway via `node dist/entry.js gateway run` (closes 4.4.4 / Rule R3).
- `openspec/changes/runtime-mode-switching/announcement.md` (or equivalent location) — dependency-chain note describing the now-mergeable Stage 1 of `runtime-mode-switching` follow-up change (closes 5.5).

### Modified

- `deck-go/test/fixtures/mock-gateway.mjs` — **already** has `MOCK_GATEWAY_PORT` parameterization (line ~4960), `MOCK_GATEWAY_TOKEN` env knob (line ~4959), SIGINT/SIGTERM shutdown wiring (line ~4968–4969), and a `close()` handler that drains the WebSocket server + HTTP listener (line ~4934–4944). Phase A's modification scope is therefore narrow: add the `/healthz` readiness probe ONLY. Do NOT re-implement port/token parameterization or SIGTERM handling — they exist.
- `deck-go/test/e2e/helpers.ts` — `startBundledStack` → `startLocalStack`; default `DECK_GO_REAL_GATEWAY_ARGS` literal at lines 331 / 341 ("dist/entry.js gateway run --bind loopback --port {gatewayPort} --allow-unconfigured") replaced with a service-lifecycle call path consumed via `helpers/real-gateway-lifecycle.ts`. The remaining `bundled` literals (mode-badge text fixture assertions, etc.) get removed where they conflict with the renamed mock spec, but otherwise pass through to scenario class names.
- `deck-go/Makefile` — `e2e-mock-runtime` target points at `test/e2e/mock.spec.ts`; `e2e-mock-module MODULE=<name>` selector mapping updated to dispatch into the unified spec's `test.describe` group names; `e2e-mock-visual` consolidates where appropriate (visual specs that only differ by `bundled` vs `remote` chrome roll up into `mock-visual.spec.ts`, separate spec retained for distinct UI flows). New `make e2e-operations-panel` shortcut if needed for 2.5.4 isolation.
- `.github/workflows/*` — **narrow-scope edit only**. The repo's `.github/workflows/` directory contains workflows for many surfaces (plugin / extension release, parity gate, docs sync, etc.) where the literal `bundled` refers to plugin/extension origin, NOT to runtime mode. Stage 3 SHALL only touch entries that actually invoke deck-go E2E targets (`make e2e-*`, `make verify` against deck-go subtree, `make e2e-real-smoke`). For every candidate workflow file, the implementer MUST first confirm via `git grep -nE "deck-go|make e2e-|make verify" <file>` that the file genuinely orchestrates deck-go runtime/E2E behavior before flipping any `bundled` literal. DO NOT do a global grep-and-replace; plugin / extension semantics are out of scope for this change.
- `deck-go/backend/internal/server/assets.go` — delete **only** the legacy direct-Gateway `/canvas/*` / `/api/canvas/*` proxy code paths (around line 133–186) that the new `/api/runtime/gateway-assets/*` BFF reverse-proxy supersedes. **PRESERVE** `canvasBridgeScript` (line ~28) and `registerAssetRoutes` (line ~94) — bridge-script injection into the streamed HTML response is a SEPARATE responsibility from asset proxying, and the migration target for that responsibility is NOT settled in this stage. Before deleting any line, confirm the caller is no longer reachable from the BFF route table (e.g., `admin.go` HTTP route bindings).
- `deck-go/backend/internal/runtime/openclaw/legacy_admin_assets.go` — **DO NOT integrally delete this file**. It still owns three live `ManagedRuntime` surface methods that are wired into the admin HTTP routes:
  - `GetMedia` (line ~101) — referenced from `backend/internal/api/http/admin.go:775` and from the `ManagedRuntime` interface in `managed_runtime.go:180`.
  - `GetCanvasAsset` (line ~130) — referenced from `admin.go:785` and `managed_runtime.go`.
  - `HandleDeckCanvas` (line ~201) — referenced from `admin.go:802` and `managed_runtime.go:181`.
    Plus the helpers `isAllowedMediaPath` / `mimeFromPath` / `invalidCanvasPath` / `statusToProxyStatus` that those three methods call. The deletion scope here is strictly the **dead duplicates**: `resolveLocalGatewayHTTPBaseFromState` (line ~249) and `processEnvMap` (line ~261) which are byte-for-byte duplicated in `assets.go`, plus any dead branch of `resolveGatewayHTTPBase` (line ~229) that the canvas-asset path no longer touches once the BFF reverse-proxy is the only consumer. Each candidate symbol MUST get a caller-graph audit before deletion (Step 1 of Task E.1).
- `deck-go/test/e2e/bundled.spec.ts` + `deck-go/test/e2e/remote.spec.ts` — DELETED after content lands in `mock.spec.ts`. Same applies to dedupable `*-visual.spec.ts` siblings where scoped.
- `deck-go/docs/project/e2e-stack-operations.md` — document the new install/start path, the `OPENCLAW_STATE_DIR=<repo>/deck-go/.local/deck-go-real-stack/isolated/data/managed-gateway-state` isolation, the cleanup hook's behavior on failure (test run fails — no silent leak), and the merged `mock.spec.ts` naming.
- `CONTEXT.md` — update grill log Q9 status note if any Stage 3 outcome (e.g., D5 closeout, R3 guard, lifecycle isolation pattern) supersedes the captured resolution (closes 5.4). Owner-gated edit per AGENTS.md.
- `openspec/changes/gateway-launcher-rewrite/tasks.md` — flip `- [ ]` → `- [x]` per task as each lands; do not edit task descriptions.
- `openspec/changes/gateway-launcher-rewrite/verification.yaml` (if present in this repo's OpenSpec workflow) — capture Stage 3 acceptance evidence pointers alongside Stage 1 / Stage 2 (closes 5.6).

### Renamed (git mv, content-changing)

- `deck-go/test/e2e/bundled.spec.ts` → DELETED (content merged into `mock.spec.ts`).
- `deck-go/test/e2e/remote.spec.ts` → DELETED (content merged into `mock.spec.ts`).
- Visual siblings (case-by-case): `bundled-visual.spec.ts` / `remote-visual.spec.ts` → `mock-visual.spec.ts` IF they only differ on chrome; KEEP separate otherwise.

### Out of scope (DO NOT touch in this plan)

- Stage 2 rename — already done; do not redo backend package rename, envconf flip, contract enum, frontend type guards, env files, dev scripts.
- Task 2.3.2 (Gateway-side static route in `src/gateway/server/`) — upstream change in OpenClaw repo, not deck-go-local. Stage 3 emits a handoff note + owner sign-off request; the actual Gateway PR is tracked separately as a Rule R1 tradeoff (analogous discipline, not the R1 label).
- Task 2.6.4 (real-stack manual chat smoke) — owner-only manual verification of `run-stack-real.sh` end-to-end; Stage 3 documents the test plan and acceptance criteria but does not "complete" the manual step.
- `runtime-mode-switching` change body — only the announcement note (5.5) is in scope.
- `.env.remote.example` content evolution (4.5 / Gap 5) — Stage 3 only confirms it is unchanged; the change is owned by the `runtime-mode-switching` follow-up.

---

## Self-discovery commands

```bash
# After Phase A: standalone mock fixture is independently launchable
cd deck-go && node test/fixtures/mock-gateway.mjs &
fixturePid=$!
sleep 1
curl -sf "http://127.0.0.1:${MOCK_GATEWAY_PORT:-18901}/healthz" >/dev/null && echo OK
kill "$fixturePid"
# Expected: 'OK' printed; fixture process exits on SIGTERM.

# After Phase B: spec merge audit
cd deck-go && rg -n "describe\(" test/e2e/mock.spec.ts | wc -l
# Expected: at least 2 (one per scenario class — local mock, remote mock).
test -f test/e2e/bundled.spec.ts && echo "FAIL: bundled.spec.ts still present" || echo "OK: bundled.spec.ts removed"
test -f test/e2e/remote.spec.ts && echo "FAIL: remote.spec.ts still present" || echo "OK: remote.spec.ts removed"

# After Phase C: CI matrix has no 'bundled' literals
rg -in "bundled" .github/workflows/ 2>&1 | rg -v "Generated|comment" || echo "OK: no bundled refs in CI workflows"

# After Phase D: real-gateway specs do not spawn gateway directly
bash scripts/check-r3-real-spec-gateway-run.sh
# Expected: 'R3 guard passed'
rg -n 'gateway run' test/e2e/*-real-gateway.spec.ts test/e2e/real-gateway.spec.ts 2>&1
# Expected: empty.

# After Phase E (2.3.4 closeout): legacy asset code removed
cd deck-go/backend && rg -n "resolveLocalGatewayHTTPBaseFromState" ./internal 2>&1
# Expected: empty (or, if intentionally retained elsewhere, only at the canvas-bridge inlining call site — documented in plan-time).

# After Phase F: full Stage 3 acceptance gate
cd deck-go && make verify && make e2e-mock-runtime && DECK_GO_REAL_GATEWAY_E2E=1 make e2e-real-smoke
# Expected: all green.
```

---

## Phase A: Mock E2E independent boot (closes 4.1)

Move `test/fixtures/mock-gateway.mjs` from a BFF-launched implicit child into a Playwright-controlled standalone process.

### Task A.1: Add `/healthz` to `mock-gateway.mjs` (port + SIGTERM already exist)

**Files:**

- Modify: `deck-go/test/fixtures/mock-gateway.mjs`

> ⚠️ **DO NOT re-implement port parameterization or SIGTERM handling.** They already exist: `MOCK_GATEWAY_PORT` env (line ~4960), `MOCK_GATEWAY_TOKEN` env (line ~4959), `SIGINT`/`SIGTERM` shutdown handlers (line ~4968–4969), `close()` that drains wss + http server (line ~4934–4944). Verify these still work; do not duplicate.

- [ ] **Step 1: Confirm via `grep -nE "MOCK_GATEWAY_PORT|SIGTERM|close" test/fixtures/mock-gateway.mjs`** that the existing knobs are intact.
- [ ] **Step 2: Add a `/healthz` HTTP endpoint that responds `200 OK` once the WS server is ready** — used by the fixture helper for boot polling. Wire it on the same `http.createServer` instance that already serves the fixture.
- [ ] **Step 3: Verify standalone boot path**: `MOCK_GATEWAY_PORT=18901 node test/fixtures/mock-gateway.mjs &`, then `curl -sf http://127.0.0.1:18901/healthz`, then `kill -TERM <pid>`; confirm clean exit (no orphaned ports / file handles).

### Task A.2: Add `test/e2e/helpers/mock-gateway-fixture.ts`

**Files:**

- Create: `deck-go/test/e2e/helpers/mock-gateway-fixture.ts`

- [ ] **Step 1: Implement `startMockGateway({ port })`** — spawn via `child_process.spawn("node", ["test/fixtures/mock-gateway.mjs"], { env: { ...process.env, MOCK_GATEWAY_PORT: String(port), MOCK_GATEWAY_TOKEN: token } })`; await `/healthz` 200 with a 5s timeout; return `{ pid, port, token, stop() }`.
- [ ] **Step 2: Implement `stopMockGateway(handle)`** — `handle.stop()` sends SIGTERM, awaits exit with 3s timeout, force-kills (`SIGKILL`) on timeout, returns combined stderr for diagnostic surfacing.
- [ ] **Step 3: Write a focused unit test (Playwright-or-vitest, whichever already gates `test/e2e/helpers.ts`) covering**: start → /healthz 200 → stop → process gone. No spec ships without this passing.

---

## Phase B: Merge mock specs (closes 4.2)

Consolidate `bundled.spec.ts` and `remote.spec.ts` into `mock.spec.ts`, retaining all assertions but deduping shared setup.

### Task B.1: Author `mock.spec.ts` scenario matrix

**Files:**

- Create: `deck-go/test/e2e/mock.spec.ts`
- Modify: `deck-go/test/e2e/helpers.ts` (`startBundledStack` → `startLocalStack`)

- [ ] **Step 1: Author `mock.spec.ts` with two `test.describe` blocks: `"local mock"` and `"remote mock"`**, each consuming `helpers/mock-gateway-fixture.ts` to spin up its own fixture instance on a distinct port (avoid cross-suite port collision via Playwright's worker index).
- [ ] **Step 2: Port every scenario from `bundled.spec.ts` into `"local mock"`** — including the mode-badge `"Local"` (post-Stage-2) text assertion, endpoint-section visibility, chat-session creation, and any `waitForGatewayMethod` flows.
- [ ] **Step 3: Port every scenario from `remote.spec.ts` into `"remote mock"`** — first-run banner, mode badge `"Remote setup"`, gateway-configured signal, chat routing.
- [ ] **Step 4: Verify `npx playwright test test/e2e/mock.spec.ts` passes locally** before deleting predecessor files.

### Task B.2: Delete predecessor specs + visual-spec consolidation

**Files:**

- Delete: `deck-go/test/e2e/bundled.spec.ts`
- Delete: `deck-go/test/e2e/remote.spec.ts`
- Inspect (per file): `deck-go/test/e2e/bundled-visual.spec.ts` / `deck-go/test/e2e/remote-visual.spec.ts` (if present)

- [ ] **Step 1: After `mock.spec.ts` is green, delete `bundled.spec.ts` and `remote.spec.ts`**.
- [ ] **Step 2: Case-by-case audit each `*-visual.spec.ts`. CONSOLIDATE ONLY IF the spec's _test content_ is purely runtime-mode chrome (mode badge / first-run banner / endpoint section). KEEP SEPARATE if it exercises a distinct module's visual surface (agents-visual, channels-visual, chat-visual, etc.) — most visual specs fall into this category and only "borrow" `startBundledStack` for stack setup. "Borrowing the helper" is NOT a merge criterion.** For specs kept separate, the only Stage 3 edit is the `startBundledStack` → `startLocalStack` rename and any direct `Bundled` mode-badge text literal flipped to `Local`.
- [ ] **Step 3: Run `make e2e-mock-runtime` + `make e2e-mock-visual` (or consolidated equivalent) and confirm green**.

---

## Phase C: CI matrix simplification (closes 4.3)

### Task C.1: Update Makefile targets

**Files:**

- Modify: `deck-go/Makefile`

- [ ] **Step 1: Point `e2e-mock-runtime` at `test/e2e/mock.spec.ts`** (and remove references to the deleted predecessor specs).
- [ ] **Step 2: Update `e2e-mock-module MODULE=<name>`** so that the selector maps to the `mock.spec.ts` `test.describe` group name (or a new `--grep` arg if grouping changed).
- [ ] **Step 3: Update `e2e-mock-visual` similarly**.

### Task C.2: Update CI workflow files — narrow scope only

**Files:**

- Modify (per-file audit required): `.github/workflows/*` — ONLY files that orchestrate deck-go E2E / verify targets.

> ⚠️ The repo root `.github/workflows/` directory governs many surfaces. Most `bundled` references in workflow YAML refer to **plugin/extension origin**, NOT runtime mode. Stage 3 SHALL NOT touch those.

- [ ] **Step 1: Per-file audit**. For every workflow file under `.github/workflows/`, run `git grep -nE "deck-go|make e2e-|make verify|e2e-mock-runtime|e2e-real" <file>`. Only files where this returns hits are in scope. Files like `plugin-npm-release.yml`, `plugin-clawhub-release.yml`, `docs-sync-publish.yml`, etc. are out of scope by inspection.
- [ ] **Step 2: For each in-scope workflow file, audit each `bundled` literal** — confirm via comment / surrounding YAML context that the literal refers to runtime mode, not plugin/extension origin. Only flip the runtime-mode literals.
- [ ] **Step 3: Add matrix entries referencing `local`** ONLY in the real-stack matrix (where it provides distinct CI coverage) and ONLY on workflow files identified in Step 1.
- [ ] **Step 4: Run a CI dry-run (or local `act` simulation if available)** to confirm no broken target references.

---

## Phase D: Real E2E install isolation (closes 4.4)

Re-wire real-gateway specs onto the service-lifecycle path with a deterministic cleanup hook.

### Task D.1: Add `helpers/real-gateway-lifecycle.ts` — service-naming-env injection + lifecycle calls

**Files:**

- Create: `deck-go/test/e2e/helpers/real-gateway-lifecycle.ts`
- Modify: `deck-go/test/e2e/helpers.ts` (replace direct `gateway run` literal at line 331 / 341)

- [ ] **Step 1: Derive `serviceName = "openclaw-gateway." + SHA256(absRepoPath).hex()[:12]`** (mirror of backend `local.DeriveServiceName`).
- [ ] **Step 2: Expose `installAndStart({ token, port, stateDir })`** that shells out to `node dist/entry.js gateway install --port <port> --token <token> --force` then `node dist/entry.js gateway start`, with env set: `OPENCLAW_LAUNCHD_LABEL=<serviceName>`, `OPENCLAW_SYSTEMD_UNIT=<serviceName>`, `OPENCLAW_WINDOWS_TASK_NAME=<serviceName>`, `OPENCLAW_STATE_DIR=<stateDir>`. Do NOT pass `--service-name` (upstream CLI does not define it).
- [ ] **Step 3: Expose `uninstall({ stateDir })`** that runs `node dist/entry.js gateway uninstall` with the same service-naming env vars set.
- [ ] **Step 4: Replace the `dist/entry.js gateway run` literal at `helpers.ts:331` / `:341` with a call into `installAndStart` + `uninstall`** in the relevant helper paths.

### Task D.2: Wire global `afterAll` cleanup hook

**Files:**

- Modify: `deck-go/test/e2e/real-gateway.spec.ts`
- Modify (per spec): `deck-go/test/e2e/*-real-gateway.spec.ts` (only if they create their own stack; most consume shared helpers)

- [ ] **Step 1: Add a global Playwright `globalTeardown` (or `afterAll` at the helper layer)** that invokes `uninstall(...)` against the test fork's per-hash service. If the cleanup call returns non-zero, the test run SHALL exit non-zero (no silent leak per 4.4.2).
- [ ] **Step 2: Confirm via a deliberate failure injection (kill the gateway between scenarios)** that the cleanup hook still runs and the run fails loudly.

### Task D.3: Pin `OPENCLAW_STATE_DIR` to isolated path

**Files:**

- Modify: `deck-go/test/e2e/helpers/real-gateway-lifecycle.ts` (passing the dir through)
- Modify: `deck-go/scripts/dev/run-stack-real.sh` (already sets a similar path — verify the test-side path matches)
- Modify: `deck-go/docs/project/e2e-stack-operations.md` (document the path)

- [ ] **Step 1: Default `OPENCLAW_STATE_DIR` for real-spec runs to `<repo>/deck-go/.local/deck-go-real-stack/isolated/data/managed-gateway-state`** (matches existing `run-stack-real.sh` convention per `deck-go/CLAUDE.md` L80).
- [ ] **Step 2: Document the path** + the cleanup hook + the failure-on-leak contract in `e2e-stack-operations.md`.

### Task D.4: Add R3 grep guard

**Files:**

- Create: `deck-go/scripts/check-r3-real-spec-gateway-run.sh`
- Modify: `deck-go/Makefile` (add `check-r3` invocation to `verify` or to a CI step)

- [ ] **Step 1: Author the guard script** following the style of `scripts/check-r2.sh` (existing R2 guard). It SHALL `rg -n "gateway run" test/e2e/*-real-gateway.spec.ts test/e2e/real-gateway.spec.ts test/e2e/helpers/real-gateway-lifecycle.ts` and exit non-zero on any match. Allow `test/fixtures/**` and `test/e2e/helpers/mock-*` (mock-side spawns are intentional per R3 carve-out).
- [ ] **Step 2: Wire into `make verify`** (or a new `make check-r3` target invoked from CI).
- [ ] **Step 3: Run `bash scripts/check-r3-real-spec-gateway-run.sh` and confirm pass**.

---

## Phase E: Stage 1/2 outstanding tails

### Task E.1: Surgical removal of dead asset code (closes 2.3.4)

**Files:**

- Modify: `deck-go/backend/internal/server/assets.go`
- Modify: `deck-go/backend/internal/runtime/openclaw/legacy_admin_assets.go`

> ⚠️ **DO NOT delete `legacy_admin_assets.go` integrally.** It still owns three live `ManagedRuntime` surface methods wired into admin HTTP routes: `GetMedia` (admin.go:775), `GetCanvasAsset` (admin.go:785), `HandleDeckCanvas` (admin.go:802). The interface `managed_runtime.go:180–181` and the duplicate at `admin.go:122–123` are external contract. Deletion scope is strictly the dead duplicates listed below.
>
> ⚠️ **DO NOT delete `canvasBridgeScript` or `registerAssetRoutes` from `assets.go`.** Bridge-script injection into the streamed iframe HTML is a SEPARATE responsibility from binary asset proxying; whether and how to migrate it lives in a follow-up. Stage 3 keeps it untouched.

**Surgical deletion candidates** (each requires Step-1 caller-graph audit before removal):

| Symbol                                                                            | File                     | Reason                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resolveLocalGatewayHTTPBaseFromState` (line ~249)                                | `legacy_admin_assets.go` | Byte-for-byte duplicate also living in `assets.go`; both predate the BFF reverse-proxy.                                                                                                                                                                         |
| `processEnvMap` (line ~261)                                                       | `legacy_admin_assets.go` | Same — duplicate of the helper in `assets.go`.                                                                                                                                                                                                                  |
| Same two helpers                                                                  | `assets.go`              | One copy survives behind whichever file's `GetCanvasAsset` / canvas iframe route still uses it; the other is dead.                                                                                                                                              |
| `/canvas/*` & `/api/canvas/*` proxy block (~line 133–186 in `assets.go`)          | `assets.go`              | Dead iff every caller migrated to `/api/runtime/gateway-assets/*`. Must verify against `admin.go` route table AND frontend `canvas-asset-config.ts`. The `canvasBridgeScript` write-back at line 184/186 (HTML rewriting) is the load-bearing piece — preserve. |
| Dead branches of `resolveGatewayHTTPBase` (line ~229) in `legacy_admin_assets.go` | `legacy_admin_assets.go` | Audit which branch the surviving `GetCanvasAsset` body needs; remove unreachable branches only.                                                                                                                                                                 |

- [ ] **Step 1: For every candidate symbol above, run `git grep -n <symbol> deck-go/backend/` and walk the caller graph**. If any caller is reachable from an admin HTTP route, a `ManagedRuntime` interface method, or the canvas iframe path, do NOT delete that symbol. Document the audit result inline in the PR description (per-symbol verdict: dead / live / partial).
- [ ] **Step 2: Delete only the symbols whose caller-graph audit returns dead**. Keep imports cleaned.
- [ ] **Step 3: Run `cd deck-go/backend && go build ./... && go vet ./... && go test ./internal/server/... ./internal/runtime/openclaw/...`**; the full admin-route test suite + reverse-proxy tests MUST stay green.
- [ ] **Step 4: Manually verify the canvas iframe still loads** via `make e2e-mock-runtime` (or, if Phase A/B not yet landed, by running the existing `canvas-panel.test.tsx`).

### Task E.2: OperationsPanel Playwright smoke (closes 2.5.4)

**Files:**

- Create: `deck-go/test/e2e/operations-panel.spec.ts`

- [ ] **Step 1: For each of the four lifecycle states (`running` / `stopped` / `not-installed` / `unhealthy`)** seed the mock-gateway fixture (or the BFF directly) so the runtime status payload returns that `lifecycleState`. Use the Phase A fixture helper.
- [ ] **Step 2: For each state, assert the spec-mandated button set is visible** (per design.md D6 table): Stop/Restart for running, Start/Reinstall for stopped, single 安装并启动 for not-installed, Restart/Reinstall + error region for unhealthy.
- [ ] **Step 3: Assert `serviceName`, `entrypointPath`, and `lastError` are rendered correctly** for the unhealthy state.
- [ ] **Step 4: Confirm the panel renders ONLY the spec-listed fields and buttons** (scope-anchoring per 2.5.5).
- [ ] **Step 5: Wire into `make e2e-mock-runtime`** if not auto-discovered, or add `make e2e-operations-panel` shortcut.

### Task E.3: Document upstream-Gateway static route handoff (2.3.2 handoff — DO NOT mark task `[x]`)

**Files:**

- Modify: `openspec/changes/gateway-launcher-rewrite/tasks.md` — append a note that 2.3.2 remains open in upstream; leave the `- [ ]` checkbox **unchecked** unless the owner explicitly confirms the handoff is equivalent to completion.
- Create or modify: an owner-visible handoff note (e.g., `docs/handoff-agent/gateway-launcher-rewrite-stage3-upstream-D5.md`) describing the canvas-asset static route gap, the analogous-discipline tradeoff (motivation / alternatives / lock-in), and the upstream Gateway PR target.

> ⚠️ Writing a handoff note is NOT the same as completing the task. The implementer SHALL NOT flip 2.3.2 to `[x]` on the basis of the note alone. Only the owner can decide whether the handoff is acceptance-equivalent for this change.

- [ ] **Step 1: Verify with `git grep` that no deck-go-side code depends on the upstream static route being present** today (BFF reverse-proxy hides the gap from the browser).
- [ ] **Step 2: Author the handoff note**.
- [ ] **Step 3: Surface the note in the Stage 3 PR description for owner sign-off**.
- [ ] **Step 4: If and only if the owner replies that the handoff is acceptance-equivalent**, mark 2.3.2 `[x]` and cite the owner approval in the PR thread.

### Task E.4: Document real-stack manual smoke acceptance criteria (2.6.4 handoff)

**Files:**

- Modify: `deck-go/docs/project/e2e-stack-operations.md` (add manual-smoke checklist)

- [ ] **Step 1: Document the manual-smoke acceptance criteria for `scripts/dev/run-stack-real.sh`** under the new lifecycle path: install completes, start completes, chat session reaches first-response token, `gateway uninstall` cleans up.
- [ ] **Step 2: Note that the manual run is owner-only and not blocking on this stage's PR merge** (matches Stage 2 scope-out convention).

---

## Phase F: Cross-cutting closeout + Stage 3 verification (closes 4.6 + 5.x)

### Task F.1: Stage 3 verification gates (4.6.1–4.6.4)

- [ ] **Step 1: `cd deck-go && make e2e-mock-runtime`** passes (Phase B / C output).
- [ ] **Step 2: `cd deck-go && make e2e-mock-visual`** passes (or consolidated equivalent).
- [ ] **Step 3: `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 make e2e-real-smoke`** passes; cleanup hook removes the per-hash service (Phase D).
- [ ] **Step 4: `cd deck-go && make verify`** passes; baseline matrix from task 1.4 still green.

### Task F.2: Root-level verify and D5 regression check (5.2)

- [ ] **Step 1: From repo root, `pnpm check`** (and `pnpm test` + `pnpm build` if the touched surface includes TS core).
- [ ] **Step 2: Confirm no regression in the D5 path** — `gateway_assets_proxy_test.go` still green, frontend canvas iframe loads `/api/runtime/gateway-assets/...` in `make e2e-mock-runtime`.

### Task F.3: Design-philosophy diff check (5.3)

- [ ] **Step 1: Walk `git diff main...HEAD` against `CONTEXT.md` "Ensure 可用 + 生命周期可控"** and confirm every added feature serves one of those goals; flag anything that doesn't for owner review before merge.

### Task F.4: CONTEXT.md grill log update (5.4)

- [ ] **Step 1: If any Stage 3 outcome supersedes Q9 status note**, update it (owner-gated per AGENTS.md).

### Task F.5: `runtime-mode-switching` announcement (5.5)

- [ ] **Step 1: Author `openspec/changes/runtime-mode-switching/announcement.md`** (or equivalent) summarizing: Stage 1 / 2 / 3 of `gateway-launcher-rewrite` complete; `runtime-mode-switching` Stage 1 is now unblocked; flag the dependency chain.

### Task F.6: Archive readiness (5.6)

- [ ] **Step 1: If `openspec/changes/gateway-launcher-rewrite/verification.yaml` is maintained**, capture Stage 3 acceptance evidence pointers (commit hashes, CI run URLs) alongside Stage 1 / 2.
- [ ] **Step 2: Run `openspec validate gateway-launcher-rewrite`** and resolve any schema errors.

---

## Acceptance signal

Stage 3 is done when all of:

1. `cd deck-go && make verify && make e2e-mock-runtime && DECK_GO_REAL_GATEWAY_E2E=1 make e2e-real-smoke` all green.
2. `bash scripts/check-r2.sh && bash scripts/check-r3-real-spec-gateway-run.sh` both pass.
3. `git grep -in "bundled" deck-go/test/e2e/` returns only intentional comments / fixture data (no spec name or scenario name).
4. `git grep -in "resolveLocalGatewayHTTPBaseFromState\|processEnvMap" deck-go/backend/internal/` returns empty or only the canvas-bridge inlining call site (documented at plan time).
5. `openspec/changes/gateway-launcher-rewrite/tasks.md` has no remaining `- [ ]` items in sections 2.3.4, 2.5.4, 4.1–4.6, 5.2, 5.5, 5.6 (2.3.2, 2.6.4, 5.3, 5.4 are documented handoffs / owner-gated and not coding deliverables).
6. Stage 3 PR description includes:
   - Evidence link for each verification gate (CI run URL, screenshot, or local log).
   - The 2.3.2 upstream Gateway PR target (or "not yet filed, blocking on owner sign-off").
   - The 5.5 follow-up announcement reference.
