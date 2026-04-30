package remote

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/envconf"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
	runtimestate "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/state"
)

func TestCapabilitiesReflectFirstRunAndConfiguredRemote(t *testing.T) {
	store := runtimestate.Open(filepath.Join(t.TempDir(), "deck-state.json"))
	rt := New(envconf.RuntimeRemoteDefaults{}, store)

	caps, err := rt.Capabilities(context.Background())
	if err != nil {
		t.Fatalf("Capabilities() error = %v", err)
	}
	if caps.Mode != "remote" || caps.Configured || !caps.EndpointMutable || caps.SupervisorState {
		t.Fatalf("first-run capabilities = %#v", caps)
	}

	if err := store.WriteRemote(runtimestate.RemoteEndpoint{URL: "https://gateway.example.test", Token: "token", TLSVerify: true}); err != nil {
		t.Fatal(err)
	}
	rt.newClient = func(runtimestate.RemoteEndpoint) gatewayClient {
		return &stubGatewayClient{payload: map[string]any{"version": "mock-gateway"}}
	}
	caps, err = rt.Capabilities(context.Background())
	if err != nil {
		t.Fatalf("Capabilities() error = %v", err)
	}
	if !caps.Configured {
		t.Fatalf("configured capabilities = %#v", caps)
	}
}

func TestRemoteLifecycleMethodsUnsupportedInSkeleton(t *testing.T) {
	rt := New(envconf.RuntimeRemoteDefaults{}, runtimestate.Open(filepath.Join(t.TempDir(), "deck-state.json")))
	if _, err := rt.Start(context.Background()); !errors.Is(err, facade.ErrUnsupported) {
		t.Fatalf("Start() error = %v, want ErrUnsupported", err)
	}
}

func TestRuntimeGatewayStatusUsesRemoteFieldShape(t *testing.T) {
	store := runtimestate.Open(filepath.Join(t.TempDir(), "deck-state.json"))
	if err := store.WriteRemote(runtimestate.RemoteEndpoint{URL: "https://gateway.example.test", Token: "token-1", TLSVerify: false}); err != nil {
		t.Fatal(err)
	}
	rt := New(envconf.RuntimeRemoteDefaults{}, store)

	status, err := rt.RuntimeGatewayStatus(context.Background())
	if err != nil {
		t.Fatalf("RuntimeGatewayStatus() error = %v", err)
	}
	if status.Mode != "remote" || status.PID != nil {
		t.Fatalf("unexpected status shape: %#v", status)
	}
	if status.LastConnectedAt == nil || status.LastError == nil || status.LatencyP50 == nil || status.TLSVerified == nil {
		t.Fatalf("remote status omitted remote fields: %#v", status)
	}
	if *status.TLSVerified {
		t.Fatalf("TLSVerified = true, want false from endpoint config")
	}
}

func TestUpdateRemoteEndpointPersistsCompleteEndpoint(t *testing.T) {
	store := runtimestate.Open(filepath.Join(t.TempDir(), "deck-state.json"))
	rt := New(envconf.RuntimeRemoteDefaults{}, store)
	rt.newClient = func(runtimestate.RemoteEndpoint) gatewayClient {
		return &stubGatewayClient{payload: map[string]any{"version": "mock-gateway"}}
	}

	view, err := rt.UpdateRemoteEndpoint(context.Background(), facade.RemoteEndpointInput{
		URL:       "https://gateway.example.test",
		Token:     "token-1",
		TLSVerify: false,
	})
	if err != nil {
		t.Fatalf("UpdateRemoteEndpoint() error = %v", err)
	}
	if view.URL != "https://gateway.example.test" || !view.TokenConfigured || view.TLSVerify || view.Source != "json" {
		t.Fatalf("unexpected endpoint view: %#v", view)
	}
	state, err := store.Read()
	if err != nil {
		t.Fatal(err)
	}
	if state.Remote == nil || state.Remote.URL != "https://gateway.example.test" || state.Remote.Token != "token-1" || state.Remote.TLSVerify {
		t.Fatalf("unexpected persisted state: %#v", state.Remote)
	}
}

func TestUpdateRemoteEndpointRejectsInvalidURL(t *testing.T) {
	rt := New(envconf.RuntimeRemoteDefaults{}, runtimestate.Open(filepath.Join(t.TempDir(), "deck-state.json")))
	_, err := rt.UpdateRemoteEndpoint(context.Background(), facade.RemoteEndpointInput{
		URL:       "file:///tmp/gateway.sock",
		Token:     "token-1",
		TLSVerify: true,
	})
	if err == nil {
		t.Fatal("UpdateRemoteEndpoint() error = nil")
	}
	code, _, ok := facade.CodedErrorInfo(err)
	if !ok || code != facade.CodeInvalidURL {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestUpdateRemoteEndpointPositiveSentinelPreservesActiveToken(t *testing.T) {
	store := runtimestate.Open(filepath.Join(t.TempDir(), "deck-state.json"))
	if err := store.WriteRemote(runtimestate.RemoteEndpoint{URL: "https://old.example.test", Token: "token-1", TLSVerify: true}); err != nil {
		t.Fatal(err)
	}
	rt := New(envconf.RuntimeRemoteDefaults{}, store)
	rt.newClient = func(runtimestate.RemoteEndpoint) gatewayClient {
		return &stubGatewayClient{payload: map[string]any{"version": "mock-gateway"}}
	}

	view, err := rt.UpdateRemoteEndpoint(context.Background(), facade.RemoteEndpointInput{
		URL:       "https://new.example.test",
		Token:     "__unchanged__",
		TLSVerify: true,
	})
	if err != nil {
		t.Fatalf("UpdateRemoteEndpoint() error = %v", err)
	}
	if !view.TokenConfigured {
		t.Fatalf("expected preserved token to stay configured: %#v", view)
	}
	state, err := store.Read()
	if err != nil {
		t.Fatal(err)
	}
	if state.Remote == nil || state.Remote.Token != "token-1" {
		t.Fatalf("sentinel did not preserve active token: %#v", state.Remote)
	}
}

func TestUpdateRemoteEndpointSentinelCaseMismatchIsRealToken(t *testing.T) {
	assertSentinelVariantIsRealToken(t, "__UNCHANGED__")
}

func TestUpdateRemoteEndpointSentinelWhitespacePaddingIsRealToken(t *testing.T) {
	assertSentinelVariantIsRealToken(t, " __unchanged__ ")
}

func TestUpdateRemoteEndpointSentinelLengthVariantIsRealToken(t *testing.T) {
	assertSentinelVariantIsRealToken(t, "__unchanged_")
}

func TestUpdateRemoteEndpointEmptyTokenRejectedAndStateUnchanged(t *testing.T) {
	store := runtimestate.Open(filepath.Join(t.TempDir(), "deck-state.json"))
	if err := store.WriteRemote(runtimestate.RemoteEndpoint{URL: "https://old.example.test", Token: "token-1", TLSVerify: true}); err != nil {
		t.Fatal(err)
	}
	rt := New(envconf.RuntimeRemoteDefaults{}, store)
	_, err := rt.UpdateRemoteEndpoint(context.Background(), facade.RemoteEndpointInput{
		URL:       "https://new.example.test",
		Token:     "",
		TLSVerify: true,
	})
	if err == nil {
		t.Fatal("UpdateRemoteEndpoint() error = nil")
	}
	code, _, ok := facade.CodedErrorInfo(err)
	if !ok || code != facade.CodeTokenRequired {
		t.Fatalf("unexpected error: %v", err)
	}
	state, err := store.Read()
	if err != nil {
		t.Fatal(err)
	}
	if state.Remote == nil || state.Remote.Token != "token-1" || state.Remote.URL != "https://old.example.test" {
		t.Fatalf("empty-token rejection mutated state: %#v", state.Remote)
	}
}

func assertSentinelVariantIsRealToken(t *testing.T, token string) {
	t.Helper()
	store := runtimestate.Open(filepath.Join(t.TempDir(), "deck-state.json"))
	if err := store.WriteRemote(runtimestate.RemoteEndpoint{URL: "https://old.example.test", Token: "token-1", TLSVerify: true}); err != nil {
		t.Fatal(err)
	}
	rt := New(envconf.RuntimeRemoteDefaults{}, store)
	rt.newClient = func(runtimestate.RemoteEndpoint) gatewayClient {
		return &stubGatewayClient{payload: map[string]any{"version": "mock-gateway"}}
	}
	_, err := rt.UpdateRemoteEndpoint(context.Background(), facade.RemoteEndpointInput{
		URL:       "https://new.example.test",
		Token:     token,
		TLSVerify: true,
	})
	if err != nil {
		t.Fatalf("UpdateRemoteEndpoint() error = %v", err)
	}
	state, err := store.Read()
	if err != nil {
		t.Fatal(err)
	}
	if state.Remote == nil || state.Remote.Token != token {
		t.Fatalf("sentinel variant %q was not stored as a real token: %#v", token, state.Remote)
	}
}

func TestUpdateRemoteEndpointPhaseAFailureLeavesStateAndActiveClientUntouched(t *testing.T) {
	store := runtimestate.Open(filepath.Join(t.TempDir(), "deck-state.json"))
	if err := store.WriteRemote(runtimestate.RemoteEndpoint{URL: "https://old.example.test", Token: "old-token", TLSVerify: true}); err != nil {
		t.Fatal(err)
	}
	oldClient := &stubGatewayClient{payload: map[string]any{"version": "old"}}
	candidate := &stubGatewayClient{err: errors.New("dial tcp 127.0.0.1:1: connect: connection refused")}
	rt := New(envconf.RuntimeRemoteDefaults{}, store)
	rt.active = oldClient
	rt.connState.markConnected()
	rt.newClient = func(runtimestate.RemoteEndpoint) gatewayClient { return candidate }

	_, err := rt.UpdateRemoteEndpoint(context.Background(), facade.RemoteEndpointInput{
		URL:       "https://new.example.test",
		Token:     "new-token",
		TLSVerify: true,
	})
	if err == nil {
		t.Fatal("UpdateRemoteEndpoint() error = nil")
	}
	code, _, ok := facade.CodedErrorInfo(err)
	if !ok || code != facade.CodeGatewayUnreachable {
		t.Fatalf("unexpected error: %v", err)
	}
	state, err := store.Read()
	if err != nil {
		t.Fatal(err)
	}
	if state.Remote == nil || state.Remote.URL != "https://old.example.test" || state.Remote.Token != "old-token" {
		t.Fatalf("Phase A failure mutated state: %#v", state.Remote)
	}
	if !candidate.closed() {
		t.Fatal("Phase A failure did not close candidate client")
	}
	if oldClient.closed() {
		t.Fatal("Phase A failure closed active client")
	}
	rt.mu.RLock()
	active := rt.active
	rt.mu.RUnlock()
	if active != oldClient {
		t.Fatalf("Phase A failure swapped active client: %#v", active)
	}
	snapshot := rt.connState.Snapshot()
	if snapshot.Status != RemoteConnectionConnected || snapshot.LastError != "" {
		t.Fatalf("Phase A failure polluted active connection state: %#v", snapshot)
	}
}

func TestUpdateRemoteEndpointPhaseBPersistsSwapsAndDrainsOldClient(t *testing.T) {
	store := runtimestate.Open(filepath.Join(t.TempDir(), "deck-state.json"))
	if err := store.WriteRemote(runtimestate.RemoteEndpoint{URL: "https://old.example.test", Token: "old-token", TLSVerify: true}); err != nil {
		t.Fatal(err)
	}
	oldClient := &stubGatewayClient{payload: map[string]any{"version": "old"}}
	candidate := &stubGatewayClient{payload: map[string]any{"version": "new"}}
	terminalCalled := false
	var terminalEventName string
	var terminalStreamID string
	rt := New(envconf.RuntimeRemoteDefaults{}, store)
	rt.active = oldClient
	rt.newClient = func(runtimestate.RemoteEndpoint) gatewayClient { return candidate }
	rt.drainTimeout = 0
	rt.terminateStream = func(eventName string, streamID string) {
		terminalCalled = true
		terminalEventName = eventName
		terminalStreamID = streamID
	}

	view, err := rt.UpdateRemoteEndpoint(context.Background(), facade.RemoteEndpointInput{
		URL:       "https://new.example.test",
		Token:     "new-token",
		TLSVerify: false,
	})
	if err != nil {
		t.Fatalf("UpdateRemoteEndpoint() error = %v", err)
	}
	if view.URL != "https://new.example.test" || view.Source != "json" || !view.TokenConfigured || view.TLSVerify {
		t.Fatalf("unexpected view: %#v", view)
	}
	state, err := store.Read()
	if err != nil {
		t.Fatal(err)
	}
	if state.Remote == nil || state.Remote.URL != "https://new.example.test" || state.Remote.Token != "new-token" || state.Remote.TLSVerify {
		t.Fatalf("Phase B did not persist new endpoint: %#v", state.Remote)
	}
	rt.mu.RLock()
	active := rt.active
	rt.mu.RUnlock()
	if active != candidate {
		t.Fatalf("Phase B active client = %#v, want candidate", active)
	}
	snapshot := rt.connState.Snapshot()
	if snapshot.Status != RemoteConnectionConnected || snapshot.LastConnectedAt == nil || snapshot.LastError != "" {
		t.Fatalf("Phase B did not mark connection state connected: %#v", snapshot)
	}
	if !oldClient.closed() {
		t.Fatal("Phase B did not drain-close old client")
	}
	if !terminalCalled {
		t.Fatal("Phase B did not emit endpoint_switched terminal event")
	}
	if terminalEventName != facade.StreamEventEndpointSwitched {
		t.Fatalf("terminal event = %q, want endpoint_switched", terminalEventName)
	}
	if terminalStreamID != "" {
		t.Fatalf("terminal callback stream id = %q, want broadcast blank id", terminalStreamID)
	}
}

func TestUpdateRemoteEndpointInFlightRPCUsesOldClientAndNewRPCUsesSwappedClient(t *testing.T) {
	store := runtimestate.Open(filepath.Join(t.TempDir(), "deck-state.json"))
	if err := store.WriteRemote(runtimestate.RemoteEndpoint{URL: "https://old.example.test", Token: "old-token", TLSVerify: true}); err != nil {
		t.Fatal(err)
	}
	started := make(chan string, 1)
	release := make(chan struct{})
	oldClient := &stubGatewayClient{
		payload: map[string]any{"version": "old"},
		started: started,
		release: release,
	}
	candidate := &stubGatewayClient{payload: map[string]any{"version": "new"}}
	rt := New(envconf.RuntimeRemoteDefaults{}, store)
	rt.active = oldClient
	rt.newClient = func(runtimestate.RemoteEndpoint) gatewayClient { return candidate }
	rt.drainTimeout = 0

	resultCh := make(chan any, 1)
	errCh := make(chan error, 1)
	go func() {
		payload, err := rt.request(context.Background(), "gateway.describe", map[string]any{})
		if err != nil {
			errCh <- err
			return
		}
		resultCh <- payload
	}()

	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("old client request did not start")
	}

	if _, err := rt.UpdateRemoteEndpoint(context.Background(), facade.RemoteEndpointInput{
		URL:       "https://new.example.test",
		Token:     "new-token",
		TLSVerify: true,
	}); err != nil {
		t.Fatalf("UpdateRemoteEndpoint() error = %v", err)
	}
	close(release)

	select {
	case err := <-errCh:
		t.Fatalf("in-flight old request errored after endpoint switch: %v", err)
	case payload := <-resultCh:
		result, ok := payload.(map[string]any)
		if !ok || result["version"] != "old" {
			t.Fatalf("in-flight payload = %#v, want old client", payload)
		}
	case <-time.After(time.Second):
		t.Fatal("in-flight old request did not complete")
	}

	payload, err := rt.request(context.Background(), "gateway.describe", map[string]any{})
	if err != nil {
		t.Fatalf("new request error = %v", err)
	}
	result, ok := payload.(map[string]any)
	if !ok || result["version"] != "new" {
		t.Fatalf("new request payload = %#v, want new client", payload)
	}
}

func TestUpdateRemoteEndpointInFlightRPCTimeoutReturnsEndpointSwitching(t *testing.T) {
	store := runtimestate.Open(filepath.Join(t.TempDir(), "deck-state.json"))
	if err := store.WriteRemote(runtimestate.RemoteEndpoint{URL: "https://old.example.test", Token: "old-token", TLSVerify: true}); err != nil {
		t.Fatal(err)
	}
	oldClient := newBlockingGatewayClient(map[string]any{"version": "old"})
	candidate := &stubGatewayClient{payload: map[string]any{"version": "new"}}
	rt := New(envconf.RuntimeRemoteDefaults{}, store)
	rt.active = oldClient
	rt.newClient = func(runtimestate.RemoteEndpoint) gatewayClient { return candidate }
	rt.drainTimeout = 10 * time.Millisecond

	errCh := make(chan error, 1)
	go func() {
		_, err := rt.request(context.Background(), "gateway.describe", map[string]any{})
		errCh <- err
	}()

	select {
	case <-oldClient.started:
	case <-time.After(time.Second):
		t.Fatal("old client request did not start")
	}

	if _, err := rt.UpdateRemoteEndpoint(context.Background(), facade.RemoteEndpointInput{
		URL:       "https://new.example.test",
		Token:     "new-token",
		TLSVerify: true,
	}); err != nil {
		t.Fatalf("UpdateRemoteEndpoint() error = %v", err)
	}

	select {
	case err := <-errCh:
		code, status, ok := facade.CodedErrorInfo(err)
		if !ok || code != facade.CodeEndpointSwitching || status != http.StatusServiceUnavailable {
			t.Fatalf("in-flight timeout error = %v code=%q status=%d ok=%v", err, code, status, ok)
		}
	case <-time.After(time.Second):
		t.Fatal("in-flight old request did not return endpoint_switching")
	}
}

func TestReloadRuntimeReconnectsActiveEndpointAndEmitsReconnectRequested(t *testing.T) {
	store := runtimestate.Open(filepath.Join(t.TempDir(), "deck-state.json"))
	if err := store.WriteRemote(runtimestate.RemoteEndpoint{URL: "https://remote.example.test", Token: "token-1", TLSVerify: true}); err != nil {
		t.Fatal(err)
	}
	oldClient := &stubGatewayClient{payload: map[string]any{"version": "old"}}
	nextClient := &stubGatewayClient{payload: map[string]any{"version": "new"}}
	terminalCalled := false
	var terminalEventName string
	rt := New(envconf.RuntimeRemoteDefaults{}, store)
	rt.active = oldClient
	rt.newClient = func(endpoint runtimestate.RemoteEndpoint) gatewayClient {
		if endpoint.URL != "https://remote.example.test" || endpoint.Token != "token-1" {
			t.Fatalf("ReloadRuntime used endpoint %#v", endpoint)
		}
		return nextClient
	}
	rt.drainTimeout = 0
	rt.terminateStream = func(eventName string, streamID string) {
		terminalCalled = true
		terminalEventName = eventName
		if streamID != "" {
			t.Fatalf("terminal callback stream id = %q, want broadcast blank id", streamID)
		}
	}

	status, err := rt.ReloadRuntime(context.Background())
	if err != nil {
		t.Fatalf("ReloadRuntime() error = %v", err)
	}
	if status.Mode != "remote" || status.LastConnectedAt == nil {
		t.Fatalf("unexpected reload status: %#v", status)
	}
	if !terminalCalled {
		t.Fatal("ReloadRuntime did not emit reconnect_requested terminal event")
	}
	if terminalEventName != facade.StreamEventReconnectRequested {
		t.Fatalf("terminal event = %q, want reconnect_requested", terminalEventName)
	}
	if !oldClient.closed() {
		t.Fatal("ReloadRuntime did not drain-close old client")
	}
	rt.mu.RLock()
	active := rt.active
	rt.mu.RUnlock()
	if active != nextClient {
		t.Fatalf("active client = %#v, want reconnect client", active)
	}
}

func TestGatewayDescribeErrorMapping(t *testing.T) {
	for _, tc := range []struct {
		name   string
		err    error
		code   string
		status int
	}{
		{name: "unreachable", err: errors.New("dial tcp 127.0.0.1:1: connect: connection refused"), code: facade.CodeGatewayUnreachable, status: http.StatusBadGateway},
		{name: "auth", err: errors.New("unauthorized: invalid token"), code: facade.CodeGatewayAuthFailed, status: http.StatusUnauthorized},
		{name: "tls", err: errors.New("tls: failed to verify certificate: x509: certificate signed by unknown authority"), code: facade.CodeTLSVerificationFailed, status: http.StatusBadGateway},
	} {
		t.Run(tc.name, func(t *testing.T) {
			coded := gatewayDescribeError(tc.err)
			code, status, ok := facade.CodedErrorInfo(coded)
			if !ok || code != tc.code || status != tc.status {
				t.Fatalf("gatewayDescribeError(%v) = code=%q status=%d ok=%v", tc.err, code, status, ok)
			}
		})
	}
}

func TestTestRemoteEndpointUsesCandidateWithoutMutatingState(t *testing.T) {
	gateway := newRemoteGatewayDescribeServer(t, "candidate-token")
	defer gateway.Close()
	store := runtimestate.Open(filepath.Join(t.TempDir(), "deck-state.json"))
	if err := store.WriteRemote(runtimestate.RemoteEndpoint{URL: "https://old.example.test", Token: "old-token", TLSVerify: true}); err != nil {
		t.Fatal(err)
	}
	rt := New(envconf.RuntimeRemoteDefaults{}, store)

	result, err := rt.TestRemoteEndpoint(context.Background(), &facade.RemoteEndpointInput{
		URL:       gateway.URL,
		Token:     "candidate-token",
		TLSVerify: true,
	})
	if err != nil {
		t.Fatalf("TestRemoteEndpoint() error = %v", err)
	}
	if !result.OK || result.GatewayVersion != "mock-gateway" || !result.TLSVerified || result.LatencyMs <= 0 {
		t.Fatalf("unexpected test result: %#v", result)
	}
	state, err := store.Read()
	if err != nil {
		t.Fatal(err)
	}
	if state.Remote == nil || state.Remote.URL != "https://old.example.test" || state.Remote.Token != "old-token" {
		t.Fatalf("TestRemoteEndpoint mutated state: %#v", state.Remote)
	}
}

func TestTestRemoteEndpointSentinelUsesActiveTokenAndClosesCandidate(t *testing.T) {
	store := runtimestate.Open(filepath.Join(t.TempDir(), "deck-state.json"))
	if err := store.WriteRemote(runtimestate.RemoteEndpoint{URL: "https://old.example.test", Token: "active-token", TLSVerify: true}); err != nil {
		t.Fatal(err)
	}
	candidate := &stubGatewayClient{payload: map[string]any{"version": "mock-gateway"}}
	var captured runtimestate.RemoteEndpoint
	rt := New(envconf.RuntimeRemoteDefaults{}, store)
	rt.newClient = func(endpoint runtimestate.RemoteEndpoint) gatewayClient {
		captured = endpoint
		return candidate
	}

	result, err := rt.TestRemoteEndpoint(context.Background(), &facade.RemoteEndpointInput{
		URL:       "https://new.example.test",
		Token:     "__unchanged__",
		TLSVerify: false,
	})
	if err != nil {
		t.Fatalf("TestRemoteEndpoint() error = %v", err)
	}
	if !result.OK {
		t.Fatalf("unexpected test result: %#v", result)
	}
	if captured.URL != "https://new.example.test" || captured.Token != "active-token" || captured.TLSVerify {
		t.Fatalf("sentinel test endpoint captured %#v", captured)
	}
	if !candidate.closed() {
		t.Fatal("TestRemoteEndpoint did not close successful candidate client")
	}
}

func TestTestRemoteEndpointClosesCandidateOnRequestError(t *testing.T) {
	store := runtimestate.Open(filepath.Join(t.TempDir(), "deck-state.json"))
	candidate := &stubGatewayClient{err: errors.New("unauthorized: invalid token")}
	rt := New(envconf.RuntimeRemoteDefaults{}, store)
	rt.newClient = func(runtimestate.RemoteEndpoint) gatewayClient { return candidate }

	result, err := rt.TestRemoteEndpoint(context.Background(), &facade.RemoteEndpointInput{
		URL:       "https://new.example.test",
		Token:     "candidate-token",
		TLSVerify: true,
	})
	if err != nil {
		t.Fatalf("TestRemoteEndpoint() error = %v", err)
	}
	if result.OK || result.Error == "" {
		t.Fatalf("unexpected request-error test result: %#v", result)
	}
	if !candidate.closed() {
		t.Fatal("TestRemoteEndpoint did not close failed candidate client")
	}
}

func TestTestRemoteEndpointNilCandidateReturnsFailedResult(t *testing.T) {
	rt := New(envconf.RuntimeRemoteDefaults{}, runtimestate.Open(filepath.Join(t.TempDir(), "deck-state.json")))
	rt.newClient = func(runtimestate.RemoteEndpoint) gatewayClient { return nil }

	result, err := rt.TestRemoteEndpoint(context.Background(), &facade.RemoteEndpointInput{
		URL:       "https://new.example.test",
		Token:     "candidate-token",
		TLSVerify: true,
	})
	if err != nil {
		t.Fatalf("TestRemoteEndpoint() error = %v", err)
	}
	if result.OK || result.Error != "remote gateway client is not configured" || !result.TLSVerified {
		t.Fatalf("unexpected nil-candidate result: %#v", result)
	}
}

func TestTestRemoteEndpointEmptyCandidateUsesActiveConfig(t *testing.T) {
	gateway := newRemoteGatewayDescribeServer(t, "active-token")
	defer gateway.Close()
	store := runtimestate.Open(filepath.Join(t.TempDir(), "deck-state.json"))
	if err := store.WriteRemote(runtimestate.RemoteEndpoint{URL: gateway.URL, Token: "active-token", TLSVerify: true}); err != nil {
		t.Fatal(err)
	}
	rt := New(envconf.RuntimeRemoteDefaults{}, store)

	result, err := rt.TestRemoteEndpoint(context.Background(), nil)
	if err != nil {
		t.Fatalf("TestRemoteEndpoint() error = %v", err)
	}
	if !result.OK || result.GatewayVersion != "mock-gateway" {
		t.Fatalf("unexpected active test result: %#v", result)
	}
}

func newRemoteGatewayDescribeServer(t *testing.T, wantToken string) *httptest.Server {
	t.Helper()
	upgrader := websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }}
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("upgrade: %v", err)
			return
		}
		defer conn.Close()
		if err := conn.WriteJSON(map[string]any{
			"type":    "event",
			"event":   "connect.challenge",
			"payload": map[string]any{"nonce": "nonce-1"},
		}); err != nil {
			t.Errorf("challenge: %v", err)
			return
		}
		for {
			_, raw, err := conn.ReadMessage()
			if err != nil {
				t.Errorf("read: %v", err)
				return
			}
			var frame map[string]any
			if err := json.Unmarshal(raw, &frame); err != nil {
				t.Errorf("frame decode: %v", err)
				return
			}
			if frame["type"] == "req" && frame["method"] == "connect" {
				params, _ := frame["params"].(map[string]any)
				auth, _ := params["auth"].(map[string]any)
				if auth["token"] != wantToken {
					t.Errorf("token = %#v, want %q", auth["token"], wantToken)
				}
				id, _ := frame["id"].(string)
				if err := conn.WriteJSON(map[string]any{
					"type":    "res",
					"id":      id,
					"payload": map[string]any{"ok": true},
				}); err != nil {
					t.Errorf("connect response: %v", err)
					return
				}
				continue
			}
			if frame["type"] != "req" {
				continue
			}
			if frame["method"] != "gateway.describe" {
				t.Errorf("method = %#v, want gateway.describe", frame["method"])
			}
			id, _ := frame["id"].(string)
			if err := conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      id,
				"payload": map[string]any{"version": "mock-gateway"},
			}); err != nil {
				t.Errorf("response: %v", err)
			}
			return
		}
	}))
}

type stubGatewayClient struct {
	payload any
	err     error
	started chan string
	release <-chan struct{}

	mu       sync.Mutex
	isClosed bool
}

type blockingGatewayClient struct {
	payload any
	started chan struct{}
	closed  chan struct{}
	done    chan struct{}

	closeOnce sync.Once
}

func newBlockingGatewayClient(payload any) *blockingGatewayClient {
	return &blockingGatewayClient{
		payload: payload,
		started: make(chan struct{}, 1),
		closed:  make(chan struct{}),
		done:    make(chan struct{}),
	}
}

func (c *blockingGatewayClient) Request(context.Context, string, map[string]any) (any, error) {
	select {
	case c.started <- struct{}{}:
	default:
	}
	defer close(c.done)
	<-c.closed
	return nil, facade.NewCodedError(facade.CodeEndpointSwitching, "runtime endpoint is switching", http.StatusServiceUnavailable)
}

func (c *blockingGatewayClient) Close() error {
	c.closeOnce.Do(func() {
		close(c.closed)
	})
	return nil
}

func (c *blockingGatewayClient) Drain(ctx context.Context) error {
	select {
	case <-c.done:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (c *stubGatewayClient) Request(ctx context.Context, method string, _ map[string]any) (any, error) {
	if c.started != nil {
		c.started <- method
	}
	if c.release != nil {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-c.release:
		}
	}
	if c.err != nil {
		return nil, c.err
	}
	if c.payload != nil {
		return c.payload, nil
	}
	return map[string]any{"version": "mock-gateway"}, nil
}

func (c *stubGatewayClient) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.isClosed = true
	return nil
}

func (c *stubGatewayClient) closed() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.isClosed
}
