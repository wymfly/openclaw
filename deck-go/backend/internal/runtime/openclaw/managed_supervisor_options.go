package openclaw

import (
	"context"
	"encoding/json"
	"os/exec"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/bundled"
)

type ManagedSupervisorOption = bundled.Option

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
	return bundled.NewSupervisorWithOptions(store, nil, options...)
}

func WithManagedLauncher(fn func(config.ManagedGatewaySettings) (*exec.Cmd, error)) ManagedSupervisorOption {
	return bundled.WithLauncher(fn)
}

func WithManagedProcessTerminator(fn func(*exec.Cmd) error) ManagedSupervisorOption {
	return bundled.WithProcessTerminator(fn)
}

func WithManagedForceKillProcess(fn func(*exec.Cmd) error) ManagedSupervisorOption {
	return bundled.WithForceKillProcess(fn)
}

func WithManagedProbe(fn func(context.Context, config.ManagedGatewaySettings) error) ManagedSupervisorOption {
	return bundled.WithProbe(fn)
}

func WithManagedGatewayConfig(settings config.ManagedGatewaySettings) ManagedSupervisorOption {
	return bundled.WithManagedGatewayConfig(settings)
}

func WithManagedProbeInterval(interval time.Duration) ManagedSupervisorOption {
	return bundled.WithProbeInterval(interval)
}

func WithManagedStartupTimeout(timeout time.Duration) ManagedSupervisorOption {
	return bundled.WithStartupTimeout(timeout)
}

func WithManagedStopTimeout(timeout time.Duration) ManagedSupervisorOption {
	return bundled.WithStopTimeout(timeout)
}

func WithManagedLifecycleNotifier(bus *events.Bus) ManagedSupervisorOption {
	return bundled.WithLifecycleNotifier(&managedLifecycleNotifier{bus: bus})
}

func WithManagedStartFailurePolicy(fn func(ManagedStartFailureContext) ManagedStartFailureDecision) ManagedSupervisorOption {
	return bundled.WithStartFailurePolicy(func(input bundled.StartFailureContext) bundled.StartFailureDecision {
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
			Status:       bundled.StatusFailed,
			Health:       bundled.HealthUnknown,
			LastError:    lastError,
			FailurePhase: input.Stage,
		}
	})
}

func WithManagedStopSignalFailurePolicy(fn func(ManagedStopSignalFailureContext) ManagedStopSignalFailureDecision) ManagedSupervisorOption {
	return bundled.WithStopSignalFailurePolicy(func(input bundled.StopSignalFailureContext) bundled.StopSignalFailureDecision {
		return fn(input)
	})
}

func WithManagedDefaultStopSignalFailurePolicy() ManagedSupervisorOption {
	return WithManagedStopSignalFailurePolicy(func(ManagedStopSignalFailureContext) ManagedStopSignalFailureDecision {
		return ManagedStopSignalFailureDecision{
			Status:       bundled.StatusStopping,
			Health:       bundled.HealthUnknown,
			LastError:    "",
			FailurePhase: "",
		}
	})
}

func WithManagedStopNoProcessPolicy(fn func(ManagedStopNoProcessContext) ManagedStopNoProcessDecision) ManagedSupervisorOption {
	return bundled.WithStopNoProcessPolicy(func(input bundled.StopNoProcessContext) bundled.StopNoProcessDecision {
		return fn(input)
	})
}

func WithManagedDefaultStopNoProcessPolicy() ManagedSupervisorOption {
	return WithManagedStopNoProcessPolicy(func(ManagedStopNoProcessContext) ManagedStopNoProcessDecision {
		return ManagedStopNoProcessDecision{
			Status:            bundled.StatusStopped,
			Health:            bundled.HealthUnknown,
			LastError:         "",
			FailurePhase:      "",
			ClearActiveConfig: false,
		}
	})
}

func WithManagedStopWaitFailurePolicy(fn func(ManagedStopWaitFailureContext) ManagedStopWaitFailureDecision) ManagedSupervisorOption {
	return bundled.WithStopWaitFailurePolicy(func(input bundled.StopWaitFailureContext) bundled.StopWaitFailureDecision {
		return fn(input)
	})
}

func WithManagedDefaultStopWaitFailurePolicy() ManagedSupervisorOption {
	return WithManagedStopWaitFailurePolicy(func(ManagedStopWaitFailureContext) ManagedStopWaitFailureDecision {
		return ManagedStopWaitFailureDecision{
			Status:       bundled.StatusStopping,
			Health:       bundled.HealthUnknown,
			LastError:    "",
			FailurePhase: "",
		}
	})
}

func WithManagedExitTransitionPolicy(fn func(ManagedExitTransitionContext) ManagedExitTransitionDecision) ManagedSupervisorOption {
	return bundled.WithExitTransitionPolicy(func(input bundled.ExitTransitionContext) bundled.ExitTransitionDecision {
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
				Status:            bundled.StatusStopped,
				Health:            bundled.HealthUnknown,
				LastError:         "",
				FailurePhase:      "",
				ClearActiveConfig: true,
			}
		}
		return ManagedExitTransitionDecision{
			Status:            bundled.StatusFailed,
			Health:            bundled.HealthUnknown,
			LastError:         lastError,
			FailurePhase:      "runtime",
			ClearActiveConfig: false,
		}
	})
}

func WithManagedProbeTransitionPolicy() ManagedSupervisorOption {
	return bundled.WithProbeTransitionPolicy(func(input bundled.ProbeTransitionContext) bundled.ProbeTransitionDecision {
		switch {
		case input.Err == nil:
			return bundled.ProbeTransitionDecision{
				Status:       bundled.StatusRunning,
				Health:       bundled.HealthHealthy,
				LastError:    "",
				FailurePhase: "",
				HealthyOnce:  true,
			}
		case input.HealthyOnce:
			return bundled.ProbeTransitionDecision{
				Status:       bundled.StatusDegraded,
				Health:       bundled.HealthUnhealthy,
				LastError:    input.Err.Error(),
				FailurePhase: "runtime",
				HealthyOnce:  true,
			}
		case !input.StartedAt.IsZero() && input.Now.Sub(input.StartedAt) >= input.StartupTimeout:
			return bundled.ProbeTransitionDecision{
				Status:       bundled.StatusFailed,
				Health:       bundled.HealthUnhealthy,
				LastError:    input.Err.Error(),
				FailurePhase: "runtime",
				HealthyOnce:  false,
			}
		default:
			return bundled.ProbeTransitionDecision{
				Status:       bundled.StatusStarting,
				Health:       bundled.HealthUnhealthy,
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

func (n *managedLifecycleNotifier) PublishStatus(snapshot bundled.Snapshot) {
	n.publish("runtime.gateway.status", snapshot)
}

func (n *managedLifecycleNotifier) PublishHealth(snapshot bundled.Snapshot) {
	n.publish("runtime.gateway.health", snapshot)
}

func (n *managedLifecycleNotifier) PublishExit(snapshot bundled.Snapshot) {
	n.publish("runtime.gateway.exit", snapshot)
}

func (n *managedLifecycleNotifier) publish(eventType string, payload any) {
	if n == nil || n.bus == nil {
		return
	}
	raw, _ := json.Marshal(payload)
	n.bus.Publish(eventType, raw)
}
