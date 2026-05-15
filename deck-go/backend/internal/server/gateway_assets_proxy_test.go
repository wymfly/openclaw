package server

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
)

func TestGatewayAssetsProxy_ForwardsGETToGateway(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")

	var upstreamPath string
	var upstreamQuery string
	var upstreamAuth string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upstreamPath = r.URL.Path
		upstreamQuery = r.URL.RawQuery
		upstreamAuth = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("<html>canvas</html>"))
	}))
	defer upstream.Close()

	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	rt := &fakeRuntimeFacade{
		caps: facade.Capabilities{
			Mode:            "local",
			Configured:      true,
			EndpointMutable: false,
			SupervisorState: true,
		},
		connection: facade.GatewayConnection{
			URL:   upstream.URL,
			Token: "secret-token",
		},
	}
	srv := httptest.NewServer(newTestRouterWithFacade(store, &testSupervisor{}, events.NewBus(4), rt))
	defer srv.Close()

	req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/runtime/gateway-assets/a2ui/index.html?v=1", nil)
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
		t.Fatalf("status = %d, want 200", res.StatusCode)
	}
	if upstreamPath != "/__openclaw__/a2ui/index.html" || upstreamQuery != "v=1" {
		t.Fatalf("upstream target = %q?%q, want /__openclaw__/a2ui/index.html?v=1", upstreamPath, upstreamQuery)
	}
	if upstreamAuth != "Bearer secret-token" {
		t.Fatalf("upstream auth = %q, want injected gateway token", upstreamAuth)
	}
	if !strings.Contains(res.Header.Get("Content-Type"), "text/html") {
		t.Fatalf("content-type = %q, want text/html", res.Header.Get("Content-Type"))
	}
	body, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatal(err)
	}
	if string(body) != "<html>canvas</html>" {
		t.Fatalf("body = %q, want proxied upstream body", string(body))
	}
}

func TestGatewayAssetsProxy_ForwardsCanvasDocumentsToGatewayCanvasHost(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")

	var upstreamPath string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upstreamPath = r.URL.Path
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("<html>document</html>"))
	}))
	defer upstream.Close()

	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	rt := &fakeRuntimeFacade{
		caps: facade.Capabilities{
			Mode:            "local",
			Configured:      true,
			EndpointMutable: false,
			SupervisorState: true,
		},
		connection: facade.GatewayConnection{URL: upstream.URL, Token: "secret-token"},
	}
	srv := httptest.NewServer(newTestRouterWithFacade(store, &testSupervisor{}, events.NewBus(4), rt))
	defer srv.Close()

	req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/runtime/gateway-assets/canvas/documents/demo/index.html", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer admin-token")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", res.StatusCode)
	}
	if upstreamPath != "/__openclaw__/canvas/documents/demo/index.html" {
		t.Fatalf("upstream path = %q, want /__openclaw__/canvas/documents/demo/index.html", upstreamPath)
	}
}

func TestGatewayAssetsProxy_DoesNotEchoTokenToBrowser(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Echo-Authorization", r.Header.Get("Authorization"))
		w.WriteHeader(http.StatusOK)
	}))
	defer upstream.Close()

	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	rt := &fakeRuntimeFacade{
		caps: facade.Capabilities{
			Mode:            "local",
			Configured:      true,
			EndpointMutable: false,
			SupervisorState: true,
		},
		connection: facade.GatewayConnection{
			URL:   upstream.URL,
			Token: "secret-token",
		},
	}
	srv := httptest.NewServer(newTestRouterWithFacade(store, &testSupervisor{}, events.NewBus(4), rt))
	defer srv.Close()

	req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/runtime/gateway-assets/", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer admin-token")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.Header.Get("X-Echo-Authorization") != "" {
		t.Fatalf("gateway token leaked into response header: %q", res.Header.Get("X-Echo-Authorization"))
	}
}

func TestGatewayAssetsProxy_RejectsNonGET(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	rt := &fakeRuntimeFacade{
		caps: facade.Capabilities{
			Mode:            "local",
			Configured:      true,
			EndpointMutable: false,
			SupervisorState: true,
		},
		connection: facade.GatewayConnection{URL: "http://127.0.0.1:1", Token: "secret-token"},
	}
	srv := httptest.NewServer(newTestRouterWithFacade(store, &testSupervisor{}, events.NewBus(4), rt))
	defer srv.Close()

	for _, method := range []string{http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete} {
		t.Run(method, func(t *testing.T) {
			req, err := http.NewRequest(method, srv.URL+"/api/runtime/gateway-assets/canvas/x", strings.NewReader(""))
			if err != nil {
				t.Fatal(err)
			}
			req.Header.Set("Authorization", "Bearer admin-token")
			res, err := http.DefaultClient.Do(req)
			if err != nil {
				t.Fatal(err)
			}
			defer res.Body.Close()
			if res.StatusCode != http.StatusMethodNotAllowed {
				t.Fatalf("%s status = %d, want 405", method, res.StatusCode)
			}
		})
	}
}

func TestGatewayAssetsProxy_RemoteFirstRunReturns503(t *testing.T) {
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
		connection: facade.GatewayConnection{URL: "http://127.0.0.1:1", Token: "secret-token"},
	}
	srv := httptest.NewServer(newTestRouterWithFacade(store, &testSupervisor{}, events.NewBus(4), rt))
	defer srv.Close()

	req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/runtime/gateway-assets/canvas/index.html", nil)
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
		t.Fatalf("status = %d, want 503", res.StatusCode)
	}
	var payload map[string]any
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if payload["code"] != facade.CodeGatewayNotConfigured {
		t.Fatalf("unexpected payload: %#v", payload)
	}
}
