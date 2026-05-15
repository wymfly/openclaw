package openclaw

import (
	"context"
	"testing"

	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
)

func TestResolveGatewayHTTPBaseUsesRuntimeFacadeConnection(t *testing.T) {
	runtime := &ManagedRuntime{
		facade: assetTestFacade{
			connection: facade.GatewayConnection{
				URL:   "ws://127.0.0.1:18901",
				Token: "runtime-token",
			},
		},
	}

	baseURL, token, ok := runtime.resolveGatewayHTTPBase(context.Background())

	if !ok {
		t.Fatal("expected facade connection to resolve")
	}
	if baseURL != "http://127.0.0.1:18901" {
		t.Fatalf("baseURL = %q, want http://127.0.0.1:18901", baseURL)
	}
	if token != "runtime-token" {
		t.Fatalf("token = %q, want runtime-token", token)
	}
}

type assetTestFacade struct {
	connection facade.GatewayConnection
}

func (f assetTestFacade) Capabilities(context.Context) (facade.Capabilities, error) {
	return facade.Capabilities{}, nil
}

func (f assetTestFacade) Endpoint(context.Context) (facade.EndpointView, error) {
	return facade.EndpointView{}, nil
}

func (f assetTestFacade) GatewayConnection(context.Context) (facade.GatewayConnection, error) {
	return f.connection, nil
}

func (f assetTestFacade) UpdateRemoteEndpoint(context.Context, facade.RemoteEndpointInput) (facade.EndpointView, error) {
	return facade.EndpointView{}, facade.ErrUnsupported
}

func (f assetTestFacade) TestRemoteEndpoint(context.Context, *facade.RemoteEndpointInput) (facade.TestResult, error) {
	return facade.TestResult{}, facade.ErrUnsupported
}

func (f assetTestFacade) RuntimeGatewayStatus(context.Context) (facade.RuntimeStatus, error) {
	return facade.RuntimeStatus{}, nil
}

func (f assetTestFacade) Start(context.Context) (facade.RuntimeStatus, error) {
	return facade.RuntimeStatus{}, nil
}

func (f assetTestFacade) Stop(context.Context) (facade.RuntimeStatus, error) {
	return facade.RuntimeStatus{}, nil
}

func (f assetTestFacade) Restart(context.Context) (facade.RuntimeStatus, error) {
	return facade.RuntimeStatus{}, nil
}

func (f assetTestFacade) Install(context.Context) (facade.RuntimeStatus, error) {
	return facade.RuntimeStatus{}, nil
}

func (f assetTestFacade) Reinstall(context.Context) (facade.RuntimeStatus, error) {
	return facade.RuntimeStatus{}, nil
}

func (f assetTestFacade) ReloadRuntime(context.Context) (facade.RuntimeStatus, error) {
	return facade.RuntimeStatus{}, nil
}
