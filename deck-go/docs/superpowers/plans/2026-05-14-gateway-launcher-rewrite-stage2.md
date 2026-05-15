# Gateway Launcher Rewrite — Stage 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finalize OpenSpec change `gateway-launcher-rewrite` by renaming runtime mode `bundled` → `local` across deck-go's backend package, contract enum, frontend type guards, `.env` files, dev scripts, and docs, while re-sourcing local-mode Gateway probe credentials (token, bind, port) from `$OPENCLAW_STATE_DIR/openclaw.json` instead of `RUNTIME_BUNDLED_*` env vars.

**Architecture:** Phase 0 is a prerequisite — a new `runtime/openclawstate` reader picks up Gateway's own state file (`openclaw.json`), parses `gateway.auth.token` as the upstream `SecretInput` shape (plain string, `${ENV_VAR}` template, or `{source:"env",provider:..., id:...}` SecretRef restricted to source="env"), falls back to `OPENCLAW_GATEWAY_TOKEN` env when the config-derived token is empty (matches upstream `src/gateway/auth-token-resolution.ts:30+` precedence), and is fed by the local Facade through an env map. The Facade switches its credentials source from envconf to the reader, and a single-shot deprecation warning is emitted when legacy `RUNTIME_BUNDLED_TOKEN` / `_BIND_HOST` / `_BIND_PORT` env vars are observed alongside (they are ignored). Phase B does the envconf flip atomically — RUNTIME_MODE=local is the only accepted local-mode value from the first commit; `bundled` is rejected with a `usageErrorf` fatal-exit message in the same commit (per spec.md `runtime-mode-dispatch` Scenario 1: "exit 64 immediately"). Phase C is the contract change with `make contracts-sync` + `make protocol-update` + `make contract-gate`. Phase D carries the rename through the frontend type guards / UI strings. Phase E renames `RuntimeBundledConfig` → `RuntimeLocalConfig` and strips spawn-era fields. Phases F–G rewrite `.env` / scripts / docs and run the final `git grep -i bundled` + `make verify` audit.

**Tech Stack:** Go 1.24 (deck-go backend, `make backend-test` + `make verify`), React + Vite + TypeScript (frontend-new, `npm run build`), deck-go contract chain (`make contracts-sync` / `make protocol-update` / `make contract-gate`), bash dev scripts, Markdown docs.

**Related:**

- OpenSpec change: `openspec/changes/gateway-launcher-rewrite/` (tasks.md sections 3.1–3.4, 3.5; plan.md Stage 2)
- F1 follow-up ADR (Stage 1 prerequisite): `deck-go/docs/adr/0001-managed-runtime-supervisor-decoupling.md`
- Stage 1 handoff log: `docs/handoff-agent/gateway-launcher-rewrite-stage1.md`
- F1 follow-up handoff log: `docs/handoff-agent/managed-runtime-supervisor-decoupling.md`

**Order constraint:** Phase 0 MUST land before Phase E2 (the spawn-era envconf field strip). Phase A (backend package rename) MUST land before Phase B (mode value flip) because the value flip touches the renamed package's files. Phase C (contract sync) MUST land before Phase D (frontend rename) because the frontend reads the regenerated `Capabilities.mode` enum. Phase E MUST land before Phase F (env files) because dropping `bundled` compat in envconf is what makes the new `.env.local.example` the only legal contract.

---

## File Structure

### Created

- `deck-go/backend/internal/runtime/openclawstate/reader.go` — JSON reader for `$OPENCLAW_STATE_DIR/openclaw.json`'s `gateway.{port,bind,auth.{mode,token}}` subtree. Exports `Reader`, `GatewayConfig`, and sentinel errors `ErrStateDirNotSet` / `ErrStateFileNotFound`.
- `deck-go/backend/internal/runtime/openclawstate/reader_test.go` — unit tests covering happy path, missing state dir, missing file, missing token (mode != token), missing port (default 18789), and malformed JSON.
- `deck-go/backend/internal/runtime/local/legacy_env_warn.go` (in renamed `local/` package after Phase A) — single-shot stderr deprecation warning for legacy `RUNTIME_BUNDLED_TOKEN` / `_BIND_HOST` / `_BIND_PORT` env vars, guarded by `sync.Once`. Also exports a test-only reset hook.
- `deck-go/backend/internal/runtime/local/legacy_env_warn_test.go` — asserts the warning fires at most once per process and only when at least one legacy env var is set.
- `deck-go/.env.local.example` — new minimal env example (only `RUNTIME_MODE=local` + commented `OPENCLAW_REPO_ROOT` + `OPENCLAW_STATE_DIR`).
- `deck-go/scripts/dev/run-local.sh` — replaces `run-bundled.sh`; calls `openclaw gateway install` + `openclaw gateway start` before launching the BFF.

### Modified

- `deck-go/backend/internal/runtime/bundled/facade.go` (renamed `local/facade.go` after Phase A) — drops `f.cfg.Token` / `f.cfg.BindHost` / `f.cfg.BindPort` reads; calls `openclawstate.Reader.Load()` instead. Adds `Mode: string(envconf.ModeLocal)` to all status payloads.
- `deck-go/backend/internal/runtime/envconf/envconf.go` — adds `ModeLocal RuntimeMode = "local"`; accepts only `local` and `remote`; `RUNTIME_MODE=bundled` is rejected with a `UsageError` (cmd/main maps to exit-64) per spec.md Scenario 1; strips `Token` / `BindHost` / `BindPort` / `Command` / `Args` / `WorkingDir` / `Env` / `EnvDeny` / `AutoStart` fields from `RuntimeBundledConfig` (renamed `RuntimeLocalConfig`); reads new optional `OPENCLAW_STATE_DIR` env.
- `deck-go/backend/internal/server/runtime.go` — replace `caps.Mode == "remote"` and `caps.Mode == "local"` branches with mode-agnostic logic where possible; flip the literal `"bundled"` to `"local"` where required.
- `deck-go/backend/internal/server/runtime_facade_test.go`, `server/server_test.go`, `server/gateway_routes_test.go` — flip `Mode: "bundled"` test fixtures to `Mode: "local"`.
- `deck-go/backend/internal/controld/app.go`, `controld/app_test.go` — flip mode literals; import-path rewrite from `runtime/bundled` to `runtime/local`.
- `deck-go/backend/internal/runtime/facade/import_boundary_test.go`, `facade/build_test.go` — import-path rewrite.
- `deck-go/contracts/source/deck-api.contract.ts` (lines 59, 83, 121) — `Capabilities.mode` enum changes from `"bundled" | "remote"` to `"local" | "remote"`; `DeckGoRuntimeBundledGatewayStatus.mode` field flips to `"local"`.
- `deck-go/contracts/generated/ts/**`, `deck-go/backend/internal/gateway/generated/**`, `deck-go/contracts/generated/go/**` — regenerated by `make contracts-sync` + `make protocol-update`. NEVER hand-edit.
- `deck-go/frontend-new/src/api.ts` (lines 568–620) — rename `isBundledRuntimeStatus` → `isLocalRuntimeStatus`; flip internal `"bundled"` string literals to `"local"`.
- `deck-go/frontend-new/src/components/runtime/ModeBadge.tsx` — `data-state="bundled"` → `data-state="local"`; copy update.
- `deck-go/frontend-new/src/components/panels/gateway/GatewayPanel.tsx` (lines 10, 499, 501) — import + caller rename.
- `deck-go/frontend-new/src/components/panels/gateway/GatewayPanel.test.tsx` (lines 18–21) — mock + assertion mode literal flip.
- `deck-go/.env.real-stack.example` — drop `RUNTIME_BUNDLED_COMMAND` / `_ARGS` / `_BIND_*` / `_TOKEN` / `_ENV_*`; add `OPENCLAW_STATE_DIR` line.
- `deck-go/scripts/dev/run-stack-real.sh` — call `openclaw gateway install` + `start` before BFF + Vite (per design D9); preserve Vite dev mode.
- `deck-go/AGENTS.md`, `deck-go/CLAUDE.md` (symlink) — Architecture + Runtime And Dev Scripts sections reflect `local` mode + new env keys.
- `deck-go/docs/project/e2e-stack-operations.md` — install/start path documentation update.
- `.agents/skills/deck-upstream-sync/SKILL.md` — path constants under `internal/runtime/bundled/supervisor.go` removed; map any future upstream conflicts onto `internal/runtime/local/` (most paths are deletions).

### Renamed (git mv, content-changing)

- `deck-go/backend/internal/runtime/bundled/` → `deck-go/backend/internal/runtime/local/` — all `.go` files; `package bundled` → `package local` declaration in every file; all `runtime/bundled` import paths in callers updated.
- `deck-go/.env.bundled.example` → `deck-go/.env.local.example` — file moved and content rewritten (drop all `RUNTIME_BUNDLED_*` keys).
- `deck-go/scripts/dev/run-bundled.sh` → `deck-go/scripts/dev/run-local.sh` — file moved and content rewritten to use `openclaw gateway install` + `start`.

### Out of scope (DO NOT touch in this plan)

- `deck-go/test/e2e/bundled.spec.ts`, `remote.spec.ts`, `*-visual.spec.ts` and the mock-gateway test harness merge — these are Stage 3 tasks (4.1–4.3); leave file names referencing `bundled` for now.
- `runtime-mode-switching` capability (Capabilities.mode runtime swap) — separate change.
- Canvas bridge injection (Stage 1 tail 2.3.4 / 2.3.5) — owner-decided design follow-up, not unblocked by Stage 2.
- OperationsPanel Playwright smoke (Stage 1 tail 2.5.4) — independent e2e task.
- Manual real-stack smoke `run-stack-real.sh` end-to-end chat session (Stage 1 tail 2.6.4 + Stage 2 tail 3.5.2 / 3.5.3) — owner-only manual verification.
- `.env.remote.example` content (per task 3.4.3, deferred to `runtime-mode-switching`).

---

## Self-discovery commands (run during implementation, not in CI)

Use these to verify nothing was missed:

```bash
# After Phase A: no caller imports the old path
cd deck-go/backend && rg -n "runtime/bundled" ./internal | rg -v "/runtime/local/"
# Expected: empty

# After Phase B: no backend source emits the literal "bundled" as a mode value
cd deck-go/backend && rg -n '"bundled"' ./internal | rg -v "_test\.go|/* legacy"
# Expected: only deprecation warning string + envconf comment

# After Phase C: regenerated artifacts checksum is fresh
cd deck-go && make contracts-check && make protocol-check
# Expected: pass

# After Phase D: frontend has no isBundledRuntimeStatus call
cd deck-go/frontend-new && rg -n "isBundledRuntimeStatus" src
# Expected: empty

# After Phase G: full `bundled` audit (allowlist: design docs, migration warning, archived OpenSpec, commit history)
cd deck-go && git grep -i bundled -- . ':!docs/superpowers/plans/' ':!docs/adr/' ':!/docs/handoff-agent/' ':!openspec/changes/' ':!openspec/specs/'
# Expected: only deprecation warning literal in envconf + .agents/skills allowlist + design.md references
```

---

## Phase 0: Local State Reader infrastructure

This phase lands BEFORE the backend rename so the local-mode Facade has a stable token / bind / port source by the time we strip `RUNTIME_BUNDLED_TOKEN` / `_BIND_*` env vars in Phase E2. The reader exists in package `openclawstate` (not `bundled`/`local`) so it is mode-agnostic and the Phase A `git mv` doesn't touch it.

### Task 0.1: Add `runtime/openclawstate` Reader with SecretInput parsing + env fallback

**Files:**

- Create: `deck-go/backend/internal/runtime/openclawstate/reader.go`
- Create: `deck-go/backend/internal/runtime/openclawstate/reader_test.go`

**Token resolution contract** (mirrors `src/config/types.gateway.ts:144` `mode` defaults + `src/config/types.secrets.ts:18` `SecretInput` + `src/gateway/auth-token-resolution.ts:30+` precedence):

1. `gateway.auth.mode` defaults to `"token"` when unset (per upstream `GatewayAuthConfig.mode?` doc-comment "Defaults to token when unset" and `src/gateway/auth.ts:285-290` fallback `else { mode = "token"; modeSource = "default"; }`). The Reader treats mode = `""` / missing / `"token"` identically; only `"none"`, `"password"`, and `"trusted-proxy"` skip token resolution.
2. If `gateway.auth.token` is a **plain string**, the value is used as-is (after trimming).
3. If `gateway.auth.token` matches the **env template** `^\$\{([A-Z][A-Z0-9_]{0,127})\}$`, the named env var supplies the value. Empty env var → `""`.
4. If `gateway.auth.token` is a **SecretRef object** `{source, provider, id}` with `source == "env"`, the env var named by `id` supplies the value.
5. Any other SecretRef source (`file`, `exec`, provider plugins) is **not supported** in Stage 2 — `cfg.Token = ""`. (Full SecretRef resolution requires the upstream Node-side secret-manager; that is out of scope for this change. Owners running a SecretRef token in deck-go local mode should set `OPENCLAW_GATEWAY_TOKEN` as the fallback or accept that local probes run unauthenticated.)
6. If the config-derived token is empty AND `OPENCLAW_GATEWAY_TOKEN` env is set, the env value is used. Config-derived token takes precedence over env when both are present.

- [ ] **Step 1: Write the failing test**

`deck-go/backend/internal/runtime/openclawstate/reader_test.go`:

```go
package openclawstate

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const sampleStateJSON = `{
  "meta": {"lastTouchedVersion": "2026.4.14"},
  "gateway": {
    "mode": "local",
    "port": 18900,
    "bind": "loopback",
    "auth": {"mode": "token", "token": "test-token-abc"}
  }
}`

func writeStateFile(t *testing.T, contents string) string {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "openclaw.json")
	if err := os.WriteFile(path, []byte(contents), 0o600); err != nil {
		t.Fatalf("write state file: %v", err)
	}
	return dir
}

func TestReader_Load_HappyPath(t *testing.T) {
	dir := writeStateFile(t, sampleStateJSON)
	cfg, err := NewReader(dir).Load(nil)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Token != "test-token-abc" {
		t.Fatalf("Token = %q, want test-token-abc", cfg.Token)
	}
	if cfg.Port != 18900 {
		t.Fatalf("Port = %d, want 18900", cfg.Port)
	}
	if cfg.Bind != "loopback" {
		t.Fatalf("Bind = %q, want loopback", cfg.Bind)
	}
}

func TestReader_Load_MissingStateDir_NoEnv_ReturnsSentinel(t *testing.T) {
	// With no env (nil) and no explicit stateDir, the Reader cannot derive the
	// upstream default (~/.openclaw) — surface the sentinel.
	_, err := NewReader("").Load(nil)
	if !errors.Is(err, ErrStateDirNotSet) {
		t.Fatalf("err = %v, want ErrStateDirNotSet", err)
	}
}

func TestReader_Load_MissingStateDir_FallsBackToUserHomeDotOpenclaw(t *testing.T) {
	// Mirrors src/daemon/paths.ts:34: when OPENCLAW_STATE_DIR is unset,
	// resolveGatewayStateDir returns $HOME/.openclaw[<profile-suffix>]. The
	// Reader applies the same default so deck-go honors `openclaw gateway
	// install` output when the user keeps the upstream default state dir.
	home := t.TempDir()
	dir := filepath.Join(home, ".openclaw")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "openclaw.json"), []byte(`{"gateway":{"auth":{"token":"home-token"}}}`), 0o600); err != nil {
		t.Fatal(err)
	}
	cfg, err := NewReader("").Load(map[string]string{"HOME": home})
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Token != "home-token" {
		t.Fatalf("Token = %q, want home-token (from $HOME/.openclaw/openclaw.json)", cfg.Token)
	}
}

func TestReader_Load_HomeDirAppliesProfileSuffix(t *testing.T) {
	home := t.TempDir()
	dir := filepath.Join(home, ".openclaw-staging")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "openclaw.json"), []byte(`{"gateway":{"auth":{"token":"staging"}}}`), 0o600); err != nil {
		t.Fatal(err)
	}
	cfg, err := NewReader("").Load(map[string]string{"HOME": home, "OPENCLAW_PROFILE": "staging"})
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Token != "staging" {
		t.Fatalf("Token = %q, want staging (from $HOME/.openclaw-staging)", cfg.Token)
	}
}

func TestReader_Load_TildeStateDirExpandsViaHomeEnv(t *testing.T) {
	home := t.TempDir()
	dir := filepath.Join(home, "custom-state")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "openclaw.json"), []byte(`{"gateway":{"auth":{"token":"tilde-tok"}}}`), 0o600); err != nil {
		t.Fatal(err)
	}
	cfg, err := NewReader("~/custom-state").Load(map[string]string{"HOME": home})
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Token != "tilde-tok" {
		t.Fatalf("Token = %q, want tilde-tok", cfg.Token)
	}
}

func TestReader_Load_MissingFile_ReturnsSentinel(t *testing.T) {
	dir := t.TempDir() // no openclaw.json inside
	_, err := NewReader(dir).Load(nil)
	if !errors.Is(err, ErrStateFileNotFound) {
		t.Fatalf("err = %v, want ErrStateFileNotFound", err)
	}
}

func TestReader_Load_AuthModeUnset_DefaultsToToken(t *testing.T) {
	// Upstream src/config/types.gateway.ts:144 — mode defaults to token when unset;
	// src/gateway/auth.ts:285-290 fallback confirms this.
	dir := writeStateFile(t, `{"gateway":{"auth":{"token":"present-but-no-mode"}}}`)
	cfg, err := NewReader(dir).Load(nil)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Token != "present-but-no-mode" {
		t.Fatalf("Token = %q, want present-but-no-mode (mode unset defaults to token)", cfg.Token)
	}
}

func TestReader_Load_AuthModeExplicitToken_ResolvesToken(t *testing.T) {
	dir := writeStateFile(t, `{"gateway":{"auth":{"mode":"token","token":"explicit"}}}`)
	cfg, _ := NewReader(dir).Load(nil)
	if cfg.Token != "explicit" {
		t.Fatalf("Token = %q, want explicit", cfg.Token)
	}
}

func TestReader_Load_AuthModeNone_SkipsToken(t *testing.T) {
	dir := writeStateFile(t, `{"gateway":{"port":18789,"auth":{"mode":"none","token":"ignored"}}}`)
	cfg, err := NewReader(dir).Load(nil)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Token != "" {
		t.Fatalf("Token = %q, want empty when auth.mode=none", cfg.Token)
	}
}

func TestReader_Load_AuthModePassword_SkipsToken(t *testing.T) {
	dir := writeStateFile(t, `{"gateway":{"auth":{"mode":"password","token":"ignored","password":"pw"}}}`)
	cfg, _ := NewReader(dir).Load(nil)
	if cfg.Token != "" {
		t.Fatalf("Token = %q, want empty when auth.mode=password", cfg.Token)
	}
}

func TestReader_Load_AuthModeTrustedProxy_SkipsToken(t *testing.T) {
	dir := writeStateFile(t, `{"gateway":{"auth":{"mode":"trusted-proxy","token":"ignored"}}}`)
	cfg, _ := NewReader(dir).Load(nil)
	if cfg.Token != "" {
		t.Fatalf("Token = %q, want empty when auth.mode=trusted-proxy", cfg.Token)
	}
}

func TestReader_Load_MissingPortDefaultsTo18789(t *testing.T) {
	dir := writeStateFile(t, `{"gateway":{"auth":{"mode":"token","token":"t"}}}`)
	cfg, err := NewReader(dir).Load(nil)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if got := cfg.ResolvePort(); got != 18789 {
		t.Fatalf("ResolvePort() = %d, want 18789", got)
	}
}

func TestReader_Load_MalformedJSON(t *testing.T) {
	dir := writeStateFile(t, `{not valid json`)
	_, err := NewReader(dir).Load(nil)
	if err == nil {
		t.Fatal("expected parse error")
	}
	if errors.Is(err, ErrStateDirNotSet) || errors.Is(err, ErrStateFileNotFound) {
		t.Fatalf("err = %v should be a parse error, not a sentinel", err)
	}
	if !strings.Contains(err.Error(), "parse") {
		t.Fatalf("err = %v, want a parse error message", err)
	}
}

func TestReader_Load_ResolveLoopbackHostAlwaysLocalhost(t *testing.T) {
	// Whatever bind mode Gateway uses externally (loopback/lan/custom), deck-go
	// reaches it via loopback because it runs on the same host.
	for _, bind := range []string{"", "loopback", "lan", "custom"} {
		cfg := GatewayConfig{Bind: bind}
		if got := cfg.ResolveLoopbackHost(); got != "127.0.0.1" {
			t.Fatalf("bind=%q → ResolveLoopbackHost() = %q, want 127.0.0.1", bind, got)
		}
	}
}

// SecretInput parsing per upstream src/config/types.secrets.ts.

func TestReader_Load_TokenAsEnvTemplate(t *testing.T) {
	dir := writeStateFile(t, `{"gateway":{"auth":{"mode":"token","token":"${MY_GW_TOKEN}"}}}`)
	cfg, err := NewReader(dir).Load(map[string]string{"MY_GW_TOKEN": "from-env-template"})
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Token != "from-env-template" {
		t.Fatalf("Token = %q, want from-env-template", cfg.Token)
	}
}

func TestReader_Load_TokenAsEnvSecretRef(t *testing.T) {
	dir := writeStateFile(t, `{"gateway":{"auth":{"mode":"token","token":{"source":"env","provider":"default","id":"MY_GW_TOKEN"}}}}`)
	cfg, err := NewReader(dir).Load(map[string]string{"MY_GW_TOKEN": "from-secret-ref"})
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Token != "from-secret-ref" {
		t.Fatalf("Token = %q, want from-secret-ref", cfg.Token)
	}
}

func TestReader_Load_NonEnvSecretRefReturnsEmpty(t *testing.T) {
	// source="file" / "exec" / provider-plugin SecretRefs are NOT resolved in
	// Stage 2; deck-go in local mode falls back to OPENCLAW_GATEWAY_TOKEN.
	dir := writeStateFile(t, `{"gateway":{"auth":{"mode":"token","token":{"source":"file","provider":"default","id":"/etc/secrets/gw"}}}}`)
	cfg, err := NewReader(dir).Load(nil)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Token != "" {
		t.Fatalf("Token = %q, want empty (file SecretRef is out of scope)", cfg.Token)
	}
}

func TestReader_Load_OpenclawGatewayTokenFallback(t *testing.T) {
	// auth.mode=token but token field is empty → fall back to env override.
	dir := writeStateFile(t, `{"gateway":{"auth":{"mode":"token","token":""}}}`)
	cfg, err := NewReader(dir).Load(map[string]string{"OPENCLAW_GATEWAY_TOKEN": "fallback-token"})
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Token != "fallback-token" {
		t.Fatalf("Token = %q, want fallback-token", cfg.Token)
	}
}

func TestReader_Load_ConfigTokenWinsOverEnvOverride(t *testing.T) {
	// Both config and env-override present → config-derived token wins
	// (matches upstream src/gateway/auth-token-resolution.ts:30+ precedence).
	dir := writeStateFile(t, `{"gateway":{"auth":{"mode":"token","token":"config-token"}}}`)
	cfg, err := NewReader(dir).Load(map[string]string{"OPENCLAW_GATEWAY_TOKEN": "env-override"})
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Token != "config-token" {
		t.Fatalf("Token = %q, want config-token (env-override is fallback only)", cfg.Token)
	}
}
```

- [ ] **Step 2: Run, verify fail**

```bash
cd deck-go/backend && go test ./internal/runtime/openclawstate/ -count=1
# Expected: compile failure — package openclawstate has no Reader / GatewayConfig / ErrStateDirNotSet / ErrStateFileNotFound / NewReader; Load signature missing env map.
```

- [ ] **Step 3: Implement the reader**

`deck-go/backend/internal/runtime/openclawstate/reader.go`:

```go
// Package openclawstate reads the Gateway-managed openclaw.json file under
// $OPENCLAW_STATE_DIR. It is consumed by the local-mode runtime facade for the
// loopback Gateway probe (token + port + bind), replacing the legacy
// RUNTIME_BUNDLED_TOKEN / BIND_HOST / BIND_PORT env contract that Stage 1
// gateway-launcher-rewrite retired.
//
// Token resolution mirrors upstream:
//   - SecretInput shape (src/config/types.secrets.ts): string | SecretRef
//   - Env template "${VAR}" (ENV_SECRET_TEMPLATE_RE in upstream)
//   - SecretRef with source="env" resolves via the env map
//   - OPENCLAW_GATEWAY_TOKEN env fallback when config-derived token is empty
//     (mirrors src/gateway/auth-token-resolution.ts precedence)
package openclawstate

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// Sentinel errors callers MAY check with errors.Is to decide whether to fall
// back to defaults vs surface a real I/O failure.
var (
	ErrStateDirNotSet    = errors.New("openclawstate: state dir not set")
	ErrStateFileNotFound = errors.New("openclawstate: openclaw.json not found in state dir")
)

// envTemplateRE matches the upstream ENV_SECRET_TEMPLATE_RE
// (src/config/types.secrets.ts:24): "${VAR_NAME}" where VAR_NAME is uppercase
// ASCII / digits / underscore, starting with a letter.
var envTemplateRE = regexp.MustCompile(`^\$\{([A-Z][A-Z0-9_]{0,127})\}$`)

// GatewayConfig is the subset of openclaw.json's `gateway` subtree consumed by
// deck-go's local-mode runtime facade.
type GatewayConfig struct {
	// Bind is the raw `gateway.bind` value ("loopback" | "lan" | "custom"). May be
	// empty if the state file does not pin it.
	Bind string
	// Port is the raw `gateway.port` value. Zero means "use default" — call
	// ResolvePort to materialize.
	Port int
	// Token is the resolved Gateway token (empty if auth.mode != "token", the
	// SecretInput cannot be resolved in-process, and OPENCLAW_GATEWAY_TOKEN is
	// not set).
	Token string
}

// ResolveLoopbackHost is the host deck-go probes against. In local mode deck-go
// and Gateway run on the same host, so this is always loopback regardless of
// Gateway's external bind mode.
func (GatewayConfig) ResolveLoopbackHost() string { return "127.0.0.1" }

// ResolvePort returns the configured port or 18789 as the upstream default.
func (cfg GatewayConfig) ResolvePort() int {
	if cfg.Port > 0 {
		return cfg.Port
	}
	return 18789
}

// Reader resolves and parses $OPENCLAW_STATE_DIR/openclaw.json.
type Reader struct {
	stateDir string
}

// NewReader constructs a Reader for the given state dir. An empty stateDir
// triggers Load to fall back to the upstream default (~/.openclaw[<profile>],
// mirroring src/daemon/paths.ts:34's resolveGatewayStateDir). Pass an empty
// stateDir when OPENCLAW_STATE_DIR is unset and you want the upstream default
// behavior.
func NewReader(stateDir string) *Reader {
	return &Reader{stateDir: strings.TrimSpace(stateDir)}
}

// resolveStateDir mirrors src/daemon/paths.ts:34 resolveGatewayStateDir: if an
// explicit OPENCLAW_STATE_DIR is given, use it (with leading ~ expansion). If
// empty, derive ~/.openclaw[<profile-suffix>] from HOME and OPENCLAW_PROFILE.
// Returns "" when neither stateDir nor HOME is available.
func resolveStateDir(stateDir string, env map[string]string) string {
	if trimmed := strings.TrimSpace(stateDir); trimmed != "" {
		if strings.HasPrefix(trimmed, "~") {
			home := homeFromEnv(env)
			if home != "" {
				return filepath.Join(home, strings.TrimPrefix(trimmed, "~"))
			}
		}
		return trimmed
	}
	home := homeFromEnv(env)
	if home == "" {
		return ""
	}
	suffix := ""
	if profile := strings.TrimSpace(envValue(env, "OPENCLAW_PROFILE")); profile != "" {
		suffix = "-" + profile
	}
	return filepath.Join(home, ".openclaw"+suffix)
}

func homeFromEnv(env map[string]string) string {
	if home := strings.TrimSpace(envValue(env, "HOME")); home != "" {
		return home
	}
	if home, err := os.UserHomeDir(); err == nil {
		return home
	}
	return ""
}

func envValue(env map[string]string, key string) string {
	if env == nil {
		return ""
	}
	return env[key]
}

// Load parses openclaw.json and returns the GatewayConfig subset. The env map
// (typically derived from os.Environ() or deps.InheritEnv) supplies values for
// "${ENV_VAR}" templates, SecretRef{source:"env"} resolution, the
// OPENCLAW_GATEWAY_TOKEN fallback, AND the OPENCLAW_PROFILE-aware default
// state dir when r.stateDir is empty. Pass nil when no env should be visible —
// in that mode an empty r.stateDir returns ErrStateDirNotSet directly.
func (r *Reader) Load(env map[string]string) (GatewayConfig, error) {
	if r == nil {
		return GatewayConfig{}, ErrStateDirNotSet
	}
	dir := resolveStateDir(r.stateDir, env)
	if dir == "" {
		return GatewayConfig{}, ErrStateDirNotSet
	}
	path := filepath.Join(dir, "openclaw.json")
	data, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return GatewayConfig{}, ErrStateFileNotFound
		}
		return GatewayConfig{}, fmt.Errorf("openclawstate: read %s: %w", path, err)
	}
	var raw struct {
		Gateway struct {
			Bind string `json:"bind"`
			Port int    `json:"port"`
			Auth struct {
				Mode  string          `json:"mode"`
				Token json.RawMessage `json:"token"` // SecretInput: string | SecretRef
			} `json:"auth"`
		} `json:"gateway"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return GatewayConfig{}, fmt.Errorf("openclawstate: parse %s: %w", path, err)
	}
	cfg := GatewayConfig{
		Bind: strings.TrimSpace(raw.Gateway.Bind),
		Port: raw.Gateway.Port,
	}
	if isTokenAuthMode(raw.Gateway.Auth.Mode) {
		cfg.Token = resolveSecretInputToken(raw.Gateway.Auth.Token, env)
	}
	if cfg.Token == "" && env != nil {
		if fallback := strings.TrimSpace(env["OPENCLAW_GATEWAY_TOKEN"]); fallback != "" {
			cfg.Token = fallback
		}
	}
	return cfg, nil
}

// isTokenAuthMode mirrors upstream src/gateway/auth.ts:285-290 — auth.mode
// defaults to "token" when unset/empty. Only the three non-token modes
// (none / password / trusted-proxy) skip token resolution.
func isTokenAuthMode(raw string) bool {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "none", "password", "trusted-proxy":
		return false
	default: // includes "" and "token"
		return true
	}
}

// resolveSecretInputToken implements the SecretInput parsing contract documented
// in the package-level comment. Returns "" when the input is empty, an
// unresolvable env template, an env-source SecretRef with no matching env var,
// or any non-env SecretRef.
func resolveSecretInputToken(raw json.RawMessage, env map[string]string) string {
	if len(raw) == 0 || string(raw) == "null" {
		return ""
	}
	// Try plain string first.
	var asString string
	if err := json.Unmarshal(raw, &asString); err == nil {
		return resolveSecretTemplate(asString, env)
	}
	// Try SecretRef object {source, provider, id}.
	var ref struct {
		Source string `json:"source"`
		ID     string `json:"id"`
	}
	if err := json.Unmarshal(raw, &ref); err != nil {
		return ""
	}
	if !strings.EqualFold(strings.TrimSpace(ref.Source), "env") {
		// file / exec / provider-plugin SecretRefs are not resolved in Stage 2.
		return ""
	}
	if env == nil {
		return ""
	}
	return strings.TrimSpace(env[strings.TrimSpace(ref.ID)])
}

// resolveSecretTemplate handles the upstream env-template form "${VAR_NAME}".
// Plain (non-template) strings are returned as-is after trimming.
func resolveSecretTemplate(value string, env map[string]string) string {
	trimmed := strings.TrimSpace(value)
	if matches := envTemplateRE.FindStringSubmatch(trimmed); matches != nil {
		if env == nil {
			return ""
		}
		return strings.TrimSpace(env[matches[1]])
	}
	return trimmed
}
```

- [ ] **Step 4: Run, verify pass**

```bash
cd deck-go/backend && go test ./internal/runtime/openclawstate/ -count=1 -v
# Expected: all 7 sub-tests PASS.
```

- [ ] **Step 5: Commit**

```bash
cd /Users/wangym/workspace/agents/openclaw
scripts/committer "Add openclawstate.Reader for local-mode gateway credentials

Stage 2 prerequisite: deck-go's local-mode facade will source token / bind /
port from \$OPENCLAW_STATE_DIR/openclaw.json instead of RUNTIME_BUNDLED_TOKEN
/ _BIND_HOST / _BIND_PORT env vars (which Stage 2 strips). The Reader is a
thin JSON parser that returns ErrStateDirNotSet / ErrStateFileNotFound
sentinels so callers can detect 'no state yet, fall back to defaults' vs a
real I/O error.

Confidence: high
Scope-risk: narrow (new package; no caller yet)
Tested: cd deck-go/backend && go test ./internal/runtime/openclawstate/ -count=1 -v" \
  deck-go/backend/internal/runtime/openclawstate/reader.go \
  deck-go/backend/internal/runtime/openclawstate/reader_test.go
```

---

### Task 0.2: Add legacy-env single-shot deprecation warning helper + envconf dotenv collection

**Files:**

- Create: `deck-go/backend/internal/runtime/bundled/legacy_env_warn.go` (lives in `bundled/` for now; renamed by Phase A's `git mv`).
- Create: `deck-go/backend/internal/runtime/bundled/legacy_env_warn_test.go`
- Modify: `deck-go/backend/internal/runtime/envconf/envconf.go` — after the dotenv merge, collect any `RUNTIME_BUNDLED_*` key into `Loaded.LegacyBundledKeys []string`. Facade construction reads this slice + `deps.InheritEnv` and emits the warning once (covers spec.md Scenario 1 which says "either .env or process env").
- Modify: `deck-go/backend/internal/runtime/envconf/envconf_test.go` — covers dotenv-only legacy key detection.

**Why two collection sources:** spec.md Scenario 1 requires the deprecation warning to fire whether the legacy `RUNTIME_BUNDLED_*` keys are set in process env OR loaded from a `.env` file (via `DECK_DOTENV_FILE` → envconf's internal merge). `deps.InheritEnv` alone misses dotenv-only keys because dotenv merging happens inside `envconf.Load` (envconf.go:81-99) and the merged map never escapes that function. The fix: envconf collects observed legacy keys into `Loaded.LegacyBundledKeys`; Facade construction passes that slice into `WarnLegacyEnvVarsOnce` alongside the InheritEnv-derived env map; the helper de-dupes them.

- [ ] **Step 1: Write the failing test**

`deck-go/backend/internal/runtime/bundled/legacy_env_warn_test.go`:

```go
package bundled

import (
	"bytes"
	"strings"
	"sync"
	"testing"
)

func TestWarnLegacyEnvVarsOnce_FiresOnceWhenAnyLegacyKeySet(t *testing.T) {
	resetLegacyEnvWarnState(t)
	buf := &bytes.Buffer{}
	env := map[string]string{
		"RUNTIME_BUNDLED_TOKEN":     "irrelevant",
		"RUNTIME_BUNDLED_BIND_HOST": "127.0.0.1",
	}
	WarnLegacyEnvVarsOnce(buf, env, nil)
	WarnLegacyEnvVarsOnce(buf, env, nil) // second call MUST be a no-op
	WarnLegacyEnvVarsOnce(buf, env, nil) // third call MUST also be a no-op
	out := buf.String()
	if strings.Count(out, "RUNTIME_BUNDLED_TOKEN") != 1 {
		t.Fatalf("expected exactly one mention of RUNTIME_BUNDLED_TOKEN, got: %q", out)
	}
	if !strings.Contains(out, "deprecated") {
		t.Fatalf("warning should say deprecated; got: %q", out)
	}
	if !strings.Contains(out, "ignored") {
		t.Fatalf("warning should say ignored; got: %q", out)
	}
}

func TestWarnLegacyEnvVarsOnce_DoesNotFireWhenNoLegacyKeySet(t *testing.T) {
	resetLegacyEnvWarnState(t)
	buf := &bytes.Buffer{}
	WarnLegacyEnvVarsOnce(buf, map[string]string{"RUNTIME_MODE": "local"}, nil)
	if buf.Len() != 0 {
		t.Fatalf("expected no warning when no RUNTIME_BUNDLED_* env is set, got: %q", buf.String())
	}
}

func TestWarnLegacyEnvVarsOnce_MergesExtraKeysFromDotenv(t *testing.T) {
	// Simulates the envconf.Loaded.LegacyBundledKeys path — keys observed only
	// in the dotenv file (not in os.Environ()).
	resetLegacyEnvWarnState(t)
	buf := &bytes.Buffer{}
	WarnLegacyEnvVarsOnce(buf, nil, []string{"RUNTIME_BUNDLED_TOKEN", "RUNTIME_BUNDLED_BIND_PORT"})
	out := buf.String()
	if !strings.Contains(out, "RUNTIME_BUNDLED_TOKEN") || !strings.Contains(out, "RUNTIME_BUNDLED_BIND_PORT") {
		t.Fatalf("dotenv-only legacy keys missing from warning: %q", out)
	}
}

func TestWarnLegacyEnvVarsOnce_DedupesAcrossEnvAndExtras(t *testing.T) {
	resetLegacyEnvWarnState(t)
	buf := &bytes.Buffer{}
	WarnLegacyEnvVarsOnce(
		buf,
		map[string]string{"RUNTIME_BUNDLED_TOKEN": "x"},
		[]string{"RUNTIME_BUNDLED_TOKEN"}, // also in dotenv → must not be listed twice
	)
	out := buf.String()
	if strings.Count(out, "RUNTIME_BUNDLED_TOKEN") != 1 {
		t.Fatalf("expected RUNTIME_BUNDLED_TOKEN listed exactly once, got: %q", out)
	}
}

func TestWarnLegacyEnvVarsOnce_RaceSafe(t *testing.T) {
	resetLegacyEnvWarnState(t)
	buf := &threadSafeBuffer{}
	env := map[string]string{"RUNTIME_BUNDLED_BIND_PORT": "18789"}
	var wg sync.WaitGroup
	for i := 0; i < 64; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			WarnLegacyEnvVarsOnce(buf, env, nil)
		}()
	}
	wg.Wait()
	if strings.Count(buf.String(), "RUNTIME_BUNDLED_") != 1 {
		t.Fatalf("expected exactly one warning fire under concurrent callers; got: %q", buf.String())
	}
}

type threadSafeBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *threadSafeBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.Write(p)
}

func (b *threadSafeBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.String()
}
```

- [ ] **Step 2: Run, verify fail**

```bash
cd deck-go/backend && go test ./internal/runtime/bundled/ -run TestWarnLegacyEnvVarsOnce -count=1
# Expected: compile failure — WarnLegacyEnvVarsOnce and resetLegacyEnvWarnState do not exist yet.
```

- [ ] **Step 3: Implement**

`deck-go/backend/internal/runtime/bundled/legacy_env_warn.go`:

```go
package bundled

import (
	"fmt"
	"io"
	"sort"
	"strings"
	"sync"
	"testing"
)

// legacyEnvKeys is the closed list of RUNTIME_BUNDLED_* env vars that Stage 2
// strips from envconf. If any of them is observed at boot we emit ONE stderr
// warning and ignore them; the local-mode facade sources token/bind/port from
// $OPENCLAW_STATE_DIR/openclaw.json (see runtime/openclawstate).
var legacyEnvKeys = []string{
	"RUNTIME_BUNDLED_TOKEN",
	"RUNTIME_BUNDLED_BIND_HOST",
	"RUNTIME_BUNDLED_BIND_PORT",
	"RUNTIME_BUNDLED_COMMAND",
	"RUNTIME_BUNDLED_ARGS",
	"RUNTIME_BUNDLED_WORKDIR",
	"RUNTIME_BUNDLED_AUTO_START",
	"RUNTIME_BUNDLED_ENV_DENY",
}

var legacyEnvWarnOnce sync.Once

// WarnLegacyEnvVarsOnce inspects env for any RUNTIME_BUNDLED_* key listed in
// legacyEnvKeys (plus any RUNTIME_BUNDLED_ENV_* pass-through key) and merges
// the result with `extraKeys` (typically envconf.Loaded.LegacyBundledKeys
// surfaced from the dotenv merge). Emits a single stderr warning naming the
// deduped, sorted observed keys. Subsequent calls within the same process are
// no-ops, even from concurrent goroutines.
func WarnLegacyEnvVarsOnce(out io.Writer, env map[string]string, extraKeys []string) {
	legacyEnvWarnOnce.Do(func() {
		seen := map[string]struct{}{}
		for _, key := range collectLegacyEnvKeys(env) {
			seen[key] = struct{}{}
		}
		for _, key := range extraKeys {
			key = strings.TrimSpace(key)
			if key != "" {
				seen[key] = struct{}{}
			}
		}
		if len(seen) == 0 {
			return
		}
		observed := make([]string, 0, len(seen))
		for key := range seen {
			observed = append(observed, key)
		}
		sort.Strings(observed)
		fmt.Fprintf(
			out,
			"deck-go: %s is deprecated and ignored; local-mode credentials now come from $OPENCLAW_STATE_DIR/openclaw.json. See deck-go/.env.local.example.\n",
			strings.Join(observed, ", "),
		)
	})
}

func collectLegacyEnvKeys(env map[string]string) []string {
	seen := map[string]struct{}{}
	for _, key := range legacyEnvKeys {
		if strings.TrimSpace(env[key]) != "" {
			seen[key] = struct{}{}
		}
	}
	for key, value := range env {
		if !strings.HasPrefix(key, "RUNTIME_BUNDLED_ENV_") {
			continue
		}
		if strings.TrimSpace(value) == "" {
			continue
		}
		seen[key] = struct{}{}
	}
	out := make([]string, 0, len(seen))
	for key := range seen {
		out = append(out, key)
	}
	return out
}

// resetLegacyEnvWarnState resets the sync.Once so tests can re-run the warning
// path. Test-only — never call from production code.
func resetLegacyEnvWarnState(t *testing.T) {
	t.Helper()
	legacyEnvWarnOnce = sync.Once{}
}
```

- [ ] **Step 4: Wire envconf dotenv-keys collection**

The Phase 0.2 helper covers process-env keys (via `deps.InheritEnv`) but not dotenv-only legacy keys. Extend `envconf.Load` to collect any `RUNTIME_BUNDLED_*` keys observed in the merged env map (post-dotenv merge), expose them through `Loaded.LegacyBundledKeys`, and let Facade construction de-dupe + forward into `WarnLegacyEnvVarsOnce`.

In `deck-go/backend/internal/runtime/envconf/envconf.go`:

```go
type Loaded struct {
	// ... existing fields ...
	LegacyBundledKeys []string // RUNTIME_BUNDLED_* keys observed in the merged env
}

func Load(opts Options) (Loaded, error) {
	// ... existing dotenv merge / mode-switch / loadLocal dispatch ...
	loaded.LegacyBundledKeys = collectLegacyBundledKeyNames(env)
	return loaded, nil
}

func collectLegacyBundledKeyNames(env map[string]string) []string {
	prefix := "RUNTIME_BUNDLED_"
	seen := map[string]struct{}{}
	for key, value := range env {
		if !strings.HasPrefix(key, prefix) {
			continue
		}
		if strings.TrimSpace(value) == "" {
			continue
		}
		seen[key] = struct{}{}
	}
	if len(seen) == 0 {
		return nil
	}
	out := make([]string, 0, len(seen))
	for key := range seen {
		out = append(out, key)
	}
	sort.Strings(out)
	return out
}
```

Add to `deck-go/backend/internal/runtime/envconf/envconf_test.go`:

```go
func TestLoad_CollectsLegacyBundledKeysFromDotenv(t *testing.T) {
	dotenv := filepath.Join(t.TempDir(), ".env")
	if err := os.WriteFile(dotenv, []byte(strings.Join([]string{
		"RUNTIME_MODE=local",
		"RUNTIME_BUNDLED_TOKEN=stale-from-dotenv",
		"RUNTIME_BUNDLED_BIND_PORT=18789",
	}, "\n")), 0o600); err != nil {
		t.Fatal(err)
	}
	loaded, err := Load(Options{
		Environ:    []string{"RUNTIME_MODE=local"}, // process env has no legacy keys
		DotenvFile: dotenv,
	})
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	want := []string{"RUNTIME_BUNDLED_BIND_PORT", "RUNTIME_BUNDLED_TOKEN"}
	if !reflect.DeepEqual(loaded.LegacyBundledKeys, want) {
		t.Fatalf("LegacyBundledKeys = %v, want %v", loaded.LegacyBundledKeys, want)
	}
}

func TestLoad_LegacyBundledKeysEmptyWhenAbsent(t *testing.T) {
	loaded, _ := Load(Options{Environ: []string{"RUNTIME_MODE=local"}})
	if len(loaded.LegacyBundledKeys) != 0 {
		t.Fatalf("LegacyBundledKeys = %v, want empty", loaded.LegacyBundledKeys)
	}
}
```

Then in `Dependencies` (Phase 0.3 task adds the wiring): pass `loaded.LegacyBundledKeys` via `deps.LegacyBundledKeysFromEnvconf []string` so `NewWithDependencies` can forward it as the third arg to `WarnLegacyEnvVarsOnce(sink, envMap, deps.LegacyBundledKeysFromEnvconf)`. The Facade construction site in `cmd/deck-go/main.go` (and `controld.NewDependenciesWithRuntimeFacade`) supplies the slice from `loaded.LegacyBundledKeys`.

- [ ] **Step 5: Run, verify pass**

```bash
cd deck-go/backend && go test -race ./internal/runtime/bundled/ ./internal/runtime/envconf/ -count=1 -v
# Expected: PASS (including new dotenv-collection test + envconf legacy-keys test).
```

- [ ] **Step 6: Commit**

```bash
cd /Users/wangym/workspace/agents/openclaw
scripts/committer "Add single-shot legacy RUNTIME_BUNDLED_* deprecation warning

Stage 2 prerequisite: when Phase E2 strips RUNTIME_BUNDLED_TOKEN /
_BIND_HOST / _BIND_PORT / _COMMAND / _ARGS / etc from envconf, anyone with
a stale .env or stale process env will silently lose those keys. We emit a
single stderr warning listing the observed legacy keys and pointing at
.env.local.example; subsequent calls are no-ops (sync.Once + 64-goroutine
race-safe). envconf.Load collects legacy keys after dotenv merge so the
spec.md Scenario 1 requirement ('.env OR process env') holds.

Confidence: high
Scope-risk: narrow (helper + envconf-side collection; no production caller
yet — Facade wiring lands in Phase 0.3)
Tested: cd deck-go/backend && go test -race ./internal/runtime/bundled/ ./internal/runtime/envconf/ -count=1 -v" \
  deck-go/backend/internal/runtime/bundled/legacy_env_warn.go \
  deck-go/backend/internal/runtime/bundled/legacy_env_warn_test.go \
  deck-go/backend/internal/runtime/envconf/envconf.go \
  deck-go/backend/internal/runtime/envconf/envconf_test.go
```

---

### Task 0.3: Local Facade switches token/bind/port source to openclawstate.Reader

**Files:**

- Modify: `deck-go/backend/internal/runtime/bundled/facade.go`
- Modify: `deck-go/backend/internal/runtime/bundled/facade_test.go`

- [ ] **Step 1: Write the failing test**

Add to `deck-go/backend/internal/runtime/bundled/facade_test.go`:

```go
func TestFacade_SourcesTokenAndPortFromStateReader(t *testing.T) {
	resetLegacyEnvWarnState(t)
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "openclaw.json"), []byte(`{
		"gateway": {
			"port": 18900,
			"bind": "loopback",
			"auth": {"mode": "token", "token": "state-token"}
		}
	}`), 0o600); err != nil {
		t.Fatal(err)
	}
	cfg := &envconf.RuntimeBundledConfig{AutoStart: false, StateDir: dir}
	f, err := NewWithDependencies(cfg, Dependencies{})
	if err != nil {
		t.Fatalf("NewWithDependencies: %v", err)
	}
	ep, err := f.Endpoint(context.Background())
	if err != nil {
		t.Fatalf("Endpoint: %v", err)
	}
	if !ep.TokenConfigured {
		t.Fatalf("expected TokenConfigured=true when state file has gateway.auth.token")
	}
	if !strings.Contains(ep.URL, ":18900") {
		t.Fatalf("URL = %q, expected to contain :18900", ep.URL)
	}
	if !strings.Contains(ep.URL, "127.0.0.1") {
		t.Fatalf("URL = %q, expected loopback host", ep.URL)
	}
}

func TestFacade_FallsBackToDefaultsWhenStateFileMissing(t *testing.T) {
	resetLegacyEnvWarnState(t)
	cfg := &envconf.RuntimeBundledConfig{StateDir: t.TempDir()} // empty dir, no openclaw.json
	f, err := NewWithDependencies(cfg, Dependencies{})
	if err != nil {
		t.Fatalf("NewWithDependencies: %v", err)
	}
	ep, err := f.Endpoint(context.Background())
	if err != nil {
		t.Fatalf("Endpoint: %v", err)
	}
	if ep.TokenConfigured {
		t.Fatalf("expected TokenConfigured=false when no state file present")
	}
	if !strings.Contains(ep.URL, ":18789") {
		t.Fatalf("URL = %q, expected default port 18789", ep.URL)
	}
}

func TestFacade_LegacyEnvWarningFiresOnceAtConstruction(t *testing.T) {
	resetLegacyEnvWarnState(t)
	buf := &bytes.Buffer{}
	deps := Dependencies{
		InheritEnv: []string{"RUNTIME_BUNDLED_TOKEN=ignored-legacy", "RUNTIME_MODE=local"},
		LegacyEnvWarnSink: buf,
	}
	cfg := &envconf.RuntimeBundledConfig{StateDir: t.TempDir()}
	if _, err := NewWithDependencies(cfg, deps); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(buf.String(), "RUNTIME_BUNDLED_TOKEN") {
		t.Fatalf("expected single deprecation warning; got %q", buf.String())
	}
	if _, err := NewWithDependencies(cfg, deps); err != nil {
		t.Fatal(err)
	}
	if strings.Count(buf.String(), "RUNTIME_BUNDLED_TOKEN") != 1 {
		t.Fatalf("warning fired more than once across two Facade constructions: %q", buf.String())
	}
}
```

- [ ] **Step 2: Run, verify fail**

```bash
cd deck-go/backend && go test ./internal/runtime/bundled/ -run "TestFacade_SourcesTokenAndPortFromStateReader|TestFacade_FallsBackToDefaultsWhenStateFileMissing|TestFacade_LegacyEnvWarningFiresOnceAtConstruction" -count=1
# Expected: compile failure — RuntimeBundledConfig.StateDir does not exist; Dependencies.LegacyEnvWarnSink does not exist; Facade does not use openclawstate.
```

- [ ] **Step 3: Wire the reader into Facade**

In `deck-go/backend/internal/runtime/envconf/envconf.go`, add a `StateDir` field to `RuntimeBundledConfig` (kept under the legacy struct name until Phase E2 renames it):

```go
type RuntimeBundledConfig struct {
	Command    string
	Args       []string
	WorkingDir string
	BindHost   string // DEPRECATED: read from openclawstate.Reader; Phase E2 removes this field
	BindPort   int    // DEPRECATED: same
	Token      string // DEPRECATED: same
	AutoStart  bool
	Env        map[string]string
	EnvDeny    []string
	StateDir   string // NEW: $OPENCLAW_STATE_DIR; consumed by openclawstate.Reader
}
```

Add the env load:

```go
func loadBundled(env map[string]string) (RuntimeBundledConfig, error) {
	// ... existing logic loading Command/Args/etc ...
	cfg.StateDir = strings.TrimSpace(env["OPENCLAW_STATE_DIR"])
	return cfg, nil
}
```

In `deck-go/backend/internal/runtime/bundled/facade.go`:

```go
import (
	"io"
	"os"
	// ... existing imports ...
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/openclawstate"
)

type Dependencies struct {
	ResolveOpts        ResolveOptions
	EntrypointOverride string
	ServiceName        string
	Probe              *LifecycleProbe
	ProxyExec          ExecRunner
	InheritEnv         []string
	// LegacyEnvWarnSink lets callers (mostly tests) capture the stderr
	// deprecation warning. Defaults to os.Stderr when nil.
	LegacyEnvWarnSink io.Writer
	// LegacyBundledKeysFromEnvconf is forwarded from envconf.Loaded.LegacyBundledKeys
	// so that legacy RUNTIME_BUNDLED_* keys observed only in dotenv (not in
	// process env / InheritEnv) still fire the deprecation warning.
	LegacyBundledKeysFromEnvconf []string
}

type Facade struct {
	cfg                   envconf.RuntimeBundledConfig
	stateReader           *openclawstate.Reader
	entrypointPath        string
	entrypointResolveErr  error
	serviceName           string
	probe                 *LifecycleProbe
	proxy                 *LifecycleProxy
	newClient             func(shared.Endpoint) *shared.Client
	lastResolvedRepoRoot  string
	lastEntrypointAttempt string
}

func NewWithDependencies(cfg *envconf.RuntimeBundledConfig, deps Dependencies) (*Facade, error) {
	if cfg == nil {
		return nil, errors.New("bundled runtime config is required")
	}
	// Emit legacy env warning once if InheritEnv contains any RUNTIME_BUNDLED_* key.
	sink := deps.LegacyEnvWarnSink
	if sink == nil {
		sink = os.Stderr
	}
	WarnLegacyEnvVarsOnce(sink, inheritEnvAsMap(deps.InheritEnv), deps.LegacyBundledKeysFromEnvconf)

	// ... existing entrypoint resolution unchanged ...

	return &Facade{
		cfg:                   *cfg,
		stateReader:           openclawstate.NewReader(cfg.StateDir),
		// ... existing fields ...
	}, nil
}

func inheritEnvAsMap(env []string) map[string]string {
	out := make(map[string]string, len(env))
	for _, kv := range env {
		idx := strings.IndexByte(kv, '=')
		if idx <= 0 {
			continue
		}
		out[kv[:idx]] = kv[idx+1:]
	}
	return out
}
```

Replace the helper that built the loopback URL:

```go
// gatewayLoopbackEndpoint returns the URL deck-go probes against, plus the
// configured token (empty when state file or auth.mode != token). It prefers
// $OPENCLAW_STATE_DIR/openclaw.json; on read failure (ErrStateDirNotSet /
// ErrStateFileNotFound) it falls back to the loopback default 18789 / "".
//
// The env map (captured from deps.InheritEnv at Facade construction time, see
// f.env field below) supplies SecretInput template / SecretRef.source=env /
// OPENCLAW_GATEWAY_TOKEN fallback values.
func (f *Facade) gatewayLoopbackEndpoint() (string, string) {
	state, err := f.stateReader.Load(f.env)
	if err == nil {
		port := state.ResolvePort()
		return fmt.Sprintf("ws://%s:%d", state.ResolveLoopbackHost(), port), state.Token
	}
	// Fallback default — used during bootstrap before the Gateway first writes
	// its state file. The Facade reports TokenConfigured=false in this state,
	// which is correct.
	return "ws://127.0.0.1:18789", ""
}
```

Add an `env map[string]string` field to the `Facade` struct + populate it in `NewWithDependencies` from `inheritEnvAsMap(deps.InheritEnv)`:

```go
type Facade struct {
	cfg                   envconf.RuntimeBundledConfig
	stateReader           *openclawstate.Reader
	env                   map[string]string // captured from deps.InheritEnv; passed to stateReader.Load
	// ... existing fields ...
}

// In NewWithDependencies, before constructing &Facade{...}:
envMap := inheritEnvAsMap(deps.InheritEnv)
WarnLegacyEnvVarsOnce(sink, envMap, deps.LegacyBundledKeysFromEnvconf)

return &Facade{
	cfg:         *cfg,
	stateReader: openclawstate.NewReader(cfg.StateDir),
	env:         envMap,
	// ... existing fields ...
}, nil
```

**Health probe rewire (CRITICAL):** The current `NewWithDependencies` (deck-go/backend/internal/runtime/bundled/facade.go:83-92) pre-builds `GatewayHealthClient{URL: bundledEndpointURL(*cfg), Token: cfg.Token}` once at construction. After Phase 0.3, that URL/Token must resolve dynamically per probe (the state file may change between probes; the initial value is empty during bootstrap). Refactor `GatewayHealthClient` from a `{URL, Token}` struct to a `{Resolve func() (url, token string)}` struct:

In `deck-go/backend/internal/runtime/bundled/probe.go` (around line 126):

```go
// GatewayHealthClient probes the Gateway's loopback health endpoint. URL and
// token are resolved on each Health() call so the state-file source (per
// runtime/openclawstate.Reader) is reflected immediately without rebuilding
// the probe.
type GatewayHealthClient struct {
	Resolve func() (url, token string)
}

func (c *GatewayHealthClient) Health(ctx context.Context) error {
	if c == nil || c.Resolve == nil {
		return ErrHealthProbeNotOK
	}
	url, token := c.Resolve()
	if strings.TrimSpace(url) == "" {
		return ErrHealthProbeNotOK
	}
	if err := gateway.ProbeHealth(ctx, url, token); err != nil {
		return classifyHealthProbeError(err)
	}
	return nil
}
```

In `NewWithDependencies`, defer Health construction until the `Facade` instance exists so the resolver closes over `managed.gatewayLoopbackEndpoint`:

```go
managed := &Facade{
	cfg:                   *cfg,
	stateReader:           openclawstate.NewReader(cfg.StateDir),
	env:                   inheritEnvAsMap(deps.InheritEnv),
	entrypointPath:        entrypointPath,
	entrypointResolveErr:  resolveErr,
	serviceName:           serviceName,
	proxy:                 proxy,
	newClient:             shared.NewClient,
	lastResolvedRepoRoot:  repoRoot,
	lastEntrypointAttempt: entrypointPath,
}
if deps.Probe != nil {
	managed.probe = deps.Probe
} else {
	managed.probe = &LifecycleProbe{
		Service: &CLIServiceQuerier{Proxy: proxy},
		Health: &GatewayHealthClient{
			Resolve: managed.gatewayLoopbackEndpoint,
		},
	}
}
WarnLegacyEnvVarsOnce(sink, managed.env, deps.LegacyBundledKeysFromEnvconf)
return managed, nil
```

Delete the helper `bundledEndpointURL(cfg envconf.RuntimeBundledConfig) string` once no caller references it.

**New regression tests** (append to `facade_test.go`):

```go
func TestFacade_HealthProbeReadsStateTokenAndPort(t *testing.T) {
	resetLegacyEnvWarnState(t)
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "openclaw.json"), []byte(`{
		"gateway":{"port":18901,"auth":{"mode":"token","token":"state-tok"}}
	}`), 0o600); err != nil {
		t.Fatal(err)
	}
	probedURL, probedToken := "", ""
	cfg := &envconf.RuntimeBundledConfig{StateDir: dir}
	deps := Dependencies{
		Probe: &LifecycleProbe{
			Service: stubServiceQuerier{state: StateRunning},
			Health: &GatewayHealthClient{
				Resolve: func() (string, string) {
					// We can't directly call f.gatewayLoopbackEndpoint here because
					// the Facade isn't built yet; this stub asserts the Resolve
					// closure pattern works once we wire it from Facade construction.
					return "ws://127.0.0.1:18901", "state-tok"
				},
			},
		},
	}
	deps.Probe.Health.(*GatewayHealthClient).Resolve = func() (string, string) {
		// pretend we ARE the Facade resolver
		state, _ := openclawstate.NewReader(dir).Load(nil)
		probedURL = fmt.Sprintf("ws://%s:%d", state.ResolveLoopbackHost(), state.ResolvePort())
		probedToken = state.Token
		return probedURL, probedToken
	}
	f, err := NewWithDependencies(cfg, deps)
	if err != nil {
		t.Fatal(err)
	}
	_, _ = f.RuntimeGatewayStatus(context.Background())
	if probedURL != "ws://127.0.0.1:18901" {
		t.Fatalf("Health.Resolve URL = %q, want loopback:18901", probedURL)
	}
	if probedToken != "state-tok" {
		t.Fatalf("Health.Resolve token = %q, want state-tok", probedToken)
	}
}

func TestFacade_DefaultHealthClientIsResolverDriven(t *testing.T) {
	// When deps.Probe is nil, NewWithDependencies must build a GatewayHealthClient
	// whose Resolve closes over the Facade's gatewayLoopbackEndpoint (NOT a
	// snapshot of cfg.Token / cfg.BindHost / cfg.BindPort taken at construction).
	resetLegacyEnvWarnState(t)
	dir := t.TempDir()
	cfg := &envconf.RuntimeBundledConfig{StateDir: dir}
	f, err := NewWithDependencies(cfg, Dependencies{})
	if err != nil {
		t.Fatal(err)
	}
	// Default state-less endpoint
	url1, token1 := f.gatewayLoopbackEndpoint()
	if url1 != "ws://127.0.0.1:18789" || token1 != "" {
		t.Fatalf("pre-state probe = (%q, %q), want loopback:18789, empty token", url1, token1)
	}
	// Write state file → resolver SHALL pick it up immediately
	if err := os.WriteFile(filepath.Join(dir, "openclaw.json"), []byte(`{
		"gateway":{"port":19002,"auth":{"token":"tok-2"}}
	}`), 0o600); err != nil {
		t.Fatal(err)
	}
	url2, token2 := f.gatewayLoopbackEndpoint()
	if url2 != "ws://127.0.0.1:19002" || token2 != "tok-2" {
		t.Fatalf("post-state probe = (%q, %q), want loopback:19002, tok-2", url2, token2)
	}
	_ = f.probe // probe field must exist after construction
}
```

Replace the four `f.cfg.Token` / `f.cfg.BindHost` / `f.cfg.BindPort` call sites (lines 122, 131, 168, 228 in current facade.go) to call `f.gatewayLoopbackEndpoint()` instead. For example, `Endpoint`:

```go
func (f *Facade) Endpoint(context.Context) (facade.EndpointView, error) {
	url, token := f.gatewayLoopbackEndpoint()
	return facade.EndpointView{
		URL:             url,
		TokenConfigured: strings.TrimSpace(token) != "",
		TLSVerify:       false,
		Source:          "openclaw-state",
	}, nil
}
```

`RuntimeGatewayStatus`, `GatewayConnection`, and `Request` are updated analogously. Delete the helper `bundledEndpointURL(cfg envconf.RuntimeBundledConfig) string`.

- [ ] **Step 4: Run, verify pass**

```bash
cd deck-go/backend && go test -race ./internal/runtime/bundled/ ./internal/runtime/openclawstate/ -count=1
# Expected: PASS, including all three new Facade tests + Phase 0.1/0.2 tests + existing Facade tests.
```

If existing Facade tests rely on the old `f.cfg.Token` / `f.cfg.BindHost` fields being authoritative (rather than the state reader), update them to seed a state file via `os.WriteFile(filepath.Join(cfg.StateDir, "openclaw.json"), ...)` instead.

- [ ] **Step 5: Commit**

```bash
cd /Users/wangym/workspace/agents/openclaw
scripts/committer "Source local-mode gateway endpoint from openclawstate.Reader

Stage 2 prerequisite: bundled.Facade now reads token / bind / port from
\$OPENCLAW_STATE_DIR/openclaw.json (via runtime/openclawstate.Reader)
instead of f.cfg.Token / BindHost / BindPort. When the state file is
missing, the facade falls back to loopback 18789 / empty token, which is
correct during pre-install bootstrap. Adds Dependencies.LegacyEnvWarnSink
so tests can capture the single-shot deprecation warning; production code
defaults to os.Stderr.

Constraint: f.cfg.Token / BindHost / BindPort fields are kept for now and
removed in Phase E2 so the same-PR test surface stays compilable.
Confidence: high
Scope-risk: medium (changes the runtime probe endpoint resolution; covered
by 3 new Facade tests + existing facade_test suite)
Tested: cd deck-go/backend && go test -race ./internal/runtime/bundled/ ./internal/runtime/openclawstate/ -count=1" \
  deck-go/backend/internal/runtime/bundled/facade.go \
  deck-go/backend/internal/runtime/bundled/facade_test.go \
  deck-go/backend/internal/runtime/envconf/envconf.go
```

---

## Phase A: Backend package rename `bundled/` → `local/`

### Task A1: Rename package + update imports + verify

**Files:**

- Renamed: `deck-go/backend/internal/runtime/bundled/` → `deck-go/backend/internal/runtime/local/` (all `.go` files, including the Phase 0.2 / 0.3 additions).
- Modified (package declaration): every file under `runtime/local/` (was `bundled/`) — declaration `package bundled` → `package local`.
- Modified (import path): all backend files that import `runtime/bundled` — list from `rg -l "runtime/bundled" deck-go/backend/internal` excluding the renamed directory itself (`controld/app.go`, `controld/app_test.go`, `runtime/facade/import_boundary_test.go`, `runtime/facade/build_test.go`, possibly more).

- [ ] **Step 1: Pre-check the import surface**

```bash
cd /Users/wangym/workspace/agents/openclaw
rg -l "runtime/bundled" deck-go/backend/internal | sort
# Expected: a finite list. Capture it.
rg -n "\\bbundled\\b" deck-go/backend/internal/controld deck-go/backend/internal/runtime/facade
# Expected: confirm uses are package qualifiers (`bundled.New`, `bundled.Facade`, …), not local variable names.
rg -n "\\blocal\\s*:=\\s*" deck-go/backend/internal/controld deck-go/backend/internal/runtime/facade
# Expected: empty (or document any local-shadowing var that the rename will collide with).
```

- [ ] **Step 2: Execute the rename**

```bash
cd /Users/wangym/workspace/agents/openclaw
git mv deck-go/backend/internal/runtime/bundled deck-go/backend/internal/runtime/local
# Rewrite package declaration in every moved .go file.
find deck-go/backend/internal/runtime/local -name "*.go" -print0 | xargs -0 sed -i '' 's/^package bundled$/package local/'
# Rewrite import paths in callers.
rg -l "runtime/bundled" deck-go/backend | xargs sed -i '' 's|openclaw/deck-go/backend/internal/runtime/bundled|openclaw/deck-go/backend/internal/runtime/local|g'
# Rewrite package qualifier `bundled.` → `local.` in callers.
rg -l "\\bbundled\\.[A-Z]" deck-go/backend/internal/controld deck-go/backend/internal/runtime/facade | xargs sed -i '' 's/\bbundled\./local./g'
```

If your `sed` does not accept the GNU-style `-i ''` form, drop the `''`. Test on a single file first.

- [ ] **Step 3: Verify build + tests**

```bash
cd deck-go/backend && go build ./...
# Expected: success.
go test -count=1 ./...
# Expected: all packages pass; in particular runtime/local, runtime/openclawstate, runtime/openclaw, controld, server, runtime/facade.
```

If `controld/app.go`'s import alias is `bundled "…/runtime/bundled"`, replace with `local "…/runtime/local"` and update call sites accordingly. Verify by inspecting `git diff deck-go/backend/internal/controld/app.go`.

- [ ] **Step 4: Sanity grep**

```bash
rg -n "runtime/bundled" deck-go/backend
# Expected: empty.
rg -n "package bundled" deck-go/backend
# Expected: empty.
```

- [ ] **Step 5: Commit**

```bash
cd /Users/wangym/workspace/agents/openclaw
scripts/committer "Rename runtime/bundled/ to runtime/local/

Stage 2 backend package rename. Textual change only: package declarations
swap bundled -> local; import paths swap accordingly; the package now
hosts only the shell-out lifecycle facade plus the Phase 0 state-reader
integration and the legacy-env warning helper. RUNTIME_MODE value flip
happens in Phase B; this commit does not change runtime behavior.

Constraint: Phase A is purely textual. Mode value still emits 'bundled' at
the wire.
Confidence: high
Scope-risk: medium (every backend caller of bundled.* updated; covered by
go build ./... and go test ./... -count=1)
Tested: cd deck-go/backend && go build ./... && go test -count=1 ./..." \
  $(git diff --name-only --diff-filter=ADMR HEAD)
```

(Use `git diff --name-only --diff-filter=ADMR HEAD` to enumerate touched files automatically. Verify the list with `git status` before invoking the committer.)

---

## Phase B: Backend mode value flip

### Task B1: envconf adds `ModeLocal`, accepts only `local|remote`, rejects `bundled` fatally

**Files:**

- Modify: `deck-go/backend/internal/runtime/envconf/envconf.go`
- Modify: `deck-go/backend/internal/runtime/envconf/envconf_test.go`

**Why atomic:** spec.md `runtime-mode-dispatch` Scenario 1 + tasks.md 3.1.3 require `RUNTIME_MODE=bundled` to fail-fast with exit-64 (no deprecation window). Splitting "accept local" and "reject bundled" into two commits would leave an interim state where `bundled` is silently aliased to `local`, contradicting the spec. Land both in a single envconf commit. (The Phase 0 helper `WarnLegacyEnvVarsOnce` covers the `RUNTIME_BUNDLED_*` _value-key_ keys — that's distinct from the `RUNTIME_MODE=bundled` _mode-string_ rejection here.)

- [ ] **Step 1: Write the failing tests**

Add to `deck-go/backend/internal/runtime/envconf/envconf_test.go` (using the real `Load(Options{Environ: []string{...}})` signature):

```go
func TestLoad_RuntimeModeLocal_Accepted(t *testing.T) {
	loaded, err := Load(Options{Environ: []string{
		"RUNTIME_MODE=local",
		"OPENCLAW_STATE_DIR=/tmp/oc-state",
	}})
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if loaded.Mode != ModeLocal {
		t.Fatalf("Mode = %q, want %q", loaded.Mode, ModeLocal)
	}
}

func TestLoad_RuntimeModeBundled_RejectedWithMigrationMessage(t *testing.T) {
	_, err := Load(Options{Environ: []string{"RUNTIME_MODE=bundled"}})
	if err == nil {
		t.Fatal("expected fatal error for RUNTIME_MODE=bundled")
	}
	msg := err.Error()
	if !strings.Contains(msg, "RUNTIME_MODE=bundled is no longer supported") {
		t.Fatalf("error should explain the migration: %v", err)
	}
	if !strings.Contains(msg, "RUNTIME_MODE=local") {
		t.Fatalf("error should name the replacement value: %v", err)
	}
	var usage *UsageError
	if !errors.As(err, &usage) {
		t.Fatalf("error should be a UsageError so cmd/main can exit 64: %v", err)
	}
}

func TestLoad_RuntimeModeUnknown_StillRejected(t *testing.T) {
	_, err := Load(Options{Environ: []string{"RUNTIME_MODE=blah"}})
	if err == nil {
		t.Fatal("expected error for unknown mode")
	}
	if !strings.Contains(err.Error(), "local") || !strings.Contains(err.Error(), "remote") {
		t.Fatalf("error should name local/remote: %v", err)
	}
}
```

(If `UsageError` is the existing envconf error type that `cmd/main` maps to exit-64, use it; the existing `usageErrorf` helper in envconf.go produces it. Substitute the exported name if it differs.)

- [ ] **Step 2: Run, verify fail**

```bash
cd deck-go/backend && go test ./internal/runtime/envconf/ -run "TestLoad_RuntimeMode(Local|Bundled|Unknown)" -count=1
# Expected: compile failure or test failure — ModeLocal does not exist; bundled is currently accepted; the migration message does not exist.
```

- [ ] **Step 3: Implement**

In `envconf.go`, add the constant and the rejection:

```go
const (
	ModeLocal  RuntimeMode = "local"
	ModeRemote RuntimeMode = "remote"
)

// ModeBundled is REMOVED. RUNTIME_MODE=bundled is rejected with usageErrorf
// (exit-64 via cmd/main).

func Load(opts Options) (Loaded, error) {
	env := envMap(opts.Environ)
	if opts.Environ == nil {
		env = envMap(os.Environ())
	}
	// ... existing dotenv merge / Logf wiring ...

	mode := RuntimeMode(strings.TrimSpace(env["RUNTIME_MODE"]))
	switch mode {
	case "":
		return Loaded{}, usageErrorf("RUNTIME_MODE is required; expected local or remote; see deck-go/.env.local.example or deck-go/.env.remote.example")
	case "bundled":
		return Loaded{}, usageErrorf("RUNTIME_MODE=bundled is no longer supported; set RUNTIME_MODE=local. See deck-go/.env.local.example. (See gateway-launcher-rewrite OpenSpec change for migration details.)")
	case ModeLocal, ModeRemote:
		// accepted
	default:
		return Loaded{}, usageErrorf("RUNTIME_MODE must be one of %q or %q, got %q", ModeLocal, ModeRemote, mode)
	}
	// ... existing loadLocal / loadRemote dispatch ...
}
```

(`loadBundled` is renamed to `loadLocal` here; the rename ripples into Phase E2's `RuntimeBundledConfig` → `RuntimeLocalConfig` rename. In this B1 commit, you may either rename the internal function now or defer; pick one and keep it consistent.)

- [ ] **Step 4: Run, verify pass**

```bash
cd deck-go/backend && go test ./internal/runtime/envconf/ -count=1
# Expected: PASS for the three new tests.
go test ./... -count=1
# Expected: any test fixture still using "RUNTIME_MODE=bundled" hard-fails. Flip those fixtures to "RUNTIME_MODE=local" in the SAME commit.
```

Grep for stragglers:

```bash
cd deck-go && rg -n 'RUNTIME_MODE=bundled' backend test
# Expected: empty after the fixture migration.
```

- [ ] **Step 5: Commit**

```bash
cd /Users/wangym/workspace/agents/openclaw
scripts/committer "envconf accepts local + rejects bundled atomically

Adds envconf.ModeLocal; RUNTIME_MODE=local is the only legal local-mode
value. RUNTIME_MODE=bundled is rejected with a UsageError so cmd/main
exits 64, per spec.md runtime-mode-dispatch Scenario 1. All test fixtures
that previously set RUNTIME_MODE=bundled are flipped to local in the same
commit so the backend test suite stays green.

The Phase 0.2 single-shot warning covers the *legacy value keys*
(RUNTIME_BUNDLED_TOKEN / _BIND_HOST / etc) which are ignored, not fatal.
That is distinct from RUNTIME_MODE=bundled which is fatal here.

Constraint: This commit MUST land atomically — there is no transition
window in which 'bundled' is accepted.
Confidence: high
Scope-risk: medium (every test fixture pinning bundled needs migration in
the same commit; covered by go test ./... and the new rejection test)
Tested: cd deck-go/backend && go test -count=1 ./..." \
  deck-go/backend/internal/runtime/envconf/envconf.go \
  deck-go/backend/internal/runtime/envconf/envconf_test.go
```

---

### Task B2: Local Facade emits mode `"local"` instead of `"bundled"`

**Files:**

- Modify: `deck-go/backend/internal/runtime/local/facade.go` (the `Mode:` field assignments inside `Capabilities` + `RuntimeGatewayStatus`)
- Modify: `deck-go/backend/internal/runtime/local/facade_test.go` (assertions that check the emitted mode value)

- [ ] **Step 1: Write the failing test**

Add to `deck-go/backend/internal/runtime/local/facade_test.go`:

```go
func TestFacade_CapabilitiesEmitLocalMode(t *testing.T) {
	resetLegacyEnvWarnState(t)
	cfg := &envconf.RuntimeLocalConfig{StateDir: t.TempDir()}
	// NOTE: Phase E2 renames RuntimeBundledConfig -> RuntimeLocalConfig. For
	// Phase B2, use the existing RuntimeBundledConfig name; flip both the test
	// and the call site to RuntimeLocalConfig in Task E2.
	f, err := NewWithDependencies(cfg, Dependencies{})
	if err != nil {
		t.Fatal(err)
	}
	caps, err := f.Capabilities(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if caps.Mode != string(envconf.ModeLocal) {
		t.Fatalf("Capabilities().Mode = %q, want %q", caps.Mode, envconf.ModeLocal)
	}
}

func TestFacade_RuntimeGatewayStatusEmitsLocalMode(t *testing.T) {
	resetLegacyEnvWarnState(t)
	cfg := &envconf.RuntimeLocalConfig{StateDir: t.TempDir()}
	f, _ := NewWithDependencies(cfg, Dependencies{})
	status, err := f.RuntimeGatewayStatus(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if status.Mode != string(envconf.ModeLocal) {
		t.Fatalf("RuntimeStatus.Mode = %q, want %q", status.Mode, envconf.ModeLocal)
	}
}
```

If you have not yet renamed `RuntimeBundledConfig` (the rename lands in Phase E2), use `RuntimeBundledConfig` instead. Adjust again in E2.

- [ ] **Step 2: Run, verify fail**

```bash
cd deck-go/backend && go test ./internal/runtime/local/ -run "TestFacade_(Capabilities|RuntimeGatewayStatus)EmitLocalMode" -count=1
# Expected: FAIL — current facade.go still passes envconf.ModeBundled as the Mode string.
```

- [ ] **Step 3: Flip the mode field assignments**

In `deck-go/backend/internal/runtime/local/facade.go`:

```go
func (f *Facade) Capabilities(ctx context.Context) (facade.Capabilities, error) {
	status, err := f.RuntimeGatewayStatus(ctx)
	if err != nil {
		return facade.Capabilities{}, err
	}
	return facade.Capabilities{
		Mode:            string(envconf.ModeLocal), // was ModeBundled
		Configured:      status.LifecycleState == string(StateRunning),
		EndpointMutable: false,
		SupervisorState: true,
	}, nil
}

func (f *Facade) RuntimeGatewayStatus(ctx context.Context) (facade.RuntimeStatus, error) {
	// ... existing probe logic ...
	status := facade.RuntimeStatus{
		Mode:           string(envconf.ModeLocal), // was ModeBundled
		// ... other fields unchanged ...
	}
	// ...
	return status, nil
}
```

- [ ] **Step 4: Run, verify pass**

```bash
cd deck-go/backend && go test ./internal/runtime/local/ -count=1
# Expected: PASS, including the two new emit-mode tests.
go test ./... -count=1
# Expected: backend-wide PASS. If any test fixture in server/controld asserts
# Mode == "bundled", flip it to "local" in the same commit.
```

- [ ] **Step 5: Commit**

```bash
cd /Users/wangym/workspace/agents/openclaw
scripts/committer "Local facade emits Mode=\"local\"

Capabilities.Mode and RuntimeStatus.Mode now return envconf.ModeLocal
('local') instead of envconf.ModeBundled ('bundled'). This is the
runtime-side half of the Stage 2 rename; the contract enum change lands in
Phase C.

Constraint: envconf still accepts RUNTIME_MODE=bundled as a deprecated
alias (normalized to ModeLocal). Phase E1 flips that to fatal exit-64.
Confidence: high
Scope-risk: medium (any test fixture or call site comparing
caps.Mode == 'bundled' must flip to 'local')
Tested: cd deck-go/backend && go test ./... -count=1" \
  deck-go/backend/internal/runtime/local/facade.go \
  deck-go/backend/internal/runtime/local/facade_test.go
```

---

### Task B3: Flip all backend `caps.Mode == "bundled"` and `Mode: "bundled"` call sites

**Files:**

- Modify: every backend file that compares `caps.Mode == "bundled"` or assigns `Mode: "bundled"` in a literal.

Discovery:

```bash
cd /Users/wangym/workspace/agents/openclaw
rg -n '"bundled"' deck-go/backend/internal | rg -v "_test\\.go|legacy_env_warn\\.go|envconf\\.go"
# Capture the list; expected hits: server/runtime.go, controld/app.go, possibly server/server.go.
rg -n '"bundled"' deck-go/backend/internal | rg "_test\\.go"
# Capture the test-side list separately.
```

- [ ] **Step 1: Write the failing test**

Pick one representative call site (e.g. `server/runtime.go` `caps.Mode == "bundled"`) and add a regression test verifying the new behavior. Example, append to `server/runtime_facade_test.go`:

```go
func TestRuntimeRoute_TreatsLocalModeAsSupervisorState(t *testing.T) {
	resetLegacyEnvWarnState(t)
	stub := testfacade.New(facade.Capabilities{Mode: "local", Configured: true, SupervisorState: true})
	stub.StatusValue = facade.RuntimeStatus{Mode: "local", Configured: true, Status: "running", Health: "healthy"}
	bus := events.NewBus(8)
	managed := openclawrt.NewManagedRuntimeWithFacade(newFacadeRuntimeStore(t), stub, bus)
	srv := httptest.NewServer(NewRootHandlerWithRuntimeFacade(newFacadeRuntimeStore(t), managed, stub))
	defer srv.Close()
	res, err := http.Get(srv.URL + "/api/runtime/gateway")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200; the local-mode handler must not short-circuit on configured=false", res.StatusCode)
	}
	body, _ := io.ReadAll(res.Body)
	if !strings.Contains(string(body), `"mode":"local"`) {
		t.Fatalf("payload should report mode=local; got %s", string(body))
	}
}
```

- [ ] **Step 2: Run, verify fail**

```bash
cd deck-go/backend && go test ./internal/server/ -run TestRuntimeRoute_TreatsLocalModeAsSupervisorState -count=1
# Expected: FAIL — server/runtime.go still branches on caps.Mode == "bundled" (or on the legacy literal) and treats "local" as the "default + 503" branch.
```

- [ ] **Step 3: Flip the literals**

Apply a uniform sed across the backend (excluding the legacy*env_warn helper that intentionally lists `RUNTIME_BUNDLED*\*` strings):

```bash
cd deck-go/backend
rg -l '"bundled"' ./internal | rg -v "legacy_env_warn\\.go|envconf\\.go" | xargs sed -i '' 's/"bundled"/"local"/g'
```

Inspect every diff line: if a comparison like `caps.Mode == "local"` belongs in remote-only branches, flip the comparison sense (`!= "remote"` is mode-agnostic).

For `envconf.go`, do not flip `"bundled"` to `"local"` — the deprecation alias and migration warning string need the literal `bundled`. Re-add manually if the sweep over-flipped.

- [ ] **Step 4: Run, verify pass**

```bash
cd deck-go/backend && go test -count=1 ./...
# Expected: PASS.
```

- [ ] **Step 5: Commit**

```bash
cd /Users/wangym/workspace/agents/openclaw
scripts/committer "Flip backend mode literals from bundled to local

server/, controld/, and shared test fixtures now compare and assign
Mode='local' instead of Mode='bundled'. envconf retains the literal
'bundled' only inside the migration-error message (per Phase B1's atomic
rejection); the legacy_env_warn helper also lists RUNTIME_BUNDLED_* keys
as part of the deprecation warning string.

Constraint: caller branches on mode-string remain mode-aware only where
they SHOULD be (Rule R2 carve-out for operations surface); business-surface
branches stay mode-agnostic.
Confidence: medium-high (sed sweep; manual diff review required)
Scope-risk: medium (every branch comparing mode-string flipped together;
covered by go test ./... and the new regression test)
Tested: cd deck-go/backend && go test -count=1 ./..." \
  $(git diff --name-only --diff-filter=ADM HEAD)
```

---

## Phase C: Contract chain

### Task C1: Update `deck-api.contract.ts` enum + sync TS + Go DTOs

**Files:**

- Modify: `deck-go/contracts/source/deck-api.contract.ts` (lines 59, 83, 121 per tasks.md 3.2.1; verify with grep).
- Auto-regenerated: `deck-go/contracts/generated/ts/**`, `deck-go/backend/internal/gateway/generated/**`, `deck-go/contracts/generated/go/**` (via `make contracts-sync`).

- [ ] **Step 1: Pre-grep contract sites**

```bash
cd /Users/wangym/workspace/agents/openclaw
rg -n '"bundled"' deck-go/contracts/source/deck-api.contract.ts
# Expected hits: line 59 (`mode?: "bundled" | "remote"`), line 83 (`mode: "bundled"`), line 121 (`mode: "bundled" | "remote"`).
```

- [ ] **Step 2: Edit the contract source**

Replace every `"bundled"` literal on those lines with `"local"`. Example:

```ts
// line 59 — before
mode?: "bundled" | "remote";
// line 59 — after
mode?: "local" | "remote";

// line 83 — before
mode: "bundled";
// line 83 — after
mode: "local";

// line 121 — before
mode: "bundled" | "remote";
// line 121 — after
mode: "local" | "remote";
```

If the file has additional `"bundled"` hits, flip them only when they refer to `Capabilities.mode` / `RuntimeGatewayStatus.mode`. Type names referencing the literal `Bundled` (e.g. `DeckGoRuntimeBundledGatewayStatus`) are deferred — the type rename is a separate refactor.

- [ ] **Step 3: Regenerate TS + Go DTOs**

```bash
cd /Users/wangym/workspace/agents/openclaw/deck-go
make contracts-sync
# Expected: regenerates ./contracts/generated/ts/... and backend/internal/gateway/generated/... ; updates .sha256 files.
```

- [ ] **Step 4: Verify**

```bash
cd /Users/wangym/workspace/agents/openclaw/deck-go
make contracts-check
# Expected: pass.
go -C backend test ./... -count=1
# Expected: PASS — the regenerated Go DTO now has `mode: "local"` and existing backend mode strings already match.
```

- [ ] **Step 5: Commit**

```bash
cd /Users/wangym/workspace/agents/openclaw
scripts/committer "Flip Capabilities.mode contract enum from bundled to local

deck-api.contract.ts Capabilities.mode and RuntimeBundledGatewayStatus.mode
literal flip; regenerated TS DTOs (deck-go/contracts/generated/ts/) and Go
DTOs (deck-go/backend/internal/gateway/generated/). Type name
DeckGoRuntimeBundledGatewayStatus is preserved (its rename is out of scope
for this change).

Confidence: high
Scope-risk: medium (contract enum flip; downstream frontend type guards
must align in Phase D within the same PR)
Tested: cd deck-go && make contracts-check && go -C backend test ./... -count=1" \
  $(git diff --name-only --diff-filter=ADM HEAD)
```

---

### Task C2: Regenerate Gateway protocol artifacts + contract gate

**Files:**

- Auto-regenerated by `make protocol-update`: `deck-go/contracts/generated/ts/gateway/**`, `deck-go/backend/internal/gateway/generated/**`.

- [ ] **Step 1: Run protocol update**

```bash
cd /Users/wangym/workspace/agents/openclaw/deck-go
make protocol-update
# Expected: regenerates Gateway protocol artifacts; updates .sha256 files.
```

- [ ] **Step 2: Run protocol check**

```bash
cd /Users/wangym/workspace/agents/openclaw/deck-go
make protocol-check
# Expected: pass.
```

- [ ] **Step 3: Run the full contract gate**

```bash
cd /Users/wangym/workspace/agents/openclaw/deck-go
make contract-gate
# Expected: pass; no drift between source contracts and generated artifacts.
```

- [ ] **Step 4: Run backend test sweep**

```bash
cd /Users/wangym/workspace/agents/openclaw/deck-go/backend && go test -count=1 ./...
# Expected: PASS.
```

- [ ] **Step 5: Commit**

```bash
cd /Users/wangym/workspace/agents/openclaw
scripts/committer "Regenerate Gateway protocol artifacts after enum flip

Stage 2 contract chain: make protocol-update regenerates the TS + Go
Gateway protocol shapes after the Capabilities.mode enum flip in C1; make
contract-gate confirms zero drift.

Confidence: high
Scope-risk: low (mechanical artifact regeneration; reviewed via .sha256)
Tested: cd deck-go && make protocol-check && make contract-gate && go -C backend test ./... -count=1" \
  $(git diff --name-only --diff-filter=ADM HEAD)
```

---

## Phase D: Frontend rename

### Task D1: `api.ts` type guards + internal strings + i18n + UI rename

**Files:**

- Modify: `deck-go/frontend-new/src/api.ts` (lines 568–583 `isBundledRuntimeStatus`; line ~620 `mode: "bundled"` default in `normalizeRuntimeGatewayStatus`).
- Modify: `deck-go/frontend-new/src/components/panels/gateway/GatewayPanel.tsx` (line 10 import; line 499 / 501 `isBundledRuntimeStatus` call; lines 499/716/1499/1545/1548/1552/1556/1581/1582 `bundledRuntime` local-variable / prop / destructure / field reads — rename to `localRuntime`; line 1529 i18n key `runtime.bundledState` → `runtime.localState`).
- Modify: `deck-go/frontend-new/src/components/panels/gateway/GatewayPanel.test.tsx` (lines 18–21 mock + assertions).
- Modify: `deck-go/frontend-new/src/components/runtime/ModeBadge.tsx` (`data-state="bundled"` → `data-state="local"` + visible copy).
- Modify: `deck-go/frontend-new/src/i18n/en.json` (line 872 `bundledState: "Bundled supervisor"` → `localState: "Local supervisor"`).
- Modify: `deck-go/frontend-new/src/i18n/zh.json` (line 872 `bundledState: "本机 supervisor"` → `localState: "本机 supervisor"`).
- Modify: any other frontend file containing `isBundledRuntimeStatus`, `bundledRuntime`, `mode === "bundled"`, or `runtime.bundledState`.

**Type-name preservation:** the generated DTO type `DeckGoBundledRuntimeGatewayStatus` (line 587 + 1512 of GatewayPanel.tsx) is left alone — it is sourced from `contracts/source/deck-api.contract.ts`'s `DeckGoRuntimeBundledGatewayStatus` interface, whose rename is out of scope for this plan (per Task C1 commit message). Renaming a generated type would cascade across protocol artifacts and is a separate refactor. The Stage 2 frontend rename touches only the runtime _function/variable names_ and the _string-literal mode value_.

- [ ] **Step 1: Write the failing test**

Add to `deck-go/frontend-new/src/api.test.ts` (create if missing):

```ts
import { describe, expect, test } from "vitest";
import { isLocalRuntimeStatus, isRemoteRuntimeStatus } from "./api";

describe("runtime status type guards", () => {
  test("isLocalRuntimeStatus matches mode='local'", () => {
    expect(isLocalRuntimeStatus({ mode: "local" })).toBe(true);
    expect(isLocalRuntimeStatus({ mode: "remote" })).toBe(false);
    expect(isLocalRuntimeStatus(null)).toBe(false);
  });

  test("isRemoteRuntimeStatus matches mode='remote'", () => {
    expect(isRemoteRuntimeStatus({ mode: "remote" })).toBe(true);
    expect(isRemoteRuntimeStatus({ mode: "local" })).toBe(false);
  });

  test("isBundledRuntimeStatus is no longer exported", () => {
    const api = require("./api");
    expect(api.isBundledRuntimeStatus).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
cd /Users/wangym/workspace/agents/openclaw/deck-go/frontend-new
npm run test:deck-ui -- api.test
# Expected: FAIL — isLocalRuntimeStatus does not exist; isBundledRuntimeStatus still exported.
```

- [ ] **Step 3: Rename in api.ts**

In `deck-go/frontend-new/src/api.ts`:

```ts
// line 568 — before
export function isBundledRuntimeStatus(
  runtime: DeckGoRuntimeGatewayStatus | null | undefined,
): runtime is DeckGoBundledRuntimeGatewayStatus {
  return runtime?.mode === "bundled";
}

// line 568 — after
export function isLocalRuntimeStatus(
  runtime: DeckGoRuntimeGatewayStatus | null | undefined,
): runtime is DeckGoBundledRuntimeGatewayStatus {
  return runtime?.mode === "local";
}
```

(The narrowed type `DeckGoBundledRuntimeGatewayStatus` stays — it's a generated DTO; only the function name and the literal mode value change.)

Around line 620 (`mode: "bundled"` default value in `normalizeRuntimeGatewayStatus`):

```ts
// before
mode: "bundled",
// after
mode: "local",
```

Around line 595 (`if (raw.mode === "remote")`) — no change unless there is a sibling `else if (raw.mode === "bundled")` branch; flip that to `"local"`.

- [ ] **Step 4: Rename callers + i18n + identifiers**

```bash
cd /Users/wangym/workspace/agents/openclaw/deck-go/frontend-new
# Function name rename
rg -l "isBundledRuntimeStatus" src | xargs sed -i '' 's/isBundledRuntimeStatus/isLocalRuntimeStatus/g'
# String-literal mode value (be careful: do NOT touch i18n keys containing "bundledState"; handled separately below)
rg -l '"bundled"' src | xargs sed -i '' 's/"bundled"/"local"/g'
# Variable / prop / destructure rename inside GatewayPanel.tsx
rg -l '\bbundledRuntime\b' src | xargs sed -i '' 's/\bbundledRuntime\b/localRuntime/g'
# i18n key rename (en + zh)
sed -i '' 's/"bundledState":/"localState":/' src/i18n/en.json src/i18n/zh.json
# i18n callsite rename inside GatewayPanel.tsx
rg -l 'runtime\.bundledState' src | xargs sed -i '' 's/runtime\.bundledState/runtime.localState/g'
# English copy: "Bundled supervisor" -> "Local supervisor" (zh is already "本机 supervisor")
sed -i '' 's/"Bundled supervisor"/"Local supervisor"/' src/i18n/en.json
```

Manual checks after the sed sweep:

- `ModeBadge.tsx`: confirm `data-state="local"` and the visible badge copy say "Local" not "Bundled".
- `GatewayPanel.tsx`: confirm the type annotation on line ~1512 still reads `DeckGoBundledRuntimeGatewayStatus` (generated DTO name preserved); only the variable name flipped.
- `i18n/zh.json`: confirm the value remains `"本机 supervisor"` (Chinese copy already says "local"; only the key flipped).

- [ ] **Step 5: Run tests + build, then commit**

```bash
cd /Users/wangym/workspace/agents/openclaw/deck-go/frontend-new
npm run test:deck-ui
# Expected: all pass.
npm run build
# Expected: TypeScript compiles; Vite builds.
```

```bash
cd /Users/wangym/workspace/agents/openclaw
scripts/committer "Rename frontend runtime status type guards to local

Frontend now reads mode='local' (matching the C1 enum flip). Renames
isBundledRuntimeStatus -> isLocalRuntimeStatus, flips internal 'bundled'
literals to 'local' (including ModeBadge data-state + copy), and updates
GatewayPanel + its tests. RuntimeBundledStatus type alias (if defined in
api.ts) is renamed to RuntimeLocalStatus; generated DTO type names are
unchanged.

Constraint: relies on Phase C contract regen having landed; verified via
npm run build + test:deck-ui.
Confidence: high
Scope-risk: medium (rename sweep across panel + test; covered by
test:deck-ui + build)
Tested: cd deck-go/frontend-new && npm run test:deck-ui && npm run build" \
  $(git diff --name-only --diff-filter=ADM HEAD)
```

---

## Phase E: Strip spawn-era envconf fields and rename `RuntimeBundledConfig`

### Task E1: ~~envconf rejects `RUNTIME_MODE=bundled`~~ — merged into Phase B1

The atomic-rejection requirement from spec.md `runtime-mode-dispatch` Scenario 1 ("exit 64 immediately") is satisfied by Phase B1 in the same commit that adds `ModeLocal`. There is no transitional window; B1 lands the rejection together with `ModeLocal`. Leave this task header as a tombstone so reviewers see the merge intent; no work in Phase E1.

---

### Task E2: Rename `RuntimeBundledConfig` → `RuntimeLocalConfig` and strip spawn-era fields

**Files:**

- Modify: `deck-go/backend/internal/runtime/envconf/envconf.go`
- Modify: `deck-go/backend/internal/runtime/local/facade.go`
- Modify: `deck-go/backend/internal/runtime/local/facade_test.go`
- Modify: every caller using `RuntimeBundledConfig` (controld/app.go, controld/app_test.go, server/server_test.go, runtime/facade/import_boundary_test.go, runtime/facade/build_test.go, etc.).

- [ ] **Step 1: Pre-grep affected files**

```bash
cd /Users/wangym/workspace/agents/openclaw
rg -l "RuntimeBundledConfig" deck-go/backend/internal
# Capture the list.
rg -n "f\\.cfg\\.(Token|BindHost|BindPort|Command|Args|WorkingDir|EnvDeny|Env\\b)" deck-go/backend/internal/runtime/local
# Expected: empty (Phase 0.3 removed Token/BindHost/BindPort reads; Command/Args/WorkingDir/Env/EnvDeny were spawn-era and unused after Stage 1).
```

If the grep above still has hits, do not proceed — there is a live reader of a soon-to-be-removed field. Update the reader to use a different source before continuing.

- [ ] **Step 2: Rewrite the struct**

In `envconf.go`:

```go
// RuntimeLocalConfig captures the local-mode runtime knobs the deck-go BFF
// consumes. Stage 2 replaces RuntimeBundledConfig; the spawn-era fields
// (Command / Args / WorkingDir / Env / EnvDeny / Token / BindHost / BindPort
// / AutoStart) are removed. Token / Bind / Port now come from
// $OPENCLAW_STATE_DIR/openclaw.json via runtime/openclawstate.Reader.
//
// NOTE: AutoStart was a spawn-era control knob (Stage 1's EnsureAutoStart path
// was removed by the F1 follow-up). The facade still emits an AutoStart field
// on RuntimeStatus for UI display only — its value is always false in this
// envconf shape. A future change (runtime-mode-switching) may re-introduce a
// boot-time autostart control with a clearly-defined trigger.
type RuntimeLocalConfig struct {
	StateDir string // $OPENCLAW_STATE_DIR; consumed by openclawstate.Reader
}

// RuntimeBundledConfig is removed.

type Loaded struct {
	Mode    RuntimeMode
	Local   RuntimeLocalConfig
	Remote  RuntimeRemoteConfig
}

func loadLocal(env map[string]string) (RuntimeLocalConfig, error) {
	return RuntimeLocalConfig{
		StateDir: strings.TrimSpace(env["OPENCLAW_STATE_DIR"]),
	}, nil
}

// loadBundled is removed; replaced by loadLocal.
```

In `Loaded`'s field, rename `Bundled` → `Local`. Update the dispatcher (`Load`) to call `loadLocal`. The previously-existing `RUNTIME_BUNDLED_AUTO_START` env key is covered by the Phase 0.2 single-shot deprecation warning helper (any setter sees one stderr message and the value is otherwise ignored — Stage 2 does NOT introduce a `RUNTIME_LOCAL_AUTO_START` replacement key; doing so would imply a boot-time autostart action that the deck-go BFF no longer performs).

Update every caller that referenced `RuntimeBundledConfig` / `loaded.Bundled` to `RuntimeLocalConfig` / `loaded.Local`. Bulk rename:

```bash
cd /Users/wangym/workspace/agents/openclaw
rg -l "RuntimeBundledConfig\\|loaded\\.Bundled\\|\\.Bundled\\b" deck-go/backend | xargs sed -i '' \
  -e 's/RuntimeBundledConfig/RuntimeLocalConfig/g' \
  -e 's/loaded\\.Bundled/loaded.Local/g'
```

In `runtime/local/facade.go`, the AutoStart field assignment becomes a constant `false`:

```go
status := facade.RuntimeStatus{
	Mode:           string(envconf.ModeLocal),
	// ... other fields ...
	AutoStart:      false, // Stage 2: deck-go does not drive boot autostart; field retained only for UI compatibility.
}
```

- [ ] **Step 3: Update Facade tests that previously seeded `cfg.AutoStart`**

Any `bundled.Facade` test that constructed `RuntimeBundledConfig{AutoStart: true, ...}` and asserted `status.AutoStart == true` (e.g. `TestBundledFacadeRuntimeGatewayStatusPropagatesAutoStart` added in Phase Z2 commit `354b312399`) is updated:

- Either drop the `AutoStart` assertion entirely (the field is now always `false` from local mode).
- Or, if AutoStart UI semantics matter for the future runtime-mode-switching change, document the deferral in the test (`t.Skip("AutoStart is statically false until runtime-mode-switching reintroduces boot autostart")`).

- [ ] **Step 4: Run, verify pass**

```bash
cd deck-go/backend && go build ./...
# Expected: success.
go test -race -count=1 ./...
# Expected: PASS.
```

If a test fixture still constructed `RuntimeBundledConfig{Token: ..., BindHost: ...}`, rewrite it to seed an `openclaw.json` via `os.WriteFile` (see Task 0.3's `TestFacade_SourcesTokenAndPortFromStateReader` for the pattern).

- [ ] **Step 5: Commit**

```bash
cd /Users/wangym/workspace/agents/openclaw
scripts/committer "Rename RuntimeBundledConfig to RuntimeLocalConfig and strip spawn-era fields

RuntimeLocalConfig holds only StateDir. Spawn-era fields (Command / Args
/ WorkingDir / Env / EnvDeny / Token / BindHost / BindPort / AutoStart)
are removed: Token / Bind / Port now flow from
\$OPENCLAW_STATE_DIR/openclaw.json via runtime/openclawstate.Reader (Phase
0); the rest were unused after Stage 1's spawn deletion. AutoStart is no
longer carried in envconf — Stage 2 does NOT introduce a RUNTIME_LOCAL_AUTO_START
key (per spec.md / tasks.md 3.1.4: 'strip RUNTIME_BUNDLED_* keys'); the
facade emits AutoStart=false as a UI-display stub until a future
runtime-mode-switching change redefines boot autostart semantics. The
Phase 0.2 helper covers any stale RUNTIME_BUNDLED_AUTO_START env setter
with a single-shot deprecation warning.

Confidence: high
Scope-risk: high (struct shape change ripples across controld + server +
facade tests; covered by go test -race ./... and the new Phase 0 tests)
Tested: cd deck-go/backend && go build ./... && go test -race -count=1 ./..." \
  $(git diff --name-only --diff-filter=ADM HEAD)
```

---

## Phase F: `.env` files, dev scripts, and docs rename

### Task F1: Rename `.env.bundled.example` → `.env.local.example` with new content

**Files:**

- Renamed (content rewritten): `deck-go/.env.bundled.example` → `deck-go/.env.local.example`.

- [ ] **Step 1: Rename + rewrite**

```bash
cd /Users/wangym/workspace/agents/openclaw
git mv deck-go/.env.bundled.example deck-go/.env.local.example
```

Replace the file body with (write via `cat <<EOF`, the engineer may copy verbatim):

```
# Local mode runs deck-go and an OpenClaw Gateway installed via the official CLI
# (`openclaw gateway install` + `start`). Copy to a private file, set mode 0600,
# then point DECK_DOTENV_FILE at it or source it before launching deck-go.

# deck-go HTTP listener. Keep loopback unless TLS is configured.
DECK_GO_ADDR=127.0.0.1:19566

# Local deck-go data root. deck-state.json is created here unless DECK_STATE_PATH overrides it.
DECK_GO_DATA_DIR=.local/deck-go-local/data

# Optional explicit deck-state path.
# DECK_STATE_PATH=.local/deck-go-local/data/deck-state.json

# Deck operator API token. Placeholder only; replace for real deployments.
DECK_GO_ACCESS_TOKEN=replace-with-dev-deck-token

# Runtime mode is fixed at process start.
RUNTIME_MODE=local

# OPENCLAW_STATE_DIR points at the Gateway's state directory. deck-go's local
# facade reads gateway.{port,bind,auth.{mode,token}} from $OPENCLAW_STATE_DIR/openclaw.json
# at boot and on every probe.
OPENCLAW_STATE_DIR=.local/deck-go-local/openclaw-state

# Uncomment to override the entrypoint resolver's repo-root tier:
# OPENCLAW_REPO_ROOT=/path/to/openclaw
```

Notes:

- `RUNTIME_BUNDLED_*` keys (including `RUNTIME_BUNDLED_AUTO_START`) are intentionally absent. Stage 2 does not introduce a `RUNTIME_LOCAL_AUTO_START` replacement — deck-go BFF no longer drives Gateway boot autostart; that lifecycle is owned by the OS service manager via `openclaw gateway install + start` (run from `scripts/dev/run-local.sh` or the equivalent production wrapper).
- `OPENCLAW_GATEWAY_TOKEN` can be set in this file when the Gateway state file declares a `${ENV}` template token or when local-mode probes should run unauthenticated until the Gateway first writes its state file. The local Facade applies it as a fallback per the openclawstate.Reader contract.

- [ ] **Step 2: Smoke check**

```bash
cd /Users/wangym/workspace/agents/openclaw
ls deck-go/.env.local.example
# Expected: file exists.
grep -E "RUNTIME_BUNDLED_" deck-go/.env.local.example
# Expected: empty.
```

- [ ] **Step 3: Commit**

```bash
cd /Users/wangym/workspace/agents/openclaw
scripts/committer ".env.bundled.example -> .env.local.example

Replaces the per-process spawn knobs (RUNTIME_BUNDLED_COMMAND / _ARGS /
_WORKDIR / _BIND_* / _TOKEN / _ENV_* / _AUTO_START) with OPENCLAW_STATE_DIR.
deck-go's local facade reads gateway.{port,bind,auth.token} from
\$OPENCLAW_STATE_DIR/openclaw.json (Phase 0). No RUNTIME_LOCAL_AUTO_START
replacement: deck-go BFF no longer drives Gateway boot autostart; the OS
service manager (via openclaw gateway install + start) owns that
lifecycle.

Confidence: high
Scope-risk: low (env example only; no code consumes the file directly)
Tested: not applicable (declarative)" \
  deck-go/.env.bundled.example deck-go/.env.local.example
```

(`scripts/committer` with both the old and new paths captures the rename properly even if git already detected it as M+D rather than R.)

---

### Task F2: Update `.env.real-stack.example` to drop `RUNTIME_BUNDLED_*`

**Files:**

- Modify: `deck-go/.env.real-stack.example`

- [ ] **Step 1: Pre-grep**

```bash
cd /Users/wangym/workspace/agents/openclaw
grep -E "RUNTIME_BUNDLED_|RUNTIME_MODE" deck-go/.env.real-stack.example
# Expected: a list of RUNTIME_BUNDLED_* lines + a RUNTIME_MODE=bundled (or already local) line.
```

- [ ] **Step 2: Rewrite**

Strip every `RUNTIME_BUNDLED_*` line. Flip `RUNTIME_MODE=bundled` to `RUNTIME_MODE=local`. Add an `OPENCLAW_STATE_DIR=` line pointing at the real-stack isolated dir. Example body to merge by hand:

```
RUNTIME_MODE=local
OPENCLAW_STATE_DIR=.local/deck-go-real-stack/isolated/data/managed-gateway-state
```

Preserve `DECK_GO_*` lines and any non-RUNTIME_BUNDLED env that was already there. Do NOT introduce `RUNTIME_LOCAL_AUTO_START` — see Phase 0 / E2 notes; boot autostart is owned by the OS service manager via `openclaw gateway install + start`.

- [ ] **Step 3: Smoke check**

```bash
cd /Users/wangym/workspace/agents/openclaw
grep -E "RUNTIME_BUNDLED_" deck-go/.env.real-stack.example
# Expected: empty.
grep -E "RUNTIME_MODE=local" deck-go/.env.real-stack.example
# Expected: exactly one hit.
```

- [ ] **Step 4: Commit**

```bash
cd /Users/wangym/workspace/agents/openclaw
scripts/committer "Update .env.real-stack.example for local mode

Drops RUNTIME_BUNDLED_COMMAND / _ARGS / _BIND_* / _TOKEN / _ENV_*. Adds
OPENCLAW_STATE_DIR pointing at the real-stack isolated state dir. Flips
RUNTIME_MODE to local.

Confidence: high
Scope-risk: low (env example; runtime config delivered by F3/F4 scripts)
Tested: not applicable (declarative)" \
  deck-go/.env.real-stack.example
```

---

### Task F3: Rename `run-bundled.sh` → `run-local.sh` with install/start invocation

**Files:**

- Renamed (content rewritten): `deck-go/scripts/dev/run-bundled.sh` → `deck-go/scripts/dev/run-local.sh`.

- [ ] **Step 1: Rename + inspect current script**

```bash
cd /Users/wangym/workspace/agents/openclaw
git mv deck-go/scripts/dev/run-bundled.sh deck-go/scripts/dev/run-local.sh
cat deck-go/scripts/dev/run-local.sh
# Capture current content for the reference rewrite below.
```

- [ ] **Step 2: Rewrite**

Replace the file body with:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Run deck-go BFF against a locally-installed OpenClaw Gateway service.
#
# Prereqs:
# - OPENCLAW_STATE_DIR points at a per-fork state dir (the Gateway service writes
#   openclaw.json here). State dir is passed to the CLI via env, not via a flag —
#   `openclaw gateway install/start/stop/restart` only support
#   --port / --runtime / --token / --force / --json (see
#   src/cli/daemon-cli/register-service-commands.ts:72).
# - OPENCLAW_REPO_ROOT either set explicitly or inferable from the script location
#   (the entrypoint resolver tries `dist/entry.js` under repo root).
#
# Stage 2 (gateway-launcher-rewrite): deck-go no longer spawns the Gateway. It
# installs + starts it via the official CLI and probes the loopback endpoint.

repo_root="${OPENCLAW_REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/..}"
state_dir="${OPENCLAW_STATE_DIR:-.local/deck-go-local/openclaw-state}"
mkdir -p "$state_dir"

# Install service (idempotent) and start it. CLI reads OPENCLAW_STATE_DIR from
# the environment; do NOT pass --state-dir (no such flag in upstream CLI).
export OPENCLAW_STATE_DIR="$state_dir"
node "$repo_root/dist/entry.js" gateway install || true
node "$repo_root/dist/entry.js" gateway start

# Launch deck-go BFF. cmd/deck-go (backend/cmd/deck-go/main.go) does NOT parse
# a --env-file flag; envconf reads DECK_DOTENV_FILE env. Use absolute paths so
# the script works regardless of $PWD.
export DECK_DOTENV_FILE="${DECK_DOTENV_FILE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.env.local.example}"
exec "${DECK_GO_BIN:-deck-go}"
```

Adjust the `node "$repo_root/dist/entry.js"` invocation if the canonical entrypoint differs in this repo. The script is a developer convenience — production deployments should still use systemd / launchd via `openclaw gateway install`.

- [ ] **Step 3: Permissions + smoke check**

```bash
cd /Users/wangym/workspace/agents/openclaw
chmod +x deck-go/scripts/dev/run-local.sh
bash -n deck-go/scripts/dev/run-local.sh
# Expected: bash -n parses cleanly (syntax-only).
```

- [ ] **Step 4: Commit**

```bash
cd /Users/wangym/workspace/agents/openclaw
scripts/committer "scripts/dev/run-bundled.sh -> run-local.sh

Calls openclaw gateway install + start (per design D9) before launching
the BFF. Reads OPENCLAW_STATE_DIR; falls back to .local/deck-go-local/openclaw-state.

Confidence: high
Scope-risk: low (developer convenience script)
Tested: bash -n deck-go/scripts/dev/run-local.sh" \
  deck-go/scripts/dev/run-bundled.sh deck-go/scripts/dev/run-local.sh
```

---

### Task F4: Full rewrite of `run-stack-real.sh` for local-mode lifecycle

**Files:**

- Modify: `deck-go/scripts/dev/run-stack-real.sh` (528 lines; 14+ RUNTIME*BUNDLED*\* references at lines 122-141, 151-154, 176-178, 230, 261, 331, 337, 425, 455-457 per current grep).

**Why this is not a local patch:** the current script enforces `RUNTIME_MODE=bundled` at line 122 (refuses to run otherwise), defaults nine `RUNTIME_BUNDLED_*` env vars at lines 126-141, exports them at lines 176-178, hits the loopback Gateway at `http://${RUNTIME_BUNDLED_BIND_HOST}:${RUNTIME_BUNDLED_BIND_PORT}` for readiness probes, clears the port via `${RUNTIME_BUNDLED_BIND_PORT}`, and asserts `"mode":"bundled"` + `"pid":` in the runtime payload at line 337 as the readiness gate. Stage 2's payload returns `"mode":"local"` and no `pid` (the F1 follow-up removed the spawn supervisor); each of those sites must migrate together or readiness checks will time out.

**Patch table** — each row is a localized change; apply all in one commit so the script stays runnable.

| Line(s)    | Before                                                                                                     | After                                                                                                                                                                                                                                                                                                                                               |
| ---------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | -------------------------------------------------------------- |
| 122        | `RUNTIME_MODE=bundled` guard                                                                               | `[[ "${RUNTIME_MODE:-}" == "local" ]] \|\| { echo "[real-stack] this script requires RUNTIME_MODE=local (got ${RUNTIME_MODE:-unset})" >&2; exit 64; }`                                                                                                                                                                                              |
| 126-141    | Nine `: "${RUNTIME_BUNDLED_*:=…}"` defaults                                                                | Single `: "${OPENCLAW_STATE_DIR:=${STATE_DIR}/data/managed-gateway-state}"` default. Remove all `RUNTIME_BUNDLED_*` defaults — token / bind / port now come from `openclaw.json` via the openclawstate reader.                                                                                                                                      |
| 129-134    | `if [[ "${RUNTIME_BUNDLED_COMMAND}" == "pnpm" … ]]` source-launcher refusal block                          | Remove entirely. The official `openclaw gateway install + start` CLI replaces the launcher; deck-go never spawns the Gateway.                                                                                                                                                                                                                       |
| 151-154    | `RUNTIME_BUNDLED_TOKEN="${config_gateway_token}"` reconciliation against config                            | Remove. Token is sourced from `openclaw.json` directly by the Reader; no double-write needed.                                                                                                                                                                                                                                                       |
| 176-178    | `export RUNTIME_MODE RUNTIME_BUNDLED_COMMAND …`                                                            | `export RUNTIME_MODE OPENCLAW_STATE_DIR`                                                                                                                                                                                                                                                                                                            |
| ~190 (new) | —                                                                                                          | Insert: `node "$REPO_ROOT/dist/entry.js" gateway install \|\| true` then `node "$REPO_ROOT/dist/entry.js" gateway start`. The CLI reads `OPENCLAW_STATE_DIR` from the env (no `--state-dir` flag; see `src/cli/daemon-cli/register-service-commands.ts:72`).                                                                                        |
| 230        | `curl_local … "http://${RUNTIME_BUNDLED_BIND_HOST}:${RUNTIME_BUNDLED_BIND_PORT}/"` Gateway readiness probe | Derive the URL from `openclaw.json` via `python3 -c 'import json; d=json.load(open("…/openclaw.json")); print("http://127.0.0.1:" + str(d["gateway"].get("port", 18789)))'`, OR hard-code `http://127.0.0.1:18789` if `OPENCLAW_STATE_DIR` is fresh and the state file does not exist yet. Loopback host is always `127.0.0.1` per Reader contract. |
| 261        | `for port in "${BACKEND_PORT}" "${RUNTIME_BUNDLED_BIND_PORT}" "${FRONTEND_PORT}"; do` port cleanup loop    | Replace `RUNTIME_BUNDLED_BIND_PORT` with `18789` (hard-coded loopback port; the script's purpose is to clean up the well-known port before launching).                                                                                                                                                                                              |
| 331        | `[real-stack] Gateway port ${RUNTIME_BUNDLED_BIND_PORT} is a mock Gateway …`                               | `[real-stack] Gateway port 18789 is a mock Gateway …`                                                                                                                                                                                                                                                                                               |
| 337        | `grep -q '"mode":"bundled"' <<<"${runtime_body}" && grep -q '"pid":' <<<"${runtime_body}"` readiness gate  | `grep -q '"mode":"local"' <<<"${runtime_body}" && grep -q '"lifecycleState":"running"' <<<"${runtime_body}"` — `pid` is gone (Stage 1 deleted the supervisor); the new readiness signal is `lifecycleState=running` from the local Facade.                                                                                                          |
| 425        | `gateway:${RUNTIME_BUNDLED_BIND_PORT}` in port-status banner                                               | `gateway:18789`                                                                                                                                                                                                                                                                                                                                     |
| 455        | `Gateway       ws://${RUNTIME_BUNDLED_BIND_HOST}:${RUNTIME_BUNDLED_BIND_PORT}` summary line                | `Gateway       ws://127.0.0.1:18789`                                                                                                                                                                                                                                                                                                                |
| 457        | `gateway token $(redact_secret "${RUNTIME_BUNDLED_TOKEN}")` summary line                                   | `gateway token $(redact_secret "$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); print(d["gateway"]["auth"].get("token",""))' "${OPENCLAW_STATE_DIR}/openclaw.json" 2>/dev/null                                                                                                                                                       |     | echo)")` — read token from state file for the operator banner. |

- [ ] **Step 1: Pre-read + grep verify the patch table is exhaustive**

```bash
cd /Users/wangym/workspace/agents/openclaw
grep -nE "RUNTIME_BUNDLED_|RUNTIME_MODE=bundled|\"mode\":\"bundled\"" deck-go/scripts/dev/run-stack-real.sh
# Capture every hit. Every line MUST appear in the patch table above. If a hit is missing, extend the table BEFORE editing.
```

- [ ] **Step 2: Apply the patch table top-to-bottom**

Apply each row as a focused edit. After each block, run `bash -n deck-go/scripts/dev/run-stack-real.sh` to catch syntax errors early.

- [ ] **Step 3: Sanity-grep + bash-syntax verify**

```bash
cd /Users/wangym/workspace/agents/openclaw
bash -n deck-go/scripts/dev/run-stack-real.sh
# Expected: pass.
grep -nE "RUNTIME_BUNDLED_|RUNTIME_MODE=bundled|\"mode\":\"bundled\"|\"pid\":" deck-go/scripts/dev/run-stack-real.sh
# Expected: empty (no remaining bundled references; no pid readiness assertion).
grep -nE "OPENCLAW_STATE_DIR|gateway install|gateway start|18789" deck-go/scripts/dev/run-stack-real.sh
# Expected: ≥1 hit per pattern.
```

- [ ] **Step 4: Update `.env.real-stack.example` (sister change from F2)**

Already covered by Task F2. Re-confirm `RUNTIME_MODE=local` and `OPENCLAW_STATE_DIR=…` are present and consistent with this script's defaults.

- [ ] **Step 5: Commit**

```bash
cd /Users/wangym/workspace/agents/openclaw
scripts/committer "Migrate run-stack-real.sh to local mode end-to-end

Stage 2 task 3.4.5. Full rewrite of variable defaults, export list,
Gateway-startup invocation, readiness probes, port cleanup, and operator
banner. The script no longer spawns Gateway via RUNTIME_BUNDLED_COMMAND;
'openclaw gateway install + start' (CLI reads OPENCLAW_STATE_DIR from env,
no --state-dir flag) takes over. Readiness gate flips from
'\"mode\":\"bundled\" + \"pid\":' to '\"mode\":\"local\" +
\"lifecycleState\":\"running\"' because Stage 1's F1 follow-up retired
the supervisor (pid field is gone).

Constraint: every RUNTIME_BUNDLED_* / RUNTIME_MODE=bundled /
\"mode\":\"bundled\" site listed in the patch table MUST migrate
together; the grep gate in Step 3 enforces no straggler.
Confidence: medium-high (manual real-stack smoke required; tracked as
Stage 2 task 3.5.2 / 3.5.3)
Scope-risk: medium (real-stack script is the primary L2 E2E entrypoint;
covered by bash -n + the grep gate; manual smoke remains owner-driven)
Tested: bash -n deck-go/scripts/dev/run-stack-real.sh
Not-tested: actual real-stack end-to-end run (owner-driven; Stage 2 task
3.5.2 / 3.5.3)." \
  deck-go/scripts/dev/run-stack-real.sh
```

---

### Task F5: Update `AGENTS.md` + `CLAUDE.md` docs

**Files:**

- Modify: `deck-go/AGENTS.md` (Architecture + Runtime And Dev Scripts sections).
- Modify: `deck-go/CLAUDE.md` (the symlink target; both files share content via the symlink).
- Modify: `deck-go/docs/project/e2e-stack-operations.md` (mock vs real install path).
- Modify: `.agents/skills/deck-upstream-sync/SKILL.md` (path constants under `internal/runtime/bundled/`).

- [ ] **Step 1: Apply textual updates**

In `deck-go/AGENTS.md` Architecture section, flip:

- `bundled mode spawns a local OpenClaw Gateway` → `local mode runs deck-go alongside an OpenClaw Gateway installed via the official CLI`.
- `backend/internal/runtime/bundled/` → `backend/internal/runtime/local/`.

In Runtime And Dev Scripts section, flip:

- `.env.bundled.example` → `.env.local.example`.
- `RUNTIME_BUNDLED_COMMAND` / `RUNTIME_BUNDLED_ARGS` references → describe `OPENCLAW_STATE_DIR` + `openclaw gateway install/start` lifecycle.
- `run-bundled.sh` → `run-local.sh`.

In `docs/project/e2e-stack-operations.md`:

- Update the L1 / L2 startup blocks to use `openclaw gateway install + start` instead of `RUNTIME_BUNDLED_COMMAND=node ...`.
- Update env var references analogously.

In `.agents/skills/deck-upstream-sync/SKILL.md`:

- Remove path constants pointing at `internal/runtime/bundled/supervisor.go` (file is gone after F1 follow-up).
- Map future upstream conflicts onto `internal/runtime/local/` for files that survived the rename.

- [ ] **Step 2: Sanity grep**

```bash
cd /Users/wangym/workspace/agents/openclaw
rg -n "RUNTIME_BUNDLED_|run-bundled\\.sh|/runtime/bundled/" deck-go/AGENTS.md deck-go/CLAUDE.md deck-go/docs/project/e2e-stack-operations.md .agents/skills/deck-upstream-sync/SKILL.md
# Expected: only deprecation references (e.g. "RUNTIME_BUNDLED_* are deprecated, see migration note").
```

- [ ] **Step 3: Commit**

```bash
cd /Users/wangym/workspace/agents/openclaw
scripts/committer "Update deck-go docs + upstream-sync skill for local mode

deck-go/AGENTS.md, deck-go/CLAUDE.md (symlink), e2e-stack-operations.md,
and the deck-upstream-sync skill all flip from bundled to local + new
install/start lifecycle.

Confidence: high
Scope-risk: low (docs only)
Tested: not applicable (declarative)" \
  deck-go/AGENTS.md \
  deck-go/CLAUDE.md \
  deck-go/docs/project/e2e-stack-operations.md \
  .agents/skills/deck-upstream-sync/SKILL.md
```

---

## Phase G: Final verification + tasks.md bookkeeping

### Task G1: `git grep -i bundled` audit

**Files:**

- No code change. This task validates the cleanup.

- [ ] **Step 1: Run the audit**

```bash
cd /Users/wangym/workspace/agents/openclaw
git grep -i bundled -- . \
  ':!deck-go/docs/superpowers/plans/' \
  ':!deck-go/docs/adr/' \
  ':!docs/handoff-agent/' \
  ':!openspec/changes/' \
  ':!openspec/specs/' \
  ':!CHANGELOG*'
# Expected hits: only allowlist entries.
```

(Note the `deck-go/` prefix on the plan and ADR pathspecs — earlier drafts excluded `docs/superpowers/plans/` / `docs/adr/` without the prefix and would have matched this plan file against itself.)

Allowlist (acceptable hits):

- `deck-go/backend/internal/runtime/local/legacy_env_warn.go` — the deprecation warning literal lists `RUNTIME_BUNDLED_*` keys.
- `deck-go/backend/internal/runtime/envconf/envconf.go` — the fatal-error message names `RUNTIME_MODE=bundled` to help users migrate.
- `deck-go/backend/internal/gateway/generated/` and `deck-go/contracts/generated/` — generated artifacts may still mention the `DeckGoRuntimeBundledGatewayStatus` type alias name (the type _value_ `mode: "local"` is correct). Type-name rename is out of scope.
- `deck-go/.agents/skills/deck-upstream-sync/` — upstream-sync historical path references.
- `.github/workflows/` / `Makefile` — may still mention `bundled` in matrix names; those are Stage 3 (out of scope).
- Comments in `runtime/local/facade.go` referencing the rename history (acceptable as migration aid).

If any hit is not in the allowlist, fix it before continuing.

- [ ] **Step 2: Commit if any fixes were needed**

If Step 1 surfaced an unexpected hit, fix it and commit:

```bash
cd /Users/wangym/workspace/agents/openclaw
scripts/committer "Stage 2 audit: drop residual bundled references

Catches one or more bundled-string hits the bulk rename missed. See diff
for the specific files.

Confidence: high
Scope-risk: low
Tested: cd deck-go && make verify" \
  $(git diff --name-only HEAD)
```

If Step 1 was clean, skip this commit.

---

### Task G2: Final `make verify` + `make contract-gate`

**Files:**

- No code change.

- [ ] **Step 1: Backend gate**

```bash
cd /Users/wangym/workspace/agents/openclaw/deck-go
make verify
# Expected: exit 0.
```

- [ ] **Step 2: Contract gate**

```bash
cd /Users/wangym/workspace/agents/openclaw/deck-go
make contract-gate
# Expected: pass.
```

- [ ] **Step 3: Race-mode backend test**

```bash
cd /Users/wangym/workspace/agents/openclaw/deck-go/backend
go test -race -count=1 ./...
# Expected: PASS.
```

- [ ] **Step 4: Frontend build**

```bash
cd /Users/wangym/workspace/agents/openclaw/deck-go/frontend-new
npm run build
# Expected: TypeScript compiles; Vite builds.
```

- [ ] **Step 5: Record evidence in the handoff log**

Append a `## Round 1: stage-2 implementation` section to a new handoff log at `docs/handoff-agent/gateway-launcher-rewrite-stage2.md` listing:

- the commit hash range,
- the four verification commands above with `PASS` markers,
- any allowlist hits from G1.

Then commit:

```bash
cd /Users/wangym/workspace/agents/openclaw
scripts/committer "Stage 2 verification evidence

make verify (exit 0) + make contract-gate (pass) + go test -race ./...
(PASS) + npm run build (PASS). Handoff log captures the commit range and
the audit allowlist.

Confidence: high
Scope-risk: low
Tested: cd deck-go && make verify && make contract-gate
        cd deck-go/backend && go test -race -count=1 ./...
        cd deck-go/frontend-new && npm run build" \
  docs/handoff-agent/gateway-launcher-rewrite-stage2.md \
  docs/handoff-agent/README.md
```

(`README.md` index gets a new entry for the new handoff doc.)

---

### Task G3: Mark Stage 2 tasks complete in `tasks.md`

**Files:**

- Modify: `openspec/changes/gateway-launcher-rewrite/tasks.md`

- [ ] **Step 1: Flip the checkboxes**

In `tasks.md`, flip every Stage 2 task in section 3 from `- [ ]` to `- [x]` with a short pointer to the implementing commit hash:

- 3.1.1 → 3.1.4 (Phase A + B + E): name commits.
- 3.2.1 → 3.2.4 (Phase C): name commits.
- 3.3.1 → 3.3.4 (Phase D): name commit.
- 3.4.1 → 3.4.9 (Phase F): name commits per file group.
- 3.5.1 → 3.5.4 (Phase G): 3.5.1 / 3.5.4 closed by G2; 3.5.2 / 3.5.3 marked as owner-only manual smoke (leave unchecked or annotate "owner-verified" once the owner reports back).

Leave 3.1.5 marked as N/A per the design-D9 update (Stage 1 task 2.1.7 already retired the internal feature flag).

- [ ] **Step 2: Commit**

```bash
cd /Users/wangym/workspace/agents/openclaw
scripts/committer "Mark Stage 2 tasks complete after final verification

Section 3 of openspec/changes/gateway-launcher-rewrite/tasks.md flipped to
[x] for all tasks closed by Phase A-F + G1-G2. 3.5.2 / 3.5.3 (manual
RUNTIME_MODE=bundled exit-64 smoke and stale env warning smoke) remain
owner-only and are annotated as such.

Confidence: high
Scope-risk: low (governance bookkeeping)
Tested: not applicable" \
  openspec/changes/gateway-launcher-rewrite/tasks.md
```

---

## Self-Review Checklist

- [ ] Spec coverage: every Stage 2 task in `openspec/changes/gateway-launcher-rewrite/tasks.md` sections 3.1–3.5 is implemented by a Phase A–G task above. Out-of-scope items (2.3.4 / 2.3.5 / 2.5.4 / 2.6.4) are explicitly listed in the File Structure "Out of scope" block; Stage 3 (sections 4.\*) is not in this plan.
- [ ] No placeholder steps: every task has concrete file paths, concrete code blocks, concrete commands, and exact expected output. Discovery commands (e.g. `rg -l ... | xargs sed -i ''`) appear only as transition steps with explicit pre/post grep checks.
- [ ] Type consistency: `RuntimeBundledConfig` → `RuntimeLocalConfig` rename happens atomically in Task E2 (struct + all call sites in one commit). `isBundledRuntimeStatus` → `isLocalRuntimeStatus` rename happens atomically in Task D1. Phase 0's `openclawstate.Reader` / `GatewayConfig` / sentinel error names are stable across tasks 0.1–0.3.
- [ ] Order constraints encoded: Phase 0 lands before E2 (state reader exists before the field strip); Phase A before B (rename before value flip); Phase C before D (contract regen before frontend type guards); Phase E before F (envconf rejection before .env rename).
- [ ] Probe-trigger discipline preserved: Phase 0.3's new `gatewayLoopbackEndpoint` helper is event-driven (called on every facade method), not on a `time.Ticker`. Stage 1 task 2.1.6 regression guard (`TestBundledPackage_DoesNotUseTimeTickerForPeriodicProbes`) still applies after the package rename.
- [ ] Cache discipline preserved: ManagedRuntime's `lastStatus` cache and `runtimeSummaryOverride` sidecar (Stage 1 / F1 follow-up) are untouched by this plan; the package rename is textual.
- [ ] Commit messages follow the lore protocol: state why, list `Tested:` / `Not-tested:`, name constraints. Manual-smoke tasks (3.5.2 / 3.5.3) are explicitly carried as `Not-tested:` lines until the owner verifies.
- [ ] Generated artifacts are never hand-edited. Phase C runs `make contracts-sync` + `make protocol-update`; Phase G2 runs `make contract-gate` as the regression guard.
- [ ] Audit allowlist in G1 is concrete (4 categories) — not a vague "remaining acceptable references" handwave.
- [ ] Stage 1 tail items (2.3.4 / 2.3.5 / 2.5.4 / 2.6.4) are explicitly flagged out of scope so this plan does not pick up the canvas-bridge design gap by accident.

---

## Execution Handoff

Plan saved to `deck-go/docs/superpowers/plans/2026-05-14-gateway-launcher-rewrite-stage2.md`.

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Recommended for Phase C (contract regen) and Phase E2 (struct rename ripple) because their cross-package fan-out benefits from a clean reviewer pass per slice.

**2. Inline Execution** — I execute tasks in this session using `superpowers:executing-plans`, batched with checkpoints. Recommended if you want to interleave plan execution with Codex cross-review on individual phases.

**Which approach?**
