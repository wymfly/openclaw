package openclaw

import (
	"context"
	"errors"
	"os/exec"
	"testing"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
	runtimecontrol "github.com/openclaw/openclaw/deck-go/backend/internal/runtime"
	runtimeregistry "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/registry"
)

type recordingManagedSupervisor struct {
	snapshot         runtimecontrol.Snapshot
	startCalls       int
	stopCalls        int
	restartCalls     int
	ensureAutoStarts int
	gatewayToken     string
}

func (s *recordingManagedSupervisor) Snapshot() runtimecontrol.Snapshot {
	return s.snapshot
}

func (s *recordingManagedSupervisor) Start(context.Context) (runtimecontrol.Snapshot, error) {
	s.startCalls++
	s.snapshot.Status = runtimecontrol.StatusRunning
	s.snapshot.Health = runtimecontrol.HealthHealthy
	if s.snapshot.GatewayURL == "" {
		s.snapshot.GatewayURL = "ws://127.0.0.1:18789"
	}
	if s.gatewayToken == "" {
		s.gatewayToken = "gateway-token"
	}
	return s.snapshot, nil
}

func (s *recordingManagedSupervisor) Stop(context.Context) (runtimecontrol.Snapshot, error) {
	s.stopCalls++
	s.snapshot.Status = runtimecontrol.StatusStopped
	s.snapshot.Health = runtimecontrol.HealthUnknown
	return s.snapshot, nil
}

func (s *recordingManagedSupervisor) Restart(context.Context) (runtimecontrol.Snapshot, error) {
	s.restartCalls++
	s.snapshot.Status = runtimecontrol.StatusRunning
	s.snapshot.Health = runtimecontrol.HealthHealthy
	if s.snapshot.GatewayURL == "" {
		s.snapshot.GatewayURL = "ws://127.0.0.1:18789"
	}
	if s.gatewayToken == "" {
		s.gatewayToken = "gateway-token"
	}
	return s.snapshot, nil
}

func (s *recordingManagedSupervisor) GatewayConnection() (string, string, bool) {
	if s.snapshot.GatewayURL == "" || s.gatewayToken == "" {
		return "", "", false
	}
	return s.snapshot.GatewayURL, s.gatewayToken, true
}

func (s *recordingManagedSupervisor) EnsureAutoStart() {
	s.ensureAutoStarts++
}

func TestNewManagedRuntime_ComposesSupervisorAdapterAndRegistry(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())

	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	bus := events.NewBus(8)

	managed := NewManagedRuntime(store, bus)
	if managed == nil {
		t.Fatal("expected managed runtime bundle")
	}
	if managed.RuntimeSupervisor() == nil {
		t.Fatal("expected supervisor in managed runtime bundle")
	}
	if managed.RuntimeAdapter() == nil {
		t.Fatal("expected adapter in managed runtime bundle")
	}
	if managed.RuntimeRegistry() == nil {
		t.Fatal("expected registry in managed runtime bundle")
	}
	if managed.EventBus() != bus {
		t.Fatal("expected event bus in managed runtime bundle")
	}
	if managed.GatewayQueries() == nil {
		t.Fatal("expected managed runtime facade to expose gateway queries directly")
	}
	if managed.SessionCommands() == nil {
		t.Fatal("expected managed runtime facade to expose session commands directly")
	}
	if _, err := managed.ListRuns(t.Context(), "rt_local"); err != nil {
		t.Fatalf("expected managed runtime facade to expose monitor queries: %v", err)
	}
	if _, err := managed.GetStats(t.Context(), "rt_local"); err != nil {
		t.Fatalf("expected managed runtime facade to expose monitor stats: %v", err)
	}

	items, err := managed.ListRuntimes(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 {
		t.Fatalf("unexpected runtime registry contents: %#v", items)
	}
	if _, _, ok := managed.GatewayConnection(); ok {
		t.Fatal("expected unmanaged test supervisor to report disconnected gateway")
	}
}

func TestManagedRuntime_PropagatesLifecycleStateIntoRegistrySummaries(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())

	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		ManagedGateway: config.ManagedGatewaySettings{
			Command:      "openclaw",
			GatewayToken: "token",
		},
	}); err != nil {
		t.Fatal(err)
	}

	bus := events.NewBus(8)
	sub := bus.Subscribe()
	defer bus.Unsubscribe(sub)

	supervisor := NewManagedSupervisorWithOptions(
		store,
		bus,
		WithManagedLauncher(func(config.ManagedGatewaySettings) (*exec.Cmd, error) {
			return nil, errors.New("launch failed")
		}),
	)
	managed := NewManagedRuntimeWithStoreAndSupervisor(store, supervisor, bus)

	if _, err := managed.Start(context.Background()); err == nil {
		t.Fatal("expected managed runtime start failure")
	}

	expectManagedRuntimeEvent(t, sub, "runtime.gateway.status")

	snapshot := managed.Snapshot()
	if snapshot.Status != runtimecontrol.StatusFailed {
		t.Fatalf("expected failed lifecycle snapshot, got %#v", snapshot)
	}

	items, err := managed.ListRuntimes(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 {
		t.Fatalf("expected one runtime summary, got %#v", items)
	}
	if items[0].RuntimeID != runtimeregistry.DefaultRuntimeID {
		t.Fatalf("expected default runtime id, got %#v", items[0])
	}
	if items[0].Status != string(runtimecontrol.StatusFailed) {
		t.Fatalf("expected failed runtime summary, got %#v", items[0])
	}
	if items[0].LastError == nil || *items[0].LastError != "launch failed" {
		t.Fatalf("expected launch failure to surface in registry summary, got %#v", items[0])
	}
}

func expectManagedRuntimeEvent(t *testing.T, sub <-chan events.Event, eventType string) {
	t.Helper()
	select {
	case event := <-sub:
		if event.Type != eventType {
			t.Fatalf("expected event %s, got %#v", eventType, event)
		}
	case <-time.After(2 * time.Second):
		t.Fatalf("timed out waiting for %s", eventType)
	}
}
