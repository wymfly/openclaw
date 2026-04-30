package server

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
	openclawrt "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/openclaw"
)

type fakeRuntimeFacade struct {
	caps        facade.Capabilities
	endpoint    facade.EndpointView
	status      facade.RuntimeStatus
	testResult  facade.TestResult
	statusErr   error
	updateErr   error
	testErr     error
	updateInput *facade.RemoteEndpointInput
	testInput   *facade.RemoteEndpointInput
}

func (f *fakeRuntimeFacade) Capabilities(context.Context) (facade.Capabilities, error) {
	return f.caps, nil
}

func (f *fakeRuntimeFacade) Endpoint(context.Context) (facade.EndpointView, error) {
	return f.endpoint, nil
}

func (f *fakeRuntimeFacade) UpdateRemoteEndpoint(_ context.Context, input facade.RemoteEndpointInput) (facade.EndpointView, error) {
	f.updateInput = &input
	if f.updateErr != nil {
		return facade.EndpointView{}, f.updateErr
	}
	f.endpoint = facade.EndpointView{
		URL:             input.URL,
		TokenConfigured: strings.TrimSpace(input.Token) != "",
		TLSVerify:       input.TLSVerify,
		Source:          "json",
	}
	return f.endpoint, nil
}

func (f *fakeRuntimeFacade) TestRemoteEndpoint(_ context.Context, input *facade.RemoteEndpointInput) (facade.TestResult, error) {
	f.testInput = input
	if f.testErr != nil {
		return facade.TestResult{}, f.testErr
	}
	return f.testResult, nil
}

func (f *fakeRuntimeFacade) RuntimeGatewayStatus(context.Context) (facade.RuntimeStatus, error) {
	if f.statusErr != nil {
		return facade.RuntimeStatus{}, f.statusErr
	}
	return f.status, nil
}

func (f *fakeRuntimeFacade) Start(context.Context) (facade.RuntimeStatus, error) {
	return facade.RuntimeStatus{}, facade.ErrUnsupported
}

func (f *fakeRuntimeFacade) Stop(context.Context) (facade.RuntimeStatus, error) {
	return facade.RuntimeStatus{}, facade.ErrUnsupported
}

func (f *fakeRuntimeFacade) Restart(context.Context) (facade.RuntimeStatus, error) {
	return facade.RuntimeStatus{}, facade.ErrUnsupported
}

func (f *fakeRuntimeFacade) ReloadRuntime(context.Context) (facade.RuntimeStatus, error) {
	return facade.RuntimeStatus{}, facade.ErrUnsupported
}

func TestRuntimeCapabilitiesRoute_UsesFacade(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	rt := &fakeRuntimeFacade{caps: facade.Capabilities{
		Mode:            "remote",
		Configured:      false,
		EndpointMutable: true,
		SupervisorState: false,
	}}
	srv := httptest.NewServer(newTestRouterWithFacade(store, &testSupervisor{}, events.NewBus(4), rt))
	defer srv.Close()

	req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/runtime/capabilities", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer admin-token")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: %d", res.StatusCode)
	}
	var payload map[string]any
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if payload["mode"] != "remote" || payload["configured"] != false || payload["endpointMutable"] != true || payload["supervisorState"] != false {
		t.Fatalf("unexpected capabilities payload: %#v", payload)
	}
}

func TestRuntimeEndpointRoutes_RedactValidateAndDispatch(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	rt := &fakeRuntimeFacade{
		caps: facade.Capabilities{
			Mode:            "remote",
			Configured:      true,
			EndpointMutable: true,
			SupervisorState: false,
		},
		endpoint: facade.EndpointView{
			URL:             "https://gateway.example.test",
			TokenConfigured: true,
			TLSVerify:       true,
			Source:          "env",
		},
		testResult: facade.TestResult{OK: true, LatencyMs: 12, GatewayVersion: "test", TLSVerified: true},
	}
	srv := httptest.NewServer(newTestRouterWithFacade(store, &testSupervisor{}, events.NewBus(4), rt))
	defer srv.Close()

	getReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/runtime/endpoint", nil)
	if err != nil {
		t.Fatal(err)
	}
	getReq.Header.Set("Authorization", "Bearer admin-token")
	getRes, err := http.DefaultClient.Do(getReq)
	if err != nil {
		t.Fatal(err)
	}
	defer getRes.Body.Close()
	var getPayload map[string]any
	if err := json.NewDecoder(getRes.Body).Decode(&getPayload); err != nil {
		t.Fatal(err)
	}
	if getPayload["url"] != "https://gateway.example.test" || getPayload["tokenConfigured"] != true || getPayload["token"] != nil {
		t.Fatalf("unexpected redacted endpoint payload: %#v", getPayload)
	}

	for _, tc := range []struct {
		name string
		body string
		code string
	}{
		{name: "invalid url", body: `{"url":"file:///tmp/gateway.sock","token":"token-1","tlsVerify":true}`, code: "invalid_url"},
		{name: "unix url", body: `{"url":"unix:///tmp/gateway.sock","token":"token-1","tlsVerify":true}`, code: "invalid_url"},
		{name: "ftp url", body: `{"url":"ftp://gateway.example.test","token":"token-1","tlsVerify":true}`, code: "invalid_url"},
		{name: "gopher url", body: `{"url":"gopher://gateway.example.test","token":"token-1","tlsVerify":true}`, code: "invalid_url"},
		{name: "malformed url", body: `{"url":"://missing-scheme","token":"token-1","tlsVerify":true}`, code: "invalid_url"},
		{name: "missing token", body: `{"url":"https://gateway.example.test","tlsVerify":true}`, code: "token_required"},
		{name: "empty token", body: `{"url":"https://gateway.example.test","token":"","tlsVerify":true}`, code: "token_required"},
		{name: "missing tls verify", body: `{"url":"https://gateway.example.test","token":"token-1"}`, code: "invalid_tls_verify"},
		{name: "invalid tls verify", body: `{"url":"https://gateway.example.test","token":"token-1","tlsVerify":"yes"}`, code: "invalid_tls_verify"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodPut, srv.URL+"/api/runtime/endpoint", strings.NewReader(tc.body))
			if err != nil {
				t.Fatal(err)
			}
			req.Header.Set("Authorization", "Bearer admin-token")
			req.Header.Set("Content-Type", "application/json")
			res, err := http.DefaultClient.Do(req)
			if err != nil {
				t.Fatal(err)
			}
			defer res.Body.Close()
			if res.StatusCode != http.StatusBadRequest {
				t.Fatalf("unexpected status: %d", res.StatusCode)
			}
			var payload map[string]any
			if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
				t.Fatal(err)
			}
			if payload["code"] != tc.code {
				t.Fatalf("expected code %q, got %#v", tc.code, payload)
			}
			if rt.updateInput != nil {
				t.Fatalf("validation failure called UpdateRemoteEndpoint: %#v", rt.updateInput)
			}
		})
	}

	putReq, err := http.NewRequest(http.MethodPut, srv.URL+"/api/runtime/endpoint", strings.NewReader(`{"url":"https://new.example.test","token":"__unchanged__","tlsVerify":false}`))
	if err != nil {
		t.Fatal(err)
	}
	putReq.Header.Set("Authorization", "Bearer admin-token")
	putReq.Header.Set("Content-Type", "application/json")
	putRes, err := http.DefaultClient.Do(putReq)
	if err != nil {
		t.Fatal(err)
	}
	defer putRes.Body.Close()
	if putRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected put status: %d", putRes.StatusCode)
	}
	if rt.updateInput == nil || rt.updateInput.URL != "https://new.example.test" || rt.updateInput.Token != "__unchanged__" || rt.updateInput.TLSVerify {
		t.Fatalf("unexpected update input: %#v", rt.updateInput)
	}

	testReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/runtime/endpoint:test", strings.NewReader(`{}`))
	if err != nil {
		t.Fatal(err)
	}
	testReq.Header.Set("Authorization", "Bearer admin-token")
	testReq.Header.Set("Content-Type", "application/json")
	testRes, err := http.DefaultClient.Do(testReq)
	if err != nil {
		t.Fatal(err)
	}
	defer testRes.Body.Close()
	if testRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected test status: %d", testRes.StatusCode)
	}
	if rt.testInput != nil {
		t.Fatalf("empty test body should use active endpoint, got %#v", rt.testInput)
	}
}

func TestRuntimeEndpointPut_BundledModeIsNotMutable(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	rt := &fakeRuntimeFacade{caps: facade.Capabilities{
		Mode:            "bundled",
		Configured:      true,
		EndpointMutable: false,
		SupervisorState: true,
	}}
	srv := httptest.NewServer(newTestRouterWithFacade(store, &testSupervisor{}, events.NewBus(4), rt))
	defer srv.Close()

	req, err := http.NewRequest(http.MethodPut, srv.URL+"/api/runtime/endpoint", strings.NewReader(`{"url":"https://gateway.example.test","token":"token-1","tlsVerify":true}`))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer admin-token")
	req.Header.Set("Content-Type", "application/json")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusMethodNotAllowed {
		t.Fatalf("unexpected status: %d", res.StatusCode)
	}
	var payload map[string]any
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if payload["code"] != "endpoint_not_mutable" {
		t.Fatalf("unexpected payload: %#v", payload)
	}
	if rt.updateInput != nil {
		t.Fatalf("bundled endpoint update should not call facade: %#v", rt.updateInput)
	}
}

func TestRuntimeErrorTaxonomyUsesConsistentBodyShape(t *testing.T) {
	for _, tc := range []struct {
		name   string
		err    error
		code   string
		status int
	}{
		{
			name:   "endpoint not mutable",
			err:    facade.ErrUnsupported,
			code:   facade.CodeEndpointNotMutable,
			status: http.StatusMethodNotAllowed,
		},
		{
			name:   "gateway not configured",
			err:    facade.ErrNotConfigured,
			code:   facade.CodeGatewayNotConfigured,
			status: http.StatusServiceUnavailable,
		},
		{
			name:   "invalid url",
			err:    facade.NewCodedError(facade.CodeInvalidURL, "invalid url", http.StatusBadRequest),
			code:   facade.CodeInvalidURL,
			status: http.StatusBadRequest,
		},
		{
			name:   "token required",
			err:    facade.NewCodedError(facade.CodeTokenRequired, "token required", http.StatusBadRequest),
			code:   facade.CodeTokenRequired,
			status: http.StatusBadRequest,
		},
		{
			name:   "invalid tls verify",
			err:    facade.NewCodedError(facade.CodeInvalidTLSVerify, "invalid tls verify", http.StatusBadRequest),
			code:   facade.CodeInvalidTLSVerify,
			status: http.StatusBadRequest,
		},
		{
			name:   "gateway unreachable",
			err:    facade.NewCodedError(facade.CodeGatewayUnreachable, "gateway unreachable", http.StatusBadGateway),
			code:   facade.CodeGatewayUnreachable,
			status: http.StatusBadGateway,
		},
		{
			name:   "gateway auth failed",
			err:    facade.NewCodedError(facade.CodeGatewayAuthFailed, "gateway auth failed", http.StatusUnauthorized),
			code:   facade.CodeGatewayAuthFailed,
			status: http.StatusUnauthorized,
		},
		{
			name:   "tls verification failed",
			err:    facade.NewCodedError(facade.CodeTLSVerificationFailed, "tls verification failed", http.StatusBadGateway),
			code:   facade.CodeTLSVerificationFailed,
			status: http.StatusBadGateway,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			writeRuntimeFacadeError(rec, tc.err)
			if rec.Code != tc.status {
				t.Fatalf("status = %d, want %d", rec.Code, tc.status)
			}
			var payload map[string]any
			if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
				t.Fatal(err)
			}
			if len(payload) != 2 || payload["code"] != tc.code {
				t.Fatalf("payload = %#v, want consistent {code,message}", payload)
			}
			if message, ok := payload["message"].(string); !ok || strings.TrimSpace(message) == "" {
				t.Fatalf("payload message = %#v, want non-empty string", payload["message"])
			}
		})
	}
}

func TestRuntimeGatewayStatusRoute_UsesFacadeShape(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	pid := 4242
	rt := &fakeRuntimeFacade{
		caps: facade.Capabilities{
			Mode:            "bundled",
			Configured:      true,
			EndpointMutable: false,
			SupervisorState: true,
		},
		status: facade.RuntimeStatus{
			Mode:            "bundled",
			PID:             &pid,
			OwnershipState:  "owned",
			RestartAttempts: 2,
		},
	}
	srv := httptest.NewServer(newTestRouterWithFacade(store, &testSupervisor{}, events.NewBus(4), rt))
	defer srv.Close()

	req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/runtime/gateway", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer admin-token")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var payload map[string]any
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if payload["runtime"] != nil || payload["mode"] != "bundled" || payload["pid"] != float64(4242) || payload["ownershipState"] != "owned" || payload["restartAttempts"] != float64(2) {
		t.Fatalf("unexpected bundled runtime shape: %#v", payload)
	}
	if _, exists := payload["lastConnectedAt"]; exists {
		t.Fatalf("bundled runtime payload included remote field: %#v", payload)
	}
}

func TestRuntimeGatewayStatusRoute_RemoteConfiguredUsesFacadeShape(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	lastConnectedAt := "2026-04-28T00:00:00Z"
	lastError := ""
	latencyP50 := 12
	tlsVerified := true
	rt := &fakeRuntimeFacade{
		caps: facade.Capabilities{
			Mode:            "remote",
			Configured:      true,
			EndpointMutable: true,
			SupervisorState: false,
		},
		status: facade.RuntimeStatus{
			Mode:            "remote",
			LastConnectedAt: &lastConnectedAt,
			LastError:       &lastError,
			LatencyP50:      &latencyP50,
			TLSVerified:     &tlsVerified,
		},
	}
	srv := httptest.NewServer(newTestRouterWithFacade(store, &testSupervisor{}, events.NewBus(4), rt))
	defer srv.Close()

	req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/runtime/gateway", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer admin-token")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var payload map[string]any
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if payload["mode"] != "remote" || payload["lastConnectedAt"] != lastConnectedAt || payload["latencyP50"] != float64(12) || payload["tlsVerified"] != true {
		t.Fatalf("unexpected remote runtime shape: %#v", payload)
	}
	if _, exists := payload["pid"]; exists {
		t.Fatalf("remote runtime payload included bundled field: %#v", payload)
	}
}

func TestRuntimeGatewayStatusRoute_RemoteFirstRunReturns503(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	rt := &fakeRuntimeFacade{
		caps: facade.Capabilities{
			Mode:            "remote",
			Configured:      false,
			EndpointMutable: true,
			SupervisorState: false,
		},
		statusErr: facade.ErrNotConfigured,
	}
	srv := httptest.NewServer(newTestRouterWithFacade(store, &testSupervisor{}, events.NewBus(4), rt))
	defer srv.Close()

	req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/runtime/gateway", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer admin-token")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("unexpected status: %d", res.StatusCode)
	}
	var payload map[string]any
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if payload["code"] != "gateway_not_configured" {
		t.Fatalf("unexpected payload: %#v", payload)
	}
}

func TestGatewayPassthroughRoutes_RemoteFirstRunReturns503ButEndpointConfigStaysOpen(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	rt := &fakeRuntimeFacade{
		caps: facade.Capabilities{
			Mode:            "remote",
			Configured:      false,
			EndpointMutable: true,
			SupervisorState: false,
		},
		endpoint: facade.EndpointView{TLSVerify: true, Source: "env"},
	}
	srv := httptest.NewServer(newTestRouterWithFacade(store, &testSupervisor{}, events.NewBus(4), rt))
	defer srv.Close()

	req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/gateway/health", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer admin-token")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("unexpected passthrough status: %d", res.StatusCode)
	}
	var payload map[string]any
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if payload["code"] != "gateway_not_configured" {
		t.Fatalf("unexpected passthrough payload: %#v", payload)
	}

	endpointReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/runtime/endpoint", nil)
	if err != nil {
		t.Fatal(err)
	}
	endpointReq.Header.Set("Authorization", "Bearer admin-token")
	endpointRes, err := http.DefaultClient.Do(endpointReq)
	if err != nil {
		t.Fatal(err)
	}
	defer endpointRes.Body.Close()
	if endpointRes.StatusCode != http.StatusOK {
		t.Fatalf("endpoint config route status = %d, want 200", endpointRes.StatusCode)
	}
}

func TestRuntimeGetResponsesDoNotExposePlaintextToken(t *testing.T) {
	const secretToken = "T0KEN_TEST_42"
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", secretToken)
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	latencyP50 := 9
	tlsVerified := true
	rt := &fakeRuntimeFacade{
		caps: facade.Capabilities{
			Mode:            "remote",
			Configured:      true,
			EndpointMutable: true,
			SupervisorState: false,
		},
		endpoint: facade.EndpointView{
			URL:             "https://gateway.example.test",
			TokenConfigured: true,
			TLSVerify:       true,
			Source:          "env",
		},
		status: facade.RuntimeStatus{
			Mode:        "remote",
			LatencyP50:  &latencyP50,
			TLSVerified: &tlsVerified,
		},
	}
	srv := httptest.NewServer(newTestRouterWithFacade(store, &testSupervisor{}, events.NewBus(4), rt))
	defer srv.Close()

	for _, path := range []string{"/api/runtime/endpoint", "/api/runtime/gateway", "/api/settings"} {
		t.Run(path, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, srv.URL+path, nil)
			if err != nil {
				t.Fatal(err)
			}
			req.Header.Set("Authorization", "Bearer "+secretToken)
			res, err := http.DefaultClient.Do(req)
			if err != nil {
				t.Fatal(err)
			}
			defer res.Body.Close()
			body, err := io.ReadAll(res.Body)
			if err != nil {
				t.Fatal(err)
			}
			if res.StatusCode != http.StatusOK {
				t.Fatalf("%s status = %d body=%s", path, res.StatusCode, string(body))
			}
			if strings.Contains(string(body), secretToken) {
				t.Fatalf("%s response leaked plaintext token: %s", path, string(body))
			}
		})
	}
}

func TestSensitiveBodyRoutesDoNotLogPlaintextToken(t *testing.T) {
	const secretToken = "T0KEN_TEST_42"
	var logs bytes.Buffer
	previousWriter := log.Writer()
	previousFlags := log.Flags()
	log.SetOutput(&logs)
	log.SetFlags(0)
	t.Cleanup(func() {
		log.SetOutput(previousWriter)
		log.SetFlags(previousFlags)
	})

	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", secretToken)
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	rt := &fakeRuntimeFacade{
		caps: facade.Capabilities{
			Mode:            "remote",
			Configured:      true,
			EndpointMutable: true,
			SupervisorState: false,
		},
		endpoint:   facade.EndpointView{URL: "https://gateway.example.test", TokenConfigured: true, TLSVerify: true, Source: "env"},
		testResult: facade.TestResult{OK: true, LatencyMs: 3, GatewayVersion: "mock", TLSVerified: true},
	}
	srv := httptest.NewServer(newTestRouterWithFacade(store, &testSupervisor{}, events.NewBus(4), rt))
	defer srv.Close()

	for _, tc := range []struct {
		method string
		path   string
		body   string
	}{
		{
			method: http.MethodPut,
			path:   "/api/runtime/endpoint",
			body:   `{"url":"https://gateway.example.test","token":"` + secretToken + `","tlsVerify":true}`,
		},
		{
			method: http.MethodPost,
			path:   "/api/runtime/endpoint:test",
			body:   `{"url":"https://gateway.example.test","token":"` + secretToken + `","tlsVerify":true}`,
		},
		{
			method: http.MethodPut,
			path:   "/api/settings",
			body:   `{"accessToken":"` + secretToken + `"}`,
		},
	} {
		req, err := http.NewRequest(tc.method, srv.URL+tc.path, strings.NewReader(tc.body))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Authorization", "Bearer "+secretToken)
		req.Header.Set("Content-Type", "application/json")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		body, err := io.ReadAll(res.Body)
		res.Body.Close()
		if err != nil {
			t.Fatal(err)
		}
		if strings.Contains(string(body), secretToken) {
			t.Fatalf("%s response leaked plaintext token: %s", tc.path, string(body))
		}
	}

	output := logs.String()
	if strings.Contains(output, secretToken) {
		t.Fatalf("access log leaked plaintext token: %s", output)
	}
	if strings.Count(output, "request_body=redacted") < 3 {
		t.Fatalf("access log did not tag every sensitive body route: %s", output)
	}
	if strings.Count(output, "authorization=redacted") < 3 {
		t.Fatalf("access log did not globally redact authorization header: %s", output)
	}
}

func TestGatewayConfiguredMiddleware_BlocksV1RuntimeAdminFamily(t *testing.T) {
	rt := &fakeRuntimeFacade{caps: facade.Capabilities{
		Mode:            "remote",
		Configured:      false,
		EndpointMutable: true,
		SupervisorState: false,
	}}
	handler := GatewayConfiguredMiddleware(rt)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	}))
	req := httptest.NewRequest(http.MethodGet, "/api/v1/runtimes/main/status", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", rec.Code)
	}
	var payload map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if payload["code"] != "gateway_not_configured" {
		t.Fatalf("unexpected payload: %#v", payload)
	}
}

func TestRuntimeGatewayActionRoutesAreRemoved(t *testing.T) {
	for _, tc := range []struct {
		name string
		caps facade.Capabilities
	}{
		{
			name: "bundled",
			caps: facade.Capabilities{
				Mode:            "bundled",
				Configured:      true,
				EndpointMutable: false,
				SupervisorState: true,
			},
		},
		{
			name: "remote",
			caps: facade.Capabilities{
				Mode:            "remote",
				Configured:      true,
				EndpointMutable: true,
				SupervisorState: false,
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
			t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")
			store, err := config.NewStore()
			if err != nil {
				t.Fatal(err)
			}
			supervisor := &testSupervisor{snapshot: openclawrt.ManagedSnapshot{
				Managed:    true,
				Configured: true,
				Status:     openclawrt.ManagedStatusStopped,
			}}
			rt := &fakeRuntimeFacade{caps: tc.caps}
			srv := httptest.NewServer(newTestRouterWithFacade(store, supervisor, events.NewBus(4), rt))
			defer srv.Close()

			for _, path := range []string{"/api/runtime/gateway/start", "/api/runtime/gateway/restart", "/api/runtime/gateway/stop"} {
				req, err := http.NewRequest(http.MethodPost, srv.URL+path, nil)
				if err != nil {
					t.Fatal(err)
				}
				req.Header.Set("Authorization", "Bearer admin-token")
				res, err := http.DefaultClient.Do(req)
				if err != nil {
					t.Fatal(err)
				}
				res.Body.Close()
				if res.StatusCode != http.StatusNotFound {
					t.Fatalf("%s status = %d, want 404", path, res.StatusCode)
				}
			}
			if supervisor.startCalls != 0 || supervisor.restartCalls != 0 || supervisor.stopCalls != 0 {
				t.Fatalf("removed HTTP routes should not call lifecycle: start=%d restart=%d stop=%d", supervisor.startCalls, supervisor.restartCalls, supervisor.stopCalls)
			}
		})
	}
}

func TestAdminHTTPRoutesReturnNotFound(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	rt := &fakeRuntimeFacade{caps: facade.Capabilities{
		Mode:            "remote",
		Configured:      true,
		EndpointMutable: true,
		SupervisorState: false,
	}}
	srv := httptest.NewServer(newTestRouterWithFacade(store, &testSupervisor{}, events.NewBus(4), rt))
	defer srv.Close()

	for _, path := range []string{"/admin/reload-runtime", "/runtime/admin", "/internal/admin/status"} {
		t.Run(path, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodPost, srv.URL+path, nil)
			if err != nil {
				t.Fatal(err)
			}
			req.Header.Set("Authorization", "Bearer admin-token")
			res, err := http.DefaultClient.Do(req)
			if err != nil {
				t.Fatal(err)
			}
			defer res.Body.Close()
			if res.StatusCode != http.StatusNotFound {
				t.Fatalf("%s status = %d, want 404", path, res.StatusCode)
			}
		})
	}
}
