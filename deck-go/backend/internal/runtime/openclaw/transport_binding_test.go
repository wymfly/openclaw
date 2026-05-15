package openclaw

import (
	"context"
	"errors"
	"testing"

	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade/testfacade"
)

type stubManagedConnectionProvider struct{}

func (stubManagedConnectionProvider) GatewayConnection() (string, string, bool) {
	return "ws://gateway.example", "token-1", true
}

type stubTransportRequester struct {
	calls   []string
	payload map[string]any
}

func (s *stubTransportRequester) Request(_ context.Context, method string, params map[string]any) (any, error) {
	s.calls = append(s.calls, method)
	if payload, ok := s.payload[method]; ok {
		return payload, nil
	}
	switch method {
	case "health":
		return map[string]any{"ok": true}, nil
	default:
		return nil, errors.New("unexpected method")
	}
}

func (s *stubTransportRequester) RequestTyped(ctx context.Context, method string, params any) (any, error) {
	paramsMap, err := typedParamsToMap(params)
	if err != nil {
		return nil, err
	}
	return s.Request(ctx, method, paramsMap)
}

type stubTransportController struct {
	subscribed   []string
	unsubscribed []string
}

func (s *stubTransportController) SubscribeSession(_ context.Context, key string) error {
	s.subscribed = append(s.subscribed, key)
	return nil
}

func (s *stubTransportController) UnsubscribeSession(_ context.Context, key string) error {
	s.unsubscribed = append(s.unsubscribed, key)
	return nil
}

type stubTransportBinding struct {
	requester        *stubTransportRequester
	controller       *stubTransportController
	probeURL         string
	probeToken       string
	deviceID         string
	providerSeen     ManagedConnectionProvider
	busSeen          *events.Bus
	probeErr         error
	currentIDError   error
	invalidatedURL   string
	invalidatedToken string
}

type transportFacadeRequester struct {
	*testfacade.Stub
	requester *stubTransportRequester
}

func (f transportFacadeRequester) Request(ctx context.Context, method string, params map[string]any) (any, error) {
	return f.requester.Request(ctx, method, params)
}

func (f transportFacadeRequester) RequestTyped(ctx context.Context, method string, params any) (any, error) {
	return f.requester.RequestTyped(ctx, method, params)
}

func (s *stubTransportBinding) NewRequester(provider ManagedConnectionProvider) Requester {
	s.providerSeen = provider
	return s.requester
}

func (s *stubTransportBinding) NewSubscriptionController(provider ManagedConnectionProvider, bus *events.Bus) SessionSubscriptionController {
	s.providerSeen = provider
	s.busSeen = bus
	return s.controller
}

func (s *stubTransportBinding) ProbeHealth(_ context.Context, upstreamURL string, token string) error {
	s.probeURL = upstreamURL
	s.probeToken = token
	return s.probeErr
}

func (s *stubTransportBinding) InvalidateProbeClient(upstreamURL string, token string) {
	s.invalidatedURL = upstreamURL
	s.invalidatedToken = token
}

func (s *stubTransportBinding) CurrentDeviceID() (string, error) {
	return s.deviceID, s.currentIDError
}

func TestNewManagedAdapter_UsesTransportBinding(t *testing.T) {
	previous := transportBinding
	stub := &stubTransportBinding{
		requester:  &stubTransportRequester{},
		controller: &stubTransportController{},
	}
	transportBinding = stub
	t.Cleanup(func() { transportBinding = previous })

	provider := stubManagedConnectionProvider{}
	bus := events.NewBus(8)
	adapter := NewManagedAdapter(provider, bus)

	if stub.providerSeen != provider {
		t.Fatal("expected managed adapter to pass provider through transport binding")
	}
	if stub.busSeen != bus {
		t.Fatal("expected managed adapter to pass realtime bus through transport binding")
	}

	if _, err := adapter.GatewayQueries().Health(context.Background()); err != nil {
		t.Fatalf("expected transport-backed requester to be used: %v", err)
	}
	if len(stub.requester.calls) != 1 || stub.requester.calls[0] != "health" {
		t.Fatalf("unexpected requester calls: %#v", stub.requester.calls)
	}

	if err := adapter.SessionSubscriptions().SubscribeSession(context.Background(), "session-1"); err != nil {
		t.Fatalf("expected transport-backed subscription controller to be used: %v", err)
	}
	if len(stub.controller.subscribed) != 1 || stub.controller.subscribed[0] != "session-1" {
		t.Fatalf("unexpected subscription calls: %#v", stub.controller.subscribed)
	}
}

func TestCurrentDeviceID_UsesTransportBinding(t *testing.T) {
	previous := transportBinding
	stub := &stubTransportBinding{
		requester:  &stubTransportRequester{},
		controller: &stubTransportController{},
		deviceID:   "device-123",
	}
	transportBinding = stub
	t.Cleanup(func() { transportBinding = previous })

	deviceID, err := CurrentDeviceID()
	if err != nil {
		t.Fatalf("expected current device id to use transport binding: %v", err)
	}
	if deviceID != "device-123" {
		t.Fatalf("unexpected device id: %q", deviceID)
	}
}

func TestDeviceTokenRotateInvalidatesOldProbeClient(t *testing.T) {
	previous := transportBinding
	stub := &stubTransportBinding{
		requester: &stubTransportRequester{
			payload: map[string]any{
				"device.token.rotate": map[string]any{"ok": true},
			},
		},
		controller: &stubTransportController{},
	}
	transportBinding = stub
	t.Cleanup(func() { transportBinding = previous })

	runtimeFacade := transportFacadeRequester{
		Stub: testfacade.New(facade.Capabilities{Mode: "local", Configured: true}),
		requester: &stubTransportRequester{
			payload: map[string]any{
				"device.token.rotate": map[string]any{"ok": true},
			},
		},
	}
	runtimeFacade.ConnectionValue = facade.GatewayConnection{
		URL:   "ws://gateway.example",
		Token: "old-token",
	}
	managed := NewManagedRuntimeWithFacade(nil, runtimeFacade, events.NewNoopBus())

	if _, err := managed.DeviceTokenRotate(context.Background(), map[string]any{"deviceId": "device-1"}); err != nil {
		t.Fatal(err)
	}

	if stub.invalidatedURL != "ws://gateway.example" || stub.invalidatedToken != "old-token" {
		t.Fatalf("expected old probe client invalidation, got url=%q token=%q", stub.invalidatedURL, stub.invalidatedToken)
	}
}
