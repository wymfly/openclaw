package facade

import (
	"context"
	"errors"
	"testing"
)

func TestSentinelErrorsAreStable(t *testing.T) {
	if !errors.Is(ErrUnsupported, ErrUnsupported) {
		t.Fatal("ErrUnsupported must be usable with errors.Is")
	}
	if !errors.Is(ErrNotConfigured, ErrNotConfigured) {
		t.Fatal("ErrNotConfigured must be usable with errors.Is")
	}
}

func TestCodedErrorsExposeStableCodes(t *testing.T) {
	err := NewCodedError(CodeInvalidURL, "invalid url", 400)
	code, status, ok := CodedErrorInfo(err)
	if !ok {
		t.Fatalf("CodedErrorInfo() did not recognize %T", err)
	}
	if code != CodeInvalidURL || status != 400 {
		t.Fatalf("code/status = %q/%d", code, status)
	}
}

func TestCapabilitiesShape(t *testing.T) {
	caps := Capabilities{
		Mode:            "remote",
		Configured:      false,
		EndpointMutable: true,
		SupervisorState: false,
	}
	if caps.Mode != "remote" || caps.Configured || !caps.EndpointMutable || caps.SupervisorState {
		t.Fatalf("unexpected capabilities: %#v", caps)
	}
}

func TestRuntimeFacadeRequiresInstallAndReinstall(t *testing.T) {
	var _ RuntimeFacade = minimalFacade{}
	_ = (RuntimeFacade)(minimalFacade{}).GatewayConnection
	_ = (RuntimeFacade)(minimalFacade{}).Install
	_ = (RuntimeFacade)(minimalFacade{}).Reinstall
}

func TestRuntimeStatusHasLifecycleFields(t *testing.T) {
	status := RuntimeStatus{
		LifecycleState: "running",
		ServiceName:    "openclaw-gateway.abc123def456",
		EntrypointPath: "/abs/repo/dist/entry.js",
	}
	if status.LifecycleState != "running" || status.ServiceName == "" || status.EntrypointPath == "" {
		t.Fatalf("expected lifecycle fields to round-trip, got %#v", status)
	}
}

type minimalFacade struct{}

func (minimalFacade) Capabilities(context.Context) (Capabilities, error) { return Capabilities{}, nil }
func (minimalFacade) Endpoint(context.Context) (EndpointView, error)     { return EndpointView{}, nil }
func (minimalFacade) GatewayConnection(context.Context) (GatewayConnection, error) {
	return GatewayConnection{}, nil
}
func (minimalFacade) UpdateRemoteEndpoint(context.Context, RemoteEndpointInput) (EndpointView, error) {
	return EndpointView{}, ErrUnsupported
}
func (minimalFacade) TestRemoteEndpoint(context.Context, *RemoteEndpointInput) (TestResult, error) {
	return TestResult{}, ErrUnsupported
}
func (minimalFacade) RuntimeGatewayStatus(context.Context) (RuntimeStatus, error) {
	return RuntimeStatus{}, nil
}
func (minimalFacade) Start(context.Context) (RuntimeStatus, error) {
	return RuntimeStatus{}, nil
}
func (minimalFacade) Stop(context.Context) (RuntimeStatus, error) {
	return RuntimeStatus{}, nil
}
func (minimalFacade) Restart(context.Context) (RuntimeStatus, error) {
	return RuntimeStatus{}, nil
}
func (minimalFacade) Install(context.Context) (RuntimeStatus, error) {
	return RuntimeStatus{}, nil
}
func (minimalFacade) Reinstall(context.Context) (RuntimeStatus, error) {
	return RuntimeStatus{}, nil
}
func (minimalFacade) ReloadRuntime(context.Context) (RuntimeStatus, error) {
	return RuntimeStatus{}, nil
}
