package openclaw

import (
	"context"
	"sync"
	"testing"

	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade/testfacade"
)

func TestNewManagedRuntimeWithFacade_PopulatesFacadeFieldAndZeroCache(t *testing.T) {
	store := newFacadeRuntimeStore(t)
	bus := events.NewBus(8)
	fac := testfacade.New(facade.Capabilities{Mode: "remote", Configured: true})

	managed := NewManagedRuntimeWithFacade(store, fac, bus)

	if managed == nil {
		t.Fatal("expected managed runtime")
	}
	if managed.Facade() != fac {
		t.Fatalf("facade was not wired")
	}
	if got := managed.LastStatus(); got.Mode != "" || got.Status != "" {
		t.Fatalf("expected zero cache before refresh, got %+v", got)
	}
}

func TestRuntimeGatewayStatusResponse_RefreshesLastStatusCache(t *testing.T) {
	store := newFacadeRuntimeStore(t)
	stub := testfacade.New(facade.Capabilities{Mode: "local", Configured: true})
	stub.StatusValue = facade.RuntimeStatus{
		Mode:       "local",
		Configured: true,
		Status:     "running",
		Health:     "healthy",
		GatewayURL: "ws://127.0.0.1:18789",
		AutoStart:  true,
	}
	managed := NewManagedRuntimeWithFacade(store, stub, events.NewBus(8))

	resp := managed.RuntimeGatewayStatusResponse()

	if !resp.Ok || resp.Runtime.Status != "running" || !resp.Runtime.AutoStart {
		t.Fatalf("unexpected runtime response: %+v", resp)
	}
	if got := managed.LastStatus(); got.Status != "running" || !got.AutoStart {
		t.Fatalf("cache was not refreshed from status response: %+v", got)
	}
}

func TestRuntimeGatewayActions_RefreshLastStatusCache(t *testing.T) {
	store := newFacadeRuntimeStore(t)
	stub := testfacade.New(facade.Capabilities{Mode: "local", Configured: true})
	stub.StartFn = func(context.Context) (facade.RuntimeStatus, error) {
		return facade.RuntimeStatus{Mode: "local", Status: "running", Health: "healthy"}, nil
	}
	stub.StopFn = func(context.Context) (facade.RuntimeStatus, error) {
		return facade.RuntimeStatus{Mode: "local", Status: "stopped", Health: "unknown"}, nil
	}
	stub.RestartFn = func(context.Context) (facade.RuntimeStatus, error) {
		return facade.RuntimeStatus{Mode: "local", Status: "degraded", Health: "unhealthy"}, nil
	}
	managed := NewManagedRuntimeWithFacade(store, stub, events.NewBus(8))

	if _, err := managed.StartRuntimeGateway(context.Background()); err != nil {
		t.Fatalf("StartRuntimeGateway() error = %v", err)
	}
	if got := managed.LastStatus(); got.Status != "running" {
		t.Fatalf("cache after start = %+v", got)
	}
	if _, err := managed.StopRuntimeGateway(context.Background()); err != nil {
		t.Fatalf("StopRuntimeGateway() error = %v", err)
	}
	if got := managed.LastStatus(); got.Status != "stopped" {
		t.Fatalf("cache after stop = %+v", got)
	}
	if _, err := managed.RestartRuntimeGateway(context.Background()); err != nil {
		t.Fatalf("RestartRuntimeGateway() error = %v", err)
	}
	if got := managed.LastStatus(); got.Status != "degraded" || got.Health != "unhealthy" {
		t.Fatalf("cache after restart = %+v", got)
	}
}

func TestBootstrapStatus_ReadsFacadeStatusAndRefreshesCache(t *testing.T) {
	store := newFacadeRuntimeStore(t)
	stub := testfacade.New(facade.Capabilities{Mode: "local", Configured: true})
	stub.StatusValue = facade.RuntimeStatus{
		Mode:       "local",
		Configured: true,
		Status:     "stopped",
		Health:     "unknown",
		GatewayURL: "ws://127.0.0.1:18789",
		AutoStart:  true,
	}
	managed := NewManagedRuntimeWithFacade(store, stub, events.NewBus(8))

	payload, err := managed.BootstrapStatus(context.Background())
	if err != nil {
		t.Fatalf("BootstrapStatus() error = %v", err)
	}
	if payload.Runtime.Status != "stopped" || !payload.Runtime.AutoStart {
		t.Fatalf("runtime status did not flow from facade: %+v", payload.Runtime)
	}
	if !payload.Settings.ManagedGatewayConfigured {
		t.Fatalf("expected settings to reflect facade configured status: %+v", payload.Settings)
	}
	if got := managed.LastStatus(); got.Status != "stopped" || !got.AutoStart {
		t.Fatalf("cache was not refreshed by BootstrapStatus: %+v", got)
	}
}

func TestManagedRuntimeRegistryReadsCachedLastStatus(t *testing.T) {
	store := newFacadeRuntimeStore(t)
	stub := testfacade.New(facade.Capabilities{Mode: "remote", Configured: true})
	managed := NewManagedRuntimeWithFacade(store, stub, events.NewBus(8))
	managed.setLastStatus(facade.RuntimeStatus{
		Mode:       "remote",
		Configured: true,
		Status:     "running",
		Health:     "healthy",
		GatewayURL: "wss://gateway.example.test",
	})

	items, err := managed.ListRuntimes(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 {
		t.Fatalf("unexpected runtime list: %+v", items)
	}
	if items[0].Status != "running" || items[0].Health != "healthy" {
		t.Fatalf("registry did not read cached status: %+v", items[0])
	}
	if items[0].Managed {
		t.Fatalf("expected remote cached status to be unmanaged: %+v", items[0])
	}
	if items[0].GatewayURL == nil || *items[0].GatewayURL != "wss://gateway.example.test" {
		t.Fatalf("cached gateway url missing from registry summary: %+v", items[0])
	}
}

func TestManagedRuntimeRegistryDoesNotProbeFacadeOnList(t *testing.T) {
	store := newFacadeRuntimeStore(t)
	stub := testfacade.New(facade.Capabilities{Mode: "local", Configured: true})
	statusProbeCalls := 0
	stub.RuntimeGatewayStatusFn = func(context.Context) (facade.RuntimeStatus, error) {
		statusProbeCalls++
		return facade.RuntimeStatus{Mode: "local", Status: "degraded"}, nil
	}
	managed := NewManagedRuntimeWithFacade(store, stub, events.NewBus(8))
	managed.setLastStatus(facade.RuntimeStatus{
		Mode:       "local",
		Configured: true,
		Status:     "stopped",
		Health:     "unknown",
	})

	items, err := managed.ListRuntimes(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if statusProbeCalls != 0 {
		t.Fatalf("registry list probed facade %d time(s)", statusProbeCalls)
	}
	if len(items) != 1 || items[0].Status != "stopped" {
		t.Fatalf("registry did not use cached status: %+v", items)
	}
}

func TestManagedRuntime_LastStatusConcurrentAccessSafe(t *testing.T) {
	store := newFacadeRuntimeStore(t)
	stub := testfacade.New(facade.Capabilities{Mode: "local", Configured: true})
	managed := NewManagedRuntimeWithFacade(store, stub, events.NewBus(8))

	const workers = 32
	const iterations = 200
	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < iterations; j++ {
				managed.RecordRuntimeStatus(facade.RuntimeStatus{
					Mode:   "local",
					Status: "running",
					Health: "healthy",
				})
				_ = managed.LastStatus()
			}
		}()
	}
	wg.Wait()
}

func TestGetVersionUsesCachedFacadeStatus(t *testing.T) {
	store := newFacadeRuntimeStore(t)
	stub := testfacade.New(facade.Capabilities{Mode: "local", Configured: true})
	stub.StatusValue = facade.RuntimeStatus{
		Mode:   "local",
		Status: "running",
		Health: "healthy",
	}
	managed := NewManagedRuntimeWithFacade(
		store,
		stub,
		events.NewBus(8),
	)
	managed.setLastStatus(facade.RuntimeStatus{
		Mode:   "local",
		Status: "running",
		Health: "healthy",
	})

	payload, err := managed.GetVersion(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if payload["gateway"] != "connected" || payload["cli"] != "connected" {
		t.Fatalf("version status did not use cached facade status: %+v", payload)
	}
}

func newFacadeRuntimeStore(t *testing.T) *config.Store {
	t.Helper()
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	return store
}
