package runtimecontrol

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"sync/atomic"
	"testing"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
)

func TestSupervisor_StartStopAndFailureTransitions(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		ManagedGateway: config.ManagedGatewaySettings{
			Command:      os.Args[0],
			Args:         []string{"-test.run=TestSupervisorHelperProcess", "--", "sleep"},
			GatewayToken: "token",
			AutoStart:    false,
		},
	}); err != nil {
		t.Fatal(err)
	}

	probeHealthy := atomic.Bool{}
	probeHealthy.Store(true)

	supervisor := NewSupervisor(store, events.NewBus(32))
	supervisor.launch = helperLauncher("sleep")
	supervisor.probe = func(context.Context, config.ManagedGatewaySettings) error {
		if probeHealthy.Load() {
			return nil
		}
		return errors.New("probe failed")
	}
	supervisor.probeInterval = 20 * time.Millisecond

	if snapshot := supervisor.Snapshot(); snapshot.Status != StatusStopped {
		t.Fatalf("expected stopped, got %#v", snapshot)
	}

	if _, err := supervisor.Start(context.Background()); err != nil {
		t.Fatal(err)
	}
	waitForStatus(t, supervisor, StatusRunning)

	probeHealthy.Store(false)
	waitForStatus(t, supervisor, StatusDegraded)

	if _, err := supervisor.Stop(context.Background()); err != nil {
		t.Fatal(err)
	}
	waitForStatus(t, supervisor, StatusStopped)
}

func TestSupervisor_AutoStartAndAbnormalExitBecomesFailed(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		ManagedGateway: config.ManagedGatewaySettings{
			Command:      os.Args[0],
			Args:         []string{"-test.run=TestSupervisorHelperProcess", "--", "exit1"},
			GatewayToken: "token",
			AutoStart:    true,
		},
	}); err != nil {
		t.Fatal(err)
	}

	supervisor := NewSupervisor(store, events.NewBus(32))
	supervisor.launch = helperLauncher("exit1")
	supervisor.probe = func(context.Context, config.ManagedGatewaySettings) error {
		return nil
	}
	supervisor.probeInterval = 20 * time.Millisecond
	supervisor.EnsureAutoStart()
	waitForStatus(t, supervisor, StatusFailed)

	snapshot := supervisor.Snapshot()
	if snapshot.LastExitCode == 0 {
		t.Fatalf("expected non-zero exit code, got %#v", snapshot)
	}
}

func TestSupervisor_FailsWhenStartupNeverBecomesHealthy(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		ManagedGateway: config.ManagedGatewaySettings{
			Command:      os.Args[0],
			Args:         []string{"-test.run=TestSupervisorHelperProcess", "--", "sleep"},
			GatewayToken: "token",
		},
	}); err != nil {
		t.Fatal(err)
	}

	supervisor := NewSupervisor(store, events.NewBus(8))
	supervisor.launch = helperLauncher("sleep")
	supervisor.probe = func(context.Context, config.ManagedGatewaySettings) error {
		return errors.New("probe never becomes healthy")
	}
	supervisor.probeInterval = 20 * time.Millisecond
	supervisor.startupTimeout = 150 * time.Millisecond

	if _, err := supervisor.Start(context.Background()); err != nil {
		t.Fatal(err)
	}
	waitForStatus(t, supervisor, StatusFailed)
	_, _ = supervisor.Stop(context.Background())
}

func TestSupervisor_StartFailsWithInvalidConfig(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		ManagedGateway: config.ManagedGatewaySettings{
			Command:      "",
			GatewayToken: "",
		},
	}); err != nil {
		t.Fatal(err)
	}

	supervisor := NewSupervisor(store, events.NewBus(4))
	if _, err := supervisor.Start(context.Background()); err == nil {
		t.Fatal("expected invalid config error")
	}
	waitForStatus(t, supervisor, StatusFailed)
}

func TestSupervisor_StartFailureSetsLaunchFailurePhase(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		ManagedGateway: config.ManagedGatewaySettings{
			Command:      os.Args[0],
			Args:         []string{"-test.run=TestSupervisorHelperProcess", "--", "sleep"},
			GatewayToken: "token",
		},
	}); err != nil {
		t.Fatal(err)
	}

	supervisor := NewSupervisor(store, events.NewBus(4))
	supervisor.prepare = func(context.Context, config.ManagedGatewaySettings) error { return nil }
	supervisor.launch = func(config.ManagedGatewaySettings) (*exec.Cmd, error) {
		return nil, fmt.Errorf("launch failed")
	}

	if _, err := supervisor.Start(context.Background()); err == nil {
		t.Fatal("expected launch failure")
	}
	snapshot := supervisor.Snapshot()
	if snapshot.FailurePhase != "launch" {
		t.Fatalf("expected launch failure phase, got %#v", snapshot)
	}
}

func TestSupervisor_PublishesRuntimeEvents(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		ManagedGateway: config.ManagedGatewaySettings{
			Command:      os.Args[0],
			Args:         []string{"-test.run=TestSupervisorHelperProcess", "--", "sleep"},
			GatewayToken: "token",
		},
	}); err != nil {
		t.Fatal(err)
	}

	bus := events.NewBus(32)
	sub := bus.Subscribe()
	defer bus.Unsubscribe(sub)

	probeHealthy := atomic.Bool{}
	probeHealthy.Store(true)

	supervisor := NewSupervisor(store, bus)
	supervisor.launch = helperLauncher("sleep")
	supervisor.probe = func(context.Context, config.ManagedGatewaySettings) error {
		if probeHealthy.Load() {
			return nil
		}
		return errors.New("probe failed")
	}
	supervisor.probeInterval = 20 * time.Millisecond

	if _, err := supervisor.Start(context.Background()); err != nil {
		t.Fatal(err)
	}

	expectEvent(t, sub, "runtime.gateway.status")
	expectEvent(t, sub, "runtime.gateway.health")
	waitForStatus(t, supervisor, StatusRunning)

	probeHealthy.Store(false)
	expectEvent(t, sub, "runtime.gateway.health")

	if _, err := supervisor.Stop(context.Background()); err != nil {
		t.Fatal(err)
	}
	expectEvent(t, sub, "runtime.gateway.exit")
}

func TestSupervisor_PinsActiveConfigWhileRunning(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		ManagedGateway: config.ManagedGatewaySettings{
			Command:      os.Args[0],
			Args:         []string{"-test.run=TestSupervisorHelperProcess", "--", "sleep"},
			BindHost:     "127.0.0.1",
			BindPort:     18950,
			GatewayToken: "token-a",
		},
	}); err != nil {
		t.Fatal(err)
	}

	supervisor := NewSupervisor(store, events.NewBus(8))
	supervisor.launch = helperLauncher("sleep")
	supervisor.prepare = func(context.Context, config.ManagedGatewaySettings) error { return nil }
	supervisor.probe = func(context.Context, config.ManagedGatewaySettings) error { return nil }
	supervisor.probeInterval = 20 * time.Millisecond

	if _, err := supervisor.Start(context.Background()); err != nil {
		t.Fatal(err)
	}
	waitForStatus(t, supervisor, StatusRunning)

	if err := store.Update(config.Settings{
		ManagedGateway: config.ManagedGatewaySettings{
			Command:      os.Args[0],
			Args:         []string{"-test.run=TestSupervisorHelperProcess", "--", "sleep"},
			BindHost:     "127.0.0.1",
			BindPort:     18999,
			GatewayToken: "token-b",
		},
	}); err != nil {
		t.Fatal(err)
	}

	url, token, ok := supervisor.GatewayConnection()
	if !ok {
		t.Fatal("expected pinned active gateway connection")
	}
	if url != "ws://127.0.0.1:18950" || token != "token-a" {
		t.Fatalf("expected pinned active config, got url=%s token=%s", url, token)
	}
	if supervisor.Snapshot().GatewayURL != "ws://127.0.0.1:18950" {
		t.Fatalf("expected pinned snapshot url, got %#v", supervisor.Snapshot())
	}

	if _, err := supervisor.Stop(context.Background()); err != nil {
		t.Fatal(err)
	}
}

func waitForStatus(t *testing.T, supervisor *Supervisor, expected Status) {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if supervisor.Snapshot().Status == expected {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for status %s, got %#v", expected, supervisor.Snapshot())
}

func expectEvent(t *testing.T, sub chan events.Event, expectedType string) {
	t.Helper()
	deadline := time.After(3 * time.Second)
	for {
		select {
		case <-deadline:
			t.Fatalf("timed out waiting for event %s", expectedType)
		case event := <-sub:
			if event.Type == expectedType {
				return
			}
		}
	}
}

func helperLauncher(mode string) launcher {
	return func(cfg config.ManagedGatewaySettings) (*exec.Cmd, error) {
		cmd := exec.Command(os.Args[0], "-test.run=TestSupervisorHelperProcess", "--", mode)
		cmd.Env = append(os.Environ(), "GO_WANT_SUPERVISOR_HELPER_PROCESS=1")
		return cmd, nil
	}
}

func TestSupervisorHelperProcess(t *testing.T) {
	if os.Getenv("GO_WANT_SUPERVISOR_HELPER_PROCESS") != "1" {
		return
	}
	mode := "sleep"
	for idx, arg := range os.Args {
		if arg == "--" && idx+1 < len(os.Args) {
			mode = os.Args[idx+1]
			break
		}
	}
	switch mode {
	case "sleep":
		time.Sleep(10 * time.Second)
		os.Exit(0)
	case "exit1":
		os.Exit(1)
	default:
		os.Exit(2)
	}
}
