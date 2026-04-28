package runtimecontrol

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"strings"
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
	runningSnapshot := supervisor.Snapshot()
	if runningSnapshot.Owner != "deck-go" || runningSnapshot.OwnershipFile == "" {
		t.Fatalf("expected ownership status, got %#v", runningSnapshot)
	}
	rawOwnership, err := os.ReadFile(runningSnapshot.OwnershipFile)
	if err != nil {
		t.Fatal(err)
	}
	var ownership ownershipMetadata
	if err := json.Unmarshal(rawOwnership, &ownership); err != nil {
		t.Fatal(err)
	}
	if ownership.Owner != "deck-go" || ownership.PID == 0 {
		t.Fatalf("unexpected ownership metadata: %#v", ownership)
	}
	if ownership.TokenHash == "" || ownership.TokenHash == "token" {
		t.Fatalf("expected non-secret token hash, got %#v", ownership)
	}
	if ownership.LaunchFingerprint == "" || ownership.StateDir == "" || ownership.LastStatus == "" {
		t.Fatalf("expected ownership fingerprint/state/status, got %#v", ownership)
	}
	if runtime.GOOS != "windows" {
		info, err := os.Stat(runningSnapshot.OwnershipFile)
		if err != nil {
			t.Fatal(err)
		}
		if info.Mode().Perm() != 0o600 {
			t.Fatalf("expected ownership metadata mode 0600, got %#o", info.Mode().Perm())
		}
	}

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
	if snapshot.RestartAttempts != 3 {
		t.Fatalf("expected bounded restart attempts to be exhausted, got %#v", snapshot)
	}
}

func TestSupervisor_RestartsAfterSustainedUnhealthyProbe(t *testing.T) {
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
			AutoStart:    true,
		},
	}); err != nil {
		t.Fatal(err)
	}

	probeHealthy := atomic.Bool{}
	probeHealthy.Store(true)
	launchAttempts := atomic.Int32{}
	supervisor := NewSupervisorWithOptions(
		store,
		events.NewBus(8),
		WithLauncher(func(config.ManagedGatewaySettings) (*exec.Cmd, error) {
			launchAttempts.Add(1)
			return helperLauncher("sleep")(config.ManagedGatewaySettings{})
		}),
		WithProbe(func(context.Context, config.ManagedGatewaySettings) error {
			if probeHealthy.Load() {
				return nil
			}
			return errors.New("probe failed")
		}),
		WithProbeInterval(20*time.Millisecond),
	)
	supervisor.unhealthyRestartAfter = 60 * time.Millisecond
	supervisor.restartInitialDelay = 10 * time.Millisecond
	supervisor.restartMaxDelay = 20 * time.Millisecond

	if _, err := supervisor.Start(context.Background()); err != nil {
		t.Fatal(err)
	}
	waitForStatus(t, supervisor, StatusRunning)
	probeHealthy.Store(false)
	waitForLaunchAttempts(t, &launchAttempts, 2)
	if supervisor.Snapshot().RestartAttempts == 0 {
		t.Fatalf("expected unhealthy replacement to schedule restart, got %#v", supervisor.Snapshot())
	}
	_, _ = supervisor.Stop(context.Background())
}

func TestSupervisor_ResetsBackoffAfterStableHealth(t *testing.T) {
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
			AutoStart:    true,
		},
	}); err != nil {
		t.Fatal(err)
	}
	supervisor := NewSupervisorWithOptions(
		store,
		events.NewBus(8),
		WithLauncher(helperLauncher("sleep")),
		WithProbe(func(context.Context, config.ManagedGatewaySettings) error { return nil }),
		WithProbeInterval(20*time.Millisecond),
	)
	supervisor.backoffResetAfter = 40 * time.Millisecond

	if _, err := supervisor.Start(context.Background()); err != nil {
		t.Fatal(err)
	}
	waitForStatus(t, supervisor, StatusRunning)
	supervisor.mu.Lock()
	supervisor.restartAttempts = 2
	supervisor.healthySince = time.Now().Add(-time.Second)
	supervisor.mu.Unlock()
	waitForRestartAttempts(t, supervisor, 0)
	_, _ = supervisor.Stop(context.Background())
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
	time.Sleep(100 * time.Millisecond)
	if supervisor.Snapshot().RestartAttempts != 0 {
		t.Fatalf("expected static validation failure to avoid restart retries, got %#v", supervisor.Snapshot())
	}
}

func TestSupervisor_UnownedListenerConflictStopRefusesToKillExternalProcess(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	port := listener.Addr().(*net.TCPAddr).Port

	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		ManagedGateway: config.ManagedGatewaySettings{
			Command:      "node",
			Args:         []string{"dist/entry.js", "gateway", "run"},
			WorkingDir:   t.TempDir(),
			BindHost:     "127.0.0.1",
			BindPort:     port,
			GatewayToken: "token",
			AutoStart:    true,
		},
	}); err != nil {
		t.Fatal(err)
	}

	supervisor := NewSupervisor(store, events.NewBus(4))
	snapshot, err := supervisor.Start(context.Background())
	if err == nil {
		t.Fatal("expected unowned listener conflict to block startup")
	}
	if snapshot.OwnershipState != "external" {
		t.Fatalf("expected external ownership state, got %#v", snapshot)
	}
	stopSnapshot, err := supervisor.Stop(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if stopSnapshot.Status != StatusFailed || stopSnapshot.OwnershipState != "external" {
		t.Fatalf("expected stop to refuse external listener, got %#v", stopSnapshot)
	}
	if _, err := net.Listen("tcp", listener.Addr().String()); err == nil {
		t.Fatal("expected unowned listener to remain alive")
	}
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
		WithStopTimeout(100*time.Millisecond),
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

func TestSupervisor_AdoptsLiveOwnedGatewayMetadata(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	settings := config.Settings{
		AccessToken: "token-a",
		ManagedGateway: config.ManagedGatewaySettings{
			Command:      os.Args[0],
			Args:         []string{"-test.run=TestSupervisorHelperProcess", "--", "sleep"},
			BindHost:     "127.0.0.1",
			BindPort:     18960,
			GatewayToken: "token-a",
		},
	}
	if err := store.Update(settings); err != nil {
		t.Fatal(err)
	}
	cfg := withManagedStateDir(store.Effective().ManagedGateway, store.Path())
	cmd := exec.Command(os.Args[0], "-test.run=TestSupervisorHelperProcess", "--", "sleep")
	cmd.Env = append(os.Environ(), "GO_WANT_SUPERVISOR_HELPER_PROCESS=1")
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	defer func() {
		if managedProcessAlive(cmd.Process.Pid) {
			_ = cmd.Process.Kill()
		}
	}()
	if err := writeOwnershipMetadata(store.Path(), cfg, cmd.Process.Pid, time.Now().UTC()); err != nil {
		t.Fatal(err)
	}

	var launched atomic.Bool
	supervisor := NewSupervisorWithOptions(
		store,
		events.NewBus(4),
		WithLauncher(func(config.ManagedGatewaySettings) (*exec.Cmd, error) {
			launched.Store(true)
			return nil, errors.New("unexpected launch")
		}),
		WithProbe(func(context.Context, config.ManagedGatewaySettings) error { return nil }),
		WithProbeInterval(20*time.Millisecond),
	)

	snapshot, err := supervisor.Start(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if launched.Load() {
		t.Fatal("expected supervisor to adopt existing owned gateway without launching")
	}
	if snapshot.OwnershipState != "adopted" || snapshot.PID != cmd.Process.Pid {
		t.Fatalf("expected adopted snapshot, got %#v", snapshot)
	}
	if _, err := supervisor.Stop(context.Background()); err != nil {
		t.Fatal(err)
	}
	waitCh := make(chan error, 1)
	go func() {
		waitCh <- cmd.Wait()
	}()
	select {
	case <-waitCh:
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for adopted helper process to exit")
	}
	if managedProcessAlive(cmd.Process.Pid) {
		t.Fatal("expected adopted gateway process to stop")
	}
}

func TestSupervisor_RejectsStaleOwnershipMetadata(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		AccessToken: "token-a",
		ManagedGateway: config.ManagedGatewaySettings{
			Command:      os.Args[0],
			Args:         []string{"-test.run=TestSupervisorHelperProcess", "--", "sleep"},
			GatewayToken: "token-a",
		},
	}); err != nil {
		t.Fatal(err)
	}
	cfg := withManagedStateDir(store.Effective().ManagedGateway, store.Path())
	if err := writeOwnershipMetadata(store.Path(), cfg, 0, time.Now().UTC()); err != nil {
		t.Fatal(err)
	}
	if _, ok, _ := readAdoptableOwnershipMetadata(store.Path(), cfg); ok {
		t.Fatal("expected stale metadata with no live PID to be ignored")
	}
}

func TestSupervisor_RejectsMismatchedOwnershipMetadata(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		AccessToken: "token-a",
		ManagedGateway: config.ManagedGatewaySettings{
			Command:      os.Args[0],
			Args:         []string{"-test.run=TestSupervisorHelperProcess", "--", "sleep"},
			GatewayToken: "token-a",
		},
	}); err != nil {
		t.Fatal(err)
	}
	cfg := withManagedStateDir(store.Effective().ManagedGateway, store.Path())
	if err := writeOwnershipMetadata(store.Path(), cfg, os.Getpid(), time.Now().UTC()); err != nil {
		t.Fatal(err)
	}
	mismatch := cfg
	mismatch.GatewayToken = "token-b"
	if _, ok, _ := readAdoptableOwnershipMetadata(store.Path(), mismatch); ok {
		t.Fatal("expected mismatched token hash metadata to be rejected")
	}
}

func TestSupervisor_DoesNotPutTokenInLaunchArgs(t *testing.T) {
	args := launchArgs(config.ManagedGatewaySettings{
		Args:         []string{"gateway", "run"},
		GatewayToken: "secret-token",
	})
	for _, arg := range args {
		if arg == "secret-token" || arg == "--token" || arg == "--password" {
			t.Fatalf("launch args must not contain auth material: %#v", args)
		}
	}
}

func TestSupervisor_StripsSecretBearingLaunchArgs(t *testing.T) {
	args := launchArgs(config.ManagedGatewaySettings{
		Args: []string{
			"dist/entry.js", "gateway", "run",
			"--token", "secret-token",
			"--password=other-secret",
		},
		GatewayToken: "secret-token",
	})
	for _, arg := range args {
		if arg == "secret-token" || arg == "other-secret" ||
			arg == "--token" || arg == "--password" ||
			strings.HasPrefix(arg, "--token=") || strings.HasPrefix(arg, "--password=") {
			t.Fatalf("launch args must not contain auth material after stripping: %#v", args)
		}
	}
	if got := strings.Join(args, " "); !strings.Contains(got, "dist/entry.js") || !strings.Contains(got, "gateway run") {
		t.Fatalf("non-auth args should be preserved, got %q", got)
	}
}

func TestSupervisor_AcceptsConfigWithUserAuthArgs(t *testing.T) {
	if err := validateManagedConfig(config.ManagedGatewaySettings{
		Command:      "node",
		Args:         []string{"dist/entry.js", "gateway", "run", "--token", "secret-token"},
		GatewayToken: "secret-token",
	}); err != nil {
		t.Fatalf("validateManagedConfig should accept legacy --token args (they are stripped at launch); got %v", err)
	}
}

func TestSupervisor_SnapshotDoesNotExposeGatewayToken(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		AccessToken: "secret-token",
		ManagedGateway: config.ManagedGatewaySettings{
			Command:      os.Args[0],
			Args:         []string{"-test.run=TestSupervisorHelperProcess", "--", "sleep"},
			GatewayToken: "secret-token",
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
	)
	if _, err := supervisor.Start(context.Background()); err != nil {
		t.Fatal(err)
	}
	defer func() {
		_, _ = supervisor.Stop(context.Background())
	}()
	waitForStatus(t, supervisor, StatusRunning)

	raw, err := json.Marshal(supervisor.Snapshot())
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(raw), "secret-token") {
		t.Fatalf("snapshot leaked raw token: %s", raw)
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

func waitForLaunchAttempts(t *testing.T, attempts *atomic.Int32, expected int32) {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if attempts.Load() >= expected {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for %d launch attempts, got %d", expected, attempts.Load())
}

func waitForRestartAttempts(t *testing.T, supervisor *Supervisor, expected int) {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if supervisor.Snapshot().RestartAttempts == expected {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for restart attempts %d, got %#v", expected, supervisor.Snapshot())
}

func helperLauncher(mode string) launcher {
	return func(cfg config.ManagedGatewaySettings) (*exec.Cmd, error) {
		cmd := exec.Command(os.Args[0], "-test.run=TestSupervisorHelperProcess", "--", mode)
		cmd.Env = append(os.Environ(), "GO_WANT_SUPERVISOR_HELPER_PROCESS=1")
		return cmd, nil
	}
}

func TestSupervisor_RejectsAdoptionOnLaunchFingerprintMismatch(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		AccessToken: "token-a",
		ManagedGateway: config.ManagedGatewaySettings{
			Command:      os.Args[0],
			Args:         []string{"-test.run=TestSupervisorHelperProcess", "--", "sleep"},
			BindHost:     "127.0.0.1",
			BindPort:     19012,
			GatewayToken: "token-a",
		},
	}); err != nil {
		t.Fatal(err)
	}
	cfg := withManagedStateDir(store.Effective().ManagedGateway, store.Path())
	if err := writeOwnershipMetadata(store.Path(), cfg, os.Getpid(), time.Now().UTC()); err != nil {
		t.Fatal(err)
	}

	cases := []struct {
		name   string
		mutate func(c config.ManagedGatewaySettings) config.ManagedGatewaySettings
		reason string
	}{
		{
			name: "launchFingerprint",
			mutate: func(c config.ManagedGatewaySettings) config.ManagedGatewaySettings {
				c.Args = append(append([]string(nil), c.Args...), "--extra-flag")
				return c
			},
			reason: "launch fingerprint mismatch",
		},
		{
			name: "bindHost",
			mutate: func(c config.ManagedGatewaySettings) config.ManagedGatewaySettings {
				c.BindHost = "0.0.0.0"
				return c
			},
			reason: "bind mismatch",
		},
		{
			name: "bindPort",
			mutate: func(c config.ManagedGatewaySettings) config.ManagedGatewaySettings {
				c.BindPort = 19099
				return c
			},
			reason: "bind mismatch",
		},
		{
			name: "stateDir",
			mutate: func(c config.ManagedGatewaySettings) config.ManagedGatewaySettings {
				c.Env = map[string]string{"OPENCLAW_STATE_DIR": "/tmp/something-else"}
				return c
			},
			reason: "state directory mismatch",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			mismatch := tc.mutate(cfg)
			_, ok, why := readAdoptableOwnershipMetadata(store.Path(), mismatch)
			if ok {
				t.Fatalf("expected adoption to be rejected for %s mismatch", tc.name)
			}
			if !strings.Contains(why, tc.reason) {
				t.Fatalf("expected rejection reason to mention %q; got %q", tc.reason, why)
			}
		})
	}

	t.Run("corruptJSON", func(t *testing.T) {
		path := ownershipMetadataPath(store.Path())
		if err := os.WriteFile(path, []byte("{not valid json"), 0o600); err != nil {
			t.Fatal(err)
		}
		_, ok, why := readAdoptableOwnershipMetadata(store.Path(), cfg)
		if ok {
			t.Fatal("expected adoption to be rejected on corrupt metadata")
		}
		if !strings.Contains(why, "corrupt") {
			t.Fatalf("expected corruption reason; got %q", why)
		}
	})
}

func TestSupervisor_AdoptedAbnormalExitTransitions(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		AccessToken: "token-a",
		ManagedGateway: config.ManagedGatewaySettings{
			Command:      os.Args[0],
			Args:         []string{"-test.run=TestSupervisorHelperProcess", "--", "sleep"},
			BindHost:     "127.0.0.1",
			BindPort:     19013,
			GatewayToken:        "token-a",
			AutoStart:           false,
			AutoStartConfigured: true,
		},
	}); err != nil {
		t.Fatal(err)
	}
	cfg := withManagedStateDir(store.Effective().ManagedGateway, store.Path())
	helper := exec.Command(os.Args[0], "-test.run=TestSupervisorHelperProcess", "--", "sleep")
	helper.Env = append(os.Environ(), "GO_WANT_SUPERVISOR_HELPER_PROCESS=1")
	if err := helper.Start(); err != nil {
		t.Fatal(err)
	}
	defer func() {
		if managedProcessAlive(helper.Process.Pid) {
			_ = helper.Process.Kill()
		}
		_ = helper.Wait()
	}()
	if err := writeOwnershipMetadata(store.Path(), cfg, helper.Process.Pid, time.Now().UTC()); err != nil {
		t.Fatal(err)
	}

	supervisor := NewSupervisorWithOptions(
		store,
		events.NewBus(8),
		WithLauncher(func(config.ManagedGatewaySettings) (*exec.Cmd, error) {
			return nil, errors.New("unexpected launch")
		}),
		WithProbe(func(context.Context, config.ManagedGatewaySettings) error { return nil }),
		WithProbeInterval(20*time.Millisecond),
	)

	snap, err := supervisor.Start(context.Background())
	if err != nil {
		t.Fatalf("Start failed: %v", err)
	}
	if snap.OwnershipState != "adopted" || snap.PID != helper.Process.Pid {
		t.Fatalf("expected adopted state with helper pid before kill, got %#v", snap)
	}

	if err := helper.Process.Kill(); err != nil {
		t.Fatal(err)
	}
	_ = helper.Wait()

	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		snap := supervisor.Snapshot()
		fileGone := false
		if _, statErr := os.Stat(ownershipMetadataPath(store.Path())); errors.Is(statErr, os.ErrNotExist) {
			fileGone = true
		}
		if snap.Status == StatusFailed && snap.OwnershipState == "none" && snap.LastExitCode == -1 && fileGone {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatalf("adopted abnormal exit did not converge within 3s; snapshot=%+v fileExists=%v",
		supervisor.Snapshot(),
		!errors.Is(func() error { _, e := os.Stat(ownershipMetadataPath(store.Path())); return e }(), os.ErrNotExist),
	)
}

func TestSupervisor_AdoptedUnhealthyDoesNotReplaceWhenAutoStartDisabled(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		AccessToken: "token-a",
		ManagedGateway: config.ManagedGatewaySettings{
			Command:      os.Args[0],
			Args:         []string{"-test.run=TestSupervisorHelperProcess", "--", "sleep"},
			BindHost:     "127.0.0.1",
			BindPort:     19014,
			GatewayToken:        "token-a",
			AutoStart:           false,
			AutoStartConfigured: true,
		},
	}); err != nil {
		t.Fatal(err)
	}
	cfg := withManagedStateDir(store.Effective().ManagedGateway, store.Path())
	helper := exec.Command(os.Args[0], "-test.run=TestSupervisorHelperProcess", "--", "sleep")
	helper.Env = append(os.Environ(), "GO_WANT_SUPERVISOR_HELPER_PROCESS=1")
	if err := helper.Start(); err != nil {
		t.Fatal(err)
	}
	defer func() {
		if managedProcessAlive(helper.Process.Pid) {
			_ = helper.Process.Kill()
			_ = helper.Wait()
		}
	}()
	time.Sleep(50 * time.Millisecond)
	if !managedProcessAlive(helper.Process.Pid) {
		t.Fatalf("helper process %d not alive immediately after Start; cannot test adoption", helper.Process.Pid)
	}
	if err := writeOwnershipMetadata(store.Path(), cfg, helper.Process.Pid, time.Now().UTC()); err != nil {
		t.Fatal(err)
	}

	var unhealthy atomic.Bool
	var launches atomic.Int32
	supervisor := NewSupervisorWithOptions(
		store,
		events.NewBus(8),
		WithLauncher(func(config.ManagedGatewaySettings) (*exec.Cmd, error) {
			launches.Add(1)
			return nil, errors.New("unexpected relaunch")
		}),
		WithProbe(func(context.Context, config.ManagedGatewaySettings) error {
			if unhealthy.Load() {
				return errors.New("induced unhealthy")
			}
			return nil
		}),
		WithProbeInterval(20*time.Millisecond),
	)
	supervisor.unhealthyRestartAfter = 60 * time.Millisecond

	snap, err := supervisor.Start(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if snap.OwnershipState != "adopted" {
		t.Fatalf("expected adopted state, got %#v", snap)
	}

	unhealthy.Store(true)
	time.Sleep(400 * time.Millisecond)
	if launches.Load() != 0 {
		t.Fatalf("supervisor must not relaunch when AutoStart=false; launches=%d", launches.Load())
	}
	if !managedProcessAlive(helper.Process.Pid) {
		t.Fatal("adopted process must not be replaced when AutoStart=false")
	}

	if _, err := supervisor.Stop(context.Background()); err != nil {
		t.Fatal(err)
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
