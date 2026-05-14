package bundled

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway"
)

type LifecycleState string

const (
	StateRunning      LifecycleState = "running"
	StateStopped      LifecycleState = "stopped"
	StateNotInstalled LifecycleState = "not-installed"
	StateUnhealthy    LifecycleState = "unhealthy"
)

const (
	ErrCodeProbeTimeout         = "probe_timeout"
	ErrCodeProbeRefused         = "probe_refused"
	ErrCodeProbeNonOK           = "probe_non_ok"
	ErrCodeEntrypointPathDrift  = "entrypoint_path_drift"
	ErrCodeServiceNotRegistered = "service_not_registered"
	ErrCodeEntrypointNotFound   = "entrypoint_not_found"
)

var (
	ErrHealthProbeTimeout = errors.New("health probe timeout")
	ErrHealthProbeRefused = errors.New("health probe connection refused")
	ErrHealthProbeNotOK   = errors.New("health probe non-OK response")
)

type ServiceState struct {
	Registered bool
	Active     bool
}

type ServiceQuerier interface {
	Query(ctx context.Context, serviceName string) (ServiceState, error)
}

type HealthClient interface {
	Health(ctx context.Context) error
}

type ProbeInputs struct {
	ServiceName             string
	EntrypointPath          string
	EntrypointExists        bool
	EntrypointDriftDetected bool
}

type LifecycleResult struct {
	LifecycleState LifecycleState
	LastError      string
}

type LifecycleProbe struct {
	Service ServiceQuerier
	Health  HealthClient
}

func (p *LifecycleProbe) Probe(ctx context.Context, in ProbeInputs) (LifecycleResult, error) {
	if !in.EntrypointExists {
		return LifecycleResult{
			LifecycleState: StateNotInstalled,
			LastError:      ErrCodeEntrypointNotFound,
		}, nil
	}
	if p == nil || p.Service == nil {
		return LifecycleResult{
			LifecycleState: StateNotInstalled,
			LastError:      ErrCodeServiceNotRegistered,
		}, nil
	}
	state, err := p.Service.Query(ctx, in.ServiceName)
	if err != nil {
		return LifecycleResult{}, fmt.Errorf("service query failed: %w", err)
	}
	if !state.Registered {
		return LifecycleResult{
			LifecycleState: StateNotInstalled,
			LastError:      ErrCodeServiceNotRegistered,
		}, nil
	}
	if !state.Active {
		return LifecycleResult{LifecycleState: StateStopped}, nil
	}
	if in.EntrypointDriftDetected {
		return LifecycleResult{
			LifecycleState: StateUnhealthy,
			LastError:      ErrCodeEntrypointPathDrift,
		}, nil
	}
	if p.Health == nil {
		return LifecycleResult{
			LifecycleState: StateUnhealthy,
			LastError:      ErrCodeProbeNonOK,
		}, nil
	}
	if err := p.Health.Health(ctx); err != nil {
		return LifecycleResult{
			LifecycleState: StateUnhealthy,
			LastError:      mapHealthError(err),
		}, nil
	}
	return LifecycleResult{LifecycleState: StateRunning}, nil
}

func mapHealthError(err error) string {
	switch {
	case errors.Is(err, ErrHealthProbeTimeout):
		return ErrCodeProbeTimeout
	case errors.Is(err, ErrHealthProbeRefused):
		return ErrCodeProbeRefused
	case errors.Is(err, ErrHealthProbeNotOK):
		return ErrCodeProbeNonOK
	default:
		return ErrCodeProbeNonOK
	}
}

type GatewayHealthClient struct {
	URL   string
	Token string
}

func (c *GatewayHealthClient) Health(ctx context.Context) error {
	if c == nil {
		return ErrHealthProbeNotOK
	}
	if err := gateway.ProbeHealth(ctx, c.URL, c.Token); err != nil {
		return classifyHealthProbeError(err)
	}
	return nil
}

func classifyHealthProbeError(err error) error {
	if err == nil {
		return nil
	}
	lower := strings.ToLower(err.Error())
	switch {
	case strings.Contains(lower, "timeout"), strings.Contains(lower, "deadline exceeded"):
		return fmt.Errorf("%w: %v", ErrHealthProbeTimeout, err)
	case strings.Contains(lower, "connection refused"):
		return fmt.Errorf("%w: %v", ErrHealthProbeRefused, err)
	default:
		return fmt.Errorf("%w: %v", ErrHealthProbeNotOK, err)
	}
}
