# ManagedRuntime Supervisor Decoupling — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sever `runtime/openclaw.ManagedRuntime`'s dependency on `runtime/bundled.Supervisor` types so the legacy spawn machinery can be deleted, completing the intent of `gateway-launcher-rewrite` Stage 1 Plan Phase B3.

**Architecture:** Two thin contract additions on `facade` first (`Phase Z`): widen `facade.RuntimeFacade` with `GatewayConnection`, add `AutoStart bool` to `facade.RuntimeStatus`. Then `ManagedRuntime` swaps its `supervisor ManagedRuntimeSupervisor` field for `facade facade.RuntimeFacade` and gains a synchronous in-memory `lastStatus facade.RuntimeStatus` cache (RWMutex-protected). Lifecycle methods (`RuntimeGatewayStatusResponse / StartRuntimeGateway / StopRuntimeGateway / RestartRuntimeGateway / BootstrapStatus`) read from the facade, refresh the cache, and adapt `facade.RuntimeStatus` (not `bundled.Snapshot`) into `deckapi.DeckGoRuntimeGatewayStatus`. `runtime/registry` is migrated to a `LastStatusReader` interface (`LastStatus() facade.RuntimeStatus`, no `ctx`, no `error`) wired against the cache — `/api/runtimes` remains I/O-free. After the openclaw layer is fully decoupled, legacy dead entry points (`controld.NewHandler`, `controld.NewDependencies`, `server.New`) are removed, and the 6 spawn-era files under `runtime/bundled/` (`supervisor.go`, `supervisor_test.go`, `preflight.go`, `preflight_test.go`, `process_group_unix.go`, `process_group_windows.go`) are deleted.

**Tech Stack:** Go 1.24, deck-go backend, `make backend-test` / `make frontend-build` / `make verify` for verification.

**Related**:

- ADR: `deck-go/docs/adr/0001-managed-runtime-supervisor-decoupling.md`
- Predecessor OpenSpec change: `openspec/changes/gateway-launcher-rewrite/`
- Handoff log: `docs/handoff-agent/gateway-launcher-rewrite-stage1.md`

**Order constraint:** This plan MUST land before `gateway-launcher-rewrite` Stage 2 (rename `runtime/bundled/` → `runtime/local/`). Otherwise Stage 2 carries dead spawn code through the rename and surface-area cleanup compounds.

---

## File Structure

### Created

- `deck-go/docs/adr/0001-managed-runtime-supervisor-decoupling.md` (already created with this plan)

### Modified

- `deck-go/backend/internal/runtime/facade/facade.go` — widen `RuntimeFacade` interface with `GatewayConnection(ctx) (GatewayConnection, error)`; add `AutoStart bool` field to `RuntimeStatus`
- `deck-go/backend/internal/runtime/bundled/facade.go` — populate `RuntimeStatus.AutoStart` from `f.cfg.AutoStart` in `RuntimeGatewayStatus`
- `deck-go/backend/internal/runtime/remote/facade.go` — populate `RuntimeStatus.AutoStart=false` in `RuntimeGatewayStatus` (remote mode never auto-starts a local Gateway)
- `deck-go/backend/internal/runtime/openclaw/managed_runtime.go` — swap `supervisor` field for `facade`; add `lastStatus facade.RuntimeStatus` + `sync.RWMutex`; new `LastStatus() facade.RuntimeStatus` method; delete `ManagedRuntimeSupervisor` interface + 3 obsolete constructors + 5 public lifecycle methods + EnsureAutoStart probe + line 228 type assertion
- `deck-go/backend/internal/runtime/openclaw/legacy_runtime_orchestration.go` — `runtimeStatus` signature changes to `(facade.RuntimeStatus) → deckapi.DeckGoRuntimeGatewayStatus`; `RuntimeGatewayActionResponse` methods read from facade and refresh the cache; `BootstrapStatus` primes the cache at first call
- `deck-go/backend/internal/runtime/openclaw/legacy_admin_settings_onboarding.go` — `runtimeVersionStatus(facade.RuntimeStatus)` instead of `runtimeVersionStatus(bundled.Snapshot)`; the call site reads `m.LastStatus()` instead of `m.Snapshot()`
- `deck-go/backend/internal/runtime/openclaw/managed_runtime_test.go` — drop `recordingManagedSupervisor` fixture + tests for removed public lifecycle methods; remaining tests use `testfacade.Stub`; add `LastStatus()` cache-behavior test
- `deck-go/backend/internal/runtime/openclaw/managed_runtime_ws_lifecycle_test.go` — same fixture migration
- `deck-go/backend/internal/runtime/openclaw/managed_runtime_ws_test.go` — same fixture migration
- `deck-go/backend/internal/runtime/openclaw/managed_runtime_contract_test.go` — same fixture migration
- `deck-go/backend/internal/runtime/openclaw/transport_binding_test.go` — replace `bundled.Snapshot{...}` test fixtures with `facade.RuntimeStatus{...}` or registry-local stubs (depending on what the test asserts)
- `deck-go/backend/internal/runtime/registry/summary.go` — `SnapshotReader` interface renamed to `RuntimeStatusReader`, signature `LastStatus() facade.RuntimeStatus` (no `context`, no `error`); `summarize(facade.RuntimeStatus, capabilities)` replaces `summarize(bundled.Snapshot, capabilities)`; drop `bundled` import
- `deck-go/backend/internal/runtime/registry/summary_test.go` — fixture stub returns `facade.RuntimeStatus`
- `deck-go/backend/internal/runtime/registry/summary_capability_test.go` — same
- `deck-go/backend/internal/runtime/registry/registry_test.go` — same
- `deck-go/backend/internal/server/test_router_test.go` — replace `bundled.Snapshot`-returning fake supervisor interface with `testfacade.Stub`
- `deck-go/backend/internal/server/server_test.go` — replace `ManagedSnapshot` / `NewManagedRuntimeWithStoreAndSupervisor` fixtures with `testfacade.Stub` + `NewManagedRuntimeWithFacade`
- `deck-go/backend/internal/server/gateway_routes_test.go` — same
- `deck-go/backend/internal/server/stream_test.go` — same
- `deck-go/backend/internal/server/stream_event_typing_test.go` — same
- `deck-go/backend/internal/server/runtime_facade_test.go` — same
- `deck-go/backend/internal/controld/app.go` — `NewDependenciesWithRuntimeFacade` no longer constructs a discarded supervisor; remove `NewHandler` / `NewDependencies` / `managedGatewaySettingsFromRuntimeBundled`. `runtimeSummaryOverride` is unchanged (it still actively probes in remote mode); registry no longer double-probes because `RuntimeStatusReader.LastStatus()` is an in-memory read.
- `deck-go/backend/internal/controld/app_test.go` — refactor 3 call sites that used `openclawrt.NewManagedRuntime(store, bus)` to build a `ManagedRuntime` from a stub facade
- `deck-go/backend/internal/server/server.go` — delete `server.New`; keep `NewRootHandler` + `NewRootHandlerWithRuntimeFacade`

### Deleted

- `deck-go/backend/internal/runtime/openclaw/managed_lifecycle_types.go`
- `deck-go/backend/internal/runtime/openclaw/managed_supervisor_options.go`
- `deck-go/backend/internal/runtime/openclaw/managed_supervisor_options_test.go`
- `deck-go/backend/internal/runtime/bundled/supervisor.go`
- `deck-go/backend/internal/runtime/bundled/supervisor_test.go`
- `deck-go/backend/internal/runtime/bundled/preflight.go`
- `deck-go/backend/internal/runtime/bundled/preflight_test.go`
- `deck-go/backend/internal/runtime/bundled/process_group_unix.go`
- `deck-go/backend/internal/runtime/bundled/process_group_windows.go`

### Out of scope (do not touch)

- `deck-go/contracts/**` — no contract changes
- `deck-go/backend/internal/runtime/bundled/{service_name,entrypoint_resolver,probe,lifecycle_proxy,facade}.go` — Stage 1 new files, stable
- `deck-go/frontend-new/**` — frontend tolerates the disappearance of `pid` / `failurePhase` / `lastExitCode` / `ownershipFile` / `restartDelayMs` (api.ts maps `raw.x` → undefined naturally; GatewayPanel renders "n/a")
- `runtime/projection`, `runtime/openclaw/views` — zero `bundled.*` references; pure consumer-side
- `legacy_admin_assets.go`, `legacy_admin_budget.go`, `legacy_admin_docs_memory.go`, `legacy_inventory.go` — out of scope (not supervisor-coupled)
- `RUNTIME_MODE=bundled` env value — Stage 2 work
- `bundled/` package rename — Stage 2 work

---

## Self-discovery commands (run during implementation, not in CI)

Use these to verify nothing was missed:

```bash
# Should be 0 after Phase F (full sweep across deck-go/backend except the bundled package itself)
cd deck-go/backend
rg -n "bundled\.Supervisor|bundled\.NewSupervisorWithOptions|bundled\.With[A-Z]|bundled\.Snapshot|bundled\.Status[A-Z]|bundled\.StatusStopped|bundled\.StatusStarting|bundled\.StatusRunning|bundled\.StatusDegraded|bundled\.StatusStopping|bundled\.StatusFailed|bundled\.Option\b|bundled\.Health|bundled\.FailurePhase|bundled\.Probe|bundled\.Start[A-Z]|bundled\.Stop[A-Z]|bundled\.Exit[A-Z]" ./internal | rg -v "/runtime/bundled/"

# Should be 0 after Phase C2 — `ManagedSnapshot` type alias and dead constructors must be gone outside the package
rg -n "ManagedSnapshot|NewManagedRuntimeWithStoreAndSupervisor|NewManagedRuntimeWithSupervisor|recordingManagedSupervisor" ./internal

# Should be 0 after Phase E
rg -n "controld\.NewHandler|controld\.NewDependencies\b|server\.New\(\)|EnsureAutoStart|managedGatewaySettingsFromRuntimeBundled|NewManagedSupervisorWithOptions|NewManagedRuntime\(|NewManagedRuntimeWithSupervisor|NewManagedRuntimeWithStoreAndSupervisor|NewManagedRuntimeWithRequester\(" ./internal

# Should be 0 after Phase F
ls ./internal/runtime/bundled/supervisor.go ./internal/runtime/bundled/preflight.go ./internal/runtime/bundled/process_group_unix.go 2>&1
```

---

## Phase Z: Facade contract additions

Phase Z lands first because every later phase consumes the new interface method and the new status field. Both additions are zero-cost for the two existing implementations (`bundled.Facade` and `remote.Facade`) — `GatewayConnection` is already implemented concretely on both, and `AutoStart` is already known to `bundled.Facade` via `f.cfg.AutoStart`.

### Task Z1: Add `GatewayConnection` to `facade.RuntimeFacade` interface

**Files:**

- Modify: `deck-go/backend/internal/runtime/facade/facade.go`
- Modify: `deck-go/backend/internal/runtime/bundled/facade.go` (compile-time interface assertion already exists at `var _ facade.RuntimeFacade = (*Facade)(nil)`; adding the method to the interface MUST keep the assertion green)
- Modify: `deck-go/backend/internal/runtime/remote/facade.go` (same)
- Test: `deck-go/backend/internal/runtime/facade/facade_contract_test.go` (new)

- [ ] **Step 1: Write the failing test**

```go
// deck-go/backend/internal/runtime/facade/facade_contract_test.go
package facade_test

import (
	"context"
	"testing"

	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/bundled"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/envconf"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/remote"
)

func TestRuntimeFacadeInterfaceIncludesGatewayConnection(t *testing.T) {
	t.Parallel()
	bundledFacade, err := bundled.New(&envconf.RuntimeBundledConfig{
		Command:   "node",
		Args:      []string{"dist/entry.js"},
		BindHost:  "127.0.0.1",
		BindPort:  18789,
		AutoStart: false,
	})
	if err != nil {
		t.Fatalf("bundled.New: %v", err)
	}
	remoteFacade, err := remote.New(envconf.RuntimeRemoteConfig{})
	if err != nil {
		t.Fatalf("remote.New: %v", err)
	}
	for _, tc := range []struct {
		name string
		f    facade.RuntimeFacade
	}{
		{name: "bundled", f: bundledFacade},
		{name: "remote", f: remoteFacade},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			_, err := tc.f.GatewayConnection(context.Background())
			// Either nil or ErrNotConfigured is fine; what matters is that
			// the method exists on the interface and compiles via tc.f.
			if err != nil && err != facade.ErrNotConfigured {
				// other errors are fine too; we only assert reachability
			}
		})
	}
}
```

- [ ] **Step 2: Run, verify fail**

```bash
cd deck-go && go test ./backend/internal/runtime/facade/ -run TestRuntimeFacadeInterfaceIncludesGatewayConnection -v
# Expected: compile failure — facade.RuntimeFacade has no method GatewayConnection
```

- [ ] **Step 3: Add `GatewayConnection` to the interface**

```go
// deck-go/backend/internal/runtime/facade/facade.go
type RuntimeFacade interface {
	Capabilities(context.Context) (Capabilities, error)
	Endpoint(context.Context) (EndpointView, error)
	GatewayConnection(context.Context) (GatewayConnection, error) // NEW
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

Both `bundled.Facade.GatewayConnection` (`runtime/bundled/facade.go:128`) and `remote.Facade.GatewayConnection` (`runtime/remote/facade.go:68`) already exist with matching signatures, so no concrete-side change is needed.

- [ ] **Step 4: Run, verify pass**

```bash
cd deck-go && go test ./backend/internal/runtime/facade/... ./backend/internal/runtime/bundled/... ./backend/internal/runtime/remote/... -v
# Expected: PASS, including interface assertions `var _ facade.RuntimeFacade = (*Facade)(nil)` on both concrete types.
```

- [ ] **Step 5: Commit**

```bash
cd deck-go
scripts/committer "feat(runtime/facade): widen RuntimeFacade with GatewayConnection method" \
  backend/internal/runtime/facade/facade.go \
  backend/internal/runtime/facade/facade_contract_test.go
```

The commit body should follow the `Why:` / `Tested:` trailer convention from the root `AGENTS.md`.

---

### Task Z2: Add `AutoStart bool` field to `facade.RuntimeStatus` and populate it in both facades

**Files:**

- Modify: `deck-go/backend/internal/runtime/facade/facade.go`
- Modify: `deck-go/backend/internal/runtime/bundled/facade.go`
- Modify: `deck-go/backend/internal/runtime/remote/facade.go`
- Test: `deck-go/backend/internal/runtime/bundled/facade_test.go` (existing; add a case) or new `_auto_start_test.go`
- Test: `deck-go/backend/internal/runtime/remote/facade_test.go` (existing; add a case)

- [ ] **Step 1: Write the failing test (bundled side)**

```go
// deck-go/backend/internal/runtime/bundled/facade_auto_start_test.go
package bundled_test

import (
	"context"
	"testing"

	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/bundled"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/envconf"
)

func TestFacadeRuntimeGatewayStatusPropagatesAutoStart(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name      string
		autoStart bool
	}{
		{name: "auto start true", autoStart: true},
		{name: "auto start false", autoStart: false},
	}
	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			f, err := bundled.New(&envconf.RuntimeBundledConfig{
				Command:   "node",
				Args:      []string{"dist/entry.js"},
				BindHost:  "127.0.0.1",
				BindPort:  18789,
				AutoStart: tc.autoStart,
			})
			if err != nil {
				t.Fatalf("bundled.New: %v", err)
			}
			status, _ := f.RuntimeGatewayStatus(context.Background())
			if status.AutoStart != tc.autoStart {
				t.Fatalf("RuntimeStatus.AutoStart = %v, want %v", status.AutoStart, tc.autoStart)
			}
		})
	}
}
```

And, alongside, on the remote side:

```go
// deck-go/backend/internal/runtime/remote/facade_test.go (add)
func TestFacadeRuntimeGatewayStatusAutoStartIsFalse(t *testing.T) {
	t.Parallel()
	f, err := remote.New(envconf.RuntimeRemoteConfig{})
	if err != nil {
		t.Fatalf("remote.New: %v", err)
	}
	status, _ := f.RuntimeGatewayStatus(context.Background())
	if status.AutoStart {
		t.Fatalf("remote RuntimeStatus.AutoStart = true; expected false (remote mode never auto-starts a local Gateway)")
	}
}
```

- [ ] **Step 2: Run, verify fail**

```bash
cd deck-go && go test ./backend/internal/runtime/bundled/ -run TestFacadeRuntimeGatewayStatusPropagatesAutoStart -v
# Expected: compile failure — facade.RuntimeStatus has no field AutoStart
```

- [ ] **Step 3: Add the field and populate it**

```go
// deck-go/backend/internal/runtime/facade/facade.go
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
	LifecycleState  string  `json:"lifecycleState,omitempty"`
	ServiceName     string  `json:"serviceName,omitempty"`
	EntrypointPath  string  `json:"entrypointPath,omitempty"`
	AutoStart       bool    `json:"autoStart"` // NEW: bundled reads from cfg.AutoStart; remote is always false
}
```

```go
// deck-go/backend/internal/runtime/bundled/facade.go — in RuntimeGatewayStatus
status := facade.RuntimeStatus{
	Mode:           string(envconf.ModeBundled),
	Configured:     res.LifecycleState == StateRunning,
	Status:         runtimeStatusFromLifecycle(res.LifecycleState),
	Health:         runtimeHealthFromLifecycle(res.LifecycleState),
	GatewayURL:     bundledEndpointURL(f.cfg),
	LifecycleState: string(res.LifecycleState),
	ServiceName:    f.serviceName,
	EntrypointPath: f.entrypointPath,
	AutoStart:      f.cfg.AutoStart, // NEW
}
```

```go
// deck-go/backend/internal/runtime/remote/facade.go — in RuntimeGatewayStatus, ensure AutoStart is explicitly false
status := facade.RuntimeStatus{
	Mode: string(envconf.ModeRemote),
	// ... existing fields ...
	AutoStart: false, // NEW: remote mode never auto-starts a local Gateway
}
```

The `false` zero value is implicit if we omit the field, but the comment in the remote facade is load-bearing for future readers.

- [ ] **Step 4: Run, verify pass**

```bash
cd deck-go && go test ./backend/internal/runtime/bundled/ ./backend/internal/runtime/remote/ ./backend/internal/runtime/facade/ -v
# Expected: PASS, including the new AutoStart cases.
```

- [ ] **Step 5: Commit**

```bash
cd deck-go
scripts/committer "feat(runtime/facade): add RuntimeStatus.AutoStart and wire bundled+remote" \
  backend/internal/runtime/facade/facade.go \
  backend/internal/runtime/bundled/facade.go \
  backend/internal/runtime/bundled/facade_auto_start_test.go \
  backend/internal/runtime/remote/facade.go \
  backend/internal/runtime/remote/facade_test.go
```

---

## Phase A: Facade plumbing into ManagedRuntime

### Task A1: Add `facade` field, `lastStatus` cache, and a new constructor that accepts a facade

**Goal:** Introduce a synchronous in-memory `facade.RuntimeStatus` cache on `ManagedRuntime`. This is the load-bearing replacement for `supervisor.Snapshot()` — `registry.LastStatusReader` (added in Phase B') and the WS lifecycle bridge will read from this cache instead of calling into the facade per request. `/api/runtimes` stays I/O-free.

**Files:**

- Modify: `deck-go/backend/internal/runtime/openclaw/managed_runtime.go`
- Test: `deck-go/backend/internal/runtime/openclaw/managed_runtime_test.go`
- Create: `deck-go/backend/internal/runtime/facade/testfacade/testfacade.go`

- [ ] **Step 1: Write the failing test**

Add to `managed_runtime_test.go`:

```go
func TestNewManagedRuntimeWithFacade_PopulatesFacadeField(t *testing.T) {
	store := configtest.NewStore(t)
	bus := events.NewBus(8)
	fac := testfacade.New(facade.Capabilities{Mode: "remote", Configured: true, EndpointMutable: true})
	managed := NewManagedRuntimeWithFacade(store, fac, bus)
	if managed == nil {
		t.Fatalf("expected non-nil managed runtime")
	}
	if managed.Facade() == nil {
		t.Fatalf("expected facade to be wired")
	}
}

func TestManagedRuntime_LastStatusInitialZero(t *testing.T) {
	store := configtest.NewStore(t)
	bus := events.NewBus(8)
	fac := testfacade.New(facade.Capabilities{Mode: "remote", Configured: true})
	managed := NewManagedRuntimeWithFacade(store, fac, bus)
	got := managed.LastStatus()
	if got.Mode != "" || got.Status != "" {
		t.Fatalf("LastStatus before any refresh should be zero, got %+v", got)
	}
}

func TestManagedRuntime_SetLastStatusIsRace_Safe(t *testing.T) {
	store := configtest.NewStore(t)
	bus := events.NewBus(8)
	fac := testfacade.New(facade.Capabilities{Mode: "bundled"})
	managed := NewManagedRuntimeWithFacade(store, fac, bus)
	// Hammer the cache concurrently — `go test -race` must stay green.
	var wg sync.WaitGroup
	for i := 0; i < 32; i++ {
		wg.Add(2)
		go func() {
			defer wg.Done()
			managed.setLastStatus(facade.RuntimeStatus{Mode: "bundled", Status: "running"})
		}()
		go func() {
			defer wg.Done()
			_ = managed.LastStatus()
		}()
	}
	wg.Wait()
}
```

Place a thin `testfacade` package at `deck-go/backend/internal/runtime/facade/testfacade/testfacade.go` (new file, ~60 LOC) that constructs a stub `facade.RuntimeFacade` returning configurable Capabilities / RuntimeStatus / EndpointView. The stub returns `ErrUnsupported` for `Install`, `Reinstall`, and lifecycle methods unless explicitly configured.

Full `testfacade.go`:

```go
package testfacade

import (
	"context"

	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
)

type Stub struct {
	CapabilitiesValue facade.Capabilities
	EndpointValue     facade.EndpointView
	StatusValue       facade.RuntimeStatus
	ConnectionValue   facade.GatewayConnection

	StartFn   func(context.Context) (facade.RuntimeStatus, error)
	StopFn    func(context.Context) (facade.RuntimeStatus, error)
	RestartFn func(context.Context) (facade.RuntimeStatus, error)
}

func New(caps facade.Capabilities) *Stub {
	return &Stub{CapabilitiesValue: caps}
}

func (s *Stub) Capabilities(context.Context) (facade.Capabilities, error) { return s.CapabilitiesValue, nil }
func (s *Stub) Endpoint(context.Context) (facade.EndpointView, error)     { return s.EndpointValue, nil }
func (s *Stub) UpdateRemoteEndpoint(context.Context, facade.RemoteEndpointInput) (facade.EndpointView, error) {
	return facade.EndpointView{}, facade.ErrUnsupported
}
func (s *Stub) TestRemoteEndpoint(context.Context, *facade.RemoteEndpointInput) (facade.TestResult, error) {
	return facade.TestResult{}, facade.ErrUnsupported
}
func (s *Stub) RuntimeGatewayStatus(context.Context) (facade.RuntimeStatus, error) {
	return s.StatusValue, nil
}
func (s *Stub) Start(ctx context.Context) (facade.RuntimeStatus, error) {
	if s.StartFn != nil {
		return s.StartFn(ctx)
	}
	return s.StatusValue, nil
}
func (s *Stub) Stop(ctx context.Context) (facade.RuntimeStatus, error) {
	if s.StopFn != nil {
		return s.StopFn(ctx)
	}
	return s.StatusValue, nil
}
func (s *Stub) Restart(ctx context.Context) (facade.RuntimeStatus, error) {
	if s.RestartFn != nil {
		return s.RestartFn(ctx)
	}
	return s.StatusValue, nil
}
func (s *Stub) Install(context.Context) (facade.RuntimeStatus, error)   { return s.StatusValue, facade.ErrUnsupported }
func (s *Stub) Reinstall(context.Context) (facade.RuntimeStatus, error) { return s.StatusValue, facade.ErrUnsupported }
func (s *Stub) ReloadRuntime(ctx context.Context) (facade.RuntimeStatus, error) {
	return s.Restart(ctx)
}

func (s *Stub) GatewayConnection(context.Context) (facade.GatewayConnection, error) {
	return s.ConnectionValue, nil
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd deck-go/backend && go test ./internal/runtime/openclaw/ -run TestNewManagedRuntimeWithFacade_PopulatesFacadeField`
Expected: FAIL with "undefined: NewManagedRuntimeWithFacade" / "undefined: Facade"

- [ ] **Step 3: Add fields, cache helpers, and constructor**

In `managed_runtime.go`, augment `ManagedRuntime`:

```go
type ManagedRuntime struct {
	store        *config.Store
	supervisor   ManagedRuntimeSupervisor // TO BE REMOVED in Phase D
	facade       facade.RuntimeFacade     // NEW
	lastStatusMu sync.RWMutex             // NEW — protects lastStatus
	lastStatus   facade.RuntimeStatus     // NEW — synchronous in-memory cache; refreshed by lifecycle ops and BootstrapStatus
	adapter      RuntimeSurface
	registry     *runtimeregistry.Registry
	monitor      *runtimeprojection.MonitorQueries
	bus          *events.Bus
	bffViews     *views.Registry
}

func (m *ManagedRuntime) Facade() facade.RuntimeFacade {
	if m == nil {
		return nil
	}
	return m.facade
}

// LastStatus returns the most recent facade.RuntimeStatus observed by this runtime.
// It is a pure in-memory read; callers MUST NOT use it as a probe trigger. Lifecycle
// methods (Phase A2/B) and BootstrapStatus (Phase B1) refresh the cache after they call
// into facade.RuntimeGatewayStatus/Start/Stop/Restart.
func (m *ManagedRuntime) LastStatus() facade.RuntimeStatus {
	if m == nil {
		return facade.RuntimeStatus{}
	}
	m.lastStatusMu.RLock()
	defer m.lastStatusMu.RUnlock()
	return m.lastStatus
}

func (m *ManagedRuntime) setLastStatus(status facade.RuntimeStatus) {
	if m == nil {
		return
	}
	m.lastStatusMu.Lock()
	m.lastStatus = status
	m.lastStatusMu.Unlock()
}

func NewManagedRuntimeWithFacade(store *config.Store, fac facade.RuntimeFacade, bus *events.Bus) *ManagedRuntime {
	requester, _ := fac.(Requester)
	adapter := NewAdapterWithRealtime(requester, nil)
	managed := &ManagedRuntime{
		store:   store,
		facade:  fac,
		adapter: adapter,
		monitor: runtimeprojection.NewMonitorQueries(bus),
		bus:     bus,
	}
	// registry.NewWithCapabilities still expects a bundled.Snapshot-returning SnapshotReader
	// in Phase A. Phase B' switches the interface to LastStatusReader and wires it to
	// managed.LastStatus() directly.
	managed.registry = runtimeregistry.NewWithCapabilities(
		facadeSnapshotReaderShim{},
		adapter.CapabilitySummary(),
		bus,
	)
	managed.bffViews = views.NewRegistry(
		func(ctx context.Context, params generated.GatewayBatchParams) (generated.GatewayBatchResult, error) {
			return managed.GatewayQueries().Batch(ctx, params)
		},
		func(ctx context.Context, method string, params any) (any, error) {
			return managed.GatewayQueries().RequestTypedRaw(ctx, method, params)
		},
		views.WithStateDir(resolveManagedRuntimeStateDir(store)),
	)
	return managed
}

// facadeSnapshotReaderShim is a temporary Phase-A stub satisfying the existing
// registry.SnapshotReader interface (returns bundled.Snapshot). Phase B' replaces
// it with a LastStatus-based adapter once the registry interface is migrated.
// Until then, callers of NewManagedRuntimeWithFacade are test-only — no production
// caller exists for `/api/runtimes` against this constructor in Phase A.
type facadeSnapshotReaderShim struct{}

func (facadeSnapshotReaderShim) Snapshot() bundled.Snapshot {
	return bundled.Snapshot{}
}
```

Import additions: `sync` (for `RWMutex`) and `bundled` (for the shim's return type — already imported in `managed_runtime.go` by virtue of `ManagedRuntimeSupervisor`).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd deck-go/backend && go test ./internal/runtime/openclaw/ -run TestNewManagedRuntimeWithFacade_PopulatesFacadeField -count=1`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
scripts/committer "Add ManagedRuntime facade plumbing

Introduce NewManagedRuntimeWithFacade and a facade field on ManagedRuntime so
later phases can route lifecycle reads through facade.RuntimeFacade instead of
the legacy bundled supervisor types.

Scope-risk: low — new constructor, old paths still work.
Tested: go test ./internal/runtime/openclaw/ -run TestNewManagedRuntimeWithFacade_PopulatesFacadeField" \
  deck-go/backend/internal/runtime/openclaw/managed_runtime.go \
  deck-go/backend/internal/runtime/openclaw/managed_runtime_test.go \
  deck-go/backend/internal/runtime/facade/testfacade/testfacade.go
```

---

### Task A2: Wire `RuntimeGatewayActionResponse` to facade-sourced status (mock-first, no behavior change yet)

**Files:**

- Modify: `deck-go/backend/internal/runtime/openclaw/legacy_runtime_orchestration.go`
- Test: `deck-go/backend/internal/runtime/openclaw/legacy_runtime_orchestration_test.go` (new file if missing; otherwise extend)

- [ ] **Step 1: Write the failing test**

```go
func TestRuntimeGatewayStatusResponse_UsesFacadeStatus(t *testing.T) {
	stub := testfacade.New(facade.Capabilities{Mode: "remote", Configured: true})
	stub.StatusValue = facade.RuntimeStatus{
		Mode:       "remote",
		Configured: true,
		Status:     "running",
		Health:     "healthy",
		GatewayURL: "ws://example.invalid:18789",
	}
	bus := events.NewBus(8)
	managed := NewManagedRuntimeWithFacade(configtest.NewStore(t), stub, bus)
	resp := managed.RuntimeGatewayStatusResponse()
	if !resp.Ok {
		t.Fatalf("expected ok response")
	}
	if resp.Runtime.Status != "running" {
		t.Fatalf("expected status=running, got %q", resp.Runtime.Status)
	}
	if resp.Runtime.GatewayUrl != "ws://example.invalid:18789" {
		t.Fatalf("expected gateway URL to flow through, got %q", resp.Runtime.GatewayUrl)
	}
}

func TestRuntimeGatewayActions_RefreshLastStatusCache(t *testing.T) {
	stub := testfacade.New(facade.Capabilities{Mode: "bundled", Configured: true})
	stub.StatusValue = facade.RuntimeStatus{Mode: "bundled", Status: "stopped", Health: "unknown"}
	bus := events.NewBus(8)
	managed := NewManagedRuntimeWithFacade(configtest.NewStore(t), stub, bus)
	// Mutate the stub between calls so we can assert the cache is refreshed in step.
	stub.StartFn = func(ctx context.Context) (facade.RuntimeStatus, error) {
		return facade.RuntimeStatus{Mode: "bundled", Status: "running", Health: "healthy"}, nil
	}
	if _, err := managed.StartRuntimeGateway(context.Background()); err != nil {
		t.Fatalf("StartRuntimeGateway: %v", err)
	}
	got := managed.LastStatus()
	if got.Status != "running" || got.Health != "healthy" {
		t.Fatalf("lastStatus not refreshed after StartRuntimeGateway: %+v", got)
	}
	stub.StatusValue = facade.RuntimeStatus{Mode: "bundled", Status: "stopped", Health: "unknown"}
	_ = managed.RuntimeGatewayStatusResponse()
	got = managed.LastStatus()
	if got.Status != "stopped" {
		t.Fatalf("lastStatus not refreshed after RuntimeGatewayStatusResponse: %+v", got)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd deck-go/backend && go test ./internal/runtime/openclaw/ -run TestRuntimeGatewayStatusResponse_UsesFacadeStatus -count=1`
Expected: FAIL — current implementation still reads `m.Snapshot()` (returns zero `bundled.Snapshot`), so `resp.Runtime.Status` will be empty.

- [ ] **Step 3: Rewrite `runtimeStatus` + `RuntimeGatewayStatusResponse` + refresh the cache on every facade call**

Replace the body of `legacy_runtime_orchestration.go` with the facade-sourced shape. Drop the `bundled` import. Every facade call refreshes `m.lastStatus` via `m.setLastStatus`, so `m.LastStatus()` (read by the registry in Phase B') stays current without any per-request probe.

```go
package openclaw

import (
	"context"

	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
)

type RuntimeGatewayActionResponse = deckapi.DeckGoRuntimeGatewayActionResponse

func (m *ManagedRuntime) RuntimeGatewayStatusResponse() RuntimeGatewayActionResponse {
	status, _ := m.refreshFacadeStatus(context.Background())
	return RuntimeGatewayActionResponse{
		Ok:      true,
		Runtime: runtimeStatusFromFacadeStatus(status),
	}
}

func (m *ManagedRuntime) StartRuntimeGateway(ctx context.Context) (RuntimeGatewayActionResponse, error) {
	if m == nil || m.facade == nil {
		return RuntimeGatewayActionResponse{}, facade.ErrUnsupported
	}
	status, err := m.facade.Start(ctx)
	m.setLastStatus(status)
	return RuntimeGatewayActionResponse{
		Ok:      err == nil,
		Runtime: runtimeStatusFromFacadeStatus(status),
	}, err
}

func (m *ManagedRuntime) StopRuntimeGateway(ctx context.Context) (RuntimeGatewayActionResponse, error) {
	if m == nil || m.facade == nil {
		return RuntimeGatewayActionResponse{}, facade.ErrUnsupported
	}
	status, err := m.facade.Stop(ctx)
	m.setLastStatus(status)
	return RuntimeGatewayActionResponse{
		Ok:      err == nil,
		Runtime: runtimeStatusFromFacadeStatus(status),
	}, err
}

func (m *ManagedRuntime) RestartRuntimeGateway(ctx context.Context) (RuntimeGatewayActionResponse, error) {
	if m == nil || m.facade == nil {
		return RuntimeGatewayActionResponse{}, facade.ErrUnsupported
	}
	status, err := m.facade.Restart(ctx)
	m.setLastStatus(status)
	return RuntimeGatewayActionResponse{
		Ok:      err == nil,
		Runtime: runtimeStatusFromFacadeStatus(status),
	}, err
}

// refreshFacadeStatus is the only call site that hits facade.RuntimeGatewayStatus
// outside of explicit lifecycle actions. It refreshes m.lastStatus before returning
// so subsequent in-memory readers (registry, WS bridge) see the same value.
func (m *ManagedRuntime) refreshFacadeStatus(ctx context.Context) (facade.RuntimeStatus, error) {
	if m == nil || m.facade == nil {
		return facade.RuntimeStatus{}, nil
	}
	status, err := m.facade.RuntimeGatewayStatus(ctx)
	if err == nil {
		m.setLastStatus(status)
	}
	return status, err
}

func runtimeStatusFromFacadeStatus(s facade.RuntimeStatus) deckapi.DeckGoRuntimeGatewayStatus {
	resp := deckapi.DeckGoRuntimeGatewayStatus{
		Mode:           s.Mode,
		Configured:     s.Configured,
		Status:         s.Status,
		Health:         s.Health,
		GatewayUrl:     s.GatewayURL,
		OwnershipState: s.OwnershipState,
		RestartAttempts: float64(s.RestartAttempts),
	}
	if s.PID != nil {
		resp.Pid = float64(*s.PID)
	}
	if s.LastConnectedAt != nil {
		resp.LastConnectedAt = *s.LastConnectedAt
	}
	if s.LastError != nil {
		resp.LastError = *s.LastError
	}
	if s.LatencyP50 != nil {
		resp.LatencyP50 = float64(*s.LatencyP50)
	}
	if s.TLSVerified != nil {
		resp.TlsVerified = *s.TLSVerified
	}
	// failurePhase / startedAt / lastExitAt / lastExitCode / owner / ownershipFile / restartDelayMs / autoStart
	// are spawn-era fields with no facade equivalent. They remain zero-valued (omitempty drops them from JSON).
	// Frontend (api.ts:611-626) tolerates undefined.
	return resp
}
```

Note: `BootstrapStatus` still uses `Snapshot` indirectly; that is addressed in Task B1.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd deck-go/backend && go test ./internal/runtime/openclaw/ -run TestRuntimeGatewayStatusResponse_UsesFacadeStatus -count=1`
Expected: PASS

Also run: `go test ./internal/runtime/openclaw/ -count=1` — old tests that still rely on `m.Snapshot()` may fail; they will be cleaned in Phase C/D. If they fail compile, the call sites still reference `m.supervisor`. Skip the failures for now and continue.

- [ ] **Step 5: Commit**

```bash
scripts/committer "Source RuntimeGatewayActionResponse from runtime facade

RuntimeGatewayStatusResponse / StartRuntimeGateway / StopRuntimeGateway /
RestartRuntimeGateway now read from facade.RuntimeFacade. The legacy
runtimeStatus(bundled.Snapshot) adapter is replaced with
runtimeStatusFromFacadeStatus(facade.RuntimeStatus). Spawn-era fields
(failurePhase, lastExitCode, ownershipFile, restartDelayMs) disappear from
the response; frontend tolerates undefined via api.ts mapping.

Constraint: deckapi.DeckGoRuntimeGatewayStatus shape unchanged; only the
populated subset changes.
Tested: go test ./internal/runtime/openclaw/ -run TestRuntimeGatewayStatusResponse_UsesFacadeStatus
Not-tested: BootstrapStatus snapshot read is still via supervisor; addressed in B1." \
  deck-go/backend/internal/runtime/openclaw/legacy_runtime_orchestration.go \
  deck-go/backend/internal/runtime/openclaw/legacy_runtime_orchestration_test.go
```

---

## Phase B: BootstrapStatus + onboarding migration

### Task B1: `BootstrapStatus` reads from facade

**Files:**

- Modify: `deck-go/backend/internal/runtime/openclaw/legacy_runtime_orchestration.go`
- Test: `deck-go/backend/internal/runtime/openclaw/legacy_runtime_orchestration_test.go`

- [ ] **Step 1: Write the failing test**

```go
func TestBootstrapStatus_ReadsFacadeRunningStatus(t *testing.T) {
	stub := testfacade.New(facade.Capabilities{Mode: "remote", Configured: true})
	stub.StatusValue = facade.RuntimeStatus{
		Mode:       "remote",
		Configured: true,
		Status:     "running",
		Health:     "healthy",
		GatewayURL: "ws://example.invalid:18789",
	}
	store := configtest.NewStore(t)
	bus := events.NewBus(8)
	managed := NewManagedRuntimeWithFacade(store, stub, bus)
	payload, err := managed.BootstrapStatus(context.Background())
	if err != nil {
		t.Fatalf("BootstrapStatus error: %v", err)
	}
	if payload.Runtime.Status != "running" {
		t.Fatalf("expected status=running, got %q", payload.Runtime.Status)
	}
	if !payload.Settings.ManagedGatewayConfigured {
		t.Fatalf("expected ManagedGatewayConfigured=true when facade reports configured")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd deck-go/backend && go test ./internal/runtime/openclaw/ -run TestBootstrapStatus_ReadsFacadeRunningStatus -count=1`
Expected: FAIL — current `BootstrapStatus` reads `m.Snapshot()` which still goes through nil supervisor → empty status.

- [ ] **Step 3: Rewrite `BootstrapStatus` body**

```go
func (m *ManagedRuntime) BootstrapStatus(ctx context.Context) (deckapi.DeckGoBootstrapStatusResponse, error) {
	payload := deckapi.DeckGoBootstrapStatusResponse{
		Ok: true,
		Gateway: deckapi.DeckGoBootstrapGatewayStatus{
			Connected: false,
		},
	}
	if m == nil || m.store == nil {
		return payload, nil
	}
	effective := m.store.Effective()
	status, _ := m.refreshFacadeStatus(ctx)
	payload.Settings = deckapi.DeckGoBootstrapSettingsStatus{
		Path:                     m.store.Path(),
		AccessTokenConfigured:    effective.AccessToken != "",
		ManagedGatewayConfigured: status.Configured,
		CommandConfigured:        effective.ManagedGateway.Command != "",
		GatewayTokenConfigured:   effective.ManagedGateway.GatewayToken != "",
		AutoStart:                effective.ManagedGateway.AutoStart,
	}
	payload.Runtime = runtimeStatusFromFacadeStatus(status)
	if status.Status == "running" || status.Status == "degraded" {
		summary, _ := m.LoadGatewayStatus(ctx)
		payload.Gateway = deckapi.DeckGoBootstrapGatewayStatus{
			Connected:                   summary.Connected,
			Error:                       summary.Error,
			CapabilitySnapshotAvailable: summary.CapabilitySnapshotAvailable,
			MethodCount:                 float64(summary.MethodCount),
			EventCount:                  float64(summary.EventCount),
			SchemaVersion:               summary.SchemaVersion,
		}
	}
	return payload, nil
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd deck-go/backend && go test ./internal/runtime/openclaw/ -run TestBootstrapStatus_ReadsFacadeRunningStatus -count=1`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
scripts/committer "Source BootstrapStatus from runtime facade

Replace m.Snapshot() with m.runtimeStatusFromFacade(ctx). Health gating
('running' or 'degraded') uses string comparison instead of bundled.Status
constants.

Tested: go test ./internal/runtime/openclaw/ -run TestBootstrapStatus_ReadsFacadeRunningStatus" \
  deck-go/backend/internal/runtime/openclaw/legacy_runtime_orchestration.go \
  deck-go/backend/internal/runtime/openclaw/legacy_runtime_orchestration_test.go
```

---

### Task B2: `legacy_admin_settings_onboarding.go` reads from facade

**Files:**

- Modify: `deck-go/backend/internal/runtime/openclaw/legacy_admin_settings_onboarding.go`

- [ ] **Step 1: Inspect current usage**

`grep -n "m\.Snapshot\|runtimeVersionStatus\|m\.store\.GatewayConnection" deck-go/backend/internal/runtime/openclaw/legacy_admin_settings_onboarding.go`

Expected hits: line ~138 (`status := runtimeVersionStatus(m.Snapshot())`) and line ~150 (`_, _, ok := m.store.GatewayConnection()`).

The store-based `GatewayConnection()` call is separate from supervisor — leave it alone (it reads from `config.Store`, not from `bundled`).

- [ ] **Step 2: Write the failing test**

If no test file exists, create `legacy_admin_settings_onboarding_test.go`:

```go
func TestGetOnboardingStatus_DoesNotPanicWithoutSupervisor(t *testing.T) {
	stub := testfacade.New(facade.Capabilities{Mode: "remote", Configured: false})
	stub.StatusValue = facade.RuntimeStatus{Mode: "remote", Configured: false, Status: "stopped"}
	bus := events.NewBus(8)
	managed := NewManagedRuntimeWithFacade(configtest.NewStore(t), stub, bus)
	payload, err := managed.GetOnboardingStatus(context.Background())
	if err != nil {
		t.Fatalf("GetOnboardingStatus error: %v", err)
	}
	if payload == nil {
		t.Fatalf("expected non-nil payload")
	}
}
```

- [ ] **Step 3: Verify failure (compile-only if `m.Snapshot()` removed later)**

Run: `cd deck-go/backend && go test ./internal/runtime/openclaw/ -run TestGetOnboardingStatus_DoesNotPanicWithoutSupervisor -count=1`
Expected: at this point likely PASS (the function still compiles); but failure becomes meaningful in Phase C when `m.Snapshot()` is removed. Mark this test as a regression guard.

- [ ] **Step 4: Change `runtimeVersionStatus` call to facade-sourced status**

Locate the function calling `runtimeVersionStatus(m.Snapshot())`. Inspect `runtimeVersionStatus` signature. If it takes `bundled.Snapshot`, refactor it to take `facade.RuntimeStatus` (or just the fields it actually reads).

Quick discovery: `grep -nA5 "func runtimeVersionStatus" deck-go/backend/internal/runtime/openclaw/`. Replace the body of the caller to use `m.runtimeStatusFromFacade(ctx)` and adapt accordingly. If `runtimeVersionStatus` only inspects `Status` / `Configured`, replace it with direct field reads on `facade.RuntimeStatus`.

- [ ] **Step 5: Run test + commit**

Run: `cd deck-go/backend && go test ./internal/runtime/openclaw/ -count=1`
Expected: PASS

```bash
scripts/committer "Source legacy onboarding runtime version from facade

Replace runtimeVersionStatus(m.Snapshot()) with facade-sourced status read.

Tested: go test ./internal/runtime/openclaw/" \
  deck-go/backend/internal/runtime/openclaw/legacy_admin_settings_onboarding.go \
  deck-go/backend/internal/runtime/openclaw/legacy_admin_settings_onboarding_test.go
```

---

## Phase B': Migrate `runtime/registry` from `bundled.Snapshot` to `facade.RuntimeStatus` (cache-based)

**Why cache, not probe:** the current `bundled.Supervisor.Snapshot()` returns a synchronous in-memory snapshot. `bundled.Facade.RuntimeGatewayStatus(ctx)`, by contrast, triggers `probe.Probe(ctx, …)` which spawns the `openclaw gateway status` CLI and pings the Gateway HTTP endpoint. The `/api/runtimes` endpoint is a list call that must remain I/O-free; if we routed it through `facade.RuntimeGatewayStatus`, every list call would launch a child process. Phase A2 already made `ManagedRuntime` cache the latest `facade.RuntimeStatus` in `m.lastStatus`; the registry reads that cache. `controld/app.go runtimeSummaryOverride` continues to actively probe in remote mode (it already lives outside the registry chain) — it is unaffected by this change.

### Task BPRIME1: Redefine `registry.SnapshotReader` as `LastStatusReader` returning `facade.RuntimeStatus` synchronously

**Files:**

- Modify: `deck-go/backend/internal/runtime/registry/summary.go`
- Modify: `deck-go/backend/internal/runtime/registry/summary_test.go`

- [ ] **Step 1: Write the failing test**

Update `summary_test.go`:

```go
package registry

import (
	"context"
	"testing"

	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
)

type stubStatusReader struct {
	status facade.RuntimeStatus
}

func (s stubStatusReader) LastStatus() facade.RuntimeStatus { return s.status }

func TestSummarize_FromCachedFacadeStatus(t *testing.T) {
	reader := stubStatusReader{
		status: facade.RuntimeStatus{
			Mode:       "bundled",
			Configured: true,
			Status:     "running",
			Health:     "healthy",
			GatewayURL: "ws://example.invalid:18789",
			AutoStart:  true,
		},
	}
	summaries := NewSummaries(reader)
	items, err := summaries.ListRuntimes(context.Background())
	if err != nil {
		t.Fatalf("ListRuntimes error: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 summary, got %d", len(items))
	}
	if items[0].Status != "running" || items[0].Health != "healthy" {
		t.Fatalf("unexpected summary: %+v", items[0])
	}
	if items[0].GatewayURL == nil || *items[0].GatewayURL != "ws://example.invalid:18789" {
		t.Fatalf("expected gateway URL to flow through, got %+v", items[0].GatewayURL)
	}
	if !items[0].Managed {
		t.Fatalf("expected Managed=true for bundled mode")
	}
	if !items[0].AutoStart {
		t.Fatalf("expected AutoStart=true to flow through from status")
	}
}

func TestSummarize_RemoteMode_AutoStartFalse(t *testing.T) {
	reader := stubStatusReader{
		status: facade.RuntimeStatus{Mode: "remote", Status: "running", Health: "healthy", AutoStart: false},
	}
	summaries := NewSummaries(reader)
	items, _ := summaries.ListRuntimes(context.Background())
	if items[0].Managed {
		t.Fatalf("expected Managed=false for remote mode")
	}
	if items[0].AutoStart {
		t.Fatalf("expected AutoStart=false for remote mode")
	}
}
```

Remove the existing `stubSnapshotReader` / `bundled.Snapshot{}`-based test cases — they are supplanted.

- [ ] **Step 2: Run, verify fail**

```bash
cd deck-go/backend && go test ./internal/runtime/registry/ -run TestSummarize -count=1
# Expected: compile failure — LastStatusReader undefined, NewSummaries doesn't accept stubStatusReader.
```

- [ ] **Step 3: Rewrite `registry/summary.go`**

Full file replacement:

```go
package registry

import (
	"context"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
	runtimecapability "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/capability"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/runtimeid"
)

const DefaultRuntimeID = runtimeid.Default

// LastStatusReader returns the most recently observed lifecycle status without
// triggering I/O. Implementations MUST NOT probe; the source-of-truth lives in
// ManagedRuntime.lastStatus, refreshed by the runtime facade lifecycle calls.
type LastStatusReader interface {
	LastStatus() facade.RuntimeStatus
}

type CapabilitySummary = runtimecapability.Summary

type CapabilityLoader interface {
	Load(context.Context) (CapabilitySummary, error)
}

type RuntimeSummary struct {
	RuntimeID         string  `json:"runtimeId"`
	Managed           bool    `json:"managed"`
	Configured        bool    `json:"configured"`
	Status            string  `json:"status"`
	Health            string  `json:"health"`
	CapabilityVersion *string `json:"capabilityVersion,omitempty"`
	MethodCount       *int    `json:"methodCount,omitempty"`
	EventCount        *int    `json:"eventCount,omitempty"`
	GatewayURL        *string `json:"gatewayUrl,omitempty"`
	LastError         *string `json:"lastError,omitempty"`
	AutoStart         bool    `json:"autoStart"`
	OccurredAt        string  `json:"occurredAt"`
}

type Summaries struct {
	reader       LastStatusReader
	capabilities CapabilityLoader
}

func NewSummaries(reader LastStatusReader) *Summaries {
	return &Summaries{reader: reader}
}

func NewSummariesWithCapabilities(reader LastStatusReader, capabilities CapabilityLoader) *Summaries {
	return &Summaries{reader: reader, capabilities: capabilities}
}

func (s *Summaries) ListRuntimes(ctx context.Context) ([]RuntimeSummary, error) {
	return []RuntimeSummary{summarize(ctx, s.readStatus(), s.capabilities)}, nil
}

func (s *Summaries) GetRuntime(ctx context.Context, runtimeID string) (RuntimeSummary, bool, error) {
	if runtimeID != DefaultRuntimeID {
		return RuntimeSummary{}, false, nil
	}
	return summarize(ctx, s.readStatus(), s.capabilities), true, nil
}

func (s *Summaries) readStatus() facade.RuntimeStatus {
	if s == nil || s.reader == nil {
		return facade.RuntimeStatus{}
	}
	return s.reader.LastStatus()
}

func summarize(ctx context.Context, status facade.RuntimeStatus, capabilities CapabilityLoader) RuntimeSummary {
	summary := RuntimeSummary{
		RuntimeID:  DefaultRuntimeID,
		Managed:    status.Mode == "bundled",
		Configured: status.Configured,
		Status:     status.Status,
		Health:     status.Health,
		GatewayURL: stringPtrNonEmpty(status.GatewayURL),
		LastError:  status.LastError,
		AutoStart:  status.AutoStart,
		OccurredAt: time.Now().UTC().Format(time.RFC3339),
	}
	if capabilities == nil {
		return summary
	}
	capabilitySummary, err := capabilities.Load(ctx)
	if err != nil || !capabilitySummary.Available || capabilitySummary.SchemaVersion == "" {
		return summary
	}
	summary.CapabilityVersion = &capabilitySummary.SchemaVersion
	summary.MethodCount = &capabilitySummary.MethodCount
	summary.EventCount = &capabilitySummary.EventCount
	return summary
}

func stringPtrNonEmpty(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}
```

Notes:

- `Managed` is now derived from `status.Mode == "bundled"`. This preserves the production semantic: bundled mode → managed runtime; remote → not.
- `AutoStart` flows from `status.AutoStart` (added in Phase Z2). For bundled mode it equals `f.cfg.AutoStart`; for remote mode it is always `false`. This preserves the existing JSON contract at `/api/runtimes` and the `GatewayPanel.tsx:1554-1556` rendering.
- No `context` passed to `LastStatus()` because it is an in-memory read with no cancellation semantics.

- [ ] **Step 4: Update `registry.NewWithCapabilities` signature in `registry.go`**

```bash
cd deck-go/backend && rg -n "SnapshotReader" ./internal/runtime/registry/
# Expected: only references that need renaming to LastStatusReader.
```

Rename `SnapshotReader` → `LastStatusReader` everywhere in `registry.go`. Drop the `bundled` import from any registry file that no longer needs it.

- [ ] **Step 5: Run, verify pass**

```bash
cd deck-go/backend && go test ./internal/runtime/registry/ -count=1
```

Expected: `TestSummarize_FromCachedFacadeStatus` and `TestSummarize_RemoteMode_AutoStartFalse` PASS. Other registry tests still red until BPRIME2.

- [ ] **Step 6: Commit**

```bash
scripts/committer "Migrate registry SnapshotReader to cached LastStatusReader

Registry's lifecycle DTO source is now facade.RuntimeStatus (read from
ManagedRuntime's in-memory cache), not bundled.Snapshot. summarize() reads
facade-typed status and pulls Managed from Mode == 'bundled' and AutoStart
straight from status.AutoStart (added in Phase Z2).

Scope-risk: low — /api/runtimes JSON shape unchanged; no extra I/O.
Tested: go test ./internal/runtime/registry/ -run TestSummarize" \
  deck-go/backend/internal/runtime/registry/summary.go \
  deck-go/backend/internal/runtime/registry/summary_test.go \
  deck-go/backend/internal/runtime/registry/registry.go
```

---

### Task BPRIME2: Migrate registry capability + integration tests to facade fixtures

**Files:**

- Modify: `deck-go/backend/internal/runtime/registry/summary_capability_test.go`
- Modify: `deck-go/backend/internal/runtime/registry/registry_test.go`

- [ ] **Step 1: Replace `bundled.Snapshot` test fixtures with `facade.RuntimeStatus`**

In each file, replace test cases like:

```go
snapshot: bundled.Snapshot{
    Managed:   true,
    Status:    bundled.StatusRunning,
    Health:    bundled.HealthHealthy,
    AutoStart: true,
},
```

with:

```go
status: facade.RuntimeStatus{
    Mode:      "bundled", // drives Managed=true downstream
    Status:    "running",
    Health:    "healthy",
    AutoStart: true,
},
```

Replace `stubSnapshotReader { snapshot bundled.Snapshot }` with `stubStatusReader { status facade.RuntimeStatus }` (returning `facade.RuntimeStatus` from `LastStatus()` — no ctx, no error), mirroring `summary_test.go`'s stub from BPRIME1.

Drop `bundled` import from both files. Drop comparisons like `string(bundled.StatusRunning)` → just `"running"`.

- [ ] **Step 2: Run, verify pass**

Run: `cd deck-go/backend && go test ./internal/runtime/registry/ -count=1`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
scripts/committer "Migrate registry capability/integration tests to facade fixtures

Drop bundled.Snapshot test fixtures from summary_capability_test.go and
registry_test.go. They now use facade.RuntimeStatus + the local
stubStatusReader.

Tested: go test ./internal/runtime/registry/" \
  deck-go/backend/internal/runtime/registry/summary_capability_test.go \
  deck-go/backend/internal/runtime/registry/registry_test.go
```

---

### Task BPRIME3: ManagedRuntime registry adapter implements cached `LastStatusReader`

**Files:**

- Modify: `deck-go/backend/internal/runtime/openclaw/managed_runtime.go`
- Modify: `deck-go/backend/internal/runtime/openclaw/managed_runtime_test.go`

This task supersedes the temporary `facadeSnapshotReaderShim` introduced in Task A1. The adapter holds a back-reference to `ManagedRuntime` and reads its in-memory `lastStatus` cache — no per-request probe.

- [ ] **Step 1: Write the failing test**

In `managed_runtime_test.go`:

```go
func TestManagedRuntime_RegistryReadsCachedLastStatus(t *testing.T) {
	stub := testfacade.New(facade.Capabilities{Mode: "bundled", Configured: true})
	stub.StatusValue = facade.RuntimeStatus{
		Mode:       "bundled",
		Configured: true,
		Status:     "running",
		Health:     "healthy",
		AutoStart:  true,
	}
	bus := events.NewBus(8)
	managed := NewManagedRuntimeWithFacade(configtest.NewStore(t), stub, bus)
	// Prime the cache (BootstrapStatus would do this in production; we exercise via
	// the public lifecycle method).
	_ = managed.RuntimeGatewayStatusResponse()

	items, err := managed.ListRuntimes(context.Background())
	if err != nil {
		t.Fatalf("ListRuntimes error: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 summary, got %d", len(items))
	}
	if items[0].Status != "running" || !items[0].Managed || !items[0].AutoStart {
		t.Fatalf("registry did not flow cached lifecycle status: %+v", items[0])
	}
}

func TestManagedRuntime_RegistryDoesNotProbeOnList(t *testing.T) {
	// If `ListRuntimes` ever calls into the facade per request, this test catches it.
	probeCalls := 0
	stub := testfacade.New(facade.Capabilities{Mode: "bundled"})
	stub.RuntimeGatewayStatusFn = func(context.Context) (facade.RuntimeStatus, error) {
		probeCalls++
		return facade.RuntimeStatus{Mode: "bundled", Status: "running"}, nil
	}
	bus := events.NewBus(8)
	managed := NewManagedRuntimeWithFacade(configtest.NewStore(t), stub, bus)
	for i := 0; i < 5; i++ {
		_, _ = managed.ListRuntimes(context.Background())
	}
	if probeCalls != 0 {
		t.Fatalf("ListRuntimes triggered %d facade probes; expected 0 (cache-only read)", probeCalls)
	}
}
```

The second test requires `testfacade.Stub` to expose `RuntimeGatewayStatusFn`. Augment `testfacade.go` accordingly:

```go
// Add to testfacade.Stub
RuntimeGatewayStatusFn func(context.Context) (facade.RuntimeStatus, error)

// Replace RuntimeGatewayStatus method
func (s *Stub) RuntimeGatewayStatus(ctx context.Context) (facade.RuntimeStatus, error) {
	if s.RuntimeGatewayStatusFn != nil {
		return s.RuntimeGatewayStatusFn(ctx)
	}
	return s.StatusValue, nil
}
```

- [ ] **Step 2: Run, verify fail**

```bash
cd deck-go/backend && go test ./internal/runtime/openclaw/ -run "TestManagedRuntime_Registry" -count=1
# Expected: FAIL — facadeSnapshotReaderShim returns bundled.Snapshot{} not the cached facade status; registry.NewWithCapabilities still expects the old interface name (renamed in BPRIME1).
```

- [ ] **Step 3: Replace the shim with a cache-reading adapter**

In `managed_runtime.go`, replace the Phase-A `facadeSnapshotReaderShim` block with:

```go
// managedRuntimeStatusReader satisfies registry.LastStatusReader by returning
// the in-memory cache maintained by ManagedRuntime. It does NOT probe the
// facade — lifecycle ops and BootstrapStatus are responsible for cache refresh.
type managedRuntimeStatusReader struct {
	owner *ManagedRuntime
}

func (r managedRuntimeStatusReader) LastStatus() facade.RuntimeStatus {
	if r.owner == nil {
		return facade.RuntimeStatus{}
	}
	return r.owner.LastStatus()
}
```

Update `NewManagedRuntimeWithFacade` to wire the registry through this adapter. Because the adapter needs the `*ManagedRuntime` back-reference, instantiate `managed` first, then construct the registry:

```go
func NewManagedRuntimeWithFacade(store *config.Store, fac facade.RuntimeFacade, bus *events.Bus) *ManagedRuntime {
	requester, _ := fac.(Requester)
	adapter := NewAdapterWithRealtime(requester, nil)
	managed := &ManagedRuntime{
		store:   store,
		facade:  fac,
		adapter: adapter,
		monitor: runtimeprojection.NewMonitorQueries(bus),
		bus:     bus,
	}
	managed.registry = runtimeregistry.NewWithCapabilities(
		managedRuntimeStatusReader{owner: managed},
		adapter.CapabilitySummary(),
		bus,
	)
	managed.bffViews = views.NewRegistry(
		func(ctx context.Context, params generated.GatewayBatchParams) (generated.GatewayBatchResult, error) {
			return managed.GatewayQueries().Batch(ctx, params)
		},
		func(ctx context.Context, method string, params any) (any, error) {
			return managed.GatewayQueries().RequestTypedRaw(ctx, method, params)
		},
		views.WithStateDir(resolveManagedRuntimeStateDir(store)),
	)
	return managed
}
```

Delete the obsolete `facadeSnapshotReaderShim` type. Drop the `bundled` import from `managed_runtime.go` if nothing else needs it.

- [ ] **Step 4: Run, verify pass**

```bash
cd deck-go/backend && go test ./internal/runtime/openclaw/ -run "TestManagedRuntime_Registry" -count=1
# Expected: PASS — both cached-status and zero-probe assertions hold.
```

- [ ] **Step 5: Commit**

```bash
scripts/committer "ManagedRuntime registry reads cached facade.RuntimeStatus

managedRuntimeStatusReader returns ManagedRuntime.LastStatus() (in-memory
cache refreshed by lifecycle ops + BootstrapStatus). /api/runtimes stays
I/O-free; no probe per list request. controld/runtimeSummaryOverride
remains the active-probe path for remote mode and is unaffected.

Tested: go test ./internal/runtime/openclaw/ -run TestManagedRuntime_Registry
        — covers cached read AND zero-probe regression guard." \
  deck-go/backend/internal/runtime/openclaw/managed_runtime.go \
  deck-go/backend/internal/runtime/openclaw/managed_runtime_test.go \
  deck-go/backend/internal/runtime/facade/testfacade/testfacade.go
```

---

## Phase C: Remove ManagedRuntime public lifecycle methods + internal supervisor calls

### Task C1: Route `DeviceTokenRotate` `GatewayConnection` through facade

**Files:**

- Modify: `deck-go/backend/internal/runtime/openclaw/managed_runtime.go` (lines around 452-462)

- [ ] **Step 1: Write the failing test**

```go
func TestDeviceTokenRotate_UsesFacadeGatewayConnection(t *testing.T) {
	stub := testfacade.New(facade.Capabilities{Mode: "remote", Configured: true})
	stub.ConnectionValue = facade.GatewayConnection{
		URL:       "ws://example.invalid:18789",
		Token:     "test-token",
		TLSVerify: false,
	}
	bus := events.NewBus(8)
	managed := NewManagedRuntimeWithFacade(configtest.NewStore(t), stub, bus)
	// DeviceTokenRotate will fail upstream (no real gateway) but should not panic; we only assert it
	// resolves the connection from the facade rather than supervisor.
	_, err := managed.DeviceTokenRotate(context.Background(), map[string]any{"deviceId": "d-1", "role": "device"})
	if err == nil {
		t.Fatalf("expected upstream error from fake gateway")
	}
}
```

- [ ] **Step 2: Run, verify fail**

Run: `cd deck-go/backend && go test ./internal/runtime/openclaw/ -run TestDeviceTokenRotate_UsesFacadeGatewayConnection -count=1`
Expected: FAIL — current code calls `m.GatewayConnection()` which is supervisor-based.

- [ ] **Step 3: Replace inline**

In `managed_runtime.go`:

```go
func (m *ManagedRuntime) DeviceTokenRotate(ctx context.Context, body map[string]any) (any, error) {
	conn, _ := m.facadeGatewayConnection(ctx)
	payload, err := m.GatewayQueries().DeviceTokenRotate(ctx, body)
	if err != nil {
		return nil, err
	}
	if conn.URL != "" {
		transportBinding.InvalidateProbeClient(conn.URL, conn.Token)
	}
	return payload, nil
}

func (m *ManagedRuntime) facadeGatewayConnection(ctx context.Context) (facade.GatewayConnection, error) {
	if m == nil || m.facade == nil {
		return facade.GatewayConnection{}, nil
	}
	if connector, ok := m.facade.(interface {
		GatewayConnection(context.Context) (facade.GatewayConnection, error)
	}); ok {
		return connector.GatewayConnection(ctx)
	}
	return facade.GatewayConnection{}, nil
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd deck-go/backend && go test ./internal/runtime/openclaw/ -run TestDeviceTokenRotate_UsesFacadeGatewayConnection -count=1`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
scripts/committer "Resolve DeviceTokenRotate connection via facade

Replace m.GatewayConnection() (supervisor) with a typed facade gateway
connection read. Behaviour identical when facade returns the same URL/token.

Tested: go test ./internal/runtime/openclaw/ -run TestDeviceTokenRotate_UsesFacadeGatewayConnection" \
  deck-go/backend/internal/runtime/openclaw/managed_runtime.go
```

---

### Task C2: Delete `Snapshot/Start/Stop/Restart/GatewayConnection/EnsureAutoStart` public methods + drop legacy constructors + retire `recordingManagedSupervisor` fixture

**Files:**

- Modify: `deck-go/backend/internal/runtime/openclaw/managed_runtime.go`
- Modify: `deck-go/backend/internal/runtime/openclaw/managed_runtime_test.go` (drop `recordingManagedSupervisor` fixture; rewrite remaining tests to use `testfacade.Stub`)
- Modify: `deck-go/backend/internal/runtime/openclaw/managed_runtime_ws_test.go` (same fixture migration)
- Modify: `deck-go/backend/internal/runtime/openclaw/managed_runtime_ws_lifecycle_test.go` (same)
- Modify: `deck-go/backend/internal/runtime/openclaw/managed_runtime_contract_test.go` (same)
- Modify: `deck-go/backend/internal/runtime/openclaw/transport_binding_test.go` (replace `bundled.Snapshot{...}` test fixtures with `facade.RuntimeStatus{...}` or registry-local stub; drop `bundled` import)
- Modify: `deck-go/backend/internal/server/test_router_test.go` (replace `Snapshot()/Start/Stop/Restart` returning `bundled.Snapshot` fake supervisor interface with `testfacade.Stub`)
- Modify: `deck-go/backend/internal/server/server_test.go` (rewrite call sites that built a ManagedRuntime via `NewManagedRuntimeWithStoreAndSupervisor` + `ManagedSnapshot` fixtures to use `NewManagedRuntimeWithFacade` + `testfacade.Stub`)
- Modify: `deck-go/backend/internal/server/gateway_routes_test.go` (same)
- Modify: `deck-go/backend/internal/server/stream_test.go` (same)
- Modify: `deck-go/backend/internal/server/stream_event_typing_test.go` (same)
- Modify: `deck-go/backend/internal/server/runtime_facade_test.go` (same)

- [ ] **Step 1: Confirm no production caller outside the package**

```bash
cd deck-go/backend && rg -n "managed\.Snapshot|managed\.Start\(ctx|managed\.Stop\(ctx|managed\.Restart\(ctx|managed\.GatewayConnection|managed\.EnsureAutoStart" ./internal --type go | rg -v _test.go
```

Expected: empty.

- [ ] **Step 2: Delete the 6 public methods**

In `managed_runtime.go`, remove:

- `Snapshot() bundled.Snapshot` (lines ~1298-1303)
- `Start(ctx context.Context) (bundled.Snapshot, error)` (lines ~1305-1310)
- `Stop(ctx context.Context) (bundled.Snapshot, error)` (lines ~1312-1317)
- `Restart(ctx context.Context) (bundled.Snapshot, error)` (lines ~1319-1324)
- `GatewayConnection() (string, string, bool)` (lines ~1326-1331)
- `EnsureAutoStart()` (lines ~1457-1463)

Also delete the legacy constructors:

- `NewManagedRuntime(store, bus)` (lines 230-233)
- `NewManagedRuntimeWithSupervisor(supervisor, bus)` (lines 235-237)
- `NewManagedRuntimeWithStoreAndSupervisor(...)` (lines 245-248)
- `NewManagedRuntimeWithRequester(store, requester, bus)` (lines 239-243) — superseded by `NewManagedRuntimeWithFacade`

Keep `newManagedRuntimeWithStoreSupervisorAdapter`? No — its only caller is the constructors just removed. Delete it.

Also delete the `supervisor` field and `ManagedRuntimeSupervisor` interface (line 23-29) and line 228 type assertion (`var _ ManagedRuntimeSupervisor = (*bundled.Supervisor)(nil)`).

- [ ] **Step 3: Migrate every test that used `recordingManagedSupervisor` / `ManagedSnapshot` / `NewManagedRuntimeWithStoreAndSupervisor`**

In `managed_runtime_test.go`:

- Remove `recordingManagedSupervisor` type definition (lines ~22-65) and any helper that builds it.
- Remove tests that asserted via `m.Snapshot/Start/Stop/Restart/GatewayConnection`: `TestManagedRuntime_GatewayConnection_*` (line 126, 159), `TestManagedRuntime_Start_*` (line 194), `TestManagedRuntime_Snapshot_*` (line 200), and the contract list at line 277-281.
- Migrate the remaining surviving tests to `NewManagedRuntimeWithFacade(store, testfacade.New(...), bus)`.

In `managed_runtime_ws_test.go`, `managed_runtime_ws_lifecycle_test.go`, `managed_runtime_contract_test.go`:

- Same — drop `recordingManagedSupervisor`-style fixtures, use `testfacade.Stub` with `StartFn` / `StopFn` / `RestartFn` hooks where the test wants to assert lifecycle invocation order.

In `transport_binding_test.go`:

- Replace `bundled.Snapshot{ ... }` test fixtures with `facade.RuntimeStatus{ ... }` if the test threads them through a public surface; otherwise drop fixture entirely.

In `server/test_router_test.go`:

- Replace the local `Snapshot() bundled.Snapshot / Start / Stop / Restart` fake supervisor interface with `testfacade.Stub`. The test router likely only needs a non-nil facade to build the router; either inline a stub or import `testfacade`.

In `server/server_test.go`, `server/gateway_routes_test.go`, `server/stream_test.go`, `server/stream_event_typing_test.go`, `server/runtime_facade_test.go`:

- These currently build a `ManagedRuntime` via `openclaw.NewManagedRuntimeWithStoreAndSupervisor(...)` with a fake supervisor that returns `ManagedSnapshot` (alias to `bundled.Snapshot`). Rewrite each call site:
  ```go
  // before
  managed := openclaw.NewManagedRuntimeWithStoreAndSupervisor(store, fakeSupervisor, bus)
  // after
  stub := testfacade.New(facade.Capabilities{Mode: "remote", Configured: true})
  stub.StatusValue = facade.RuntimeStatus{Mode: "remote", Configured: true, Status: "running", Health: "healthy"}
  managed := openclaw.NewManagedRuntimeWithFacade(store, stub, bus)
  ```
- For tests that mutated the snapshot mid-test (e.g. asserting status flips after Start/Stop), set `stub.StatusValue` between calls and exercise `managed.RuntimeGatewayStatusResponse()` / `managed.StartRuntimeGateway(ctx)`. Cache refresh happens inside `ManagedRuntime`, so subsequent `ListRuntimes` / `BootstrapStatus` calls see the updated state without further plumbing.
- Drop the `bundled` import from each file. Confirm with `goimports -l deck-go/backend/internal/server/`.

Grep guard after migration:

```bash
cd deck-go/backend && rg -n "ManagedSnapshot|NewManagedRuntimeWithStoreAndSupervisor|recordingManagedSupervisor" ./internal
# Expected: empty.
```

- [ ] **Step 4: Run package test**

Run: `cd deck-go/backend && go test ./internal/runtime/openclaw/ -count=1`
Expected: PASS (or list failures for callers in `controld` which will be cleaned in Phase E)

If `controld` tests fail to compile, mark them with `//nolint` is NOT acceptable. Instead, suspend `make backend-test` until Phase E completes. Each phase commits its own slice; package-level go test green per package is the gate.

- [ ] **Step 5: Commit**

```bash
scripts/committer "Drop ManagedRuntime supervisor field and public lifecycle methods

Snapshot / Start / Stop / Restart / GatewayConnection / EnsureAutoStart had
no production caller outside the package; remove them. Drop the
ManagedRuntimeSupervisor interface, the line 228 type assertion, and the
legacy constructors (NewManagedRuntime, NewManagedRuntimeWithSupervisor,
NewManagedRuntimeWithStoreAndSupervisor, NewManagedRuntimeWithRequester).
Surviving constructor: NewManagedRuntimeWithFacade.

Scope-risk: medium — controld and tests reference the deleted constructors;
those are cleaned in Phase E.
Tested: go test ./internal/runtime/openclaw/ ./internal/server/
Not-tested: full make backend-test (Phase E unblocks)." \
  deck-go/backend/internal/runtime/openclaw/managed_runtime.go \
  deck-go/backend/internal/runtime/openclaw/managed_runtime_test.go \
  deck-go/backend/internal/runtime/openclaw/managed_runtime_ws_test.go \
  deck-go/backend/internal/runtime/openclaw/managed_runtime_ws_lifecycle_test.go \
  deck-go/backend/internal/runtime/openclaw/managed_runtime_contract_test.go \
  deck-go/backend/internal/runtime/openclaw/transport_binding_test.go \
  deck-go/backend/internal/server/test_router_test.go \
  deck-go/backend/internal/server/server_test.go \
  deck-go/backend/internal/server/gateway_routes_test.go \
  deck-go/backend/internal/server/stream_test.go \
  deck-go/backend/internal/server/stream_event_typing_test.go \
  deck-go/backend/internal/server/runtime_facade_test.go
```

---

## Phase D: Delete openclaw legacy bundled-typed support files

### Task D1: Delete `managed_lifecycle_types.go`

**Files:**

- Delete: `deck-go/backend/internal/runtime/openclaw/managed_lifecycle_types.go`

- [ ] **Step 1: Verify no internal caller**

```bash
cd deck-go/backend && rg -n "ManagedSnapshot|ManagedStatus|ManagedHealth|ManagedStartFailureContext|ManagedStartFailureDecision|ManagedStopSignalFailureContext|ManagedStopSignalFailureDecision|ManagedStopNoProcessContext|ManagedStopNoProcessDecision|ManagedStopWaitFailureContext|ManagedStopWaitFailureDecision|ManagedExitTransitionContext|ManagedExitTransitionDecision|ManagedStatusStopped|ManagedStatusStarting|ManagedStatusRunning|ManagedStatusDegraded|ManagedStatusStopping|ManagedStatusFailed|ManagedHealthUnknown|ManagedHealthHealthy|ManagedHealthUnhealthy" ./internal
```

Expected: hits only inside `managed_supervisor_options.go` + `managed_supervisor_options_test.go` (both being deleted in D2). If there are unexpected hits, address them before deleting.

- [ ] **Step 2: Delete the file**

```bash
rm deck-go/backend/internal/runtime/openclaw/managed_lifecycle_types.go
```

- [ ] **Step 3: Run package test**

Run: `cd deck-go/backend && go test ./internal/runtime/openclaw/ -count=1`
Expected: PASS (or only fail on managed_supervisor_options_test.go, which is deleted in D2)

- [ ] **Step 4: Commit**

```bash
scripts/committer "Drop managed_lifecycle_types.go

13 type aliases and 9 status/health constants pointed at bundled.* — no
non-supervisor caller remains.

Tested: go test ./internal/runtime/openclaw/" \
  deck-go/backend/internal/runtime/openclaw/managed_lifecycle_types.go
```

---

### Task D2: Delete `managed_supervisor_options.go` + test

**Files:**

- Delete: `deck-go/backend/internal/runtime/openclaw/managed_supervisor_options.go`
- Delete: `deck-go/backend/internal/runtime/openclaw/managed_supervisor_options_test.go`

- [ ] **Step 1: Verify no caller**

```bash
cd deck-go/backend && rg -n "NewManagedSupervisorWithOptions|WithManagedDefaultStartFailurePolicy|WithManagedDefaultStopSignalFailurePolicy|WithManagedDefaultStopNoProcessPolicy|WithManagedDefaultStopWaitFailurePolicy|WithManagedDefaultExitTransitionPolicy|WithManagedProbeTransitionPolicy|WithManagedLauncher|WithManagedProcessTerminator|WithManagedForceKillProcess|WithManagedProbe|WithManagedGatewayConfig|WithManagedProbeInterval|WithManagedStartupTimeout|WithManagedStopTimeout|WithManagedLifecycleNotifier|managedLifecycleNotifier" ./internal
```

Expected: empty (Phase C deleted the constructors that referenced them).

- [ ] **Step 2: Delete both files**

```bash
rm deck-go/backend/internal/runtime/openclaw/managed_supervisor_options.go \
   deck-go/backend/internal/runtime/openclaw/managed_supervisor_options_test.go
```

- [ ] **Step 3: Run package test**

Run: `cd deck-go/backend && go test ./internal/runtime/openclaw/ -count=1`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
scripts/committer "Drop managed_supervisor_options{.go,_test.go}

Phase C removed every caller of NewManagedSupervisorWithOptions and the
WithManaged* wrappers. The files are now dead. Their test file (473 LOC)
exercised internal wiring that no longer exists.

Tested: go test ./internal/runtime/openclaw/" \
  deck-go/backend/internal/runtime/openclaw/managed_supervisor_options.go \
  deck-go/backend/internal/runtime/openclaw/managed_supervisor_options_test.go
```

---

## Phase E: controld + server entry-point cleanup

### Task E1: `controld.NewDependenciesWithRuntimeFacade` switches to `NewManagedRuntimeWithFacade`

**Files:**

- Modify: `deck-go/backend/internal/controld/app.go`
- Modify: `deck-go/backend/internal/controld/app_test.go`

- [ ] **Step 1: Write the failing test**

Add to `app_test.go`:

```go
func TestNewDependenciesWithRuntimeFacade_UsesFacadeBackedManagedRuntime(t *testing.T) {
	stub := testfacade.New(facade.Capabilities{Mode: "remote", Configured: true})
	stub.StatusValue = facade.RuntimeStatus{Mode: "remote", Configured: true, Status: "running"}
	loaded := envconf.Loaded{Mode: envconf.ModeRemote}
	deps, err := NewDependenciesWithRuntimeFacade(loaded, stub)
	if err != nil {
		t.Fatalf("NewDependenciesWithRuntimeFacade error: %v", err)
	}
	if deps == nil || deps.Runtime == nil {
		t.Fatalf("expected non-nil deps and runtime")
	}
	resp, err := deps.Runtime.StartRuntimeGateway(context.Background())
	if err != nil {
		t.Fatalf("StartRuntimeGateway error: %v", err)
	}
	if resp.Runtime.Status != "running" {
		t.Fatalf("expected runtime status=running, got %q", resp.Runtime.Status)
	}
}
```

- [ ] **Step 2: Run, verify fail**

Run: `cd deck-go/backend && go test ./internal/controld/ -run TestNewDependenciesWithRuntimeFacade_UsesFacadeBackedManagedRuntime -count=1`
Expected: FAIL — current code calls `openclawrt.NewManagedRuntime(store, bus)` which is deleted.

- [ ] **Step 3: Replace constructor**

In `app.go`:

```go
func NewDependenciesWithRuntimeFacade(loaded envconf.Loaded, runtimeFacade facade.RuntimeFacade) (*Dependencies, error) {
	store, err := config.NewStore()
	if err != nil {
		return nil, err
	}
	bus := events.NewBus(2000)
	managed := openclawrt.NewManagedRuntimeWithFacade(store, runtimeFacade, bus)
	return &Dependencies{
		Store:         store,
		Runtime:       managed,
		RuntimeFacade: runtimeFacade,
	}, nil
}
```

Remove the now-unused `if loaded.Mode == envconf.ModeRemote { ... }` / `if loaded.Mode == envconf.ModeBundled { ... }` blocks. `loaded` is still in the signature for compatibility with `NewDependenciesFromEnv`; if it becomes fully unused, remove it.

Delete `NewHandler()` (lines 94-100), `NewDependencies()` (lines 102-114), and `managedGatewaySettingsFromRuntimeBundled` (lines 152+).

- [ ] **Step 4: Run, verify pass**

Run: `cd deck-go/backend && go test ./internal/controld/ -run TestNewDependenciesWithRuntimeFacade_UsesFacadeBackedManagedRuntime -count=1`
Expected: PASS.

Then run the full controld package: `cd deck-go/backend && go test ./internal/controld/ -count=1`.
Other tests that called `openclawrt.NewManagedRuntime(store, bus)` (lines 97, 169, 199 in `app_test.go`) MUST be updated to use `testfacade` + `openclawrt.NewManagedRuntimeWithFacade`. Adjust them inline.

- [ ] **Step 5: Commit**

```bash
scripts/committer "Wire controld dependencies through ManagedRuntime facade

NewDependenciesWithRuntimeFacade no longer constructs a discarded supervisor.
Remove dead spawn entry points: NewHandler, NewDependencies,
managedGatewaySettingsFromRuntimeBundled. Update three test fixtures to
use NewManagedRuntimeWithFacade + testfacade.Stub.

Tested: go test ./internal/controld/
Constraint: production cmd/* paths unaffected (they already used
NewDependenciesFromEnv → NewDependenciesWithRuntimeFacade)." \
  deck-go/backend/internal/controld/app.go \
  deck-go/backend/internal/controld/app_test.go
```

---

### Task E2: Delete `server.New()`

**Files:**

- Modify: `deck-go/backend/internal/server/server.go`

- [ ] **Step 1: Verify no caller**

```bash
cd deck-go/backend && rg -n "server\.New\(\)" ./internal ./cmd
```

Expected: empty (or only test). If any production caller exists, route them through `NewRootHandler` instead.

- [ ] **Step 2: Delete the function body**

In `server.go`:

```go
// NewRootHandler builds the chi mux without an explicit runtime facade.
// (Previously server.New existed as a convenience wrapper that constructed
// a ManagedRuntime via the supervisor; that path no longer exists.)
```

Remove the `func New()` definition (lines 17-25). Keep `NewRootHandler` and `NewRootHandlerWithRuntimeFacade`. Drop the now-unused `openclawrt` import if it becomes orphaned.

- [ ] **Step 3: Run server package**

Run: `cd deck-go/backend && go test ./internal/server/ -count=1`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
scripts/committer "Drop legacy server.New spawn entry point

server.New() was the only remaining caller of openclawrt.NewManagedRuntime
+ EnsureAutoStart() outside controld. Production cmd/* paths use
NewRootHandlerWithRuntimeFacade via controld.

Tested: go test ./internal/server/" \
  deck-go/backend/internal/server/server.go
```

---

## Phase F: Delete `runtime/bundled/` spawn files

### Task F1: Verify zero references then delete

**Files:**

- Delete: `deck-go/backend/internal/runtime/bundled/supervisor.go`
- Delete: `deck-go/backend/internal/runtime/bundled/supervisor_test.go`
- Delete: `deck-go/backend/internal/runtime/bundled/preflight.go`
- Delete: `deck-go/backend/internal/runtime/bundled/preflight_test.go`
- Delete: `deck-go/backend/internal/runtime/bundled/process_group_unix.go`
- Delete: `deck-go/backend/internal/runtime/bundled/process_group_windows.go`

- [ ] **Step 1: Run reference check**

```bash
cd deck-go/backend && rg -n "bundled\.Supervisor|bundled\.NewSupervisorWithOptions|bundled\.With[A-Z]|bundled\.Snapshot|bundled\.Status|bundled\.Option|bundled\.Health|bundled\.FailurePhase|bundled\.Probe|bundled\.Start[A-Z]|bundled\.Stop[A-Z]|bundled\.Exit[A-Z]|preflight|process_group" ./internal --type go
```

Expected: only matches inside `runtime/bundled/{supervisor,preflight,process_group}*.go` (the files we are about to delete).

If there are external matches, halt — Phase A–E missed a consumer. Re-run discovery, do not proceed.

- [ ] **Step 2: Delete the 6 files**

```bash
cd deck-go/backend/internal/runtime/bundled
rm supervisor.go supervisor_test.go preflight.go preflight_test.go process_group_unix.go process_group_windows.go
```

- [ ] **Step 3: Run full backend test**

Run: `cd deck-go && make backend-test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
scripts/committer "Delete legacy spawn machinery from runtime/bundled

Removes 6 files / ~3561 LOC:
  supervisor.go (1523), supervisor_test.go (1567)
  preflight.go (158), preflight_test.go (208)
  process_group_unix.go (61), process_group_windows.go (44)

Phase A–E ensured runtime/openclaw and controld no longer reference these
types. The runtime/bundled package now hosts only the Stage 1 shell-out
lifecycle (service_name, entrypoint_resolver, probe, lifecycle_proxy, facade).

This completes gateway-launcher-rewrite Stage 1 Plan B3 intent. Stage 2
(rename bundled/ → local/) can now proceed without dead code.

Constraint: cmd/* production paths unchanged.
Tested: make backend-test" \
  deck-go/backend/internal/runtime/bundled/supervisor.go \
  deck-go/backend/internal/runtime/bundled/supervisor_test.go \
  deck-go/backend/internal/runtime/bundled/preflight.go \
  deck-go/backend/internal/runtime/bundled/preflight_test.go \
  deck-go/backend/internal/runtime/bundled/process_group_unix.go \
  deck-go/backend/internal/runtime/bundled/process_group_windows.go
```

---

## Phase G: Final verification + ADR commit

### Task G1: Run the full local gate suite

- [ ] **Step 1: Backend gate**

Run: `cd deck-go && make backend-test`
Expected: PASS

- [ ] **Step 2: Frontend build**

Run: `cd deck-go && make frontend-build`
Expected: PASS (deckapi shape unchanged; frontend tolerates fewer fields)

- [ ] **Step 3: Drift guards**

Run: `cd deck-go && ./scripts/check-r2.sh && ./scripts/check-canvas-asset-url.sh`
Expected: PASS

- [ ] **Step 4: Full verify (modulo baseline `.local` host-check noise)**

Run: `cd deck-go && make verify`
Expected: PASS, except for the pre-existing `scripts/check-active-host-paths.mjs` ENOENT on `.local/deck-go-real-stack/isolated/data/managed-gateway-state/skills/accessibility-a11y`. Document this exception in the final commit message.

- [ ] **Step 5: Commit ADR sign-off marker (if not yet committed with Phase A)**

```bash
scripts/committer "ADR 0001: ManagedRuntime supervisor decoupling complete

Plan landed across Phases A-F. ADR status: Accepted, fully implemented.

Tested:
  make backend-test
  make frontend-build
  ./scripts/check-r2.sh
  ./scripts/check-canvas-asset-url.sh

Not-tested:
  make verify — fails on baseline .local host-check ENOENT; unrelated to
  this work." \
  deck-go/docs/adr/0001-managed-runtime-supervisor-decoupling.md \
  deck-go/docs/superpowers/plans/2026-05-14-managed-runtime-supervisor-decoupling.md
```

---

## Self-Review Checklist

- [ ] Spec coverage: every consumer of `bundled.*` types in `runtime/openclaw`, `runtime/registry`, `controld/`, `server/` is migrated (Z1, Z2, A1, A2, B1, B2, BPRIME1, BPRIME2, BPRIME3, C1, E1) or deleted (C2, D1, D2, E2) before F1 deletion. Codex round-1 review surfaced gaps F1–F5 (AutoStart regression, probe-on-list regression, ADR fact error, server test sweep, missing interface method); Phase Z + cache-based BPRIME design + extended File Structure address all five.
- [ ] No placeholder steps — every task has concrete code blocks, exact file paths, exact commands. Phase A's temporary `facadeSnapshotReaderShim` is explicitly labeled and superseded by Phase B' BPRIME3.
- [ ] Type consistency: `facade.RuntimeStatus` (now carrying `AutoStart`) is the lifecycle source of truth across all migrated methods. `runtimeStatusFromFacadeStatus` is the single adapter into `deckapi.DeckGoRuntimeGatewayStatus`. `registry.LastStatusReader` (synchronous, no-ctx, no-error) replaces `registry.SnapshotReader`. `facade.RuntimeFacade.GatewayConnection` is now an interface method.
- [ ] No I/O regression on `/api/runtimes`: `LastStatusReader.LastStatus()` is a pure in-memory read against `ManagedRuntime.lastStatus`, refreshed by lifecycle ops + BootstrapStatus. `TestManagedRuntime_RegistryDoesNotProbeOnList` is the regression guard.
- [ ] AutoStart contract preserved: `bundled.Facade.RuntimeGatewayStatus` reads `f.cfg.AutoStart` (default `true` via config + envconf normalization); `remote.Facade` returns `false`. Registry summarize reads `status.AutoStart` verbatim. `GatewayPanel.tsx:1554-1556` keeps showing the current bundled.autoStart value.
- [ ] Tests precede implementation in every task that adds behaviour (Z1, Z2, A1, A2, B1, B2, BPRIME1, BPRIME3, C1, E1). Pure deletion tasks (C2, D1, D2, E2, F1) and pure test fixture migration (BPRIME2) gate on grep-zero-references discovery commands and on the migrated test files compiling green.
- [ ] Commit messages follow the lore protocol: state why, list `Tested:` / `Not-tested:`, name constraints when relevant.
- [ ] Frontend impact accounted for: spawn-era fields (`pid`, `failurePhase`, `lastExitCode`, `ownershipFile`, `restartDelayMs`) silently disappear from the response; api.ts (lines 611-626) maps undefined gracefully; GatewayPanel renders "n/a". `autoStart` and `managed` continue to populate. Confirm during BPRIME1 implementation via `rg -n "\\.managed\\b|\\.autoStart\\b" deck-go/frontend-new/src`.
- [ ] Phase F's grep guard prevents premature deletion if a consumer was missed. Grep excludes `/runtime/bundled/` itself. A separate `ManagedSnapshot` grep guard (added after C2) catches the server test sweep.
- [ ] No contract changes in `contracts/source/**`; `deckapi.DeckGoRuntimeGatewayStatus` shape unchanged. `facade.RuntimeFacade` interface widens by one method (`GatewayConnection`) and `facade.RuntimeStatus` adds one field (`AutoStart`); both are internal Go types, not on the wire.
- [ ] Stage 2 (`bundled/` → `local/` rename) unblocked: after F1, the `bundled/` package is small enough that the rename is a textual operation.

---

## Execution Handoff

Plan saved to `deck-go/docs/superpowers/plans/2026-05-14-managed-runtime-supervisor-decoupling.md`.

Two execution options:

**1. Subagent-Driven** — dispatch a fresh subagent per task, review between tasks.

**2. Inline / Manual Codex CLI** — owner opens codex CLI, runs `superpowers:executing-plans` against this plan. This matches the precedent set by `gateway-launcher-rewrite` Stage 1.

Per the handoff log, the owner intends to put this plan through Codex review first, then decide implementation path.
