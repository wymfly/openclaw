package testfacade

import (
	"context"

	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
)

type Stub struct {
	CapabilitiesValue facade.Capabilities
	EndpointValue     facade.EndpointView
	StatusValue       facade.RuntimeStatus
	ConnectionValue   facade.GatewayConnection

	RuntimeGatewayStatusFn func(context.Context) (facade.RuntimeStatus, error)
	StartFn                func(context.Context) (facade.RuntimeStatus, error)
	StopFn                 func(context.Context) (facade.RuntimeStatus, error)
	RestartFn              func(context.Context) (facade.RuntimeStatus, error)
	InstallFn              func(context.Context) (facade.RuntimeStatus, error)
	ReinstallFn            func(context.Context) (facade.RuntimeStatus, error)
	ReloadRuntimeFn        func(context.Context) (facade.RuntimeStatus, error)
}

func New(caps facade.Capabilities) *Stub {
	return &Stub{CapabilitiesValue: caps}
}

func (s *Stub) Capabilities(context.Context) (facade.Capabilities, error) {
	return s.CapabilitiesValue, nil
}

func (s *Stub) Endpoint(context.Context) (facade.EndpointView, error) {
	return s.EndpointValue, nil
}

func (s *Stub) GatewayConnection(context.Context) (facade.GatewayConnection, error) {
	return s.ConnectionValue, nil
}

func (s *Stub) UpdateRemoteEndpoint(context.Context, facade.RemoteEndpointInput) (facade.EndpointView, error) {
	return facade.EndpointView{}, facade.ErrUnsupported
}

func (s *Stub) TestRemoteEndpoint(context.Context, *facade.RemoteEndpointInput) (facade.TestResult, error) {
	return facade.TestResult{}, facade.ErrUnsupported
}

func (s *Stub) RuntimeGatewayStatus(ctx context.Context) (facade.RuntimeStatus, error) {
	if s.RuntimeGatewayStatusFn != nil {
		return s.RuntimeGatewayStatusFn(ctx)
	}
	return s.StatusValue, nil
}

func (s *Stub) Start(ctx context.Context) (facade.RuntimeStatus, error) {
	if s.StartFn != nil {
		return s.StartFn(ctx)
	}
	return s.StatusValue, nil
}

func (s *Stub) Stop(ctx context.Context) (facade.RuntimeStatus, error) {
	if s.StopFn != nil {
		return s.StopFn(ctx)
	}
	return s.StatusValue, nil
}

func (s *Stub) Restart(ctx context.Context) (facade.RuntimeStatus, error) {
	if s.RestartFn != nil {
		return s.RestartFn(ctx)
	}
	return s.StatusValue, nil
}

func (s *Stub) Install(ctx context.Context) (facade.RuntimeStatus, error) {
	if s.InstallFn != nil {
		return s.InstallFn(ctx)
	}
	return s.StatusValue, facade.ErrUnsupported
}

func (s *Stub) Reinstall(ctx context.Context) (facade.RuntimeStatus, error) {
	if s.ReinstallFn != nil {
		return s.ReinstallFn(ctx)
	}
	return s.StatusValue, facade.ErrUnsupported
}

func (s *Stub) ReloadRuntime(ctx context.Context) (facade.RuntimeStatus, error) {
	if s.ReloadRuntimeFn != nil {
		return s.ReloadRuntimeFn(ctx)
	}
	return s.Restart(ctx)
}
