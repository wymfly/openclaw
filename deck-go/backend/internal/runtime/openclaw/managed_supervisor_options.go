package openclaw

import (
	"context"
	"encoding/json"
	"os/exec"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
	runtimecontrol "github.com/openclaw/openclaw/deck-go/backend/internal/runtime"
)

type ManagedSupervisorOption = runtimecontrol.Option

func NewManagedSupervisorWithOptions(store *config.Store, bus *events.Bus, options ...ManagedSupervisorOption) ManagedRuntimeSupervisor {
	options = append([]ManagedSupervisorOption{
		WithManagedDefaultStartFailurePolicy(),
		WithManagedDefaultStopSignalFailurePolicy(),
		WithManagedDefaultStopNoProcessPolicy(),
		WithManagedDefaultStopWaitFailurePolicy(),
		WithManagedDefaultExitTransitionPolicy(),
		WithManagedProbeTransitionPolicy(),
	}, options...)
	if bus != nil {
		options = append([]ManagedSupervisorOption{
			WithManagedLifecycleNotifier(bus),
		}, options...)
	}
	return runtimecontrol.NewSupervisorWithOptions(store, nil, options...)
}

func WithManagedLauncher(fn func(config.ManagedGatewaySettings) (*exec.Cmd, error)) ManagedSupervisorOption {
	return runtimecontrol.WithLauncher(fn)
}

func WithManagedProcessTerminator(fn func(*exec.Cmd) error) ManagedSupervisorOption {
	return runtimecontrol.WithProcessTerminator(fn)
}

func WithManagedForceKillProcess(fn func(*exec.Cmd) error) ManagedSupervisorOption {
	return runtimecontrol.WithForceKillProcess(fn)
}

func WithManagedProbe(fn func(context.Context, config.ManagedGatewaySettings) error) ManagedSupervisorOption {
	return runtimecontrol.WithProbe(fn)
}

func WithManagedProbeInterval(interval time.Duration) ManagedSupervisorOption {
	return runtimecontrol.WithProbeInterval(interval)
}

func WithManagedStartupTimeout(timeout time.Duration) ManagedSupervisorOption {
	return runtimecontrol.WithStartupTimeout(timeout)
}

func WithManagedStopTimeout(timeout time.Duration) ManagedSupervisorOption {
	return runtimecontrol.WithStopTimeout(timeout)
}

func WithManagedLifecycleNotifier(bus *events.Bus) ManagedSupervisorOption {
	return runtimecontrol.WithLifecycleNotifier(&managedLifecycleNotifier{bus: bus})
}

func WithManagedStartFailurePolicy(fn func(ManagedStartFailureContext) ManagedStartFailureDecision) ManagedSupervisorOption {
	return runtimecontrol.WithStartFailurePolicy(func(input runtimecontrol.StartFailureContext) runtimecontrol.StartFailureDecision {
		return fn(input)
	})
}

func WithManagedDefaultStartFailurePolicy() ManagedSupervisorOption {
	return WithManagedStartFailurePolicy(func(input ManagedStartFailureContext) ManagedStartFailureDecision {
		lastError := ""
		if input.Err != nil {
			lastError = input.Err.Error()
		}
		return ManagedStartFailureDecision{
			Status:       runtimecontrol.StatusFailed,
			Health:       runtimecontrol.HealthUnknown,
			LastError:    lastError,
			FailurePhase: input.Stage,
		}
	})
}

func WithManagedStopSignalFailurePolicy(fn func(ManagedStopSignalFailureContext) ManagedStopSignalFailureDecision) ManagedSupervisorOption {
	return runtimecontrol.WithStopSignalFailurePolicy(func(input runtimecontrol.StopSignalFailureContext) runtimecontrol.StopSignalFailureDecision {
		return fn(input)
	})
}

func WithManagedDefaultStopSignalFailurePolicy() ManagedSupervisorOption {
	return WithManagedStopSignalFailurePolicy(func(ManagedStopSignalFailureContext) ManagedStopSignalFailureDecision {
		return ManagedStopSignalFailureDecision{
			Status:       runtimecontrol.StatusStopping,
			Health:       runtimecontrol.HealthUnknown,
			LastError:    "",
			FailurePhase: "",
		}
	})
}

func WithManagedStopNoProcessPolicy(fn func(ManagedStopNoProcessContext) ManagedStopNoProcessDecision) ManagedSupervisorOption {
	return runtimecontrol.WithStopNoProcessPolicy(func(input runtimecontrol.StopNoProcessContext) runtimecontrol.StopNoProcessDecision {
		return fn(input)
	})
}

func WithManagedDefaultStopNoProcessPolicy() ManagedSupervisorOption {
	return WithManagedStopNoProcessPolicy(func(ManagedStopNoProcessContext) ManagedStopNoProcessDecision {
		return ManagedStopNoProcessDecision{
			Status:            runtimecontrol.StatusStopped,
			Health:            runtimecontrol.HealthUnknown,
			LastError:         "",
			FailurePhase:      "",
			ClearActiveConfig: false,
		}
	})
}

func WithManagedStopWaitFailurePolicy(fn func(ManagedStopWaitFailureContext) ManagedStopWaitFailureDecision) ManagedSupervisorOption {
	return runtimecontrol.WithStopWaitFailurePolicy(func(input runtimecontrol.StopWaitFailureContext) runtimecontrol.StopWaitFailureDecision {
		return fn(input)
	})
}

func WithManagedDefaultStopWaitFailurePolicy() ManagedSupervisorOption {
	return WithManagedStopWaitFailurePolicy(func(ManagedStopWaitFailureContext) ManagedStopWaitFailureDecision {
		return ManagedStopWaitFailureDecision{
			Status:       runtimecontrol.StatusStopping,
			Health:       runtimecontrol.HealthUnknown,
			LastError:    "",
			FailurePhase: "",
		}
	})
}

func WithManagedExitTransitionPolicy(fn func(ManagedExitTransitionContext) ManagedExitTransitionDecision) ManagedSupervisorOption {
	return runtimecontrol.WithExitTransitionPolicy(func(input runtimecontrol.ExitTransitionContext) runtimecontrol.ExitTransitionDecision {
		return fn(input)
	})
}

func WithManagedDefaultExitTransitionPolicy() ManagedSupervisorOption {
	return WithManagedExitTransitionPolicy(func(input ManagedExitTransitionContext) ManagedExitTransitionDecision {
		lastError := ""
		if input.Err != nil {
			lastError = input.Err.Error()
		}
		if input.StopRequested {
			return ManagedExitTransitionDecision{
				Status:            runtimecontrol.StatusStopped,
				Health:            runtimecontrol.HealthUnknown,
				LastError:         "",
				FailurePhase:      "",
				ClearActiveConfig: true,
			}
		}
		return ManagedExitTransitionDecision{
			Status:            runtimecontrol.StatusFailed,
			Health:            runtimecontrol.HealthUnknown,
			LastError:         lastError,
			FailurePhase:      "runtime",
			ClearActiveConfig: false,
		}
	})
}

func WithManagedProbeTransitionPolicy() ManagedSupervisorOption {
	return runtimecontrol.WithProbeTransitionPolicy(func(input runtimecontrol.ProbeTransitionContext) runtimecontrol.ProbeTransitionDecision {
		switch {
		case input.Err == nil:
			return runtimecontrol.ProbeTransitionDecision{
				Status:       runtimecontrol.StatusRunning,
				Health:       runtimecontrol.HealthHealthy,
				LastError:    "",
				FailurePhase: "",
				HealthyOnce:  true,
			}
		case input.HealthyOnce:
			return runtimecontrol.ProbeTransitionDecision{
				Status:       runtimecontrol.StatusDegraded,
				Health:       runtimecontrol.HealthUnhealthy,
				LastError:    input.Err.Error(),
				FailurePhase: "runtime",
				HealthyOnce:  true,
			}
		case !input.StartedAt.IsZero() && input.Now.Sub(input.StartedAt) >= input.StartupTimeout:
			return runtimecontrol.ProbeTransitionDecision{
				Status:       runtimecontrol.StatusFailed,
				Health:       runtimecontrol.HealthUnhealthy,
				LastError:    input.Err.Error(),
				FailurePhase: "runtime",
				HealthyOnce:  false,
			}
		default:
			return runtimecontrol.ProbeTransitionDecision{
				Status:       runtimecontrol.StatusStarting,
				Health:       runtimecontrol.HealthUnhealthy,
				LastError:    input.Err.Error(),
				FailurePhase: "runtime",
				HealthyOnce:  false,
			}
		}
	})
}

type managedLifecycleNotifier struct {
	bus *events.Bus
}

func (n *managedLifecycleNotifier) PublishStatus(snapshot runtimecontrol.Snapshot) {
	n.publish("runtime.gateway.status", snapshot)
}

func (n *managedLifecycleNotifier) PublishHealth(snapshot runtimecontrol.Snapshot) {
	n.publish("runtime.gateway.health", snapshot)
}

func (n *managedLifecycleNotifier) PublishExit(snapshot runtimecontrol.Snapshot) {
	n.publish("runtime.gateway.exit", snapshot)
}

func (n *managedLifecycleNotifier) publish(eventType string, payload any) {
	if n == nil || n.bus == nil {
		return
	}
	raw, _ := json.Marshal(payload)
	n.bus.Publish(eventType, raw)
}
