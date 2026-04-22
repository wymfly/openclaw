package runtimecontrol

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"os/signal"
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
	if _, err := supervisor.Start(context.Background()); err != nil {
		t.Fatal(err)
	}
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

func TestSupervisor_StartFailurePolicyOverridesClassification(t *testing.T) {
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

	supervisor := NewSupervisorWithOptions(
		store,
		events.NewBus(4),
		WithLauncher(func(config.ManagedGatewaySettings) (*exec.Cmd, error) {
			return nil, fmt.Errorf("launch failed")
		}),
		WithStartFailurePolicy(func(input StartFailureContext) StartFailureDecision {
			return StartFailureDecision{
				Status:       StatusFailed,
				Health:       HealthUnknown,
				LastError:    "classified: " + input.Err.Error(),
				FailurePhase: "managed-" + input.Stage,
			}
		}),
	)

	if _, err := supervisor.Start(context.Background()); err == nil {
		t.Fatal("expected launch failure")
	}
	snapshot := supervisor.Snapshot()
	if snapshot.FailurePhase != "managed-launch" {
		t.Fatalf("expected managed launch failure phase, got %#v", snapshot)
	}
	if snapshot.LastError != "classified: launch failed" {
		t.Fatalf("expected classified launch error, got %#v", snapshot)
	}
}

func TestSupervisor_StartClearsPreviousFailureStateOnRecovery(t *testing.T) {
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

	var launchAttempts int32
	supervisor := NewSupervisorWithOptions(
		store,
		events.NewBus(4),
		WithLauncher(func(config.ManagedGatewaySettings) (*exec.Cmd, error) {
			if atomic.AddInt32(&launchAttempts, 1) == 1 {
				return nil, errors.New("launch failed once")
			}
			return helperLauncher("sleep")(config.ManagedGatewaySettings{})
		}),
		WithProbe(func(context.Context, config.ManagedGatewaySettings) error { return nil }),
		WithProbeInterval(20*time.Millisecond),
	)

	if _, err := supervisor.Start(context.Background()); err == nil {
		t.Fatal("expected first launch failure")
	}
	failed := supervisor.Snapshot()
	if failed.FailurePhase != "launch" || failed.LastError != "launch failed once" {
		t.Fatalf("expected initial launch failure, got %#v", failed)
	}

	if _, err := supervisor.Start(context.Background()); err != nil {
		t.Fatal(err)
	}
	waitForStatus(t, supervisor, StatusRunning)
	running := supervisor.Snapshot()
	if running.FailurePhase != "" {
		t.Fatalf("expected recovered start to clear failure phase, got %#v", running)
	}
	if running.LastError != "" {
		t.Fatalf("expected recovered start to clear last error, got %#v", running)
	}
	if _, err := supervisor.Stop(context.Background()); err != nil {
		t.Fatal(err)
	}
}

func TestSupervisor_ExitTransitionPolicyOverridesAbnormalExitClassification(t *testing.T) {
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
		},
	}); err != nil {
		t.Fatal(err)
	}

	supervisor := NewSupervisorWithOptions(
		store,
		events.NewBus(4),
		WithLauncher(helperLauncher("exit1")),
		WithProbe(func(context.Context, config.ManagedGatewaySettings) error { return nil }),
		WithProbeInterval(20*time.Millisecond),
		WithExitTransitionPolicy(func(input ExitTransitionContext) ExitTransitionDecision {
			return ExitTransitionDecision{
				Status:            StatusFailed,
				Health:            HealthUnknown,
				LastError:         fmt.Sprintf("managed exit %d", input.ExitCode),
				FailurePhase:      "managed-runtime-exit",
				ClearActiveConfig: false,
			}
		}),
	)

	if _, err := supervisor.Start(context.Background()); err != nil {
		t.Fatal(err)
	}
	waitForStatus(t, supervisor, StatusFailed)

	snapshot := supervisor.Snapshot()
	if snapshot.FailurePhase != "managed-runtime-exit" {
		t.Fatalf("expected managed exit failure phase, got %#v", snapshot)
	}
	if snapshot.LastError != "managed exit 1" {
		t.Fatalf("expected managed exit error, got %#v", snapshot)
	}
}

func TestSupervisor_ExitTransitionPolicyOverridesStopClassification(t *testing.T) {
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

	supervisor := NewSupervisorWithOptions(
		store,
		events.NewBus(4),
		WithLauncher(helperLauncher("sleep")),
		WithProbe(func(context.Context, config.ManagedGatewaySettings) error { return nil }),
		WithProbeInterval(20*time.Millisecond),
		WithExitTransitionPolicy(func(input ExitTransitionContext) ExitTransitionDecision {
			if input.StopRequested {
				return ExitTransitionDecision{
					Status:            StatusStopped,
					Health:            HealthUnknown,
					LastError:         "",
					FailurePhase:      "managed-stop",
					ClearActiveConfig: true,
				}
			}
			return defaultExitTransitionPolicy(input)
		}),
	)

	if _, err := supervisor.Start(context.Background()); err != nil {
		t.Fatal(err)
	}
	waitForStatus(t, supervisor, StatusRunning)

	if _, err := supervisor.Stop(context.Background()); err != nil {
		t.Fatal(err)
	}
	waitForStatus(t, supervisor, StatusStopped)

	snapshot := supervisor.Snapshot()
	if snapshot.FailurePhase != "managed-stop" {
		t.Fatalf("expected managed stop classification, got %#v", snapshot)
	}
}

func TestSupervisor_ExitTransitionPolicyOverridesForcedKillStopClassification(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		ManagedGateway: config.ManagedGatewaySettings{
			Command:      os.Args[0],
			Args:         []string{"-test.run=TestSupervisorHelperProcess", "--", "ignore-interrupt"},
			GatewayToken: "token",
		},
	}); err != nil {
		t.Fatal(err)
	}

	supervisor := NewSupervisorWithOptions(
		store,
		events.NewBus(4),
		WithLauncher(helperLauncher("ignore-interrupt")),
		WithProbe(func(context.Context, config.ManagedGatewaySettings) error { return nil }),
		WithProbeInterval(20*time.Millisecond),
		WithStopTimeout(50*time.Millisecond),
		WithExitTransitionPolicy(func(input ExitTransitionContext) ExitTransitionDecision {
			if input.StopRequested && input.StopTimedOut {
				return ExitTransitionDecision{
					Status:            StatusStopped,
					Health:            HealthUnknown,
					LastError:         "",
					FailurePhase:      "managed-stop-timeout",
					ClearActiveConfig: true,
				}
			}
			return defaultExitTransitionPolicy(input)
		}),
	)

	if _, err := supervisor.Start(context.Background()); err != nil {
		t.Fatal(err)
	}
	waitForStatus(t, supervisor, StatusRunning)

	if _, err := supervisor.Stop(context.Background()); err != nil {
		t.Fatal(err)
	}
	waitForStatus(t, supervisor, StatusStopped)

	snapshot := supervisor.Snapshot()
	if snapshot.FailurePhase != "managed-stop-timeout" {
		t.Fatalf("expected managed stop-timeout classification, got %#v", snapshot)
	}
}

func TestSupervisor_StopSignalFailurePolicyOverridesClassification(t *testing.T) {
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

	supervisor := NewSupervisorWithOptions(
		store,
		events.NewBus(4),
		WithLauncher(helperLauncher("sleep")),
		WithProbe(func(context.Context, config.ManagedGatewaySettings) error { return nil }),
		WithProbeInterval(20*time.Millisecond),
		WithProcessTerminator(func(cmd *exec.Cmd) error {
			_ = cmd.Process.Kill()
			return errors.New("interrupt failed")
		}),
		WithStopSignalFailurePolicy(func(input StopSignalFailureContext) StopSignalFailureDecision {
			return StopSignalFailureDecision{
				Status:       StatusFailed,
				Health:       HealthUnknown,
				LastError:    "classified: " + input.Err.Error(),
				FailurePhase: "managed-stop-signal",
			}
		}),
	)

	if _, err := supervisor.Start(context.Background()); err != nil {
		t.Fatal(err)
	}
	waitForStatus(t, supervisor, StatusRunning)

	snapshot, err := supervisor.Stop(context.Background())
	if err == nil {
		t.Fatal("expected stop signal failure")
	}
	if snapshot.FailurePhase != "managed-stop-signal" {
		t.Fatalf("expected managed stop signal failure phase, got %#v", snapshot)
	}
	if snapshot.LastError != "classified: interrupt failed" {
		t.Fatalf("expected classified stop signal error, got %#v", snapshot)
	}
	waitForStatus(t, supervisor, StatusStopped)
}

func TestSupervisor_StopNoProcessPolicyOverridesNoCommandClassification(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}

	supervisor := NewSupervisorWithOptions(
		store,
		events.NewBus(4),
		WithStopNoProcessPolicy(func(input StopNoProcessContext) StopNoProcessDecision {
			if input.HasCommand || input.HasProcess {
				t.Fatalf("expected no command/no process path, got %#v", input)
			}
			return StopNoProcessDecision{
				Status:            StatusStopped,
				Health:            HealthUnknown,
				LastError:         "",
				FailurePhase:      "managed-stop-idle",
				ClearActiveConfig: false,
			}
		}),
	)

	snapshot, err := supervisor.Stop(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.FailurePhase != "managed-stop-idle" {
		t.Fatalf("expected managed idle stop classification, got %#v", snapshot)
	}
}

func TestSupervisor_StopNoProcessPolicyOverridesStaleCommandClassification(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}

	supervisor := NewSupervisorWithOptions(
		store,
		events.NewBus(4),
		WithStopNoProcessPolicy(func(input StopNoProcessContext) StopNoProcessDecision {
			if !input.HasCommand || input.HasProcess {
				t.Fatalf("expected stale command/no process path, got %#v", input)
			}
			return StopNoProcessDecision{
				Status:            StatusStopped,
				Health:            HealthUnknown,
				LastError:         "",
				FailurePhase:      "managed-stop-stale-command",
				ClearActiveConfig: false,
			}
		}),
	)
	supervisor.cmd = &exec.Cmd{}
	supervisor.waitDone = make(chan struct{})
	supervisor.status = StatusRunning

	snapshot, err := supervisor.Stop(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.FailurePhase != "managed-stop-stale-command" {
		t.Fatalf("expected managed stale-command stop classification, got %#v", snapshot)
	}
	if supervisor.cmd != nil {
		t.Fatalf("expected stale command to be cleared, got %#v", supervisor.cmd)
	}
	if supervisor.waitDone != nil {
		t.Fatal("expected stale wait channel to be cleared")
	}
}

func TestSupervisor_StopWaitFailurePolicyOverridesContextCancellation(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		ManagedGateway: config.ManagedGatewaySettings{
			Command:      os.Args[0],
			Args:         []string{"-test.run=TestSupervisorHelperProcess", "--", "ignore-interrupt"},
			GatewayToken: "token",
		},
	}); err != nil {
		t.Fatal(err)
	}

	supervisor := NewSupervisorWithOptions(
		store,
		events.NewBus(4),
		WithLauncher(helperLauncher("ignore-interrupt")),
		WithProbe(func(context.Context, config.ManagedGatewaySettings) error { return nil }),
		WithProbeInterval(20*time.Millisecond),
		WithStopTimeout(50*time.Millisecond),
		WithProcessTerminator(func(*exec.Cmd) error { return nil }),
		WithStopWaitFailurePolicy(func(input StopWaitFailureContext) StopWaitFailureDecision {
			if input.Stage != "ctx-cancelled" {
				t.Fatalf("expected ctx-cancelled stage, got %#v", input)
			}
			return StopWaitFailureDecision{
				Status:       StatusStopping,
				Health:       HealthUnknown,
				LastError:    "managed ctx cancel",
				FailurePhase: "managed-stop-cancelled",
			}
		}),
	)

	if _, err := supervisor.Start(context.Background()); err != nil {
		t.Fatal(err)
	}
	waitForStatus(t, supervisor, StatusRunning)
	stopCtx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()

	snapshot, err := supervisor.Stop(stopCtx)
	if err == nil {
		t.Fatal("expected stop context cancellation")
	}
	if snapshot.FailurePhase != "managed-stop-cancelled" {
		t.Fatalf("expected managed stop cancelled classification, got %#v", snapshot)
	}
	if snapshot.LastError != "managed ctx cancel" {
		t.Fatalf("expected managed stop cancelled error, got %#v", snapshot)
	}
	if supervisor.cmd != nil && supervisor.cmd.Process != nil {
		_ = supervisor.cmd.Process.Kill()
	}
}

func TestSupervisor_StopWaitFailurePolicyOverridesForceKillError(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		ManagedGateway: config.ManagedGatewaySettings{
			Command:      os.Args[0],
			Args:         []string{"-test.run=TestSupervisorHelperProcess", "--", "ignore-interrupt"},
			GatewayToken: "token",
		},
	}); err != nil {
		t.Fatal(err)
	}

	supervisor := NewSupervisorWithOptions(
		store,
		events.NewBus(4),
		WithLauncher(helperLauncher("ignore-interrupt")),
		WithProbe(func(context.Context, config.ManagedGatewaySettings) error { return nil }),
		WithProbeInterval(20*time.Millisecond),
		WithStopTimeout(20*time.Millisecond),
		WithProcessTerminator(func(*exec.Cmd) error { return nil }),
		WithForceKillProcess(func(cmd *exec.Cmd) error {
			if cmd != nil && cmd.Process != nil {
				_ = cmd.Process.Kill()
			}
			return errors.New("kill failed")
		}),
		WithStopWaitFailurePolicy(func(input StopWaitFailureContext) StopWaitFailureDecision {
			if input.Stage != "force-kill" || !input.TimedOut {
				t.Fatalf("expected force-kill timedOut context, got %#v", input)
			}
			return StopWaitFailureDecision{
				Status:       StatusStopping,
				Health:       HealthUnknown,
				LastError:    "managed kill failed",
				FailurePhase: "managed-stop-kill-failed",
			}
		}),
	)

	if _, err := supervisor.Start(context.Background()); err != nil {
		t.Fatal(err)
	}
	waitForStatus(t, supervisor, StatusRunning)
	snapshot, err := supervisor.Stop(context.Background())
	if err == nil {
		t.Fatal("expected force-kill failure")
	}
	if snapshot.FailurePhase != "managed-stop-kill-failed" {
		t.Fatalf("expected managed stop kill failure classification, got %#v", snapshot)
	}
	if snapshot.LastError != "managed kill failed" {
		t.Fatalf("expected managed stop kill error, got %#v", snapshot)
	}
	if supervisor.cmd != nil && supervisor.cmd.Process != nil {
		_ = supervisor.cmd.Process.Kill()
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
	case "ignore-interrupt":
		signal.Ignore(os.Interrupt)
		time.Sleep(10 * time.Second)
		os.Exit(0)
	default:
		os.Exit(2)
	}
}
