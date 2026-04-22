package openclaw

import (
	"context"
	"testing"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
	runtimecontrol "github.com/openclaw/openclaw/deck-go/backend/internal/runtime"
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

func TestManagedRuntime_DelegatesLifecycleAndRegistryState(t *testing.T) {
	bus := events.NewBus(8)
	supervisor := &recordingManagedSupervisor{
		snapshot: runtimecontrol.Snapshot{
			Managed:    true,
			Configured: true,
			Status:     runtimecontrol.StatusStopped,
			Health:     runtimecontrol.HealthUnknown,
			AutoStart:  true,
		},
	}

	managed := NewManagedRuntimeWithSupervisor(supervisor, bus)

	items, err := managed.ListRuntimes(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].Status != string(runtimecontrol.StatusStopped) {
		t.Fatalf("expected registry to reflect initial stopped snapshot, got %#v", items)
	}

	snapshot, err := managed.Start(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.Status != runtimecontrol.StatusRunning || snapshot.Health != runtimecontrol.HealthHealthy {
		t.Fatalf("expected running snapshot from start, got %#v", snapshot)
	}
	if supervisor.startCalls != 1 {
		t.Fatalf("expected one supervisor start call, got %d", supervisor.startCalls)
	}

	runtimeSummary, ok, err := managed.GetRuntime(t.Context(), "rt_local")
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Fatal("expected default runtime summary after start")
	}
	if runtimeSummary.Status != string(runtimecontrol.StatusRunning) || runtimeSummary.Health != string(runtimecontrol.HealthHealthy) {
		t.Fatalf("expected registry summary to read live supervisor state, got %#v", runtimeSummary)
	}

	gatewayURL, gatewayToken, ok := managed.GatewayConnection()
	if !ok || gatewayURL != "ws://127.0.0.1:18789" || gatewayToken != "gateway-token" {
		t.Fatalf("expected gateway connection to delegate to supervisor, got ok=%v url=%q token=%q", ok, gatewayURL, gatewayToken)
	}

	snapshot, err = managed.Restart(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.Status != runtimecontrol.StatusRunning || supervisor.restartCalls != 1 {
		t.Fatalf("expected restart delegation, got snapshot=%#v restartCalls=%d", snapshot, supervisor.restartCalls)
	}

	snapshot, err = managed.Stop(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.Status != runtimecontrol.StatusStopped || supervisor.stopCalls != 1 {
		t.Fatalf("expected stop delegation, got snapshot=%#v stopCalls=%d", snapshot, supervisor.stopCalls)
	}

	items, err = managed.ListRuntimes(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].Status != string(runtimecontrol.StatusStopped) || items[0].Health != string(runtimecontrol.HealthUnknown) {
		t.Fatalf("expected registry to keep reading supervisor snapshot after stop, got %#v", items)
	}

	managed.EnsureAutoStart()
	if supervisor.ensureAutoStarts != 1 {
		t.Fatalf("expected managed runtime to forward EnsureAutoStart, got %d", supervisor.ensureAutoStarts)
	}
}

func TestManagedRuntime_StreamAndReplayUseRegistryFeed(t *testing.T) {
	bus := events.NewBus(8)
	managed := NewManagedRuntimeWithSupervisor(&recordingManagedSupervisor{
		snapshot: runtimecontrol.Snapshot{
			Managed:    true,
			Configured: true,
			Status:     runtimecontrol.StatusRunning,
			Health:     runtimecontrol.HealthHealthy,
		},
	}, bus)

	event := bus.Publish("runtime.gateway.status", []byte(`{"status":"running"}`))

	replayed, gap := managed.EventsSince(0)
	if gap {
		t.Fatal("expected no replay gap for fresh event history")
	}
	if len(replayed) != 1 || replayed[0].ID != event.ID {
		t.Fatalf("expected replay to proxy registry feed, got %#v", replayed)
	}

	stream, cancel := managed.SubscribeStream()
	defer cancel()

	followup := bus.Publish("runtime.gateway.health", []byte(`{"health":"healthy"}`))

	select {
	case got, ok := <-stream:
		if !ok {
			t.Fatal("expected live registry event stream")
		}
		if got.ID != followup.ID || got.Type != "runtime.gateway.health" {
			t.Fatalf("unexpected streamed event %#v", got)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for streamed runtime event")
	}
}
