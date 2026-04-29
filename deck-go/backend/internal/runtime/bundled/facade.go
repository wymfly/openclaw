package bundled

import (
	"context"
	"errors"
	"strconv"
	"strings"

	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/envconf"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
)

type Facade struct {
	cfg        envconf.RuntimeBundledConfig
	supervisor *Supervisor
}

func New(cfg *envconf.RuntimeBundledConfig) (*Facade, error) {
	if cfg == nil {
		return nil, errors.New("bundled runtime config is required")
	}
	return &Facade{cfg: *cfg}, nil
}

func NewWithSupervisor(cfg *envconf.RuntimeBundledConfig, supervisor *Supervisor) (*Facade, error) {
	rt, err := New(cfg)
	if err != nil {
		return nil, err
	}
	rt.supervisor = supervisor
	return rt, nil
}

func (f *Facade) AttachSupervisor(supervisor *Supervisor) {
	if f == nil {
		return
	}
	f.supervisor = supervisor
}

func (f *Facade) Capabilities(context.Context) (facade.Capabilities, error) {
	return facade.Capabilities{
		Mode:            string(envconf.ModeBundled),
		Configured:      strings.TrimSpace(f.cfg.Command) != "",
		EndpointMutable: false,
		SupervisorState: true,
	}, nil
}

func (f *Facade) Endpoint(context.Context) (facade.EndpointView, error) {
	return facade.EndpointView{
		URL:             bundledEndpointURL(f.cfg),
		TokenConfigured: strings.TrimSpace(f.cfg.Token) != "",
		TLSVerify:       false,
		Source:          "env",
	}, nil
}

func (f *Facade) UpdateRemoteEndpoint(context.Context, facade.RemoteEndpointInput) (facade.EndpointView, error) {
	return facade.EndpointView{}, facade.ErrUnsupported
}

func (f *Facade) TestRemoteEndpoint(context.Context, *facade.RemoteEndpointInput) (facade.TestResult, error) {
	return facade.TestResult{}, facade.ErrUnsupported
}

func (f *Facade) RuntimeGatewayStatus(context.Context) (facade.RuntimeStatus, error) {
	status := facade.RuntimeStatus{Mode: string(envconf.ModeBundled)}
	if f.supervisor == nil {
		return status, nil
	}
	snapshot := f.supervisor.Snapshot()
	if snapshot.PID != 0 {
		status.PID = &snapshot.PID
	}
	status.OwnershipState = snapshot.OwnershipState
	status.RestartAttempts = snapshot.RestartAttempts
	return status, nil
}

func (f *Facade) Start(ctx context.Context) (facade.RuntimeStatus, error) {
	if f.supervisor == nil {
		return f.RuntimeGatewayStatus(ctx)
	}
	_, err := f.supervisor.Start(ctx)
	status, statusErr := f.RuntimeGatewayStatus(ctx)
	if err != nil {
		return status, err
	}
	return status, statusErr
}

func (f *Facade) Stop(ctx context.Context) (facade.RuntimeStatus, error) {
	if f.supervisor == nil {
		return f.RuntimeGatewayStatus(ctx)
	}
	_, err := f.supervisor.Stop(ctx)
	status, statusErr := f.RuntimeGatewayStatus(ctx)
	if err != nil {
		return status, err
	}
	return status, statusErr
}

func (f *Facade) Restart(ctx context.Context) (facade.RuntimeStatus, error) {
	if f.supervisor == nil {
		return f.RuntimeGatewayStatus(ctx)
	}
	_, err := f.supervisor.Restart(ctx)
	status, statusErr := f.RuntimeGatewayStatus(ctx)
	if err != nil {
		return status, err
	}
	return status, statusErr
}

func (f *Facade) ReloadRuntime(ctx context.Context) (facade.RuntimeStatus, error) {
	if f.supervisor == nil {
		return f.RuntimeGatewayStatus(ctx)
	}
	_, err := f.supervisor.ForceRespawn(ctx)
	status, statusErr := f.RuntimeGatewayStatus(ctx)
	if err != nil {
		return status, err
	}
	return status, statusErr
}

func bundledEndpointURL(cfg envconf.RuntimeBundledConfig) string {
	host := strings.TrimSpace(cfg.BindHost)
	if host == "" {
		host = "127.0.0.1"
	}
	port := cfg.BindPort
	if port <= 0 {
		port = 18789
	}
	return "ws://" + host + ":" + strconv.Itoa(port)
}

var _ facade.RuntimeFacade = (*Facade)(nil)

func init() {
	facade.RegisterBundledFactory(func(cfg *envconf.RuntimeBundledConfig) (facade.RuntimeFacade, error) {
		return New(cfg)
	})
}
