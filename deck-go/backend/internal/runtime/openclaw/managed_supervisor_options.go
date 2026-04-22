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

func WithManagedProbe(fn func(context.Context, config.ManagedGatewaySettings) error) ManagedSupervisorOption {
	return runtimecontrol.WithProbe(fn)
}

func WithManagedProbeInterval(interval time.Duration) ManagedSupervisorOption {
	return runtimecontrol.WithProbeInterval(interval)
}

func WithManagedStartupTimeout(timeout time.Duration) ManagedSupervisorOption {
	return runtimecontrol.WithStartupTimeout(timeout)
}

func WithManagedLifecycleNotifier(bus *events.Bus) ManagedSupervisorOption {
	return runtimecontrol.WithLifecycleNotifier(&managedLifecycleNotifier{bus: bus})
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
