package openclaw

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"os/signal"
	"testing"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
)

func TestManagedSupervisorWithOptions_PublishesLifecycleEvents(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		ManagedGateway: config.ManagedGatewaySettings{
			Command:      "echo",
			GatewayToken: "token",
		},
	}); err != nil {
		t.Fatal(err)
	}

	bus := events.NewBus(16)
	sub := bus.Subscribe()
	defer bus.Unsubscribe(sub)

	supervisor := NewManagedSupervisorWithOptions(
		store,
		bus,
		WithManagedLauncher(func(config.ManagedGatewaySettings) (*exec.Cmd, error) {
			return nil, errors.New("launch failed")
		}),
	)

	if _, err := supervisor.Start(context.Background()); err == nil {
		t.Fatal("expected launch failure")
	}

	expectManagedEvent(t, sub, "runtime.gateway.status")
}

func TestManagedSupervisorWithOptions_UsesManagedStartFailurePolicy(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		ManagedGateway: config.ManagedGatewaySettings{
			Command:      "echo",
			GatewayToken: "token",
		},
	}); err != nil {
		t.Fatal(err)
	}

	supervisor := NewManagedSupervisorWithOptions(
		store,
		nil,
		WithManagedLauncher(func(config.ManagedGatewaySettings) (*exec.Cmd, error) {
			return nil, errors.New("launch failed")
		}),
		WithManagedStartFailurePolicy(func(input ManagedStartFailureContext) ManagedStartFailureDecision {
			return ManagedStartFailureDecision{
				Status:       ManagedStatusFailed,
				Health:       ManagedHealthUnknown,
				LastError:    "managed: " + input.Err.Error(),
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
	if snapshot.LastError != "managed: launch failed" {
		t.Fatalf("expected managed launch failure error, got %#v", snapshot)
	}
}

func TestManagedSupervisorWithOptions_UsesManagedExitTransitionPolicy(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		ManagedGateway: config.ManagedGatewaySettings{
			Command:      os.Args[0],
			Args:         []string{"-test.run=TestManagedSupervisorHelperProcess", "--", "exit1"},
			GatewayToken: "token",
		},
	}); err != nil {
		t.Fatal(err)
	}

	supervisor := NewManagedSupervisorWithOptions(
		store,
		nil,
		WithManagedLauncher(func(config.ManagedGatewaySettings) (*exec.Cmd, error) {
			cmd := exec.Command(os.Args[0], "-test.run=TestManagedSupervisorHelperProcess", "--", "exit1")
			cmd.Env = append(os.Environ(), "GO_WANT_MANAGED_SUPERVISOR_HELPER_PROCESS=1")
			return cmd, nil
		}),
		WithManagedProbe(func(context.Context, config.ManagedGatewaySettings) error { return nil }),
		WithManagedProbeInterval(20*time.Millisecond),
		WithManagedExitTransitionPolicy(func(input ManagedExitTransitionContext) ManagedExitTransitionDecision {
			return ManagedExitTransitionDecision{
				Status:            ManagedStatusFailed,
				Health:            ManagedHealthUnknown,
				LastError:         "managed exit",
				FailurePhase:      "managed-runtime-exit",
				ClearActiveConfig: false,
			}
		}),
	)

	if _, err := supervisor.Start(context.Background()); err != nil {
		t.Fatal(err)
	}
	waitForManagedStatus(t, supervisor, ManagedStatusFailed)
	snapshot := supervisor.Snapshot()
	if snapshot.FailurePhase != "managed-runtime-exit" {
		t.Fatalf("expected managed exit failure phase, got %#v", snapshot)
	}
	if snapshot.LastError != "managed exit" {
		t.Fatalf("expected managed exit error, got %#v", snapshot)
	}
}

func TestManagedSupervisorWithOptions_UsesManagedForcedKillStopClassification(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		ManagedGateway: config.ManagedGatewaySettings{
			Command:      os.Args[0],
			Args:         []string{"-test.run=TestManagedSupervisorHelperProcess", "--", "ignore-interrupt"},
			GatewayToken: "token",
		},
	}); err != nil {
		t.Fatal(err)
	}

	supervisor := NewManagedSupervisorWithOptions(
		store,
		nil,
		WithManagedLauncher(func(config.ManagedGatewaySettings) (*exec.Cmd, error) {
			cmd := exec.Command(os.Args[0], "-test.run=TestManagedSupervisorHelperProcess", "--", "ignore-interrupt")
			cmd.Env = append(os.Environ(), "GO_WANT_MANAGED_SUPERVISOR_HELPER_PROCESS=1")
			return cmd, nil
		}),
		WithManagedProbe(func(context.Context, config.ManagedGatewaySettings) error { return nil }),
		WithManagedProbeInterval(20*time.Millisecond),
		WithManagedStopTimeout(50*time.Millisecond),
		WithManagedExitTransitionPolicy(func(input ManagedExitTransitionContext) ManagedExitTransitionDecision {
			if input.StopRequested && input.StopTimedOut {
				return ManagedExitTransitionDecision{
					Status:            ManagedStatusStopped,
					Health:            ManagedHealthUnknown,
					LastError:         "",
					FailurePhase:      "managed-stop-timeout",
					ClearActiveConfig: true,
				}
			}
			lastError := ""
			if input.Err != nil {
				lastError = input.Err.Error()
			}
			return ManagedExitTransitionDecision{
				Status:            ManagedStatusFailed,
				Health:            ManagedHealthUnknown,
				LastError:         lastError,
				FailurePhase:      "runtime",
				ClearActiveConfig: false,
			}
		}),
	)

	if _, err := supervisor.Start(context.Background()); err != nil {
		t.Fatal(err)
	}
	waitForManagedStatus(t, supervisor, ManagedStatusRunning)
	time.Sleep(100 * time.Millisecond)

	if _, err := supervisor.Stop(context.Background()); err != nil {
		t.Fatal(err)
	}
	waitForManagedStatus(t, supervisor, ManagedStatusStopped)
	snapshot := supervisor.Snapshot()
	if snapshot.FailurePhase != "managed-stop-timeout" {
		t.Fatalf("expected managed stop-timeout classification, got %#v", snapshot)
	}
}

func TestManagedSupervisorWithOptions_UsesManagedStopSignalFailurePolicy(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		ManagedGateway: config.ManagedGatewaySettings{
			Command:      os.Args[0],
			Args:         []string{"-test.run=TestManagedSupervisorHelperProcess", "--", "sleep"},
			GatewayToken: "token",
		},
	}); err != nil {
		t.Fatal(err)
	}

	supervisor := NewManagedSupervisorWithOptions(
		store,
		nil,
		WithManagedLauncher(func(config.ManagedGatewaySettings) (*exec.Cmd, error) {
			cmd := exec.Command(os.Args[0], "-test.run=TestManagedSupervisorHelperProcess", "--", "sleep")
			cmd.Env = append(os.Environ(), "GO_WANT_MANAGED_SUPERVISOR_HELPER_PROCESS=1")
			return cmd, nil
		}),
		WithManagedProbe(func(context.Context, config.ManagedGatewaySettings) error { return nil }),
		WithManagedProbeInterval(20*time.Millisecond),
		WithManagedProcessTerminator(func(cmd *exec.Cmd) error {
			_ = cmd.Process.Kill()
			return errors.New("interrupt failed")
		}),
		WithManagedStopSignalFailurePolicy(func(input ManagedStopSignalFailureContext) ManagedStopSignalFailureDecision {
			return ManagedStopSignalFailureDecision{
				Status:       ManagedStatusFailed,
				Health:       ManagedHealthUnknown,
				LastError:    "managed stop signal",
				FailurePhase: "managed-stop-signal",
			}
		}),
	)

	if _, err := supervisor.Start(context.Background()); err != nil {
		t.Fatal(err)
	}
	waitForManagedStatus(t, supervisor, ManagedStatusRunning)

	snapshot, err := supervisor.Stop(context.Background())
	if err == nil {
		t.Fatal("expected stop signal failure")
	}
	if snapshot.FailurePhase != "managed-stop-signal" {
		t.Fatalf("expected managed stop signal failure phase, got %#v", snapshot)
	}
	if snapshot.LastError != "managed stop signal" {
		t.Fatalf("expected managed stop signal error, got %#v", snapshot)
	}
	waitForManagedStatus(t, supervisor, ManagedStatusStopped)
}

func TestManagedSupervisorWithOptions_UsesManagedStopNoProcessPolicy(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}

	supervisor := NewManagedSupervisorWithOptions(
		store,
		nil,
		WithManagedStopNoProcessPolicy(func(input ManagedStopNoProcessContext) ManagedStopNoProcessDecision {
			if input.HasCommand || input.HasProcess {
				t.Fatalf("expected no command/no process path, got %#v", input)
			}
			return ManagedStopNoProcessDecision{
				Status:            ManagedStatusStopped,
				Health:            ManagedHealthUnknown,
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
		t.Fatalf("expected managed stop idle classification, got %#v", snapshot)
	}
}

func TestManagedSupervisorWithOptions_UsesManagedStopWaitFailurePolicy(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		ManagedGateway: config.ManagedGatewaySettings{
			Command:      os.Args[0],
			Args:         []string{"-test.run=TestManagedSupervisorHelperProcess", "--", "ignore-interrupt"},
			GatewayToken: "token",
		},
	}); err != nil {
		t.Fatal(err)
	}

	supervisor := NewManagedSupervisorWithOptions(
		store,
		nil,
		WithManagedLauncher(func(config.ManagedGatewaySettings) (*exec.Cmd, error) {
			cmd := exec.Command(os.Args[0], "-test.run=TestManagedSupervisorHelperProcess", "--", "ignore-interrupt")
			cmd.Env = append(os.Environ(), "GO_WANT_MANAGED_SUPERVISOR_HELPER_PROCESS=1")
			return cmd, nil
		}),
		WithManagedProbe(func(context.Context, config.ManagedGatewaySettings) error { return nil }),
		WithManagedProbeInterval(20*time.Millisecond),
		WithManagedStopTimeout(50*time.Millisecond),
		WithManagedStopWaitFailurePolicy(func(input ManagedStopWaitFailureContext) ManagedStopWaitFailureDecision {
			if input.Stage != "ctx-cancelled" {
				t.Fatalf("expected ctx-cancelled stage, got %#v", input)
			}
			return ManagedStopWaitFailureDecision{
				Status:       ManagedStatusStopping,
				Health:       ManagedHealthUnknown,
				LastError:    "managed stop wait failure",
				FailurePhase: "managed-stop-cancelled",
			}
		}),
	)

	if _, err := supervisor.Start(context.Background()); err != nil {
		t.Fatal(err)
	}
	waitForManagedStatus(t, supervisor, ManagedStatusRunning)
	stopCtx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()

	snapshot, err := supervisor.Stop(stopCtx)
	if err == nil {
		t.Fatal("expected stop context cancellation")
	}
	if snapshot.FailurePhase != "managed-stop-cancelled" {
		t.Fatalf("expected managed stop cancelled classification, got %#v", snapshot)
	}
	if snapshot.LastError != "managed stop wait failure" {
		t.Fatalf("expected managed stop cancelled error, got %#v", snapshot)
	}
	_, _ = supervisor.Stop(context.Background())
}

func TestManagedSupervisorWithOptions_UsesManagedForceKillErrorPolicy(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		ManagedGateway: config.ManagedGatewaySettings{
			Command:      os.Args[0],
			Args:         []string{"-test.run=TestManagedSupervisorHelperProcess", "--", "ignore-interrupt"},
			GatewayToken: "token",
		},
	}); err != nil {
		t.Fatal(err)
	}

	supervisor := NewManagedSupervisorWithOptions(
		store,
		nil,
		WithManagedLauncher(func(config.ManagedGatewaySettings) (*exec.Cmd, error) {
			cmd := exec.Command(os.Args[0], "-test.run=TestManagedSupervisorHelperProcess", "--", "ignore-interrupt")
			cmd.Env = append(os.Environ(), "GO_WANT_MANAGED_SUPERVISOR_HELPER_PROCESS=1")
			return cmd, nil
		}),
		WithManagedProbe(func(context.Context, config.ManagedGatewaySettings) error { return nil }),
		WithManagedProbeInterval(20*time.Millisecond),
		WithManagedStopTimeout(20*time.Millisecond),
		WithManagedForceKillProcess(func(cmd *exec.Cmd) error {
			if cmd != nil && cmd.Process != nil {
				_ = cmd.Process.Kill()
			}
			return errors.New("kill failed")
		}),
		WithManagedStopWaitFailurePolicy(func(input ManagedStopWaitFailureContext) ManagedStopWaitFailureDecision {
			if input.Stage != "force-kill" || !input.TimedOut {
				t.Fatalf("expected force-kill timedOut context, got %#v", input)
			}
			return ManagedStopWaitFailureDecision{
				Status:       ManagedStatusStopping,
				Health:       ManagedHealthUnknown,
				LastError:    "managed kill failed",
				FailurePhase: "managed-stop-kill-failed",
			}
		}),
	)

	if _, err := supervisor.Start(context.Background()); err != nil {
		t.Fatal(err)
	}
	waitForManagedStatus(t, supervisor, ManagedStatusRunning)
	time.Sleep(100 * time.Millisecond)

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
}

func waitForManagedStatus(t *testing.T, supervisor ManagedRuntimeSupervisor, expected ManagedStatus) {
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

func TestManagedSupervisorHelperProcess(t *testing.T) {
	if os.Getenv("GO_WANT_MANAGED_SUPERVISOR_HELPER_PROCESS") != "1" {
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

func expectManagedEvent(t *testing.T, sub <-chan events.Event, eventType string) {
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
