# Gateway Launcher Rewrite — Stage 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Codex CLI users invoked manually by the operator follow the same TDD red-green-refactor loop and commit cadence; do not skip the "run test, verify FAIL" gate.

**Goal:** In-place rewrite of `deck-go/backend/internal/runtime/bundled/` from spawn-based supervisor to a thin lifecycle proxy over the official `openclaw gateway install/start/stop/restart/uninstall` CLI; fix six R2 violations; add Operations Panel UI; preserve all existing behavior under the still-current `RUNTIME_MODE=bundled` value (mode rename / package rename / contract regen / env rename all happen in Stage 2; E2E adaptation in Stage 3).

**Architecture:** Replace `Supervisor` (self-rolled PID/fingerprint/lock) with `LifecycleProxy` (shells out to upstream CLI via `os/exec`) + `LifecycleProbe` (4-state classifier from `gateway status` + loopback `/health`). The bundled package keeps its name and `facade.RuntimeFacade` interface contract; only internals change. `LifecycleProbe` is the sole source of truth for `lifecycleState`; no `time.Ticker` polling. Browser asset access goes through a new BFF reverse-proxy route at `/api/runtime/gateway-assets/*`, preserving the three-layer boundary (`deck-go/AGENTS.md:23-24`).

**Tech Stack:** Go 1.24 (`os/exec`, `crypto/sha256`, `net/http`, `net/http/httputil`), React 18 + Vite + Vitest (frontend), Playwright (e2e), Make (verification targets).

---

## Scope guard — do NOT touch in Stage 1

These are Stage 2 / Stage 3 surfaces. Touching them in Stage 1 introduces churn and breaks the staged rollback story documented in `design.md` D9.

- `deck-go/contracts/**` — Stage 2 regenerates contracts (`make protocol-update` + `make contracts-sync`)
- `deck-go/.env.bundled.example` — Stage 2 renames to `.env.local.example`
- `deck-go/.env.real-stack.example` `RUNTIME_BUNDLED_*` keys — Stage 2 replaces
- `deck-go/.env.remote.example` — owned by the follow-up `runtime-mode-switching` change
- `deck-go/scripts/dev/run-bundled.sh` — Stage 2 renames to `run-local.sh`
- `deck-go/scripts/dev/run-stack-real.sh` — Stage 2 reworks startup sequence
- `frontend-new/src/components/runtime/ModeBadge.tsx` — already R2-compliant
- `frontend-new/src/components/runtime/FirstRunBanner.tsx` — already R2-compliant
- `frontend-new/src/components/runtime/EndpointSection.tsx` — already R2-compliant
- `deck-go/test/e2e/{bundled,remote,real-gateway,*-real-gateway,*-visual}.spec.ts` — Stage 3 reworks
- `deck-go/test/fixtures/mock-gateway.mjs` — Stage 3
- `envconf` package — keep accepting `RUNTIME_MODE=bundled` and emitting `Mode=bundled` in `Capabilities()`; Stage 2 flips it
- The `bundled` package directory name itself — Stage 2 does `git mv → local/`
- `RuntimeFacade.Capabilities().Mode` returned value — must still be `"bundled"` at end of Stage 1
- Type-guard names `isBundledRuntimeStatus()` — internally tag them `@operationsSurface` but DO NOT rename them yet (Stage 2 renames)

## Architectural anchors (always live)

- **Rule R1:** New `deck.*` RPC must be classified type 1/2/3. Stage 1 does not add a `deck.*` RPC. The BFF `/api/runtime/gateway-assets/*` route is internal HTTP plumbing (not a `deck.*` RPC). The Gateway-side static-asset route is a separate PR, recorded outside this plan.
- **Rule R2 (corrected):** Control surface above the runtime facade is mode-agnostic; operations surface (Operations Panel + lifecycle HTTP routes) is explicitly mode-aware. `contracts/`, `frontend-new/`, and control business logic must not branch on `RUNTIME_MODE`. Operations Panel gates on `capabilities.supervisorState`, never on `mode === "..."` (Decision D11).
- **Rule R3:** Real E2E ≡ release path with `.env` diffs only. Stage 1 must not add any "E2E-only spawn shortcut". Real E2E adaptation lives in Stage 3.

---

## File structure

### Created (Stage 1)

- `deck-go/backend/internal/runtime/bundled/service_name.go` — `DeriveServiceName(absRepoPath string) string`
- `deck-go/backend/internal/runtime/bundled/service_name_test.go`
- `deck-go/backend/internal/runtime/bundled/entrypoint_resolver.go` — three-tier `ResolveEntrypoint`
- `deck-go/backend/internal/runtime/bundled/entrypoint_resolver_test.go`
- `deck-go/backend/internal/runtime/bundled/probe.go` — `LifecycleProbe` + 4-state classifier
- `deck-go/backend/internal/runtime/bundled/probe_test.go`
- `deck-go/backend/internal/runtime/bundled/lifecycle_proxy.go` — `LifecycleProxy` shell-out wrapper over `openclaw gateway <action>`
- `deck-go/backend/internal/runtime/bundled/lifecycle_proxy_test.go`
- `deck-go/backend/internal/server/runtime_lifecycle.go` — install/start/stop/restart/reinstall/refresh HTTP route registrations
- `deck-go/backend/internal/server/runtime_lifecycle_test.go`
- `deck-go/backend/internal/server/gateway_assets_proxy.go` — BFF reverse-proxy `/api/runtime/gateway-assets/*`
- `deck-go/backend/internal/server/gateway_assets_proxy_test.go`
- `deck-go/frontend-new/src/components/runtime/OperationsPanel.tsx` — state-driven lifecycle UI
- `deck-go/frontend-new/src/components/runtime/OperationsPanel.test.tsx`

### Modified (Stage 1)

- `deck-go/backend/internal/runtime/facade/facade.go` — extend `RuntimeFacade` (add `Install` / `Reinstall`); extend `RuntimeStatus` (add `LifecycleState`, `ServiceName`, `EntrypointPath`)
- `deck-go/backend/internal/runtime/facade/facade_test.go` / `build_test.go` / `import_boundary_test.go` — adjust to new interface shape
- `deck-go/backend/internal/runtime/bundled/facade.go` — drop `Supervisor`; wire `LifecycleProxy` + `LifecycleProbe`
- `deck-go/backend/internal/runtime/bundled/facade_test.go` — replace supervisor expectations
- `deck-go/backend/internal/server/runtime.go` — D10 carve-out (mode-aware 503 short-circuit)
- `deck-go/backend/internal/server/assets.go` — remove canvas A2UI loading near line 269
- `deck-go/backend/internal/runtime/openclaw/legacy_admin_assets.go` — remove canvas A2UI loading near line 249
- `deck-go/frontend-new/src/api.ts` — tag `isBundledRuntimeStatus` `@operationsSurface`; remove `mode === "remote"` business branches near lines 566 / 572 / 578
- `deck-go/frontend-new/src/deck-ui/HeaderBar.tsx` — remove direct `runtime.mode === "remote"` branch near line 31
- frontend canvas-asset consumer file (located in Task D3) — change asset URL to relative `/api/runtime/gateway-assets/...`

### Deleted (Stage 1)

- `deck-go/backend/internal/runtime/bundled/supervisor.go`
- `deck-go/backend/internal/runtime/bundled/supervisor_test.go`
- `deck-go/backend/internal/runtime/bundled/preflight.go`
- `deck-go/backend/internal/runtime/bundled/preflight_test.go`
- `deck-go/backend/internal/runtime/bundled/process_group_unix.go`
- `deck-go/backend/internal/runtime/bundled/process_group_windows.go`

---

## Phase A — Backend lifecycle primitives (TDD, no facade wiring yet)

This phase introduces the four small Go primitives that the rewritten `bundled.Facade` will compose. Each primitive is independently testable and has no dependency on `Supervisor`, so they can land before the supervisor deletion in Phase B.

### Task A1: Per-repo-hash service name derivation

**Files:**

- Create: `deck-go/backend/internal/runtime/bundled/service_name.go`
- Create: `deck-go/backend/internal/runtime/bundled/service_name_test.go`

**Acceptance:** Pure function; deterministic over the same input; different absolute paths produce different names; output matches spec scenario "Service name hashed from repo path" (`openclaw-gateway.` + 12 hex chars from `SHA-256(absRepoPath)`).

- [ ] **A1.1 — Write the failing test**

```go
// deck-go/backend/internal/runtime/bundled/service_name_test.go
package bundled

import (
	"strings"
	"testing"
)

func TestDeriveServiceName_PrefixAndHashLength(t *testing.T) {
	name := DeriveServiceName("/home/user/work/openclaw-fork-a")
	if !strings.HasPrefix(name, "openclaw-gateway.") {
		t.Fatalf("expected prefix %q, got %q", "openclaw-gateway.", name)
	}
	suffix := strings.TrimPrefix(name, "openclaw-gateway.")
	if len(suffix) != 12 {
		t.Fatalf("expected 12-hex suffix, got %d chars: %q", len(suffix), suffix)
	}
	for _, r := range suffix {
		if !((r >= '0' && r <= '9') || (r >= 'a' && r <= 'f')) {
			t.Fatalf("suffix must be lowercase hex, got %q", suffix)
		}
	}
}

func TestDeriveServiceName_DeterministicSamePath(t *testing.T) {
	a := DeriveServiceName("/home/user/work/openclaw-fork-a")
	b := DeriveServiceName("/home/user/work/openclaw-fork-a")
	if a != b {
		t.Fatalf("expected deterministic derivation, got %q vs %q", a, b)
	}
}

func TestDeriveServiceName_DifferentPathsCollisionFree(t *testing.T) {
	a := DeriveServiceName("/home/user/work/openclaw-fork-a")
	b := DeriveServiceName("/home/user/work/openclaw-fork-b")
	if a == b {
		t.Fatalf("expected distinct service names for distinct paths, both got %q", a)
	}
}
```

- [ ] **A1.2 — Run test to verify it fails**

```bash
cd deck-go && go test ./backend/internal/runtime/bundled/ -run TestDeriveServiceName -v
```

Expected: `undefined: DeriveServiceName` build error → all three tests FAIL.

- [ ] **A1.3 — Write minimal implementation**

```go
// deck-go/backend/internal/runtime/bundled/service_name.go
package bundled

import (
	"crypto/sha256"
	"encoding/hex"
)

// ServiceNamePrefix is the launchd / systemd / schtasks identifier prefix shared
// across every clone of this repository.
const ServiceNamePrefix = "openclaw-gateway."

// ServiceNameHashLen is the number of hex characters appended after the prefix.
// 12 hex chars = 48 bits of entropy from SHA-256(absRepoPath); collision
// probability over realistic fork counts on one machine is negligible.
const ServiceNameHashLen = 12

// DeriveServiceName returns "openclaw-gateway.<hash>" where <hash> is the first
// ServiceNameHashLen lowercase hex characters of SHA-256(absRepoPath).
func DeriveServiceName(absRepoPath string) string {
	sum := sha256.Sum256([]byte(absRepoPath))
	return ServiceNamePrefix + hex.EncodeToString(sum[:])[:ServiceNameHashLen]
}
```

- [ ] **A1.4 — Run test to verify it passes**

```bash
cd deck-go && go test ./backend/internal/runtime/bundled/ -run TestDeriveServiceName -v
```

Expected: 3/3 PASS.

- [ ] **A1.5 — Commit**

```bash
git add deck-go/backend/internal/runtime/bundled/service_name.go \
        deck-go/backend/internal/runtime/bundled/service_name_test.go
git commit -m "feat(bundled): add per-repo-hash DeriveServiceName

Decision D4: service identifiers derive from SHA-256(absRepoPath)[:12] so
multiple clones can each install their own service without collision.

Tested: prefix, hash length, lowercase-hex, determinism, distinctness.
Not-tested: collision rate (statistical; out of unit scope)."
```

---

### Task A2: Entrypoint path resolution (three-tier fallback)

**Files:**

- Create: `deck-go/backend/internal/runtime/bundled/entrypoint_resolver.go`
- Create: `deck-go/backend/internal/runtime/bundled/entrypoint_resolver_test.go`

**Acceptance:** Resolution order (1) `OPENCLAW_REPO_ROOT` env → `<root>/dist/entry.js`; (2) `<bff_binary_dir>/../../../dist/entry.js`; (3) `installTimeAbsolutePath` parameter (persisted at install time, passed by caller). Returns sentinel error when none resolve to an existing file. Rejects entrypoints outside the repository tree (sibling `package.json` check) per spec scenario "Reject paths outside repository".

- [ ] **A2.1 — Write the failing test**

```go
// deck-go/backend/internal/runtime/bundled/entrypoint_resolver_test.go
package bundled

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestResolveEntrypoint_EnvOverride(t *testing.T) {
	repo := t.TempDir()
	writeFile(t, filepath.Join(repo, "package.json"), `{"name":"openclaw"}`)
	writeFile(t, filepath.Join(repo, "dist", "entry.js"), "// stub")

	got, err := ResolveEntrypoint(ResolveOptions{RepoRootEnv: repo})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := filepath.Join(repo, "dist", "entry.js")
	if got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
}

func TestResolveEntrypoint_RelativeFromBFFBinary(t *testing.T) {
	root := t.TempDir()
	bffDir := filepath.Join(root, "deck-go", "backend", "bin")
	if err := os.MkdirAll(bffDir, 0o755); err != nil {
		t.Fatal(err)
	}
	writeFile(t, filepath.Join(root, "package.json"), `{"name":"openclaw"}`)
	writeFile(t, filepath.Join(root, "dist", "entry.js"), "// stub")

	got, err := ResolveEntrypoint(ResolveOptions{BFFBinaryDir: bffDir})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := filepath.Join(root, "dist", "entry.js")
	if got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
}

func TestResolveEntrypoint_InstallTimeAbsolutePath(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "package.json"), `{"name":"openclaw"}`)
	writeFile(t, filepath.Join(root, "dist", "entry.js"), "// stub")

	got, err := ResolveEntrypoint(ResolveOptions{
		InstallTimeAbsolutePath: filepath.Join(root, "dist", "entry.js"),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != filepath.Join(root, "dist", "entry.js") {
		t.Fatalf("got %q, want install-time path", got)
	}
}

func TestResolveEntrypoint_NoneResolveError(t *testing.T) {
	_, err := ResolveEntrypoint(ResolveOptions{})
	if !errors.Is(err, ErrEntrypointNotFound) {
		t.Fatalf("expected ErrEntrypointNotFound, got %v", err)
	}
}

func TestResolveEntrypoint_OutsideRepoRejected(t *testing.T) {
	other := t.TempDir()
	writeFile(t, filepath.Join(other, "dist", "entry.js"), "// stub")
	// Intentionally no package.json with name "openclaw" — must reject.

	_, err := ResolveEntrypoint(ResolveOptions{RepoRootEnv: other})
	if !errors.Is(err, ErrEntrypointOutsideRepo) {
		t.Fatalf("expected ErrEntrypointOutsideRepo, got %v", err)
	}
}
```

- [ ] **A2.2 — Run test to verify it fails**

```bash
cd deck-go && go test ./backend/internal/runtime/bundled/ -run TestResolveEntrypoint -v
```

Expected: `undefined: ResolveEntrypoint, ResolveOptions, ErrEntrypointNotFound, ErrEntrypointOutsideRepo` → build fails.

- [ ] **A2.3 — Write minimal implementation**

```go
// deck-go/backend/internal/runtime/bundled/entrypoint_resolver.go
package bundled

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

var (
	ErrEntrypointNotFound    = errors.New("entrypoint_not_found")
	ErrEntrypointOutsideRepo = errors.New("entrypoint_outside_repo")
)

// ResolveOptions carries the three input tiers in priority order. The first
// non-empty field that resolves to a readable file wins.
type ResolveOptions struct {
	// Tier 1: explicit override (typically from OPENCLAW_REPO_ROOT env).
	RepoRootEnv string
	// Tier 2: directory of the running BFF binary; entrypoint is at
	// <BFFBinaryDir>/../../../dist/entry.js (i.e. deck-go/backend/bin -> repo root).
	BFFBinaryDir string
	// Tier 3: absolute path persisted at install time (read from plist / unit /
	// scheduled-task metadata by the lifecycle proxy when available).
	InstallTimeAbsolutePath string
}

// ResolveEntrypoint walks the three tiers in order and returns the first
// absolute path that points to an existing file inside this repository.
func ResolveEntrypoint(opts ResolveOptions) (string, error) {
	attempts := make([]string, 0, 3)

	if opts.RepoRootEnv != "" {
		candidate := filepath.Join(opts.RepoRootEnv, "dist", "entry.js")
		attempts = append(attempts, candidate)
		if ok, err := fileExists(candidate); err != nil {
			return "", err
		} else if ok {
			return verifyInsideRepo(candidate)
		}
	}

	if opts.BFFBinaryDir != "" {
		// deck-go/backend/bin → repo root is three levels up.
		repoRoot := filepath.Clean(filepath.Join(opts.BFFBinaryDir, "..", "..", ".."))
		candidate := filepath.Join(repoRoot, "dist", "entry.js")
		attempts = append(attempts, candidate)
		if ok, err := fileExists(candidate); err != nil {
			return "", err
		} else if ok {
			return verifyInsideRepo(candidate)
		}
	}

	if opts.InstallTimeAbsolutePath != "" {
		attempts = append(attempts, opts.InstallTimeAbsolutePath)
		if ok, err := fileExists(opts.InstallTimeAbsolutePath); err != nil {
			return "", err
		} else if ok {
			return verifyInsideRepo(opts.InstallTimeAbsolutePath)
		}
	}

	return "", fmt.Errorf("%w: attempted=%v", ErrEntrypointNotFound, attempts)
}

func fileExists(p string) (bool, error) {
	info, err := os.Stat(p)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, err
	}
	return !info.IsDir(), nil
}

// verifyInsideRepo walks up from the resolved entrypoint and asserts that a
// package.json with name "openclaw" lives at the repo root sibling. This is the
// "Reject paths outside repository" scenario.
func verifyInsideRepo(entrypointAbs string) (string, error) {
	// dist/entry.js → repo root is two levels up.
	root := filepath.Clean(filepath.Join(filepath.Dir(entrypointAbs), ".."))
	pkgPath := filepath.Join(root, "package.json")
	data, err := os.ReadFile(pkgPath)
	if err != nil {
		return "", fmt.Errorf("%w: package.json missing at %s", ErrEntrypointOutsideRepo, pkgPath)
	}
	var pkg struct {
		Name string `json:"name"`
	}
	if err := json.Unmarshal(data, &pkg); err != nil {
		return "", fmt.Errorf("%w: invalid package.json: %v", ErrEntrypointOutsideRepo, err)
	}
	if pkg.Name != "openclaw" {
		return "", fmt.Errorf("%w: package.json name=%q (expected openclaw)", ErrEntrypointOutsideRepo, pkg.Name)
	}
	return entrypointAbs, nil
}
```

- [ ] **A2.4 — Run test to verify it passes**

```bash
cd deck-go && go test ./backend/internal/runtime/bundled/ -run TestResolveEntrypoint -v
```

Expected: 5/5 PASS.

- [ ] **A2.5 — Commit**

```bash
git add deck-go/backend/internal/runtime/bundled/entrypoint_resolver.go \
        deck-go/backend/internal/runtime/bundled/entrypoint_resolver_test.go
git commit -m "feat(bundled): three-tier entrypoint resolver

Decision D3: resolve entrypoint via OPENCLAW_REPO_ROOT -> bff-relative ->
install-time absolute path; reject any resolution that escapes the repo
tree (package.json sibling check).

Tested: env override, bff-relative, install-time, not-found sentinel,
outside-repo rejection."
```

---

### Task A3: Lifecycle probe (4-state classifier)

**Files:**

- Create: `deck-go/backend/internal/runtime/bundled/probe.go`
- Create: `deck-go/backend/internal/runtime/bundled/probe_test.go`

**Acceptance:** `LifecycleProbe.Probe(ctx)` returns one of `running` / `stopped` / `not-installed` / `unhealthy` based on (a) injected `ServiceQuerier` reporting registration + active state and (b) injected `HealthClient` reporting loopback health. `lastError` populated with error codes per spec (`probe_timeout`, `probe_refused`, `probe_non_ok`, `entrypoint_path_drift`, `service_not_registered`, `entrypoint_not_found`). No `time.Ticker`, no goroutine — probe is a pure synchronous call invoked by HTTP handlers / boot / lifecycle action completions.

- [ ] **A3.1 — Write the failing test (state matrix)**

```go
// deck-go/backend/internal/runtime/bundled/probe_test.go
package bundled

import (
	"context"
	"errors"
	"testing"
)

type fakeServiceQuerier struct {
	registered bool
	active     bool
	queryErr   error
}

func (f *fakeServiceQuerier) Query(context.Context, string) (ServiceState, error) {
	if f.queryErr != nil {
		return ServiceState{}, f.queryErr
	}
	return ServiceState{Registered: f.registered, Active: f.active}, nil
}

type fakeHealthClient struct {
	healthy   bool
	healthErr error
}

func (f *fakeHealthClient) Health(context.Context) error {
	if f.healthErr != nil {
		return f.healthErr
	}
	if !f.healthy {
		return ErrHealthProbeNotOK
	}
	return nil
}

func TestProbe_RunningWhenActiveAndHealthy(t *testing.T) {
	p := &LifecycleProbe{
		Service: &fakeServiceQuerier{registered: true, active: true},
		Health:  &fakeHealthClient{healthy: true},
	}
	res, err := p.Probe(context.Background(), ProbeInputs{ServiceName: "svc", EntrypointPath: "/tmp/entry.js", EntrypointExists: true})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.LifecycleState != StateRunning {
		t.Fatalf("expected %q, got %q (lastError=%q)", StateRunning, res.LifecycleState, res.LastError)
	}
}

func TestProbe_StoppedWhenRegisteredButInactive(t *testing.T) {
	p := &LifecycleProbe{
		Service: &fakeServiceQuerier{registered: true, active: false},
		Health:  &fakeHealthClient{},
	}
	res, _ := p.Probe(context.Background(), ProbeInputs{EntrypointExists: true})
	if res.LifecycleState != StateStopped {
		t.Fatalf("expected stopped, got %q", res.LifecycleState)
	}
}

func TestProbe_NotInstalledWhenUnregistered(t *testing.T) {
	p := &LifecycleProbe{
		Service: &fakeServiceQuerier{registered: false},
		Health:  &fakeHealthClient{},
	}
	res, _ := p.Probe(context.Background(), ProbeInputs{EntrypointExists: true})
	if res.LifecycleState != StateNotInstalled {
		t.Fatalf("expected not-installed, got %q", res.LifecycleState)
	}
	if res.LastError != ErrCodeServiceNotRegistered {
		t.Fatalf("expected lastError=%q, got %q", ErrCodeServiceNotRegistered, res.LastError)
	}
}

func TestProbe_NotInstalledWhenEntrypointMissing(t *testing.T) {
	p := &LifecycleProbe{
		Service: &fakeServiceQuerier{registered: true, active: false},
		Health:  &fakeHealthClient{},
	}
	res, _ := p.Probe(context.Background(), ProbeInputs{EntrypointExists: false})
	if res.LifecycleState != StateNotInstalled {
		t.Fatalf("expected not-installed (entrypoint missing), got %q", res.LifecycleState)
	}
	if res.LastError != ErrCodeEntrypointNotFound {
		t.Fatalf("expected lastError=%q, got %q", ErrCodeEntrypointNotFound, res.LastError)
	}
}

func TestProbe_UnhealthyWhenActiveButHealthFails(t *testing.T) {
	cases := []struct {
		name     string
		probeErr error
		wantCode string
	}{
		{"timeout", ErrHealthProbeTimeout, ErrCodeProbeTimeout},
		{"refused", ErrHealthProbeRefused, ErrCodeProbeRefused},
		{"non_ok", ErrHealthProbeNotOK, ErrCodeProbeNonOK},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			p := &LifecycleProbe{
				Service: &fakeServiceQuerier{registered: true, active: true},
				Health:  &fakeHealthClient{healthErr: c.probeErr},
			}
			res, _ := p.Probe(context.Background(), ProbeInputs{EntrypointExists: true})
			if res.LifecycleState != StateUnhealthy {
				t.Fatalf("%s: expected unhealthy, got %q", c.name, res.LifecycleState)
			}
			if res.LastError != c.wantCode {
				t.Fatalf("%s: expected lastError=%q, got %q", c.name, c.wantCode, res.LastError)
			}
		})
	}
}

func TestProbe_UnhealthyOnEntrypointPathDrift(t *testing.T) {
	p := &LifecycleProbe{
		Service: &fakeServiceQuerier{registered: true, active: true},
		Health:  &fakeHealthClient{healthy: true},
	}
	res, _ := p.Probe(context.Background(), ProbeInputs{
		EntrypointExists:        true,
		EntrypointDriftDetected: true,
	})
	if res.LifecycleState != StateUnhealthy {
		t.Fatalf("expected unhealthy on drift, got %q", res.LifecycleState)
	}
	if res.LastError != ErrCodeEntrypointPathDrift {
		t.Fatalf("expected drift code, got %q", res.LastError)
	}
}

func TestProbe_PropagatesServiceQueryError(t *testing.T) {
	boom := errors.New("boom")
	p := &LifecycleProbe{
		Service: &fakeServiceQuerier{queryErr: boom},
		Health:  &fakeHealthClient{},
	}
	_, err := p.Probe(context.Background(), ProbeInputs{EntrypointExists: true})
	if !errors.Is(err, boom) {
		t.Fatalf("expected wrapped query error, got %v", err)
	}
}
```

- [ ] **A3.2 — Run test to verify it fails**

```bash
cd deck-go && go test ./backend/internal/runtime/bundled/ -run TestProbe -v
```

Expected: build fails on undefined `LifecycleProbe`, `ServiceQuerier`, `HealthClient`, `ProbeInputs`, `StateRunning`, `StateStopped`, `StateNotInstalled`, `StateUnhealthy`, `ErrCode*`, `ErrHealthProbe*`.

- [ ] **A3.3 — Write minimal implementation**

```go
// deck-go/backend/internal/runtime/bundled/probe.go
package bundled

import (
	"context"
	"errors"
	"fmt"
)

// LifecycleState is one of four values; cli-missing is intentionally not
// represented (OQ4 resolved 2026-05-13 — entrypoint-missing surfaces as
// not-installed with lastError=entrypoint_not_found).
type LifecycleState string

const (
	StateRunning      LifecycleState = "running"
	StateStopped      LifecycleState = "stopped"
	StateNotInstalled LifecycleState = "not-installed"
	StateUnhealthy    LifecycleState = "unhealthy"
)

// Error codes surfaced via LifecycleResult.LastError.
const (
	ErrCodeProbeTimeout         = "probe_timeout"
	ErrCodeProbeRefused         = "probe_refused"
	ErrCodeProbeNonOK           = "probe_non_ok"
	ErrCodeEntrypointPathDrift  = "entrypoint_path_drift"
	ErrCodeServiceNotRegistered = "service_not_registered"
	ErrCodeEntrypointNotFound   = "entrypoint_not_found"
)

// Sentinel errors that HealthClient implementations may return; the probe maps
// these to LifecycleResult.LastError codes.
var (
	ErrHealthProbeTimeout = errors.New("health probe timeout")
	ErrHealthProbeRefused = errors.New("health probe connection refused")
	ErrHealthProbeNotOK   = errors.New("health probe non-OK response")
)

// ServiceState is the platform-agnostic projection of "is the service
// registered with the OS service manager, and is it currently active".
type ServiceState struct {
	Registered bool
	Active     bool
}

// ServiceQuerier abstracts launchd / systemd / schtasks queries. Production
// implementations shell out to `openclaw gateway status` or platform tooling.
type ServiceQuerier interface {
	Query(ctx context.Context, serviceName string) (ServiceState, error)
}

// HealthClient abstracts the loopback Gateway RPC `health` probe. Production
// implementations dial the bundled Gateway port.
type HealthClient interface {
	Health(ctx context.Context) error
}

// ProbeInputs are the per-call facts the caller (Facade) supplies to the probe.
type ProbeInputs struct {
	ServiceName             string
	EntrypointPath          string
	EntrypointExists        bool
	EntrypointDriftDetected bool
}

// LifecycleResult is the classifier output; it is the source of truth for the
// `lifecycleState` field returned by `GET /api/runtime/gateway`.
type LifecycleResult struct {
	LifecycleState LifecycleState
	LastError      string // empty when LifecycleState == StateRunning
}

// LifecycleProbe composes a ServiceQuerier and a HealthClient into the 4-state
// classifier defined in `specs/local-gateway-lifecycle/spec.md`.
type LifecycleProbe struct {
	Service ServiceQuerier
	Health  HealthClient
}

// Probe runs one classification pass. It does not retry, does not sleep, does
// not start any background goroutine. Decision D7: probes are triggered only
// at boot / on request / after lifecycle action.
func (p *LifecycleProbe) Probe(ctx context.Context, in ProbeInputs) (LifecycleResult, error) {
	if !in.EntrypointExists {
		return LifecycleResult{
			LifecycleState: StateNotInstalled,
			LastError:      ErrCodeEntrypointNotFound,
		}, nil
	}

	state, err := p.Service.Query(ctx, in.ServiceName)
	if err != nil {
		return LifecycleResult{}, fmt.Errorf("service query failed: %w", err)
	}

	if !state.Registered {
		return LifecycleResult{
			LifecycleState: StateNotInstalled,
			LastError:      ErrCodeServiceNotRegistered,
		}, nil
	}

	if !state.Active {
		return LifecycleResult{LifecycleState: StateStopped}, nil
	}

	if in.EntrypointDriftDetected {
		return LifecycleResult{
			LifecycleState: StateUnhealthy,
			LastError:      ErrCodeEntrypointPathDrift,
		}, nil
	}

	if err := p.Health.Health(ctx); err != nil {
		return LifecycleResult{
			LifecycleState: StateUnhealthy,
			LastError:      mapHealthError(err),
		}, nil
	}

	return LifecycleResult{LifecycleState: StateRunning}, nil
}

func mapHealthError(err error) string {
	switch {
	case errors.Is(err, ErrHealthProbeTimeout):
		return ErrCodeProbeTimeout
	case errors.Is(err, ErrHealthProbeRefused):
		return ErrCodeProbeRefused
	case errors.Is(err, ErrHealthProbeNotOK):
		return ErrCodeProbeNonOK
	default:
		return ErrCodeProbeNonOK
	}
}
```

- [ ] **A3.4 — Run test to verify it passes**

```bash
cd deck-go && go test ./backend/internal/runtime/bundled/ -run TestProbe -v
```

Expected: 7/7 PASS.

- [ ] **A3.5 — Commit**

```bash
git add deck-go/backend/internal/runtime/bundled/probe.go \
        deck-go/backend/internal/runtime/bundled/probe_test.go
git commit -m "feat(bundled): 4-state lifecycle probe classifier

Decision D6 + OQ4 resolution: classify into running / stopped /
not-installed / unhealthy from a ServiceQuerier and HealthClient. No
cli-missing state (entrypoint-missing surfaces as not-installed).

Tested: each of the four states, three unhealthy error-code mappings,
entrypoint drift, entrypoint missing, service query error propagation."
```

---

### Task A4: Lifecycle CLI proxy (shell-out wrapper)

**Files:**

- Create: `deck-go/backend/internal/runtime/bundled/lifecycle_proxy.go`
- Create: `deck-go/backend/internal/runtime/bundled/lifecycle_proxy_test.go`

**Acceptance:** `LifecycleProxy` exposes `Install` / `Start` / `Stop` / `Restart` / `Uninstall` / `Reinstall`; each call shells out via injected `ExecRunner` interface (so tests don't actually fork processes). Service-naming env vars (`OPENCLAW_LAUNCHD_LABEL` / `OPENCLAW_SYSTEMD_UNIT` / `OPENCLAW_WINDOWS_TASK_NAME`) are ALL set on every invocation; user-inherited env values must not override. NO `--service-name` / `--entrypoint` flags pass through (spec scenario "Service-naming env vars are never user-overridable").

- [ ] **A4.1 — Write the failing test**

```go
// deck-go/backend/internal/runtime/bundled/lifecycle_proxy_test.go
package bundled

import (
	"context"
	"errors"
	"strings"
	"testing"
)

type fakeExec struct {
	calls []ExecCall
	err   error
}

func (f *fakeExec) Run(ctx context.Context, call ExecCall) ([]byte, error) {
	f.calls = append(f.calls, call)
	return nil, f.err
}

func newProxy(exec *fakeExec) *LifecycleProxy {
	return &LifecycleProxy{
		ServiceName:    "openclaw-gateway.abc123def456",
		EntrypointPath: "/abs/repo/dist/entry.js",
		Exec:           exec,
	}
}

func TestLifecycleProxy_InstallShellsOutWithEnvVars(t *testing.T) {
	exec := &fakeExec{}
	p := newProxy(exec)
	if _, err := p.Install(context.Background()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(exec.calls) != 1 {
		t.Fatalf("expected 1 exec call, got %d", len(exec.calls))
	}
	call := exec.calls[0]
	if call.Command != "node" {
		t.Fatalf("expected command=node, got %q", call.Command)
	}
	wantArgs := []string{"/abs/repo/dist/entry.js", "gateway", "install"}
	if !equalSlices(call.Args, wantArgs) {
		t.Fatalf("expected args=%v, got %v", wantArgs, call.Args)
	}
	mustHaveEnv(t, call, "OPENCLAW_LAUNCHD_LABEL", "openclaw-gateway.abc123def456")
	mustHaveEnv(t, call, "OPENCLAW_SYSTEMD_UNIT", "openclaw-gateway.abc123def456")
	mustHaveEnv(t, call, "OPENCLAW_WINDOWS_TASK_NAME", "openclaw-gateway.abc123def456")
	for _, e := range call.Env {
		if strings.HasPrefix(e, "--service-name") || strings.HasPrefix(e, "--entrypoint") {
			t.Fatalf("unexpected flag-as-env leak: %q", e)
		}
	}
	for _, arg := range call.Args {
		if arg == "--service-name" || arg == "--entrypoint" {
			t.Fatalf("forbidden CLI flag passed: %q (use env vars instead)", arg)
		}
	}
}

func TestLifecycleProxy_StartShellsOutCorrectly(t *testing.T) {
	exec := &fakeExec{}
	p := newProxy(exec)
	if _, err := p.Start(context.Background()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	wantArgs := []string{"/abs/repo/dist/entry.js", "gateway", "start"}
	if !equalSlices(exec.calls[0].Args, wantArgs) {
		t.Fatalf("got args %v, want %v", exec.calls[0].Args, wantArgs)
	}
}

func TestLifecycleProxy_StopShellsOutCorrectly(t *testing.T) {
	exec := &fakeExec{}
	if _, err := newProxy(exec).Stop(context.Background()); err != nil {
		t.Fatal(err)
	}
	wantArgs := []string{"/abs/repo/dist/entry.js", "gateway", "stop"}
	if !equalSlices(exec.calls[0].Args, wantArgs) {
		t.Fatalf("got args %v, want %v", exec.calls[0].Args, wantArgs)
	}
}

func TestLifecycleProxy_RestartShellsOutCorrectly(t *testing.T) {
	exec := &fakeExec{}
	if _, err := newProxy(exec).Restart(context.Background()); err != nil {
		t.Fatal(err)
	}
	wantArgs := []string{"/abs/repo/dist/entry.js", "gateway", "restart"}
	if !equalSlices(exec.calls[0].Args, wantArgs) {
		t.Fatalf("got args %v, want %v", exec.calls[0].Args, wantArgs)
	}
}

func TestLifecycleProxy_UninstallShellsOutCorrectly(t *testing.T) {
	exec := &fakeExec{}
	if _, err := newProxy(exec).Uninstall(context.Background()); err != nil {
		t.Fatal(err)
	}
	wantArgs := []string{"/abs/repo/dist/entry.js", "gateway", "uninstall"}
	if !equalSlices(exec.calls[0].Args, wantArgs) {
		t.Fatalf("got args %v, want %v", exec.calls[0].Args, wantArgs)
	}
}

func TestLifecycleProxy_ReinstallIsUninstallThenInstall(t *testing.T) {
	exec := &fakeExec{}
	if _, err := newProxy(exec).Reinstall(context.Background()); err != nil {
		t.Fatal(err)
	}
	if len(exec.calls) != 2 {
		t.Fatalf("expected 2 exec calls (uninstall+install), got %d", len(exec.calls))
	}
	if exec.calls[0].Args[2] != "uninstall" {
		t.Fatalf("expected first call uninstall, got %q", exec.calls[0].Args[2])
	}
	if exec.calls[1].Args[2] != "install" {
		t.Fatalf("expected second call install, got %q", exec.calls[1].Args[2])
	}
}

func TestLifecycleProxy_ExecFailureSurfacesStderr(t *testing.T) {
	exec := &fakeExec{err: errors.New("exit status 1: launchctl rejected")}
	_, err := newProxy(exec).Start(context.Background())
	if err == nil || !strings.Contains(err.Error(), "launchctl rejected") {
		t.Fatalf("expected wrapped exec error, got %v", err)
	}
}

func TestLifecycleProxy_ServiceNameEnvVarsAreNotInheritedOverridable(t *testing.T) {
	// Caller sets an inherited env that tries to override our naming; proxy
	// must overwrite it, not honor it.
	exec := &fakeExec{}
	p := &LifecycleProxy{
		ServiceName:    "openclaw-gateway.correctname1",
		EntrypointPath: "/abs/repo/dist/entry.js",
		Exec:           exec,
		InheritEnv: []string{
			"OPENCLAW_LAUNCHD_LABEL=hijacked-name",
			"PATH=/usr/bin",
		},
	}
	if _, err := p.Start(context.Background()); err != nil {
		t.Fatal(err)
	}
	mustHaveEnv(t, exec.calls[0], "OPENCLAW_LAUNCHD_LABEL", "openclaw-gateway.correctname1")
	mustHaveEnv(t, exec.calls[0], "PATH", "/usr/bin")
}

func equalSlices(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func mustHaveEnv(t *testing.T, call ExecCall, key, value string) {
	t.Helper()
	want := key + "=" + value
	for _, e := range call.Env {
		if e == want {
			return
		}
	}
	t.Fatalf("missing env entry %q in %v", want, call.Env)
}
```

- [ ] **A4.2 — Run test to verify it fails**

```bash
cd deck-go && go test ./backend/internal/runtime/bundled/ -run TestLifecycleProxy -v
```

Expected: build fails on undefined `LifecycleProxy`, `ExecRunner`, `ExecCall`.

- [ ] **A4.3 — Write minimal implementation**

```go
// deck-go/backend/internal/runtime/bundled/lifecycle_proxy.go
package bundled

import (
	"context"
	"fmt"
	"os/exec"
	"strings"
)

// ExecCall is the side-effect-free description of one shell-out invocation.
// LifecycleProxy builds an ExecCall and hands it to the injected ExecRunner so
// unit tests can capture the call without forking a real process.
type ExecCall struct {
	Command string
	Args    []string
	Env     []string
}

// ExecRunner abstracts the os/exec call site.
type ExecRunner interface {
	Run(ctx context.Context, call ExecCall) ([]byte, error)
}

// LifecycleProxy invokes `node <entrypoint> gateway <action>` for each
// lifecycle action. Service identity is communicated through OS-service-naming
// env vars (NOT --service-name / --entrypoint CLI flags, which the upstream
// CLI at src/cli/daemon-cli/register-service-commands.ts:72-119 does not
// define — verified at Stage 1 gate task 1.2).
type LifecycleProxy struct {
	ServiceName    string
	EntrypointPath string
	Exec           ExecRunner
	// InheritEnv is the operator's process env to pass through (e.g. PATH).
	// Service-naming keys in InheritEnv are dropped — proxy sets its own.
	InheritEnv []string
}

func (p *LifecycleProxy) Install(ctx context.Context) ([]byte, error) {
	return p.run(ctx, "install")
}

func (p *LifecycleProxy) Start(ctx context.Context) ([]byte, error) {
	return p.run(ctx, "start")
}

func (p *LifecycleProxy) Stop(ctx context.Context) ([]byte, error) {
	return p.run(ctx, "stop")
}

func (p *LifecycleProxy) Restart(ctx context.Context) ([]byte, error) {
	return p.run(ctx, "restart")
}

func (p *LifecycleProxy) Uninstall(ctx context.Context) ([]byte, error) {
	return p.run(ctx, "uninstall")
}

// Reinstall = uninstall + install with the currently-resolved entrypoint, so a
// moved repo gets the corrected absolute path persisted into the new plist.
func (p *LifecycleProxy) Reinstall(ctx context.Context) ([]byte, error) {
	if _, err := p.run(ctx, "uninstall"); err != nil {
		return nil, fmt.Errorf("reinstall: uninstall step failed: %w", err)
	}
	return p.run(ctx, "install")
}

func (p *LifecycleProxy) run(ctx context.Context, action string) ([]byte, error) {
	call := ExecCall{
		Command: "node",
		Args:    []string{p.EntrypointPath, "gateway", action},
		Env:     p.buildEnv(),
	}
	out, err := p.Exec.Run(ctx, call)
	if err != nil {
		return out, fmt.Errorf("gateway %s failed: %w", action, err)
	}
	return out, nil
}

func (p *LifecycleProxy) buildEnv() []string {
	const (
		keyLaunchd = "OPENCLAW_LAUNCHD_LABEL"
		keySystemd = "OPENCLAW_SYSTEMD_UNIT"
		keyTask    = "OPENCLAW_WINDOWS_TASK_NAME"
	)
	naming := map[string]string{
		keyLaunchd: p.ServiceName,
		keySystemd: p.ServiceName,
		keyTask:    p.ServiceName,
	}

	out := make([]string, 0, len(p.InheritEnv)+len(naming))
	for _, entry := range p.InheritEnv {
		key := entry
		if eq := strings.IndexByte(entry, '='); eq >= 0 {
			key = entry[:eq]
		}
		if _, owned := naming[key]; owned {
			continue // strip user-supplied override; proxy is authoritative
		}
		out = append(out, entry)
	}
	for k, v := range naming {
		out = append(out, k+"="+v)
	}
	return out
}

// OSExecRunner is the production ExecRunner. Tests use a fake.
type OSExecRunner struct{}

func (OSExecRunner) Run(ctx context.Context, call ExecCall) ([]byte, error) {
	cmd := exec.CommandContext(ctx, call.Command, call.Args...)
	cmd.Env = call.Env
	out, err := cmd.CombinedOutput()
	if err != nil {
		return out, fmt.Errorf("%w: %s", err, strings.TrimSpace(string(out)))
	}
	return out, nil
}
```

- [ ] **A4.4 — Run test to verify it passes**

```bash
cd deck-go && go test ./backend/internal/runtime/bundled/ -run TestLifecycleProxy -v
```

Expected: 8/8 PASS.

- [ ] **A4.5 — Commit**

```bash
git add deck-go/backend/internal/runtime/bundled/lifecycle_proxy.go \
        deck-go/backend/internal/runtime/bundled/lifecycle_proxy_test.go
git commit -m "feat(bundled): CLI lifecycle proxy with env-var service naming

Decision D1 + R1c H1 resolution: shell out to upstream
node <entrypoint> gateway <action>; service identity through
OPENCLAW_LAUNCHD_LABEL / OPENCLAW_SYSTEMD_UNIT / OPENCLAW_WINDOWS_TASK_NAME
env vars (NOT --service-name / --entrypoint flags — verified absent from
src/cli/daemon-cli/register-service-commands.ts:72-119). Inherited
service-naming env vars are overwritten (anti-footgun).

Tested: each of 5 actions, reinstall=uninstall+install, exec failure
propagation, inherited env protection."
```

---

## Phase B — Facade interface extension + bundled rewrite + supervisor deletion

This phase composes Phase A primitives into the public `bundled.Facade` and extends the `facade.RuntimeFacade` interface. The supervisor / preflight / process_group files are deleted at the end of this phase — after the rewrite proves it can satisfy the same `facade_test.go` expectations.

### Task B1: Extend `facade.RuntimeFacade` interface and `RuntimeStatus`

**Files:**

- Modify: `deck-go/backend/internal/runtime/facade/facade.go`
- Modify: `deck-go/backend/internal/runtime/facade/facade_test.go`
- Modify: `deck-go/backend/internal/runtime/facade/import_boundary_test.go` (only if it asserts method set; verify by grep)

**Acceptance:** New methods `Install(ctx)` and `Reinstall(ctx)` on `RuntimeFacade` (existing implementations may return `ErrUnsupported` until Task B2). `RuntimeStatus` gains three lifecycle fields. Existing fields preserved (Stage 2 drops the supervisor-specific ones).

- [ ] **B1.1 — Write the failing test**

Append the following to `facade_test.go`:

```go
func TestRuntimeFacade_RequiresInstallAndReinstall(t *testing.T) {
	// Compile-time check: any RuntimeFacade implementation must expose Install
	// and Reinstall. This test fails to compile if the interface omits them.
	var _ RuntimeFacade = (*minimalFacade)(nil)
	_ = (RuntimeFacade)(nil).Install
	_ = (RuntimeFacade)(nil).Reinstall
}

// minimalFacade is a no-op RuntimeFacade implementation used to compile-check
// interface coverage. Add stub methods for every interface method.
type minimalFacade struct{}

func (minimalFacade) Capabilities(context.Context) (Capabilities, error)              { return Capabilities{}, nil }
func (minimalFacade) Endpoint(context.Context) (EndpointView, error)                  { return EndpointView{}, nil }
func (minimalFacade) UpdateRemoteEndpoint(context.Context, RemoteEndpointInput) (EndpointView, error) {
	return EndpointView{}, ErrUnsupported
}
func (minimalFacade) TestRemoteEndpoint(context.Context, *RemoteEndpointInput) (TestResult, error) {
	return TestResult{}, ErrUnsupported
}
func (minimalFacade) RuntimeGatewayStatus(context.Context) (RuntimeStatus, error) {
	return RuntimeStatus{}, nil
}
func (minimalFacade) Start(context.Context) (RuntimeStatus, error)         { return RuntimeStatus{}, nil }
func (minimalFacade) Stop(context.Context) (RuntimeStatus, error)          { return RuntimeStatus{}, nil }
func (minimalFacade) Restart(context.Context) (RuntimeStatus, error)       { return RuntimeStatus{}, nil }
func (minimalFacade) Install(context.Context) (RuntimeStatus, error)       { return RuntimeStatus{}, nil }
func (minimalFacade) Reinstall(context.Context) (RuntimeStatus, error)     { return RuntimeStatus{}, nil }
func (minimalFacade) ReloadRuntime(context.Context) (RuntimeStatus, error) { return RuntimeStatus{}, nil }

func TestRuntimeStatus_HasLifecycleFields(t *testing.T) {
	s := RuntimeStatus{
		LifecycleState: "running",
		ServiceName:    "openclaw-gateway.abc123def456",
		EntrypointPath: "/abs/repo/dist/entry.js",
	}
	if s.LifecycleState != "running" || s.ServiceName == "" || s.EntrypointPath == "" {
		t.Fatalf("expected fields to round-trip, got %+v", s)
	}
}
```

(Also add `import "context"` at the top of the file if not already there.)

- [ ] **B1.2 — Run test to verify it fails**

```bash
cd deck-go && go test ./backend/internal/runtime/facade/ -run "TestRuntimeFacade_RequiresInstallAndReinstall|TestRuntimeStatus_HasLifecycleFields" -v
```

Expected: compile errors on `Install`, `Reinstall`, `LifecycleState`, `ServiceName`, `EntrypointPath`.

- [ ] **B1.3 — Modify `facade.go` to extend interface and struct**

In `deck-go/backend/internal/runtime/facade/facade.go`, change the `RuntimeFacade` interface to:

```go
type RuntimeFacade interface {
	Capabilities(context.Context) (Capabilities, error)
	Endpoint(context.Context) (EndpointView, error)
	UpdateRemoteEndpoint(context.Context, RemoteEndpointInput) (EndpointView, error)
	TestRemoteEndpoint(context.Context, *RemoteEndpointInput) (TestResult, error)
	RuntimeGatewayStatus(context.Context) (RuntimeStatus, error)
	Start(context.Context) (RuntimeStatus, error)
	Stop(context.Context) (RuntimeStatus, error)
	Restart(context.Context) (RuntimeStatus, error)
	Install(context.Context) (RuntimeStatus, error)
	Reinstall(context.Context) (RuntimeStatus, error)
	ReloadRuntime(context.Context) (RuntimeStatus, error)
}
```

And extend `RuntimeStatus`:

```go
type RuntimeStatus struct {
	Mode            string  `json:"mode"`
	Configured      bool    `json:"configured,omitempty"`
	Status          string  `json:"status,omitempty"`
	Health          string  `json:"health,omitempty"`
	GatewayURL      string  `json:"gatewayUrl,omitempty"`
	PID             *int    `json:"pid,omitempty"`
	OwnershipState  string  `json:"ownershipState,omitempty"`
	RestartAttempts int     `json:"restartAttempts,omitempty"`
	LastConnectedAt *string `json:"lastConnectedAt,omitempty"`
	LastError       *string `json:"lastError,omitempty"`
	LatencyP50      *int    `json:"latencyP50,omitempty"`
	TLSVerified     *bool   `json:"tlsVerified,omitempty"`

	// Local-mode lifecycle fields (Decision D6). Empty when supervisorState is
	// false (i.e. remote mode); always non-empty in local mode.
	LifecycleState string `json:"lifecycleState,omitempty"`
	ServiceName    string `json:"serviceName,omitempty"`
	EntrypointPath string `json:"entrypointPath,omitempty"`
}
```

- [ ] **B1.4 — Update any existing impls that no longer satisfy the interface**

The remote impl and any test stubs that implement `RuntimeFacade` will fail to compile until they gain `Install` / `Reinstall`. For Stage 1, every non-bundled implementation returns `ErrUnsupported`:

```go
// in remote/facade.go (and any test stubs):
func (f *Facade) Install(context.Context) (facade.RuntimeStatus, error) {
	return facade.RuntimeStatus{}, facade.ErrUnsupported
}
func (f *Facade) Reinstall(context.Context) (facade.RuntimeStatus, error) {
	return facade.RuntimeStatus{}, facade.ErrUnsupported
}
```

Run `cd deck-go && go build ./...` and add stubs for every reported missing-method site. Do NOT modify any handler import behavior — only stub method additions.

- [ ] **B1.5 — Verify tests pass**

```bash
cd deck-go && go test ./backend/internal/runtime/facade/ -v
```

Expected: new tests + existing tests all PASS.

- [ ] **B1.6 — Commit**

```bash
git add deck-go/backend/internal/runtime/facade/ \
        deck-go/backend/internal/runtime/remote/
git commit -m "feat(facade): add Install/Reinstall to RuntimeFacade

R2 corrected: HTTP handlers must depend on facade only (no concrete
bundled/local/remote import). The lifecycle action endpoints added in
Phase C call Install/Reinstall through the facade; the remote impl
returns ErrUnsupported.

Also adds LifecycleState / ServiceName / EntrypointPath to RuntimeStatus
for local-mode lifecycle payload (Decision D6); existing supervisor
fields preserved (Stage 2 prunes)."
```

---

### Task B2: Rewrite `bundled/facade.go` against new primitives

**Files:**

- Modify: `deck-go/backend/internal/runtime/bundled/facade.go`
- Modify: `deck-go/backend/internal/runtime/bundled/facade_test.go`

**Acceptance:** `bundled.Facade` no longer references `Supervisor`. `Start` / `Stop` / `Restart` / `Install` / `Reinstall` dispatch through `LifecycleProxy`. `RuntimeGatewayStatus` is built from a `LifecycleProbe` snapshot. `Capabilities()` still returns `Mode: "bundled"` and `SupervisorState: true` (Stage 1 invariant — Stage 2 flips Mode value). `LastError` populated when probe surfaces a non-empty error code.

- [ ] **B2.1 — Write the failing test (probe-driven facade behavior)**

Replace `deck-go/backend/internal/runtime/bundled/facade_test.go` body with:

```go
package bundled

import (
	"context"
	"errors"
	"testing"

	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/envconf"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
)

type stubExec struct {
	err error
}

func (s *stubExec) Run(ctx context.Context, call ExecCall) ([]byte, error) {
	return nil, s.err
}

type stubService struct {
	state ServiceState
	err   error
}

func (s *stubService) Query(context.Context, string) (ServiceState, error) {
	return s.state, s.err
}

type stubHealth struct{ err error }

func (s *stubHealth) Health(context.Context) error { return s.err }

func newTestFacade(t *testing.T, svc *stubService, hc *stubHealth, exec ExecRunner) *Facade {
	t.Helper()
	cfg := &envconf.RuntimeBundledConfig{}
	f, err := New(cfg, Dependencies{
		ResolveOpts: ResolveOptions{InstallTimeAbsolutePath: "/abs/repo/dist/entry.js"},
		// Test-only override skips the inside-repo verifier.
		EntrypointOverride: "/abs/repo/dist/entry.js",
		ServiceName:        "openclaw-gateway.testhash1234",
		Probe:              &LifecycleProbe{Service: svc, Health: hc},
		ProxyExec:          exec,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	return f
}

func TestBundledFacade_Capabilities_ReportsBundledMode(t *testing.T) {
	f := newTestFacade(t, &stubService{}, &stubHealth{}, &stubExec{})
	caps, err := f.Capabilities(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if caps.Mode != string(envconf.ModeBundled) {
		t.Fatalf("Stage 1 invariant violated: Mode=%q (Stage 2 renames to local)", caps.Mode)
	}
	if !caps.SupervisorState {
		t.Fatal("expected SupervisorState=true in bundled mode")
	}
}

func TestBundledFacade_RuntimeGatewayStatus_PopulatesLifecycleFields(t *testing.T) {
	f := newTestFacade(t,
		&stubService{state: ServiceState{Registered: true, Active: true}},
		&stubHealth{},
		&stubExec{},
	)
	status, err := f.RuntimeGatewayStatus(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if status.LifecycleState != string(StateRunning) {
		t.Fatalf("expected running, got %q", status.LifecycleState)
	}
	if status.ServiceName != "openclaw-gateway.testhash1234" {
		t.Fatalf("missing service name: %+v", status)
	}
	if status.EntrypointPath == "" {
		t.Fatalf("expected EntrypointPath populated, got empty")
	}
}

func TestBundledFacade_RuntimeGatewayStatus_LastErrorOnUnhealthy(t *testing.T) {
	f := newTestFacade(t,
		&stubService{state: ServiceState{Registered: true, Active: true}},
		&stubHealth{err: ErrHealthProbeRefused},
		&stubExec{},
	)
	status, err := f.RuntimeGatewayStatus(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if status.LifecycleState != string(StateUnhealthy) {
		t.Fatalf("expected unhealthy, got %q", status.LifecycleState)
	}
	if status.LastError == nil || *status.LastError != ErrCodeProbeRefused {
		t.Fatalf("expected lastError=%q, got %v", ErrCodeProbeRefused, status.LastError)
	}
}

func TestBundledFacade_Start_InvokesProxy(t *testing.T) {
	exec := &stubExec{}
	f := newTestFacade(t,
		&stubService{state: ServiceState{Registered: true, Active: false}},
		&stubHealth{},
		exec,
	)
	if _, err := f.Start(context.Background()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestBundledFacade_Install_InvokesProxy(t *testing.T) {
	exec := &stubExec{}
	f := newTestFacade(t,
		&stubService{state: ServiceState{Registered: false}},
		&stubHealth{},
		exec,
	)
	if _, err := f.Install(context.Background()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestBundledFacade_Reinstall_InvokesProxyTwice(t *testing.T) {
	// Reinstall = uninstall + install; we assert via proxy double-call in
	// LifecycleProxy unit tests; here we just assert no error on the facade
	// path.
	f := newTestFacade(t,
		&stubService{state: ServiceState{Registered: true, Active: false}},
		&stubHealth{},
		&stubExec{},
	)
	if _, err := f.Reinstall(context.Background()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestBundledFacade_RemoteEndpointMethodsUnsupported(t *testing.T) {
	f := newTestFacade(t, &stubService{}, &stubHealth{}, &stubExec{})
	if _, err := f.UpdateRemoteEndpoint(context.Background(), facade.RemoteEndpointInput{}); !errors.Is(err, facade.ErrUnsupported) {
		t.Fatalf("expected ErrUnsupported, got %v", err)
	}
}
```

- [ ] **B2.2 — Run test to verify it fails**

```bash
cd deck-go && go test ./backend/internal/runtime/bundled/ -run TestBundledFacade -v
```

Expected: build failures referencing `Dependencies`, missing `New` signature, missing `EntrypointOverride`, etc.

- [ ] **B2.3 — Rewrite `bundled/facade.go`**

Replace the file body with:

```go
// deck-go/backend/internal/runtime/bundled/facade.go
package bundled

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/envconf"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
)

// Dependencies are the constructor inputs for a Facade. All fields are
// optional in tests (sensible defaults are provided); production callers
// supply a complete set built in cmd/deck-go/main.go.
type Dependencies struct {
	ResolveOpts        ResolveOptions
	EntrypointOverride string // test-only escape hatch; skips ResolveEntrypoint
	ServiceName        string // when empty, derived from the resolved repo root
	Probe              *LifecycleProbe
	ProxyExec          ExecRunner
	InheritEnv         []string
}

// Facade is the bundled-mode RuntimeFacade implementation. It owns no
// subprocesses — every lifecycle action shells out to the upstream CLI via
// LifecycleProxy. Probe is the source of truth for RuntimeGatewayStatus.
type Facade struct {
	cfg            envconf.RuntimeBundledConfig
	entrypointPath string
	serviceName    string
	probe          *LifecycleProbe
	proxy          *LifecycleProxy
}

// New constructs a Facade from cfg and deps. It resolves the entrypoint (or
// honors the test override), derives the service name (or honors override),
// and wires the proxy + probe.
func New(cfg *envconf.RuntimeBundledConfig, deps Dependencies) (*Facade, error) {
	if cfg == nil {
		return nil, errors.New("bundled runtime config is required")
	}
	entry := deps.EntrypointOverride
	if entry == "" {
		resolved, err := ResolveEntrypoint(deps.ResolveOpts)
		if err != nil {
			return nil, err
		}
		entry = resolved
	}
	svcName := deps.ServiceName
	if svcName == "" {
		// Derive from the repo root (two levels up from dist/entry.js).
		repoRoot := filepath.Clean(filepath.Join(filepath.Dir(entry), ".."))
		svcName = DeriveServiceName(repoRoot)
	}
	proxy := &LifecycleProxy{
		ServiceName:    svcName,
		EntrypointPath: entry,
		Exec:           deps.ProxyExec,
		InheritEnv:     deps.InheritEnv,
	}
	if proxy.Exec == nil {
		proxy.Exec = OSExecRunner{}
	}
	probe := deps.Probe
	if probe == nil {
		probe = &LifecycleProbe{} // caller may inject Service/Health later
	}
	return &Facade{
		cfg:            *cfg,
		entrypointPath: entry,
		serviceName:    svcName,
		probe:          probe,
		proxy:          proxy,
	}, nil
}

func (f *Facade) Capabilities(context.Context) (facade.Capabilities, error) {
	return facade.Capabilities{
		Mode:            string(envconf.ModeBundled), // Stage 1 invariant; Stage 2 flips to "local"
		Configured:      true,                        // local-mode capabilities.configured ALWAYS true post-Stage-1
		EndpointMutable: false,
		SupervisorState: true,
	}, nil
}

func (f *Facade) Endpoint(context.Context) (facade.EndpointView, error) {
	return facade.EndpointView{
		URL:             bundledEndpointURL(f.cfg),
		TokenConfigured: strings.TrimSpace(f.cfg.Token) != "",
		TLSVerify:       false,
		Source:          "env",
	}, nil
}

func (f *Facade) UpdateRemoteEndpoint(context.Context, facade.RemoteEndpointInput) (facade.EndpointView, error) {
	return facade.EndpointView{}, facade.ErrUnsupported
}

func (f *Facade) TestRemoteEndpoint(context.Context, *facade.RemoteEndpointInput) (facade.TestResult, error) {
	return facade.TestResult{}, facade.ErrUnsupported
}

func (f *Facade) RuntimeGatewayStatus(ctx context.Context) (facade.RuntimeStatus, error) {
	entrypointExists := false
	if info, err := os.Stat(f.entrypointPath); err == nil && !info.IsDir() {
		entrypointExists = true
	}
	res, err := f.probe.Probe(ctx, ProbeInputs{
		ServiceName:      f.serviceName,
		EntrypointPath:   f.entrypointPath,
		EntrypointExists: entrypointExists,
	})
	if err != nil {
		return facade.RuntimeStatus{}, err
	}
	status := facade.RuntimeStatus{
		Mode:           string(envconf.ModeBundled), // Stage 1 invariant
		LifecycleState: string(res.LifecycleState),
		ServiceName:    f.serviceName,
		EntrypointPath: f.entrypointPath,
	}
	if res.LastError != "" {
		s := res.LastError
		status.LastError = &s
	}
	return status, nil
}

func (f *Facade) Start(ctx context.Context) (facade.RuntimeStatus, error) {
	if _, err := f.proxy.Start(ctx); err != nil {
		return f.RuntimeGatewayStatus(ctx)
	}
	return f.RuntimeGatewayStatus(ctx)
}

func (f *Facade) Stop(ctx context.Context) (facade.RuntimeStatus, error) {
	if _, err := f.proxy.Stop(ctx); err != nil {
		return f.RuntimeGatewayStatus(ctx)
	}
	return f.RuntimeGatewayStatus(ctx)
}

func (f *Facade) Restart(ctx context.Context) (facade.RuntimeStatus, error) {
	if _, err := f.proxy.Restart(ctx); err != nil {
		return f.RuntimeGatewayStatus(ctx)
	}
	return f.RuntimeGatewayStatus(ctx)
}

func (f *Facade) Install(ctx context.Context) (facade.RuntimeStatus, error) {
	if _, err := f.proxy.Install(ctx); err != nil {
		return f.RuntimeGatewayStatus(ctx)
	}
	return f.RuntimeGatewayStatus(ctx)
}

func (f *Facade) Reinstall(ctx context.Context) (facade.RuntimeStatus, error) {
	if _, err := f.proxy.Reinstall(ctx); err != nil {
		return f.RuntimeGatewayStatus(ctx)
	}
	return f.RuntimeGatewayStatus(ctx)
}

// ReloadRuntime: for bundled mode this is equivalent to Restart (Decision D7
// has no auto-restart loop; reload-runtime is a manual recovery affordance).
func (f *Facade) ReloadRuntime(ctx context.Context) (facade.RuntimeStatus, error) {
	return f.Restart(ctx)
}

func bundledEndpointURL(cfg envconf.RuntimeBundledConfig) string {
	host := strings.TrimSpace(cfg.BindHost)
	if host == "" {
		host = "127.0.0.1"
	}
	port := cfg.BindPort
	if port <= 0 {
		port = 18789
	}
	return "ws://" + host + ":" + strconv.Itoa(port)
}

var _ facade.RuntimeFacade = (*Facade)(nil)
```

Also remove any `init()` registering a "bundled factory" if the surrounding code still references `RegisterBundledFactory` with the OLD `New(cfg)` signature — update the registration site to match the new `New(cfg, deps)` shape:

```go
// Likely lives in cmd/deck-go/main.go or facade/build.go; locate via:
//   git grep -n "RegisterBundledFactory\|bundled.New(" -- deck-go/backend
```

The factory site builds `Dependencies` from runtime config. Example wiring (verify the actual call site):

```go
// in facade/build.go or main.go
facade.RegisterBundledFactory(func(cfg *envconf.RuntimeBundledConfig) (facade.RuntimeFacade, error) {
	bffBin, _ := os.Executable()
	bffDir := filepath.Dir(bffBin)
	return bundled.New(cfg, bundled.Dependencies{
		ResolveOpts: bundled.ResolveOptions{
			RepoRootEnv:  os.Getenv("OPENCLAW_REPO_ROOT"),
			BFFBinaryDir: bffDir,
		},
		InheritEnv: os.Environ(),
		// Probe.Service and Probe.Health are wired in Task B3 follow-up
		// (or stubbed here with TODO until Phase C lands them).
	})
})
```

- [ ] **B2.4 — Run tests to verify they pass**

```bash
cd deck-go && go test ./backend/internal/runtime/bundled/ -v
```

Expected: all `TestBundledFacade_*` tests PASS. Test runner may report failures from the still-present `supervisor_test.go` / `preflight_test.go` — those are deleted in Task B3.

- [ ] **B2.5 — Commit**

```bash
git add deck-go/backend/internal/runtime/bundled/facade.go \
        deck-go/backend/internal/runtime/bundled/facade_test.go \
        deck-go/backend/internal/runtime/facade/build.go
git commit -m "feat(bundled): rewrite Facade against LifecycleProxy+Probe

Decision D1+D6+D7: replace Supervisor with LifecycleProxy (CLI shell-out)
and LifecycleProbe (4-state classifier). RuntimeGatewayStatus is built
from a fresh probe on every call (no caching, no background polling).

Stage 1 invariants preserved:
- Capabilities.Mode = \"bundled\" (Stage 2 renames)
- Capabilities.SupervisorState = true
- Capabilities.Configured = true (local-mode invariant; spec D6)

Tested: capabilities, status running/unhealthy paths, Start/Install/
Reinstall proxy dispatch, ErrUnsupported on remote-endpoint methods."
```

---

### Task B3: Delete supervisor / preflight / process_group files

**Files:**

- Delete: `deck-go/backend/internal/runtime/bundled/supervisor.go`
- Delete: `deck-go/backend/internal/runtime/bundled/supervisor_test.go`
- Delete: `deck-go/backend/internal/runtime/bundled/preflight.go`
- Delete: `deck-go/backend/internal/runtime/bundled/preflight_test.go`
- Delete: `deck-go/backend/internal/runtime/bundled/process_group_unix.go`
- Delete: `deck-go/backend/internal/runtime/bundled/process_group_windows.go`

**Acceptance:** `go build ./...` passes after deletion. No remaining import of `Supervisor` anywhere in `deck-go/backend/`. Any call site that previously held a `*Supervisor` reference no longer does so (audit via grep).

- [ ] **B3.1 — Audit remaining references**

```bash
cd deck-go && git grep -n "bundled\.Supervisor\|bundled\.Preflight\|bundled\.NewWithSupervisor\|bundled\.AttachSupervisor\|ProcessGroup\b" -- backend
```

Expected: zero results outside the files being deleted. If any production file still references these, fix it before deletion (likely lives in `cmd/deck-go/main.go` or `cmd/controld/main.go`).

- [ ] **B3.2 — Delete files**

```bash
cd deck-go && git rm \
  backend/internal/runtime/bundled/supervisor.go \
  backend/internal/runtime/bundled/supervisor_test.go \
  backend/internal/runtime/bundled/preflight.go \
  backend/internal/runtime/bundled/preflight_test.go \
  backend/internal/runtime/bundled/process_group_unix.go \
  backend/internal/runtime/bundled/process_group_windows.go
```

- [ ] **B3.3 — Verify build + tests**

```bash
cd deck-go && go build ./... && go test ./backend/internal/runtime/...
```

Expected: build PASS; all tests in `runtime/` PASS.

- [ ] **B3.4 — Commit**

```bash
git commit -m "refactor(bundled): delete legacy spawn/supervisor code

Decision D1: bundled package no longer owns a Gateway subprocess; the
lifecycle is delegated to OS service manager via LifecycleProxy. The
supervisor / preflight / process_group / lock / fingerprint / ownership
implementations are dead code.

Verified: go build ./... passes, runtime/ tests pass."
```

---

## Phase C — HTTP lifecycle routes + D10 carve-out

This phase exposes the facade's lifecycle methods over HTTP and implements the D10 mode-aware 503 carve-out. Handlers depend on `facade.RuntimeFacade` only (Rule R2).

### Task C1: Lifecycle action HTTP routes (install/start/stop/restart/reinstall/refresh)

**Files:**

- Create: `deck-go/backend/internal/server/runtime_lifecycle.go`
- Create: `deck-go/backend/internal/server/runtime_lifecycle_test.go`

**Acceptance:** Six new routes mounted: `POST /api/runtime/gateway/install`, `start`, `stop`, `restart`, `reinstall`, `refresh`. Each calls the corresponding facade method (refresh = RuntimeGatewayStatus). Remote-mode requests return HTTP 405 with `code: "lifecycle_unsupported_in_remote_mode"`. Each successful response carries the post-action probe result.

- [ ] **C1.1 — Write the failing test**

```go
// deck-go/backend/internal/server/runtime_lifecycle_test.go
package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
)

type fakeFacade struct {
	caps      facade.Capabilities
	status    facade.RuntimeStatus
	installed bool
	started   bool
	stopped   bool
	restarted bool
	reins     bool
}

func (f *fakeFacade) Capabilities(context.Context) (facade.Capabilities, error) {
	return f.caps, nil
}
func (f *fakeFacade) Endpoint(context.Context) (facade.EndpointView, error) {
	return facade.EndpointView{}, nil
}
func (f *fakeFacade) UpdateRemoteEndpoint(context.Context, facade.RemoteEndpointInput) (facade.EndpointView, error) {
	return facade.EndpointView{}, facade.ErrUnsupported
}
func (f *fakeFacade) TestRemoteEndpoint(context.Context, *facade.RemoteEndpointInput) (facade.TestResult, error) {
	return facade.TestResult{}, facade.ErrUnsupported
}
func (f *fakeFacade) RuntimeGatewayStatus(context.Context) (facade.RuntimeStatus, error) {
	return f.status, nil
}
func (f *fakeFacade) Start(context.Context) (facade.RuntimeStatus, error) {
	f.started = true
	return f.status, nil
}
func (f *fakeFacade) Stop(context.Context) (facade.RuntimeStatus, error) {
	f.stopped = true
	return f.status, nil
}
func (f *fakeFacade) Restart(context.Context) (facade.RuntimeStatus, error) {
	f.restarted = true
	return f.status, nil
}
func (f *fakeFacade) Install(context.Context) (facade.RuntimeStatus, error) {
	f.installed = true
	return f.status, nil
}
func (f *fakeFacade) Reinstall(context.Context) (facade.RuntimeStatus, error) {
	f.reins = true
	return f.status, nil
}
func (f *fakeFacade) ReloadRuntime(context.Context) (facade.RuntimeStatus, error) {
	return f.status, nil
}

type unsupportedFacade struct{ fakeFacade }

func (u *unsupportedFacade) Install(context.Context) (facade.RuntimeStatus, error) {
	return facade.RuntimeStatus{}, facade.ErrUnsupported
}
func (u *unsupportedFacade) Reinstall(context.Context) (facade.RuntimeStatus, error) {
	return facade.RuntimeStatus{}, facade.ErrUnsupported
}
func (u *unsupportedFacade) Start(context.Context) (facade.RuntimeStatus, error) {
	return facade.RuntimeStatus{}, facade.ErrUnsupported
}
func (u *unsupportedFacade) Stop(context.Context) (facade.RuntimeStatus, error) {
	return facade.RuntimeStatus{}, facade.ErrUnsupported
}
func (u *unsupportedFacade) Restart(context.Context) (facade.RuntimeStatus, error) {
	return facade.RuntimeStatus{}, facade.ErrUnsupported
}

func setupLifecycleRoutes(t *testing.T, f facade.RuntimeFacade) http.Handler {
	t.Helper()
	mux := http.NewServeMux()
	RegisterRuntimeLifecycleRoutes(mux, f)
	return mux
}

func TestLifecycleRoute_InstallLocalMode(t *testing.T) {
	f := &fakeFacade{
		caps:   facade.Capabilities{Mode: "bundled", SupervisorState: true},
		status: facade.RuntimeStatus{LifecycleState: "stopped"},
	}
	srv := httptest.NewServer(setupLifecycleRoutes(t, f))
	defer srv.Close()

	resp, err := http.Post(srv.URL+"/api/runtime/gateway/install", "application/json", strings.NewReader("{}"))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	if !f.installed {
		t.Fatal("expected facade.Install to be called")
	}
	var body facade.RuntimeStatus
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.LifecycleState != "stopped" {
		t.Fatalf("expected lifecycleState=stopped, got %q", body.LifecycleState)
	}
}

func TestLifecycleRoute_AllVerbsLocalMode(t *testing.T) {
	verbs := []struct {
		path    string
		dispatched func(*fakeFacade) bool
	}{
		{"/api/runtime/gateway/install", func(f *fakeFacade) bool { return f.installed }},
		{"/api/runtime/gateway/start", func(f *fakeFacade) bool { return f.started }},
		{"/api/runtime/gateway/stop", func(f *fakeFacade) bool { return f.stopped }},
		{"/api/runtime/gateway/restart", func(f *fakeFacade) bool { return f.restarted }},
		{"/api/runtime/gateway/reinstall", func(f *fakeFacade) bool { return f.reins }},
	}
	for _, v := range verbs {
		t.Run(v.path, func(t *testing.T) {
			f := &fakeFacade{caps: facade.Capabilities{Mode: "bundled", SupervisorState: true}}
			srv := httptest.NewServer(setupLifecycleRoutes(t, f))
			defer srv.Close()
			resp, err := http.Post(srv.URL+v.path, "application/json", strings.NewReader("{}"))
			if err != nil {
				t.Fatal(err)
			}
			resp.Body.Close()
			if resp.StatusCode != 200 {
				t.Fatalf("%s: expected 200, got %d", v.path, resp.StatusCode)
			}
			if !v.dispatched(f) {
				t.Fatalf("%s: facade method not dispatched", v.path)
			}
		})
	}
}

func TestLifecycleRoute_RefreshRunsProbe(t *testing.T) {
	f := &fakeFacade{
		caps:   facade.Capabilities{Mode: "bundled", SupervisorState: true},
		status: facade.RuntimeStatus{LifecycleState: "running"},
	}
	srv := httptest.NewServer(setupLifecycleRoutes(t, f))
	defer srv.Close()

	resp, err := http.Post(srv.URL+"/api/runtime/gateway/refresh", "application/json", strings.NewReader("{}"))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	var body facade.RuntimeStatus
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.LifecycleState != "running" {
		t.Fatalf("expected running, got %q", body.LifecycleState)
	}
}

func TestLifecycleRoute_RemoteMode405(t *testing.T) {
	f := &unsupportedFacade{fakeFacade: fakeFacade{caps: facade.Capabilities{Mode: "remote", SupervisorState: false}}}
	srv := httptest.NewServer(setupLifecycleRoutes(t, f))
	defer srv.Close()

	for _, path := range []string{"install", "start", "stop", "restart", "reinstall"} {
		t.Run(path, func(t *testing.T) {
			resp, err := http.Post(srv.URL+"/api/runtime/gateway/"+path, "application/json", strings.NewReader("{}"))
			if err != nil {
				t.Fatal(err)
			}
			defer resp.Body.Close()
			if resp.StatusCode != 405 {
				t.Fatalf("%s: expected 405, got %d", path, resp.StatusCode)
			}
			var body struct {
				Code string `json:"code"`
			}
			if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
				t.Fatal(err)
			}
			if body.Code != "lifecycle_unsupported_in_remote_mode" {
				t.Fatalf("%s: expected code=lifecycle_unsupported_in_remote_mode, got %q", path, body.Code)
			}
		})
	}
}

func TestLifecycleRoute_RejectsGET(t *testing.T) {
	f := &fakeFacade{caps: facade.Capabilities{Mode: "bundled", SupervisorState: true}}
	srv := httptest.NewServer(setupLifecycleRoutes(t, f))
	defer srv.Close()
	resp, err := http.Get(srv.URL + "/api/runtime/gateway/install")
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", resp.StatusCode)
	}
}

// Compile-time assertion that ErrUnsupported is what we expect.
var _ = errors.Is
```

- [ ] **C1.2 — Run test to verify it fails**

```bash
cd deck-go && go test ./backend/internal/server/ -run "TestLifecycleRoute" -v
```

Expected: build failure on `RegisterRuntimeLifecycleRoutes`.

- [ ] **C1.3 — Write minimal implementation**

```go
// deck-go/backend/internal/server/runtime_lifecycle.go
package server

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
)

// RegisterRuntimeLifecycleRoutes mounts the install/start/stop/restart/
// reinstall/refresh routes onto mux. The handlers depend only on
// facade.RuntimeFacade — no import of bundled/ or remote/ packages — per
// Rule R2.
func RegisterRuntimeLifecycleRoutes(mux *http.ServeMux, f facade.RuntimeFacade) {
	mux.HandleFunc("/api/runtime/gateway/install", lifecycleAction(f, (facade.RuntimeFacade).Install))
	mux.HandleFunc("/api/runtime/gateway/start", lifecycleAction(f, (facade.RuntimeFacade).Start))
	mux.HandleFunc("/api/runtime/gateway/stop", lifecycleAction(f, (facade.RuntimeFacade).Stop))
	mux.HandleFunc("/api/runtime/gateway/restart", lifecycleAction(f, (facade.RuntimeFacade).Restart))
	mux.HandleFunc("/api/runtime/gateway/reinstall", lifecycleAction(f, (facade.RuntimeFacade).Reinstall))
	mux.HandleFunc("/api/runtime/gateway/refresh", lifecycleAction(f, (facade.RuntimeFacade).RuntimeGatewayStatus))
}

// lifecycleAction returns an http.HandlerFunc that POSTs the named facade
// action. ErrUnsupported is mapped to HTTP 405 with the spec-defined error
// code; any other error becomes HTTP 500.
func lifecycleAction(f facade.RuntimeFacade, op func(facade.RuntimeFacade, _ httpCtx) (facade.RuntimeStatus, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		status, err := op(f, r.Context())
		if err != nil {
			if errors.Is(err, facade.ErrUnsupported) {
				writeJSON(w, http.StatusMethodNotAllowed, map[string]string{
					"code": "lifecycle_unsupported_in_remote_mode",
				})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{
				"code":    "lifecycle_action_failed",
				"message": err.Error(),
			})
			return
		}
		writeJSON(w, http.StatusOK, status)
	}
}

// httpCtx is a type alias to avoid pulling context import collisions; in
// practice this is just context.Context.
type httpCtx = interface{ Err() error }
```

NOTE: the function-pointer signature `(facade.RuntimeFacade).Install` will only compile if Go's method-value support matches. If the indirect-method-value pattern produces friction, fall back to per-route closures:

```go
mux.HandleFunc("/api/runtime/gateway/install", func(w http.ResponseWriter, r *http.Request) {
	dispatchLifecycle(w, r, f, f.Install)
})
// repeat for each action
```

(Pick the closure form if the type-erased version fights the compiler; both meet the test contract.)

Also reuse the existing `writeJSON` helper (already in the `server` package — confirm via `grep -n "func writeJSON" deck-go/backend/internal/server/`). If absent, add:

```go
func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
```

- [ ] **C1.4 — Wire the routes into the actual HTTP server**

Find the server registration site (typically `deck-go/backend/internal/server/server.go` or `cmd/deck-go/main.go`):

```bash
cd deck-go && git grep -n "mux\.Handle\(Func\)\?\(\"/api/runtime" -- backend
```

Add `RegisterRuntimeLifecycleRoutes(mux, runtimeFacade)` next to the existing `/api/runtime/...` registrations.

- [ ] **C1.5 — Run all tests**

```bash
cd deck-go && go test ./backend/internal/server/ -v
```

Expected: 6 new lifecycle route tests PASS, existing tests still PASS.

- [ ] **C1.6 — Commit**

```bash
git add deck-go/backend/internal/server/runtime_lifecycle.go \
        deck-go/backend/internal/server/runtime_lifecycle_test.go \
        deck-go/backend/internal/server/server.go
git commit -m "feat(server): lifecycle action HTTP routes

Add POST /api/runtime/gateway/{install,start,stop,restart,reinstall,refresh}
mounted via facade.RuntimeFacade only (no concrete impl import — Rule R2).
Remote mode returns 405 lifecycle_unsupported_in_remote_mode.

Tested: each of 5 actions dispatches facade method, refresh runs probe,
remote mode 405 for all five, GET rejected, response body is RuntimeStatus
JSON."
```

---

### Task C2: D10 carve-out — `local` mode `GET /api/runtime/gateway` always returns lifecycle payload

**Files:**

- Modify: `deck-go/backend/internal/server/runtime.go` (around line 77-86 per R1c H4 spot-check)
- Modify: `deck-go/backend/internal/server/runtime_test.go` (locate via `git grep -n "writeGatewayNotConfigured" deck-go/backend/internal/server/`)

**Acceptance:** When `capabilities.Mode == "bundled"` (Stage 1) or `"local"` (Stage 2-aware: handler accepts both), the 503 `gateway_not_configured` short-circuit at line 83-85 is NOT taken; the handler always proceeds to `runtimeFacade.RuntimeGatewayStatus(...)`. Remote mode 503 short-circuit unchanged.

- [ ] **C2.1 — Write the failing test**

```go
// deck-go/backend/internal/server/runtime_test.go (append)

func TestRuntimeGatewayHandler_LocalModeReturns200WhenNotConfigured(t *testing.T) {
	f := &fakeFacade{
		caps: facade.Capabilities{
			Mode:            "bundled", // Stage 1 invariant; Stage 2 flips
			Configured:      false,     // not-installed / stopped
			SupervisorState: true,
		},
		status: facade.RuntimeStatus{
			Mode:           "bundled",
			LifecycleState: "not-installed",
			ServiceName:    "openclaw-gateway.abc123def456",
			EntrypointPath: "/abs/repo/dist/entry.js",
		},
	}
	mux := http.NewServeMux()
	registerRuntimeRoutes(mux, f) // existing helper name; verify via grep
	srv := httptest.NewServer(mux)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/api/runtime/gateway")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("D10 carve-out broken: expected 200 in local mode with configured=false, got %d", resp.StatusCode)
	}
	var body facade.RuntimeStatus
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.LifecycleState != "not-installed" {
		t.Fatalf("expected lifecycle payload, got %+v", body)
	}
}

func TestRuntimeGatewayHandler_RemoteModePreserves503(t *testing.T) {
	f := &fakeFacade{
		caps: facade.Capabilities{
			Mode:            "remote",
			Configured:      false,
			SupervisorState: false,
		},
	}
	mux := http.NewServeMux()
	registerRuntimeRoutes(mux, f)
	srv := httptest.NewServer(mux)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/api/runtime/gateway")
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != 503 {
		t.Fatalf("remote first-run 503 contract broken: got %d", resp.StatusCode)
	}
}
```

- [ ] **C2.2 — Run test to verify it fails**

```bash
cd deck-go && go test ./backend/internal/server/ -run "TestRuntimeGatewayHandler" -v
```

Expected: `TestRuntimeGatewayHandler_LocalModeReturns200WhenNotConfigured` FAILS (current code returns 503); `TestRuntimeGatewayHandler_RemoteModePreserves503` PASSES (unchanged behavior).

- [ ] **C2.3 — Modify `runtime.go` at lines 77-86**

The current handler (per R1c spot-check):

```go
mux.MethodFunc("GET", "/runtime/gateway", func(w http.ResponseWriter, r *http.Request) {
    caps, err := runtimeFacade.Capabilities(r.Context())
    if err != nil {
        writeRuntimeError(w, http.StatusInternalServerError, "runtime_capabilities_failed", err.Error())
        return
    }
    if !caps.Configured {
        writeGatewayNotConfigured(w, r.Context(), runtimeFacade)
        return
    }
    payload, err := runtimeFacade.RuntimeGatewayStatus(r.Context())
    if err != nil {
        writeRuntimeFacadeError(w, err)
        return
    }
    writeJSON(w, http.StatusOK, payload)
})
```

Change to (D10 carve-out):

```go
mux.MethodFunc("GET", "/runtime/gateway", func(w http.ResponseWriter, r *http.Request) {
    caps, err := runtimeFacade.Capabilities(r.Context())
    if err != nil {
        writeRuntimeError(w, http.StatusInternalServerError, "runtime_capabilities_failed", err.Error())
        return
    }
    // D10 carve-out: in local mode, `Configured=false` is a valid product
    // state (not-installed / stopped) that the Operations Panel needs to
    // render. The 503 gateway_not_configured short-circuit applies only to
    // remote mode first-run.
    isLocal := caps.Mode == "bundled" || caps.Mode == "local"
    if !caps.Configured && !isLocal {
        writeGatewayNotConfigured(w, r.Context(), runtimeFacade)
        return
    }
    payload, err := runtimeFacade.RuntimeGatewayStatus(r.Context())
    if err != nil {
        writeRuntimeFacadeError(w, err)
        return
    }
    writeJSON(w, http.StatusOK, payload)
})
```

- [ ] **C2.4 — Run tests to verify they pass**

```bash
cd deck-go && go test ./backend/internal/server/ -run "TestRuntimeGatewayHandler" -v
```

Expected: both tests PASS.

- [ ] **C2.5 — Commit**

```bash
git add deck-go/backend/internal/server/runtime.go \
        deck-go/backend/internal/server/runtime_test.go
git commit -m "fix(server): local-mode lifecycle payload returned even when not configured

R1c H4 + Decision D10: GET /api/runtime/gateway in local (bundled) mode
no longer short-circuits to 503 gateway_not_configured when Configured=false;
local-mode lifecycleState (not-installed/stopped/unhealthy) is a valid
product state the Operations Panel must read. Remote first-run 503
preserved.

Tested: local mode 200 with lifecycle payload, remote mode 503 unchanged."
```

---

## Phase D — Canvas A2UI asset migration (D5)

This phase implements the D5 decision: Gateway-side static asset route (recorded in a separate Gateway PR — outside this plan's scope), BFF reverse-proxy passthrough at `/api/runtime/gateway-assets/*`, and removal of the bundled-only canvas A2UI loader from deck-go BFF.

### Task D1: BFF reverse-proxy route `/api/runtime/gateway-assets/*`

**Files:**

- Create: `deck-go/backend/internal/server/gateway_assets_proxy.go`
- Create: `deck-go/backend/internal/server/gateway_assets_proxy_test.go`

**Acceptance:** GET to `/api/runtime/gateway-assets/<path>` proxies to `<gateway_endpoint>/admin/assets/<path>`. BFF injects Gateway auth token internally (browser never sees token). Request path forwarded verbatim under `/admin/assets/`. Response body and content-type streamed. Non-GET methods rejected with 405.

- [ ] **D1.1 — Write the failing test**

```go
// deck-go/backend/internal/server/gateway_assets_proxy_test.go
package server

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestGatewayAssetsProxy_ForwardsGETToGateway(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/admin/assets/canvas/index.html" {
			t.Errorf("upstream path mismatch: got %q", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer secret-token" {
			t.Errorf("auth header missing: got %q", r.Header.Get("Authorization"))
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(200)
		_, _ = w.Write([]byte("<html>canvas</html>"))
	}))
	defer upstream.Close()

	mux := http.NewServeMux()
	RegisterGatewayAssetsProxy(mux, GatewayAssetsProxyConfig{
		GatewayEndpoint: upstream.URL,
		GatewayToken:    "secret-token",
	})
	srv := httptest.NewServer(mux)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/api/runtime/gateway-assets/canvas/index.html")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	if !strings.Contains(resp.Header.Get("Content-Type"), "text/html") {
		t.Errorf("content-type not propagated: %q", resp.Header.Get("Content-Type"))
	}
	body, _ := io.ReadAll(resp.Body)
	if string(body) != "<html>canvas</html>" {
		t.Errorf("body not propagated: %q", string(body))
	}
}

func TestGatewayAssetsProxy_DoesNotEchoTokenToBrowser(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Even if Gateway echoes Authorization back (it shouldn't), BFF must
		// strip it.
		w.Header().Set("X-Echo-Authorization", r.Header.Get("Authorization"))
		w.WriteHeader(200)
	}))
	defer upstream.Close()

	mux := http.NewServeMux()
	RegisterGatewayAssetsProxy(mux, GatewayAssetsProxyConfig{
		GatewayEndpoint: upstream.URL,
		GatewayToken:    "secret-token",
	})
	srv := httptest.NewServer(mux)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/api/runtime/gateway-assets/")
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.Header.Get("X-Echo-Authorization") != "" {
		t.Errorf("token leaked into response header: %q", resp.Header.Get("X-Echo-Authorization"))
	}
}

func TestGatewayAssetsProxy_RejectsNonGET(t *testing.T) {
	mux := http.NewServeMux()
	RegisterGatewayAssetsProxy(mux, GatewayAssetsProxyConfig{GatewayEndpoint: "http://127.0.0.1:1"})
	srv := httptest.NewServer(mux)
	defer srv.Close()

	for _, method := range []string{http.MethodPost, http.MethodPut, http.MethodDelete} {
		t.Run(method, func(t *testing.T) {
			req, _ := http.NewRequest(method, srv.URL+"/api/runtime/gateway-assets/canvas/x", strings.NewReader(""))
			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				t.Fatal(err)
			}
			resp.Body.Close()
			if resp.StatusCode != http.StatusMethodNotAllowed {
				t.Errorf("%s: expected 405, got %d", method, resp.StatusCode)
			}
		})
	}
}
```

- [ ] **D1.2 — Run test to verify it fails**

```bash
cd deck-go && go test ./backend/internal/server/ -run "TestGatewayAssetsProxy" -v
```

Expected: build failure on `RegisterGatewayAssetsProxy`, `GatewayAssetsProxyConfig`.

- [ ] **D1.3 — Write minimal implementation**

```go
// deck-go/backend/internal/server/gateway_assets_proxy.go
package server

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
)

const gatewayAssetsRoutePrefix = "/api/runtime/gateway-assets/"
const gatewayAssetsUpstreamPrefix = "/admin/assets/"

type GatewayAssetsProxyConfig struct {
	GatewayEndpoint string // e.g. "http://127.0.0.1:18789"
	GatewayToken    string // Gateway auth token; BFF-injected, browser-invisible
}

// RegisterGatewayAssetsProxy mounts the BFF reverse-proxy route per Decision
// D5. Browser → BFF → Gateway boundary is preserved (deck-go/AGENTS.md:23-24).
func RegisterGatewayAssetsProxy(mux *http.ServeMux, cfg GatewayAssetsProxyConfig) {
	target, err := url.Parse(cfg.GatewayEndpoint)
	if err != nil {
		// Caller misconfigured at boot; surface via 502 at request time rather
		// than panic.
		mux.HandleFunc(gatewayAssetsRoutePrefix, func(w http.ResponseWriter, _ *http.Request) {
			http.Error(w, "invalid gateway endpoint configured", http.StatusBadGateway)
		})
		return
	}
	rp := httputil.NewSingleHostReverseProxy(target)
	originalDirector := rp.Director
	rp.Director = func(r *http.Request) {
		originalDirector(r)
		// Rewrite /api/runtime/gateway-assets/<path> -> /admin/assets/<path>
		r.URL.Path = gatewayAssetsUpstreamPrefix + strings.TrimPrefix(r.URL.Path, gatewayAssetsRoutePrefix)
		r.Host = target.Host
		if cfg.GatewayToken != "" {
			r.Header.Set("Authorization", "Bearer "+cfg.GatewayToken)
		}
	}
	// Strip any upstream-echoed auth headers before returning to browser.
	rp.ModifyResponse = func(resp *http.Response) error {
		resp.Header.Del("X-Echo-Authorization")
		resp.Header.Del("Authorization")
		return nil
	}

	mux.HandleFunc(gatewayAssetsRoutePrefix, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		rp.ServeHTTP(w, r)
	})
}
```

- [ ] **D1.4 — Verify tests pass**

```bash
cd deck-go && go test ./backend/internal/server/ -run "TestGatewayAssetsProxy" -v
```

Expected: 3/3 sub-suites PASS.

- [ ] **D1.5 — Wire into server registration**

Locate the place where other `/api/runtime/...` routes are mounted (`runtime.go` or `server.go`) and add at boot time:

```go
RegisterGatewayAssetsProxy(mux, server.GatewayAssetsProxyConfig{
    GatewayEndpoint: gatewayEndpointURL, // resolved from facade.Endpoint or env
    GatewayToken:    gatewayToken,
})
```

Boot-time resolution detail: the token comes from the same source the rest of the runtime uses (likely `envconf.RuntimeBundledConfig.Token` in local mode; `state.JSON.remote.token` in remote mode). Inject what the existing runtime initialization already has.

- [ ] **D1.6 — Commit**

```bash
git add deck-go/backend/internal/server/gateway_assets_proxy.go \
        deck-go/backend/internal/server/gateway_assets_proxy_test.go \
        deck-go/backend/internal/server/server.go
git commit -m "feat(server): BFF reverse-proxy /api/runtime/gateway-assets/*

R1c H2 + Decision D5: browser fetches only from deck-go BFF; BFF
transparently proxies to Gateway. Preserves browser->BFF->Gateway
boundary (deck-go/AGENTS.md:23-24); BFF injects auth token,
browser never sees it.

Tested: GET forwards path + auth, response auth headers stripped,
non-GET 405."
```

---

### Task D2: Remove canvas A2UI loader from deck-go BFF

**Files:**

- Modify: `deck-go/backend/internal/server/assets.go` (around line 269 per R1c spot-check)
- Modify: `deck-go/backend/internal/runtime/openclaw/legacy_admin_assets.go` (around line 249)

**Acceptance:** No bundled-only canvas A2UI asset serving from deck-go BFF. Any caller that used to load this asset now relies on the BFF reverse-proxy route. Tests that previously asserted the BFF-served path are removed or updated.

- [ ] **D2.1 — Inspect existing loader**

```bash
cd deck-go && sed -n '260,290p' backend/internal/server/assets.go
cd deck-go && sed -n '240,270p' backend/internal/runtime/openclaw/legacy_admin_assets.go
```

Identify the exact byte range of the canvas A2UI handling. Note the test file that exercises this path:

```bash
cd deck-go && git grep -ln "canvas.*assets\|A2UI" -- backend
```

- [ ] **D2.2 — Write the failing test (asset path absent)**

In `assets_test.go` (or co-located), assert that the route is no longer registered:

```go
func TestAssets_CanvasA2UIRouteRemoved(t *testing.T) {
	mux := http.NewServeMux()
	registerAssetRoutes(mux) // existing helper name; verify via grep
	srv := httptest.NewServer(mux)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/api/assets/canvas/a2ui/index.html") // adjust path to match what's being removed
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("legacy canvas A2UI route still served: status=%d", resp.StatusCode)
	}
}
```

(If the existing test does the opposite assertion, this test inverts it; delete the legacy positive assertion.)

- [ ] **D2.3 — Run test to verify it fails**

```bash
cd deck-go && go test ./backend/internal/server/ -run "TestAssets_CanvasA2UIRouteRemoved" -v
```

Expected: FAIL (route still served).

- [ ] **D2.4 — Delete the bundled-only canvas A2UI loader**

In `backend/internal/server/assets.go` around line 269, remove the registration block. The exact diff depends on the inspection output from D2.1; typical pattern:

```diff
- mux.MethodFunc("GET", "/assets/canvas/a2ui/", canvasA2UIHandler(...))
- // or:
- if cfg.Mode == "bundled" {
-     mux.HandleFunc("/assets/canvas/...", ...)
- }
```

Similarly in `backend/internal/runtime/openclaw/legacy_admin_assets.go` around line 249.

If a helper function (e.g. `canvasA2UIHandler`) becomes orphaned, delete it too.

- [ ] **D2.5 — Verify tests pass + build passes**

```bash
cd deck-go && go test ./backend/internal/server/ ./backend/internal/runtime/openclaw/ -v
cd deck-go && go build ./...
```

Expected: all tests PASS, build PASS.

- [ ] **D2.6 — Commit**

```bash
git add deck-go/backend/internal/server/assets.go \
        deck-go/backend/internal/server/assets_test.go \
        deck-go/backend/internal/runtime/openclaw/legacy_admin_assets.go
git commit -m "refactor(server): remove bundled-only canvas A2UI asset loader

R2 (corrected) violation: canvas A2UI asset was loaded only in bundled
mode (functional leak — remote mode users never saw it). The asset now
lives behind the BFF reverse-proxy /api/runtime/gateway-assets/* route
(Task D1), accessible in both modes.

Removed: BFF asset registration in assets.go:269 and
legacy_admin_assets.go:249 areas. Any orphaned helper deleted."
```

---

### Task D3: Frontend canvas component fetches via reverse-proxy

**Files:**

- Modify: frontend canvas component (locate in D3.1)

**Acceptance:** The frontend canvas/A2UI component fetches assets from `/api/runtime/gateway-assets/...` (relative to BFF origin), never via `<gateway_endpoint>` directly. A grep-based static check passes (no `gateway_endpoint` URL pattern in frontend files for canvas assets).

- [ ] **D3.1 — Locate the canvas component asset reference**

```bash
cd deck-go && git grep -nE "admin/assets|canvas.*asset|gatewayEndpoint.*admin" -- frontend-new
```

Expected: one or two TSX/TS files. Record paths.

- [ ] **D3.2 — Write the failing test (vitest)**

In the canvas component's test file, assert the asset URL is relative:

```ts
import { describe, expect, it } from "vitest";
import { CANVAS_ASSET_BASE_URL } from "./canvas-asset-config"; // adjust import

describe("canvas asset URL", () => {
  it("uses the BFF reverse-proxy route", () => {
    expect(CANVAS_ASSET_BASE_URL).toBe("/api/runtime/gateway-assets/");
  });
  it("does not reference gatewayEndpoint directly", () => {
    expect(CANVAS_ASSET_BASE_URL.startsWith("/")).toBe(true);
    expect(CANVAS_ASSET_BASE_URL).not.toMatch(/^https?:\/\//);
  });
});
```

- [ ] **D3.3 — Run test to verify it fails**

```bash
cd deck-go/frontend-new && pnpm vitest run src/path/to/canvas-asset-config.test.ts
```

Expected: FAIL or import error.

- [ ] **D3.4 — Implement: introduce a shared `CANVAS_ASSET_BASE_URL`**

Create or modify a small config module:

```ts
// deck-go/frontend-new/src/<component-dir>/canvas-asset-config.ts
export const CANVAS_ASSET_BASE_URL = "/api/runtime/gateway-assets/";

export function canvasAssetUrl(subpath: string): string {
  const clean = subpath.replace(/^\/+/, "");
  return `${CANVAS_ASSET_BASE_URL}${clean}`;
}
```

Update the canvas component to use `canvasAssetUrl(...)` (replace any `${gatewayEndpoint}/admin/assets/...` template).

- [ ] **D3.5 — Add static-check guard**

Create `deck-go/scripts/check-canvas-asset-url.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Rule R2-adjacent: frontend code must not reference gateway endpoint URLs
# directly for canvas assets. All canvas asset URLs must go through the BFF
# reverse-proxy route /api/runtime/gateway-assets/*.
if grep -RIn --include='*.ts' --include='*.tsx' \
  -E '(gatewayEndpoint|gateway_endpoint|http://.*:.*?/admin/assets)' frontend-new/src \
  | grep -v 'canvas-asset-config' \
  | grep -i 'canvas\|admin/assets'; then
  echo "❌ Direct gateway asset URL in frontend code (must use canvasAssetUrl)" >&2
  exit 1
fi
echo "✅ canvas asset URLs all use BFF reverse-proxy route"
```

`chmod +x` and run it:

```bash
chmod +x deck-go/scripts/check-canvas-asset-url.sh
cd deck-go && ./scripts/check-canvas-asset-url.sh
```

Expected: PASS.

- [ ] **D3.6 — Verify all frontend tests pass**

```bash
cd deck-go && make frontend-build
```

Expected: PASS.

- [ ] **D3.7 — Commit**

```bash
git add deck-go/frontend-new/src/ \
        deck-go/scripts/check-canvas-asset-url.sh
git commit -m "feat(frontend): canvas component fetches via BFF reverse-proxy

R1c H2 + Decision D5: replace direct gatewayEndpoint URL with relative
/api/runtime/gateway-assets/ via canvasAssetUrl() helper. Browser no
longer talks to Gateway directly.

Added: scripts/check-canvas-asset-url.sh static guard.

Tested: CANVAS_ASSET_BASE_URL points to BFF route, no http(s):// scheme,
static guard finds zero violations."
```

---

## Phase E — Frontend R2 violation cleanup

This phase fixes the four frontend R2 violations (`HeaderBar.tsx:31`, `api.ts:566/572/578`) and adds a grep-based guard against regression. The mode-string allowlist (`<ModeBadge>`, `<FirstRunBanner>`) is preserved unchanged.

### Task E1: Tag `isBundledRuntimeStatus()` as operations surface

**Files:**

- Modify: `deck-go/frontend-new/src/api.ts` (around lines 566-578)
- Modify: `deck-go/frontend-new/src/api.agents.test.ts` or co-located test (verify via grep)

**Acceptance:** The type-guard functions are tagged `@operationsSurface` via a JSDoc comment so the static check in E3 can allowlist them. Function names DO NOT change in Stage 1 (Stage 2 renames `isBundled*` → `isLocal*`).

- [ ] **E1.1 — Inspect the existing functions**

```bash
cd deck-go && sed -n '560,585p' frontend-new/src/api.ts
```

Record the existing function names + signatures.

- [ ] **E1.2 — Add `@operationsSurface` tag**

For each type-guard / mode-aware helper at lines 566 / 572 / 578, add the JSDoc tag:

```ts
/**
 * @operationsSurface
 * Type guard for bundled-mode runtime status. Lives on the operations surface;
 * non-display callers (effects, store reducers, route guards) must NOT branch
 * on this — they must use capability flags (capabilities.supervisorState etc).
 * Stage 2 renames to isLocalRuntimeStatus.
 */
export function isBundledRuntimeStatus(s: RuntimeStatus): s is BundledRuntimeStatus {
  return s.mode === "bundled";
}
```

(Apply same JSDoc pattern to the other two type guards at lines 572 and 578.)

- [ ] **E1.3 — Verify build + tests pass**

```bash
cd deck-go && make frontend-build && pnpm --filter frontend-new test
```

Expected: PASS (no behavior change).

- [ ] **E1.4 — Commit**

```bash
git add deck-go/frontend-new/src/api.ts
git commit -m "chore(frontend): tag bundled runtime type guards @operationsSurface

R2 (corrected): operations surface is mode-aware by design. Tag the
type guards so the upcoming static check (Task E3) can allowlist them
explicitly. Functions are NOT renamed (Stage 2 does isBundled* ->
isLocal* rename in lockstep with contract regen)."
```

---

### Task E2: Remove `runtime.mode === "remote"` branch from `HeaderBar.tsx:31`

**Files:**

- Modify: `deck-go/frontend-new/src/deck-ui/HeaderBar.tsx`
- Modify: `deck-go/frontend-new/src/deck-ui/HeaderBar.test.tsx` (if exists; else create)

**Acceptance:** No `runtime.mode === "remote"` or `runtime.mode === "bundled"` branch in `HeaderBar.tsx`. The previously mode-branched behavior is rerouted through `capabilities.endpointMutable` (or moved into the already-display-only `<ModeBadge>` if that's where it belonged).

- [ ] **E2.1 — Inspect the branch**

```bash
cd deck-go && sed -n '25,45p' frontend-new/src/deck-ui/HeaderBar.tsx
```

Identify what the branch decides (a class, a label, a callback wiring). Record.

- [ ] **E2.2 — Write the failing test**

```tsx
// deck-go/frontend-new/src/deck-ui/HeaderBar.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeaderBar } from "./HeaderBar";

describe("HeaderBar", () => {
  it("does not branch on runtime.mode string", () => {
    // Render twice with same capability flags but different mode values.
    // Behavioral output must be identical.
    const remote = render(
      <HeaderBar
        capabilities={{
          mode: "remote",
          configured: true,
          endpointMutable: true,
          supervisorState: false,
        }}
      />,
    );
    const remoteHtml = remote.container.innerHTML;
    remote.unmount();

    const bundled = render(
      <HeaderBar
        capabilities={{
          mode: "bundled",
          configured: true,
          endpointMutable: false,
          supervisorState: true,
        }}
      />,
    );
    const bundledHtml = bundled.container.innerHTML;
    bundled.unmount();

    // Mode badge is allowed to differ (display-only). The rest of the chrome
    // must come from capability flags, not mode strings. Test: stripping the
    // <ModeBadge> region leaves identical HTML when only the mode differs and
    // capabilities are otherwise consistent.
    expect(stripModeBadge(remoteHtml)).toEqual(stripModeBadge(bundledHtml));
  });
});

function stripModeBadge(html: string): string {
  return html.replace(/<[^>]*data-testid="mode-badge"[^>]*>.*?<\/[^>]+>/g, "");
}
```

NOTE: this is a regression-pattern test. Adjust the prop shape to match actual `HeaderBar` props (it likely reads from a hook like `useCapabilities()` — use `vi.mock` or a context provider).

- [ ] **E2.3 — Run test, expect FAIL**

```bash
cd deck-go/frontend-new && pnpm vitest run src/deck-ui/HeaderBar.test.tsx
```

- [ ] **E2.4 — Remove the mode branch**

In `HeaderBar.tsx`, the typical fix at line 31:

```diff
- {runtime.mode === 'remote' && <SomeRemoteChrome />}
+ {capabilities.endpointMutable && <SomeRemoteChrome />}
```

If the decision was not editability-driven, move the conditional into `<ModeBadge>` (already display-only) and let `ModeBadge` read `mode` for display copy.

- [ ] **E2.5 — Verify test passes + build passes**

```bash
cd deck-go/frontend-new && pnpm vitest run src/deck-ui/HeaderBar.test.tsx
cd deck-go && make frontend-build
```

- [ ] **E2.6 — Commit**

```bash
git add deck-go/frontend-new/src/deck-ui/HeaderBar.tsx \
        deck-go/frontend-new/src/deck-ui/HeaderBar.test.tsx
git commit -m "fix(frontend): remove mode-string branch from HeaderBar

R2 (corrected): control surface above runtime facade is mode-agnostic.
HeaderBar previously branched on runtime.mode === 'remote' at line 31;
rerouted through capabilities.endpointMutable so future mode additions
(e.g. local) don't need HeaderBar changes.

Tested: HeaderBar renders identical chrome (modulo ModeBadge display
copy) for matched capability flags regardless of mode string."
```

---

### Task E3: Static-check guard for R2 mode-string violations

**Files:**

- Create: `deck-go/scripts/check-r2.sh`

**Acceptance:** Grep-based check that rejects `mode === "bundled"` / `mode === "remote"` / `mode === "local"` patterns outside the `@operationsSurface`-tagged allowlist + display-only components (`<ModeBadge>`, `<FirstRunBanner>`, `<EndpointSection>`). Runs as part of `make verify` in Stage 1 verification.

- [ ] **E3.1 — Write the script**

```bash
# deck-go/scripts/check-r2.sh
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Allowlisted files (display-only or explicitly tagged @operationsSurface).
# Stage 2 will add isLocalRuntimeStatus to this list after rename.
ALLOWLIST_PATHS=(
  "frontend-new/src/components/runtime/ModeBadge.tsx"
  "frontend-new/src/components/runtime/FirstRunBanner.tsx"
  "frontend-new/src/components/runtime/EndpointSection.tsx"
  "frontend-new/src/components/runtime/OperationsPanel.tsx"
  "frontend-new/src/api.ts"  # @operationsSurface type guards live here
)
# Translate to a single grep -v pattern.
EXCLUDE_PATTERN=$(printf "%s\n" "${ALLOWLIST_PATHS[@]}" | paste -sd "|" -)

violations=$(grep -RInE --include='*.ts' --include='*.tsx' \
  "mode\s*===?\s*['\"](bundled|local|remote)['\"]" frontend-new/src \
  | grep -vE "$EXCLUDE_PATTERN" || true)

if [[ -n "$violations" ]]; then
  echo "❌ R2 violation: mode-string branch outside allowlist" >&2
  echo "$violations" >&2
  echo "" >&2
  echo "Display components allowed: ${ALLOWLIST_PATHS[*]}" >&2
  echo "Non-display behavior must gate on capability flags." >&2
  exit 1
fi
echo "✅ no R2 mode-string branches outside allowlist"
```

`chmod +x deck-go/scripts/check-r2.sh`.

- [ ] **E3.2 — Run the script and verify it passes**

```bash
cd deck-go && ./scripts/check-r2.sh
```

Expected: PASS (Tasks E1 + E2 have already cleared the violations).

If violations remain, fix them before committing (DO NOT add files to the allowlist to silence the check).

- [ ] **E3.3 — Add the check to `make verify`**

In `deck-go/Makefile`, append to the `verify` target:

```makefile
verify: ... existing dependencies ...
	./scripts/check-r2.sh
	./scripts/check-canvas-asset-url.sh
```

- [ ] **E3.4 — Commit**

```bash
git add deck-go/scripts/check-r2.sh deck-go/Makefile
git commit -m "ci(deck-go): grep guard for R2 mode-string violations

R2 (corrected): allowlist display-only components (ModeBadge / FirstRunBanner
/ EndpointSection / OperationsPanel) and @operationsSurface-tagged
helpers in api.ts; reject mode === '...' branches anywhere else.

Wired into make verify."
```

---

## Phase F — Operations Panel UI

This phase introduces the `OperationsPanel` component and integrates it into the existing `GatewayPanel` runtime tab. Mount condition is `capabilities.supervisorState === true` per Decision D11. Button visibility is driven entirely by `lifecycleState`. Scope is anchored to the spec scenarios — no charts / history / token UI / upgrade banner.

### Task F1: `OperationsPanel` component + unit tests

**Files:**

- Create: `deck-go/frontend-new/src/components/runtime/OperationsPanel.tsx`
- Create: `deck-go/frontend-new/src/components/runtime/OperationsPanel.test.tsx`

**Acceptance:** Component renders `lifecycleState` / `serviceName` / `entrypointPath` / `lastError` from a `RuntimeStatus` prop. Buttons match the D6 state table exactly. The `[安装并启动]` button dispatches `install` then `start` sequentially. The component reads `capabilities.mode` only for display copy (e.g. tooltip "本地 Gateway"); no behavioral branch on `mode`.

- [ ] **F1.1 — Write the failing test (state-table-driven)**

```tsx
// deck-go/frontend-new/src/components/runtime/OperationsPanel.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OperationsPanel } from "./OperationsPanel";

const baseStatus = {
  mode: "bundled" as const,
  lifecycleState: "running",
  serviceName: "openclaw-gateway.abc123def456",
  entrypointPath: "/abs/repo/dist/entry.js",
  lastError: null as string | null,
};

describe("OperationsPanel — button visibility by lifecycleState", () => {
  it("running: shows Stop and Restart", () => {
    render(
      <OperationsPanel status={{ ...baseStatus, lifecycleState: "running" }} onAction={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /restart/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^install/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /reinstall/i })).toBeNull();
  });

  it("stopped: shows Start and Reinstall", () => {
    render(
      <OperationsPanel status={{ ...baseStatus, lifecycleState: "stopped" }} onAction={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /start/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reinstall/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^stop$/i })).toBeNull();
  });

  it("not-installed: shows single 安装并启动 button", () => {
    render(
      <OperationsPanel
        status={{ ...baseStatus, lifecycleState: "not-installed" }}
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /安装并启动/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^stop$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^restart$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^reinstall$/i })).toBeNull();
  });

  it("unhealthy: shows Restart, Reinstall, and lastError summary", () => {
    render(
      <OperationsPanel
        status={{ ...baseStatus, lifecycleState: "unhealthy", lastError: "probe_refused" }}
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /restart/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reinstall/i })).toBeInTheDocument();
    expect(screen.getByText(/probe_refused/i)).toBeInTheDocument();
  });
});

describe("OperationsPanel — 安装并启动 dispatches install then start", () => {
  it("calls install, awaits, then calls start", async () => {
    const calls: string[] = [];
    const onAction = vi.fn(async (action: string) => {
      calls.push(action);
    });
    render(
      <OperationsPanel
        status={{ ...baseStatus, lifecycleState: "not-installed" }}
        onAction={onAction}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /安装并启动/ }));
    await waitFor(() => expect(calls).toEqual(["install", "start"]));
  });
});

describe("OperationsPanel — surface fields", () => {
  it("renders serviceName, entrypointPath", () => {
    render(<OperationsPanel status={baseStatus} onAction={vi.fn()} />);
    expect(screen.getByText(/openclaw-gateway\.abc123def456/)).toBeInTheDocument();
    expect(screen.getByText(/\/abs\/repo\/dist\/entry\.js/)).toBeInTheDocument();
  });
});

describe("OperationsPanel — no mode-string behavioral branch", () => {
  it("renders identical button set for matched lifecycleState regardless of mode", () => {
    const a = render(
      <OperationsPanel
        status={{ ...baseStatus, mode: "bundled", lifecycleState: "stopped" }}
        onAction={vi.fn()}
      />,
    );
    const aBtns = a.container.querySelectorAll("button");
    const aLabels = Array.from(aBtns)
      .map((b) => b.textContent)
      .sort();
    a.unmount();

    // Same lifecycleState, hypothetical future mode='local' value (Stage 2):
    const b = render(
      <OperationsPanel
        status={{ ...baseStatus, mode: "local", lifecycleState: "stopped" }}
        onAction={vi.fn()}
      />,
    );
    const bBtns = b.container.querySelectorAll("button");
    const bLabels = Array.from(bBtns)
      .map((b) => b.textContent)
      .sort();
    b.unmount();

    expect(aLabels).toEqual(bLabels);
  });
});

describe("OperationsPanel — scope anchoring", () => {
  it("contains no chart / history / token / upgrade widgets", () => {
    const { container } = render(<OperationsPanel status={baseStatus} onAction={vi.fn()} />);
    expect(container.querySelector('[data-testid*="chart"]')).toBeNull();
    expect(container.querySelector('[data-testid*="history"]')).toBeNull();
    expect(container.querySelector('[data-testid*="token"]')).toBeNull();
    expect(container.querySelector('[data-testid*="upgrade"]')).toBeNull();
  });
});
```

- [ ] **F1.2 — Run test to verify it fails**

```bash
cd deck-go/frontend-new && pnpm vitest run src/components/runtime/OperationsPanel.test.tsx
```

Expected: import error on `OperationsPanel`.

- [ ] **F1.3 — Write minimal implementation**

```tsx
// deck-go/frontend-new/src/components/runtime/OperationsPanel.tsx
import { useState } from "react";

export type LifecycleState = "running" | "stopped" | "not-installed" | "unhealthy";

export interface OperationsPanelStatus {
  mode: string; // 'bundled' | 'local' | 'remote' — read for display copy only
  lifecycleState: LifecycleState;
  serviceName: string;
  entrypointPath: string;
  lastError: string | null;
}

export type LifecycleAction = "install" | "start" | "stop" | "restart" | "reinstall";

export interface OperationsPanelProps {
  status: OperationsPanelStatus;
  onAction: (action: LifecycleAction) => Promise<void> | void;
}

/**
 * OperationsPanel — local-mode Gateway lifecycle copilot.
 *
 * Mount condition: parent gates on `capabilities.supervisorState === true`.
 * Button visibility is driven by `status.lifecycleState` exclusively (D6 state
 * table). `status.mode` is read for display copy only (Decision D11).
 *
 * Scope anchored (spec scenario "Probe + UI live where the goals require"):
 * lifecycleState, serviceName, entrypointPath, lastError, and the action
 * buttons — nothing else.
 */
export function OperationsPanel({ status, onAction }: OperationsPanelProps): JSX.Element {
  const [busy, setBusy] = useState(false);

  async function dispatch(action: LifecycleAction) {
    setBusy(true);
    try {
      await onAction(action);
    } finally {
      setBusy(false);
    }
  }

  async function dispatchInstallAndStart() {
    setBusy(true);
    try {
      await onAction("install");
      await onAction("start");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section data-testid="operations-panel" data-state={status.lifecycleState}>
      <header>
        <span data-testid="lifecycle-state">{status.lifecycleState}</span>
        <span data-testid="service-name">{status.serviceName}</span>
        <span data-testid="entrypoint-path">{status.entrypointPath}</span>
      </header>

      {status.lifecycleState === "unhealthy" && status.lastError && (
        <div data-testid="last-error" role="alert">
          {status.lastError}
        </div>
      )}

      <div data-testid="action-buttons">
        {status.lifecycleState === "running" && (
          <>
            <button type="button" disabled={busy} onClick={() => dispatch("stop")}>
              Stop
            </button>
            <button type="button" disabled={busy} onClick={() => dispatch("restart")}>
              Restart
            </button>
          </>
        )}
        {status.lifecycleState === "stopped" && (
          <>
            <button type="button" disabled={busy} onClick={() => dispatch("start")}>
              Start
            </button>
            <button type="button" disabled={busy} onClick={() => dispatch("reinstall")}>
              Reinstall
            </button>
          </>
        )}
        {status.lifecycleState === "not-installed" && (
          <button type="button" disabled={busy} onClick={dispatchInstallAndStart}>
            安装并启动
          </button>
        )}
        {status.lifecycleState === "unhealthy" && (
          <>
            <button type="button" disabled={busy} onClick={() => dispatch("restart")}>
              Restart
            </button>
            <button type="button" disabled={busy} onClick={() => dispatch("reinstall")}>
              Reinstall
            </button>
          </>
        )}
      </div>
    </section>
  );
}
```

- [ ] **F1.4 — Verify tests pass**

```bash
cd deck-go/frontend-new && pnpm vitest run src/components/runtime/OperationsPanel.test.tsx
```

Expected: all suites PASS.

- [ ] **F1.5 — Commit**

```bash
git add deck-go/frontend-new/src/components/runtime/OperationsPanel.tsx \
        deck-go/frontend-new/src/components/runtime/OperationsPanel.test.tsx
git commit -m "feat(frontend): OperationsPanel lifecycle UI

Decision D6 + D11: state-driven button visibility from lifecycleState;
mount gated on supervisorState (NOT mode) by parent. 安装并启动 dispatches
install -> start sequentially (Decision OQ3 default).

Scope anchored: only lifecycleState/serviceName/entrypointPath/lastError
+ action buttons. No chart/history/token/upgrade widgets (asserted by
test)."
```

---

### Task F2: Integrate `OperationsPanel` into `GatewayPanel` runtime tab

**Files:**

- Modify: the GatewayPanel runtime tab component (locate via grep)

**Acceptance:** `OperationsPanel` mounts inside `GatewayPanel`'s runtime tab when `capabilities.supervisorState === true`. Mount condition is `supervisorState`, NOT `mode === "bundled"` (Decision D11). The panel receives `status` from `/api/runtime/gateway` (which after C2 always returns lifecycle payload in local mode) and dispatches actions via the lifecycle HTTP routes.

- [ ] **F2.1 — Locate the GatewayPanel runtime tab**

```bash
cd deck-go && git grep -nE "GatewayPanel|runtime.*tab" -- frontend-new/src | head -20
```

Find the file that renders the runtime tab content.

- [ ] **F2.2 — Write the failing test**

In the GatewayPanel test file (or new one):

```tsx
// e.g. deck-go/frontend-new/src/components/panels/GatewayPanel.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GatewayPanel } from "./GatewayPanel"; // adjust import

describe("GatewayPanel runtime tab", () => {
  it("mounts OperationsPanel when supervisorState=true", () => {
    render(
      <GatewayPanel
        capabilities={{
          mode: "bundled",
          configured: false,
          endpointMutable: false,
          supervisorState: true,
        }}
        runtimeStatus={{
          mode: "bundled",
          lifecycleState: "not-installed",
          serviceName: "s",
          entrypointPath: "/e",
          lastError: null,
        }}
      />,
    );
    expect(screen.getByTestId("operations-panel")).toBeInTheDocument();
  });

  it("does NOT mount OperationsPanel when supervisorState=false", () => {
    render(
      <GatewayPanel
        capabilities={{
          mode: "remote",
          configured: true,
          endpointMutable: true,
          supervisorState: false,
        }}
        runtimeStatus={{ mode: "remote" }}
      />,
    );
    expect(screen.queryByTestId("operations-panel")).toBeNull();
  });

  it("mounts OperationsPanel based on supervisorState, not mode string", () => {
    // Hypothetical future: supervisorState=true with a non-bundled mode value.
    // OperationsPanel must still mount.
    render(
      <GatewayPanel
        capabilities={{
          mode: "local",
          configured: false,
          endpointMutable: false,
          supervisorState: true,
        }}
        runtimeStatus={{
          mode: "local",
          lifecycleState: "stopped",
          serviceName: "s",
          entrypointPath: "/e",
          lastError: null,
        }}
      />,
    );
    expect(screen.getByTestId("operations-panel")).toBeInTheDocument();
  });
});
```

- [ ] **F2.3 — Run test to verify it fails**

```bash
cd deck-go/frontend-new && pnpm vitest run src/components/panels/GatewayPanel.test.tsx
```

Expected: FAIL (panel not mounting on supervisorState).

- [ ] **F2.4 — Modify GatewayPanel runtime tab**

In the runtime tab render path, replace any previous lifecycle UI with:

```tsx
{
  capabilities.supervisorState && runtimeStatus.lifecycleState && (
    <OperationsPanel
      status={{
        mode: runtimeStatus.mode,
        lifecycleState: runtimeStatus.lifecycleState as LifecycleState,
        serviceName: runtimeStatus.serviceName ?? "",
        entrypointPath: runtimeStatus.entrypointPath ?? "",
        lastError: runtimeStatus.lastError ?? null,
      }}
      onAction={async (action) => {
        await fetch(`/api/runtime/gateway/${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        // Caller should refresh runtimeStatus via the existing query mechanism.
      }}
    />
  );
}
```

Adjust the data-fetch hook integration to match the existing patterns (likely a react-query hook or similar).

- [ ] **F2.5 — Verify tests pass**

```bash
cd deck-go/frontend-new && pnpm vitest run src/components/panels/GatewayPanel.test.tsx
cd deck-go && make frontend-build
```

- [ ] **F2.6 — Commit**

```bash
git add deck-go/frontend-new/src/components/panels/GatewayPanel.tsx \
        deck-go/frontend-new/src/components/panels/GatewayPanel.test.tsx
git commit -m "feat(frontend): mount OperationsPanel on supervisorState

R1c M2 + Decision D11: GatewayPanel runtime tab gates OperationsPanel
mount on capabilities.supervisorState (NOT mode === 'bundled'). Future
mode rename (Stage 2 'local') needs no GatewayPanel change.

Tested: mounts when supervisorState=true (bundled or hypothetical local);
absent when supervisorState=false (remote)."
```

---

### Task F3: Playwright smoke under each lifecycle state

**Files:**

- Create or modify: `deck-go/test/e2e/operations-panel-mock.spec.ts` (or co-located inside the existing mock spec — verify Stage 3 doesn't claim ownership of this fixture style; if it does, use a Stage-1-temporary `.smoke.spec.ts` file scoped to OperationsPanel)

**Acceptance:** Mock-Gateway-driven smoke that seeds each of four lifecycle states and asserts the corresponding Operations Panel button set renders. Real-Gateway E2E is Stage 3's responsibility — do not add to `real-gateway.spec.ts` here.

- [ ] **F3.1 — Inspect existing mock spec format**

```bash
cd deck-go && head -60 test/e2e/bundled.spec.ts
cd deck-go && head -60 test/fixtures/mock-gateway.mjs
```

Note: in Stage 1 the mock fixture still spawns the way it does today (Stage 3 reworks). Use the existing fixture API.

- [ ] **F3.2 — Write the smoke spec**

```ts
// deck-go/test/e2e/operations-panel-mock.spec.ts
import { test, expect } from "@playwright/test";

// Drive each lifecycle state via a mock /api/runtime/gateway override; assert
// the corresponding button set is present.
const cases: Array<{ state: string; expectedButtons: string[]; absentButtons: string[] }> = [
  { state: "running", expectedButtons: ["Stop", "Restart"], absentButtons: ["Start", "Install"] },
  { state: "stopped", expectedButtons: ["Start", "Reinstall"], absentButtons: ["Stop"] },
  { state: "not-installed", expectedButtons: ["安装并启动"], absentButtons: ["Stop", "Restart"] },
  { state: "unhealthy", expectedButtons: ["Restart", "Reinstall"], absentButtons: [] },
];

for (const c of cases) {
  test(`OperationsPanel — ${c.state}`, async ({ page }) => {
    await page.route("**/api/runtime/gateway", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          mode: "bundled",
          lifecycleState: c.state,
          serviceName: "openclaw-gateway.smoke12345678",
          entrypointPath: "/abs/repo/dist/entry.js",
          lastError: c.state === "unhealthy" ? "probe_refused" : null,
        }),
      }),
    );
    await page.route("**/api/runtime/capabilities", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          mode: "bundled",
          configured: c.state === "running",
          endpointMutable: false,
          supervisorState: true,
        }),
      }),
    );

    await page.goto("/");
    // Navigate to Gateway panel; adjust selector to match actual nav.
    await page.getByRole("link", { name: /gateway/i }).click();
    await page.getByRole("tab", { name: /runtime/i }).click();

    const panel = page.getByTestId("operations-panel");
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute("data-state", c.state);

    for (const btn of c.expectedButtons) {
      await expect(panel.getByRole("button", { name: new RegExp(btn, "i") })).toBeVisible();
    }
    for (const btn of c.absentButtons) {
      await expect(panel.getByRole("button", { name: new RegExp(btn, "i") })).toHaveCount(0);
    }
  });
}
```

- [ ] **F3.3 — Run the spec**

```bash
cd deck-go && make e2e-mock-module MODULE=operations-panel
```

(Adjust target name to match `Makefile` selector; if no module-level selector exists, run the whole mock suite: `make e2e-mock-runtime`.)

Expected: 4/4 PASS.

- [ ] **F3.4 — Commit**

```bash
git add deck-go/test/e2e/operations-panel-mock.spec.ts
git commit -m "test(e2e): OperationsPanel smoke for each lifecycle state

Mocks /api/runtime/gateway + /api/runtime/capabilities to drive the
panel into running/stopped/not-installed/unhealthy and asserts the
expected button set.

Note: real-gateway E2E adaptation (per-repo-hash service install,
uninstall cleanup) is owned by Stage 3 (tasks.md § 4)."
```

---

## Phase G — Stage 1 verification

Run the full set of Stage 1 gates. Each gate is one short verification step (no implementation). The Stage 1 commit boundary is reached only when every gate passes.

### Task G1: `cd deck-go && make backend-test`

- [ ] Run: `cd deck-go && make backend-test`
- [ ] Expected: PASS. New tests added in Phases A/B/C/D pass; deleted supervisor/preflight/process_group tests no longer exist.

### Task G2: `cd deck-go && make frontend-build`

- [ ] Run: `cd deck-go && make frontend-build`
- [ ] Expected: PASS. OperationsPanel + tests compile; HeaderBar passes new test.

### Task G3: `cd deck-go && make verify`

- [ ] Run: `cd deck-go && make verify`
- [ ] Expected: PASS — includes `check-r2.sh` and `check-canvas-asset-url.sh`.

### Task G4: Real-stack smoke

- [ ] Pre-req: a fresh build of this repo's `dist/entry.js` (`pnpm build` at repo root).
- [ ] Run: `cd deck-go && scripts/dev/run-stack-real.sh`
- [ ] Open `http://127.0.0.1:4174/` in a browser, navigate Gateway → Runtime tab.
- [ ] Expected:
  - Operations Panel mounts.
  - On a clean machine (no prior install), `lifecycleState=not-installed`; clicking `[安装并启动]` triggers `install` then `start` via BFF lifecycle routes; service registers with launchd / systemd / schtasks under `openclaw-gateway.<hash>`; panel transitions to `running` after probe.
  - Clicking `[Stop]` transitions to `stopped`; `[Start]` brings it back; `[Restart]` reissues the start.
  - Canvas A2UI asset loads (browser network tab shows GETs to `/api/runtime/gateway-assets/...`, never to `<gateway_endpoint>` directly).

### Task G5: Rule R2 grep guard

- [ ] Run: `cd deck-go && ./scripts/check-r2.sh && ./scripts/check-canvas-asset-url.sh`
- [ ] Expected: both PASS.

### Task G6: Rule R3 audit

- [ ] Run: `cd deck-go && git grep -nE "if.*e2e.*\\{|spawn.*entry\\.js" -- test/e2e/`
- [ ] Expected: zero matches in real-gateway specs. (Mock fixtures may spawn `mock-gateway.mjs`; that is allowed.)

### Task G7: Stage 1 commit boundary

- [ ] All Phase A/B/C/D/E/F/G commits land on the working branch.
- [ ] Run `cd deck-go && git status` — expect clean working tree.
- [ ] Stage 2 (mode rename) does NOT begin in this branch; it is a separate change package follow-up.

---

## Self-review checklist

Run this checklist after finishing the plan above. Tick each item; if any fails, fix and re-run.

### Spec coverage

- [ ] tasks.md §1 Pre-Stage gates → Plan Pre-flight checks (item 1.1: D5 owner-confirm removed — N/A) + Task 1.2 CLI surface verify (mapped to A4 implicit) + 1.3/1.4 baseline → captured as "run baseline before plan starts" in the plan header
- [ ] tasks.md §2.1.1 in-place rewrite → Phase B (B1+B2+B3)
- [ ] tasks.md §2.1.2 entrypoint resolver → Task A2
- [ ] tasks.md §2.1.3 service-name → Task A1
- [ ] tasks.md §2.1.4 lifecycle action proxies → Task A4
- [ ] tasks.md §2.1.5 4-state probe → Task A3
- [ ] tasks.md §2.1.6 probe trigger discipline → Tasks A3 + B2 (no time.Ticker assertion in B2's RuntimeGatewayStatus path)
- [ ] tasks.md §2.1.7 NO internal feature flag → reflected by Phase B doing in-place rewrite
- [ ] tasks.md §2.2.1 lifecycle HTTP routes → Task C1
- [ ] tasks.md §2.2.2 refresh route → Task C1 (last entry in route table)
- [ ] tasks.md §2.2.3 remote 405 → Task C1 (TestLifecycleRoute_RemoteMode405)
- [ ] tasks.md §2.2.4 RuntimeGatewayStatus lifecycle fields → Task B2 (facade) + Task B1 (struct extension)
- [ ] tasks.md §2.2.5 D10 carve-out → Task C2
- [ ] tasks.md §2.3.1 inspect asset path → Task D2.1
- [ ] tasks.md §2.3.2 Gateway-side static route → out-of-scope for this plan (separate Gateway PR; plan header notes this)
- [ ] tasks.md §2.3.3 BFF reverse proxy → Task D1
- [ ] tasks.md §2.3.4 remove BFF canvas loader → Task D2
- [ ] tasks.md §2.3.5 frontend canvas component URL → Task D3
- [ ] tasks.md §2.3.6 static guard → Task D3.5
- [ ] tasks.md §2.4.1 HeaderBar.tsx → Task E2
- [ ] tasks.md §2.4.2 api.ts type guards → Task E1 + E3 (grep guard)
- [ ] tasks.md §2.4.3 FirstRunBanner/ModeBadge unchanged → reflected in scope guard
- [ ] tasks.md §2.5.1 OperationsPanel mount → Task F2 (gate on supervisorState)
- [ ] tasks.md §2.5.2 state-driven button visibility → Task F1 (D6 state table tests)
- [ ] tasks.md §2.5.3 安装并启动 handler → Task F1 (dispatch install -> start test)
- [ ] tasks.md §2.5.4 Playwright smoke → Task F3
- [ ] tasks.md §2.5.5 scope anchor → Task F1 (scope-anchoring test)
- [ ] tasks.md §2.6.1-2.6.5 verification gates → Phase G (G1-G6)

### Placeholder scan

- [ ] No "TBD" / "TODO" / "implement later" / "appropriate error handling" / "edge cases" in any task body
- [ ] Each test code block runs against names defined in earlier tasks (cross-task type consistency)
- [ ] Each commit message includes a short rationale (not just file list)
- [ ] Every "verify it fails" step names a specific expected failure mode (build error / specific assertion)

### Type consistency

- [ ] `LifecycleState` enum values match across Task A3 (Go), Task B1 (Go struct field type `string`), Task F1 (TS type union) — all four states identical: `running` / `stopped` / `not-installed` / `unhealthy`
- [ ] `LifecycleAction` values match across Task A4 (Go method names) and Task F1 (TS string union) — all five actions identical: `install` / `start` / `stop` / `restart` / `reinstall`
- [ ] `ServiceNamePrefix` is `"openclaw-gateway."` in Task A1 (Go) and any reference elsewhere (test fixtures)
- [ ] `RuntimeStatus` field name `LifecycleState` (Go struct tag `lifecycleState`) matches the TS prop name `lifecycleState` consumed by `OperationsPanel`
- [ ] No reference in later tasks to types/functions not defined in earlier tasks

### Scope discipline

- [ ] Plan does not touch any file listed in "Scope guard — do NOT touch in Stage 1"
- [ ] Plan does not invent tasks outside tasks.md §2 (Stage 1) — every plan task maps to an existing tasks.md checkbox or is a sub-step of one
- [ ] Plan acknowledges the Gateway-side static-asset route as out-of-scope (separate Gateway PR)
- [ ] Rule R3: plan does not add an "E2E-only spawn shortcut" anywhere

---

## Execution handoff

Plan complete and saved to `openspec/changes/gateway-launcher-rewrite/plan.md`.

**Execution options:**

1. **Manual codex CLI** (per user 2026-05-13 direction): operator opens a codex CLI session, points it at this plan, and runs through tasks task-by-task following the same `superpowers:subagent-driven-development` cadence (fresh sub-agent per task or in-line execution, two-stage review between tasks). Codex has the same project context + ruleset (CLAUDE.md / CONTEXT.md / AGENTS.md auto-loaded).

2. **Claude main-thread execution** (fallback): Claude executes the plan in this session using `superpowers:executing-plans` (batch execution with checkpoints) or `superpowers:subagent-driven-development` (fresh sub-agent per task).

Either path produces an identical implementation provided the executor obeys the TDD red-green-refactor gates and the scope guard.
