package controld

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/gorilla/websocket"
	httpapi "github.com/openclaw/openclaw/deck-go/backend/internal/api/http"
	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/envconf"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/local"
	openclawrt "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/openclaw"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/remote"
	runtimestate "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/state"
)

func TestResolveListenAddr(t *testing.T) {
	t.Run("prefers controld-specific env", func(t *testing.T) {
		addr := ResolveListenAddr(func(key string) string {
			switch key {
			case "CONTROLD_ADDR":
				return "127.0.0.1:29666"
			case "DECK_GO_ADDR":
				return "127.0.0.1:19528"
			default:
				return ""
			}
		})
		if addr != "127.0.0.1:29666" {
			t.Fatalf("expected controld addr, got %q", addr)
		}
	})

	t.Run("falls back to deck-go env", func(t *testing.T) {
		addr := ResolveListenAddr(func(key string) string {
			if key == "DECK_GO_ADDR" {
				return "127.0.0.1:19528"
			}
			return ""
		})
		if addr != "127.0.0.1:19528" {
			t.Fatalf("expected deck-go fallback addr, got %q", addr)
		}
	})

	t.Run("uses default when unset", func(t *testing.T) {
		addr := ResolveListenAddr(func(string) string { return "" })
		if addr != defaultListenAddr {
			t.Fatalf("expected default addr %q, got %q", defaultListenAddr, addr)
		}
	})
}

func TestValidateListenAddrSecurity(t *testing.T) {
	for _, addr := range []string{"127.0.0.1:19566", "localhost:19566", "[::1]:19566"} {
		if err := ValidateListenAddrSecurity(addr, func(string) string { return "" }); err != nil {
			t.Fatalf("%s should be accepted: %v", addr, err)
		}
	}

	err := ValidateListenAddrSecurity("0.0.0.0:19566", func(string) string { return "" })
	if err == nil || !strings.Contains(err.Error(), "loopback") {
		t.Fatalf("expected non-loopback error, got %v", err)
	}

	err = ValidateListenAddrSecurity("0.0.0.0:19566", func(key string) string {
		switch key {
		case "DECK_GO_TLS_CERT_FILE":
			return "/etc/deck-go/cert.pem"
		case "DECK_GO_TLS_KEY_FILE":
			return "/etc/deck-go/key.pem"
		default:
			return ""
		}
	})
	if err != nil {
		t.Fatalf("non-loopback with TLS config should be accepted: %v", err)
	}
}

func TestNewHandlerWithDependencies_ExposesStage2RuntimeRoutes(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	bus := events.NewBus(8)
	managed := newControldTestRuntime(store, bus)

	handler := NewHandlerWithDependencies(&Dependencies{
		Store:   store,
		Runtime: managed,
	})

	server := httptest.NewServer(handler)
	defer server.Close()

	stage2Res, err := http.Get(server.URL + "/api/v1/runtimes")
	if err != nil {
		t.Fatal(err)
	}
	defer stage2Res.Body.Close()
	if stage2Res.StatusCode != http.StatusOK {
		t.Fatalf("unexpected stage2 status: %d", stage2Res.StatusCode)
	}

	var stage2Payload struct {
		Runtimes []map[string]any `json:"runtimes"`
	}
	if err := json.NewDecoder(stage2Res.Body).Decode(&stage2Payload); err != nil {
		t.Fatal(err)
	}
	if len(stage2Payload.Runtimes) != 1 {
		t.Fatalf("unexpected stage2 payload: %#v", stage2Payload)
	}

	settingsRes, err := http.Get(server.URL + "/api/v1/settings")
	if err != nil {
		t.Fatal(err)
	}
	defer settingsRes.Body.Close()
	if settingsRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected settings status: %d", settingsRes.StatusCode)
	}

	alertsRes, err := http.Get(server.URL + "/api/v1/alerts")
	if err != nil {
		t.Fatal(err)
	}
	defer alertsRes.Body.Close()
	if alertsRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected alerts status: %d", alertsRes.StatusCode)
	}

	stage2WS := "ws" + strings.TrimPrefix(server.URL, "http") + "/api/v1/ws"
	conn, _, err := websocket.DefaultDialer.Dial(stage2WS, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()

	healthRes, err := http.Get(server.URL + "/healthz")
	if err != nil {
		t.Fatal(err)
	}
	defer healthRes.Body.Close()
	if healthRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected healthz status: %d", healthRes.StatusCode)
	}
}

func newControldTestRuntime(store *config.Store, bus *events.Bus) *openclawrt.ManagedRuntime {
	return openclawrt.NewManagedRuntimeWithFacade(store, &dependencyRuntimeFacade{
		caps: facade.Capabilities{
			Mode:            "local",
			Configured:      true,
			SupervisorState: true,
		},
		status: facade.RuntimeStatus{
			Mode:       "local",
			Configured: true,
			Status:     "stopped",
			Health:     "unknown",
		},
	}, bus)
}

func TestNewHandlerWithDependencies_CorsAllowsStreamResumeHeader(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	handler := NewHandlerWithDependencies(&Dependencies{
		Store:   store,
		Runtime: newControldTestRuntime(store, events.NewBus(4)),
	})

	req := httptest.NewRequest(http.MethodOptions, "/api/v1/logs/stream", nil)
	req.Header.Set("Origin", "http://127.0.0.1:4176")
	req.Header.Set("Access-Control-Request-Method", http.MethodGet)
	req.Header.Set("Access-Control-Request-Headers", "Last-Event-ID, x-deck-token")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("unexpected preflight status: %d", rec.Code)
	}
	allowHeaders := rec.Header().Get("Access-Control-Allow-Headers")
	if !strings.Contains(strings.ToLower(allowHeaders), "last-event-id") {
		t.Fatalf("Last-Event-ID not allowed in CORS headers: %q", allowHeaders)
	}
	if !strings.Contains(strings.ToLower(allowHeaders), "x-request-id") {
		t.Fatalf("X-Request-Id not allowed in CORS headers: %q", allowHeaders)
	}
}

func TestNewHandlerWithDependencies_CorsAllowsDelete(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	handler := NewHandlerWithDependencies(&Dependencies{
		Store:   store,
		Runtime: newControldTestRuntime(store, events.NewBus(4)),
	})

	req := httptest.NewRequest(http.MethodOptions, "/api/alerts/ar-test", nil)
	req.Header.Set("Origin", "http://127.0.0.1:4174")
	req.Header.Set("Access-Control-Request-Method", http.MethodDelete)
	req.Header.Set("Access-Control-Request-Headers", "x-deck-token")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("unexpected preflight status: %d", rec.Code)
	}
	allowMethods := rec.Header().Get("Access-Control-Allow-Methods")
	if !strings.Contains(allowMethods, http.MethodDelete) {
		t.Fatalf("DELETE not allowed in CORS methods: %q", allowMethods)
	}
}

func TestWebhookAdapter_RedactsSecretsInReadResponses(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	secret := "receiver-secret"
	enabled := true
	adapter := webhookAdapter{}

	created, err := adapter.CreateWebhook(context.Background(), httpapi.WebhookCreateInput{
		Name:    "Audit",
		URL:     "https://example.test/hook",
		Secret:  &secret,
		Events:  []string{"alert.fired"},
		Enabled: &enabled,
	})
	if err != nil {
		t.Fatal(err)
	}
	if created["secret"] != "***redacted" {
		t.Fatalf("expected redacted create payload, got %#v", created)
	}

	listed, err := adapter.ListWebhooks(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	webhooks, ok := listed["webhooks"].([]map[string]any)
	if !ok || len(webhooks) != 1 {
		t.Fatalf("unexpected webhooks payload: %#v", listed)
	}
	if webhooks[0]["secret"] != "***redacted" {
		t.Fatalf("expected redacted list payload, got %#v", webhooks[0])
	}
}

func TestWebhookAdapter_RejectsNonHTTPReceiverURL(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	adapter := webhookAdapter{}

	_, err := adapter.CreateWebhook(context.Background(), httpapi.WebhookCreateInput{
		Name:   "Audit",
		URL:    "not-a-receiver",
		Events: []string{"alert.fired"},
	})
	if err == nil {
		t.Fatal("expected non-http receiver URL to be rejected")
	}
}

func TestNewDependenciesWithRuntimeFacadeLocalUsesRuntimeEnvConfig(t *testing.T) {
	dataDir := t.TempDir()
	t.Setenv("DECK_GO_DATA_DIR", dataDir)
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")

	legacyStore, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := legacyStore.Update(config.Settings{
		ManagedGateway: config.ManagedGatewaySettings{
			Command:      "legacy-command-that-should-not-run",
			Args:         []string{"gateway", "run"},
			GatewayToken: "legacy-token",
			AutoStart:    false,
		},
	}); err != nil {
		t.Fatal(err)
	}

	localCfg := envconf.RuntimeLocalConfig{}
	exec := &recordingLocalExec{}
	entrypoint := filepath.Join(t.TempDir(), "dist", "entry.js")
	if err := os.MkdirAll(filepath.Dir(entrypoint), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(entrypoint, []byte("// stub"), 0o644); err != nil {
		t.Fatal(err)
	}
	runtimeFacade, err := local.NewWithDependencies(&localCfg, local.Dependencies{
		EntrypointOverride: entrypoint,
		ServiceName:        "openclaw-gateway.testhash1234",
		ProxyExec:          exec,
	})
	if err != nil {
		t.Fatal(err)
	}
	deps, err := NewDependenciesWithRuntimeFacade(envconf.Loaded{
		Mode:  envconf.ModeLocal,
		Local: localCfg,
	}, runtimeFacade)
	if err != nil {
		t.Fatal(err)
	}

	_, err = deps.RuntimeFacade.Start(context.Background())
	if err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	if len(exec.calls) < 2 {
		t.Fatalf("expected lifecycle start + status calls, got %#v", exec.calls)
	}
	if got := strings.Join(exec.calls[0].Args, " "); got != entrypoint+" gateway start" {
		t.Fatalf("unexpected lifecycle command: %q", got)
	}
	for _, call := range exec.calls {
		joined := call.Command + " " + strings.Join(call.Args, " ")
		if strings.Contains(joined, "legacy-command-that-should-not-run") {
			t.Fatalf("local lifecycle used legacy spawn command: %q", joined)
		}
	}
}

func TestNewDependenciesWithRuntimeFacadeWiresManagedRuntimeToFacade(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	runtimeFacade := &dependencyRuntimeFacade{
		caps: facade.Capabilities{
			Mode:            "local",
			Configured:      true,
			SupervisorState: true,
		},
		status: facade.RuntimeStatus{
			Mode:       "local",
			Configured: true,
			Status:     "running",
			Health:     "healthy",
		},
	}

	deps, err := NewDependenciesWithRuntimeFacade(envconf.Loaded{
		Mode: envconf.ModeLocal,
	}, runtimeFacade)
	if err != nil {
		t.Fatal(err)
	}
	managed, ok := deps.Runtime.(*openclawrt.ManagedRuntime)
	if !ok {
		t.Fatalf("unexpected runtime type %T", deps.Runtime)
	}
	if managed.Facade() != runtimeFacade {
		t.Fatalf("managed runtime was not wired to the provided facade")
	}
}

func TestRuntimeSummaryOverrideRecordsRemoteStatusCache(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	runtimeFacade := &dependencyRuntimeFacade{
		caps: facade.Capabilities{
			Mode:       "remote",
			Configured: true,
		},
		status: facade.RuntimeStatus{
			Mode:       "remote",
			Configured: true,
			Status:     "running",
			Health:     "healthy",
			GatewayURL: "wss://gateway.example.test",
		},
	}
	managed := openclawrt.NewManagedRuntimeWithFacade(store, runtimeFacade, events.NewBus(4))
	override := runtimeSummaryOverride{base: managed, runtime: runtimeFacade, recorder: managed}

	items, err := override.ListRuntimes(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].Status != "running" || items[0].GatewayURL == nil || *items[0].GatewayURL != "wss://gateway.example.test" {
		t.Fatalf("override did not use remote facade status: %+v", items)
	}
	if got := managed.LastStatus(); got.Status != "running" || got.GatewayURL != "wss://gateway.example.test" {
		t.Fatalf("override did not record remote status cache: %+v", got)
	}
}

type dependencyRuntimeFacade struct {
	caps   facade.Capabilities
	status facade.RuntimeStatus
}

func (f *dependencyRuntimeFacade) Capabilities(context.Context) (facade.Capabilities, error) {
	return f.caps, nil
}

func (f *dependencyRuntimeFacade) Endpoint(context.Context) (facade.EndpointView, error) {
	return facade.EndpointView{}, nil
}

func (f *dependencyRuntimeFacade) GatewayConnection(context.Context) (facade.GatewayConnection, error) {
	return facade.GatewayConnection{}, facade.ErrNotConfigured
}

func (f *dependencyRuntimeFacade) UpdateRemoteEndpoint(context.Context, facade.RemoteEndpointInput) (facade.EndpointView, error) {
	return facade.EndpointView{}, facade.ErrUnsupported
}

func (f *dependencyRuntimeFacade) TestRemoteEndpoint(context.Context, *facade.RemoteEndpointInput) (facade.TestResult, error) {
	return facade.TestResult{}, facade.ErrUnsupported
}

func (f *dependencyRuntimeFacade) RuntimeGatewayStatus(context.Context) (facade.RuntimeStatus, error) {
	return f.status, nil
}

func (f *dependencyRuntimeFacade) Start(context.Context) (facade.RuntimeStatus, error) {
	return f.status, nil
}

func (f *dependencyRuntimeFacade) Stop(context.Context) (facade.RuntimeStatus, error) {
	return f.status, nil
}

func (f *dependencyRuntimeFacade) Restart(context.Context) (facade.RuntimeStatus, error) {
	return f.status, nil
}

func (f *dependencyRuntimeFacade) Install(context.Context) (facade.RuntimeStatus, error) {
	return f.status, nil
}

func (f *dependencyRuntimeFacade) Reinstall(context.Context) (facade.RuntimeStatus, error) {
	return f.status, nil
}

func (f *dependencyRuntimeFacade) ReloadRuntime(context.Context) (facade.RuntimeStatus, error) {
	return f.status, nil
}

type recordingLocalExec struct {
	calls []local.ExecCall
}

func (r *recordingLocalExec) Run(_ context.Context, call local.ExecCall) ([]byte, error) {
	r.calls = append(r.calls, call)
	if len(call.Args) >= 3 && call.Args[2] == "status" {
		return []byte(`{"service":{"loaded":true,"runtime":{"status":"running"}}}`), nil
	}
	return nil, nil
}

func TestRemoteModeEndpointUpdateRoutesChatThroughRemoteGateway(t *testing.T) {
	dataDir := t.TempDir()
	t.Setenv("DECK_GO_DATA_DIR", dataDir)
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")

	gateway := newRemoteModeChatGateway(t, "remote-token")
	defer gateway.Close()

	stateStore := runtimestate.Open(filepath.Join(dataDir, "deck-state.json"))
	runtimeFacade := remote.New(envconf.RuntimeRemoteDefaults{}, stateStore)
	deps, err := NewDependenciesWithRuntimeFacade(envconf.Loaded{
		Mode:   envconf.ModeRemote,
		Remote: envconf.RuntimeRemoteDefaults{},
	}, runtimeFacade)
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(NewHandlerWithDependencies(deps))
	defer server.Close()

	firstRunRes := doJSONRequest(t, http.MethodPost, server.URL+"/api/chat/sessions/create", "admin-token", map[string]any{
		"message": "before config",
	})
	if firstRunRes.status != http.StatusServiceUnavailable {
		t.Fatalf("first-run chat status = %d, want 503 body=%s", firstRunRes.status, firstRunRes.body)
	}
	var firstRunBody map[string]any
	if err := json.Unmarshal(firstRunRes.body, &firstRunBody); err != nil {
		t.Fatal(err)
	}
	if firstRunBody["code"] != "gateway_not_configured" {
		t.Fatalf("unexpected first-run chat body: %#v", firstRunBody)
	}

	updateRes := doJSONRequest(t, http.MethodPut, server.URL+"/api/runtime/endpoint", "admin-token", map[string]any{
		"url":       gateway.URL,
		"token":     "remote-token",
		"tlsVerify": true,
	})
	if updateRes.status != http.StatusOK {
		t.Fatalf("endpoint update status = %d body=%s", updateRes.status, updateRes.body)
	}
	runtimesRes := doJSONRequest(t, http.MethodGet, server.URL+"/api/v1/runtimes", "admin-token", nil)
	if runtimesRes.status != http.StatusOK {
		t.Fatalf("runtimes status = %d body=%s", runtimesRes.status, runtimesRes.body)
	}
	var runtimesBody struct {
		Runtimes []struct {
			Managed    bool   `json:"managed"`
			Configured bool   `json:"configured"`
			Status     string `json:"status"`
			Health     string `json:"health"`
			GatewayURL string `json:"gatewayUrl"`
			AutoStart  bool   `json:"autoStart"`
		} `json:"runtimes"`
	}
	if err := json.Unmarshal(runtimesRes.body, &runtimesBody); err != nil {
		t.Fatal(err)
	}
	if len(runtimesBody.Runtimes) != 1 {
		t.Fatalf("unexpected runtimes body: %s", runtimesRes.body)
	}
	runtimeSummary := runtimesBody.Runtimes[0]
	if runtimeSummary.Managed || !runtimeSummary.Configured || runtimeSummary.Status != "running" || runtimeSummary.Health != "healthy" || runtimeSummary.GatewayURL != gateway.URL || runtimeSummary.AutoStart {
		t.Fatalf("remote runtime summary used local supervisor state: %#v raw=%s", runtimeSummary, runtimesRes.body)
	}

	createRes := doJSONRequest(t, http.MethodPost, server.URL+"/api/chat/sessions/create", "admin-token", map[string]any{
		"message": "hello",
	})
	if createRes.status != http.StatusOK {
		t.Fatalf("chat create status = %d body=%s", createRes.status, createRes.body)
	}
	var createBody struct {
		Key   string `json:"key"`
		RunID string `json:"runId"`
	}
	if err := json.Unmarshal(createRes.body, &createBody); err != nil {
		t.Fatal(err)
	}
	if createBody.Key != "session:mock:1" || createBody.RunID != "run:mock:1" {
		t.Fatalf("unexpected chat create body: %#v raw=%s", createBody, createRes.body)
	}

	sendRes := doJSONRequest(t, http.MethodPost, server.URL+"/api/chat/send", "admin-token", map[string]any{
		"sessionKey": createBody.Key,
		"message":    "ping",
	})
	if sendRes.status != http.StatusOK {
		t.Fatalf("chat send status = %d body=%s", sendRes.status, sendRes.body)
	}
	var sendBody struct {
		RunID  string `json:"runId"`
		Status string `json:"status"`
	}
	if err := json.Unmarshal(sendRes.body, &sendBody); err != nil {
		t.Fatal(err)
	}
	if sendBody.RunID != "run:mock:2" || sendBody.Status != "started" {
		t.Fatalf("unexpected chat send body: %#v raw=%s", sendBody, sendRes.body)
	}
	gateway.assertMethods(t, "connect", "gateway.describe", "connect", "gateway.describe", "connect", "sessions.create", "connect", "sessions.send")
}

func TestRemoteModeBadPersistedEndpointBlocksPassthroughUntilRepair(t *testing.T) {
	dataDir := t.TempDir()
	t.Setenv("DECK_GO_DATA_DIR", dataDir)
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")

	gateway := newRemoteModeChatGateway(t, "remote-token")
	defer gateway.Close()

	stateStore := runtimestate.Open(filepath.Join(dataDir, "deck-state.json"))
	if err := stateStore.WriteRemote(runtimestate.RemoteEndpoint{
		URL:       gateway.URL,
		Token:     "bad-token",
		TLSVerify: true,
	}); err != nil {
		t.Fatal(err)
	}
	runtimeFacade := remote.New(envconf.RuntimeRemoteDefaults{}, stateStore)
	deps, err := NewDependenciesWithRuntimeFacade(envconf.Loaded{
		Mode:   envconf.ModeRemote,
		Remote: envconf.RuntimeRemoteDefaults{},
	}, runtimeFacade)
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(NewHandlerWithDependencies(deps))
	defer server.Close()

	badRes := doJSONRequest(t, http.MethodGet, server.URL+"/api/gateway/describe", "admin-token", nil)
	if badRes.status != http.StatusServiceUnavailable {
		t.Fatalf("bad persisted endpoint status = %d body=%s", badRes.status, badRes.body)
	}
	var badBody map[string]any
	if err := json.Unmarshal(badRes.body, &badBody); err != nil {
		t.Fatal(err)
	}
	lastError, _ := badBody["lastError"].(string)
	if badBody["code"] != "gateway_not_configured" || strings.TrimSpace(lastError) == "" {
		t.Fatalf("bad persisted endpoint body missing lastError: %#v", badBody)
	}

	repairRes := doJSONRequest(t, http.MethodPut, server.URL+"/api/runtime/endpoint", "admin-token", map[string]any{
		"url":       gateway.URL,
		"token":     "remote-token",
		"tlsVerify": true,
	})
	if repairRes.status != http.StatusOK {
		t.Fatalf("repair endpoint status = %d body=%s", repairRes.status, repairRes.body)
	}

	describeRes := doJSONRequest(t, http.MethodGet, server.URL+"/api/gateway/describe", "admin-token", nil)
	if describeRes.status != http.StatusOK {
		t.Fatalf("post-repair describe status = %d body=%s", describeRes.status, describeRes.body)
	}
}

type jsonHTTPResult struct {
	status int
	body   []byte
}

func doJSONRequest(t *testing.T, method string, url string, token string, payload map[string]any) jsonHTTPResult {
	t.Helper()
	var bodyReader *bytes.Reader
	if payload == nil {
		bodyReader = bytes.NewReader(nil)
	} else {
		body, err := json.Marshal(payload)
		if err != nil {
			t.Fatal(err)
		}
		bodyReader = bytes.NewReader(body)
	}
	req, err := http.NewRequest(method, url, bodyReader)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var raw bytes.Buffer
	if _, err := raw.ReadFrom(res.Body); err != nil {
		t.Fatal(err)
	}
	return jsonHTTPResult{status: res.StatusCode, body: raw.Bytes()}
}

type remoteModeChatGateway struct {
	*httptest.Server
	token string

	mu      sync.Mutex
	methods []string
}

func newRemoteModeChatGateway(t *testing.T, token string) *remoteModeChatGateway {
	t.Helper()
	gateway := &remoteModeChatGateway{token: token}
	upgrader := websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }}
	gateway.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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
				return
			}
			var frame map[string]any
			if err := json.Unmarshal(raw, &frame); err != nil {
				t.Errorf("decode frame: %v", err)
				return
			}
			if frame["type"] != "req" {
				continue
			}
			id, _ := frame["id"].(string)
			method, _ := frame["method"].(string)
			params, _ := frame["params"].(map[string]any)
			gateway.record(method)
			switch method {
			case "connect":
				auth, _ := params["auth"].(map[string]any)
				if auth["token"] != token {
					_ = conn.WriteJSON(map[string]any{
						"type":  "res",
						"id":    id,
						"error": map[string]any{"code": "unauthorized", "message": "invalid token"},
					})
					continue
				}
				_ = conn.WriteJSON(map[string]any{
					"type":    "res",
					"id":      id,
					"payload": map[string]any{"ok": true},
				})
			case "gateway.describe":
				_ = conn.WriteJSON(map[string]any{
					"type":    "res",
					"id":      id,
					"payload": map[string]any{"version": "mock-gateway", "gatewayVersion": "mock-gateway"},
				})
			case "sessions.create":
				_ = conn.WriteJSON(map[string]any{
					"type": "res",
					"id":   id,
					"payload": map[string]any{
						"key":        "session:mock:1",
						"sessionId":  "session:mock:1",
						"runId":      "run:mock:1",
						"status":     "started",
						"runStarted": true,
					},
				})
			case "sessions.send":
				_ = conn.WriteJSON(map[string]any{
					"type": "res",
					"id":   id,
					"payload": map[string]any{
						"runId":      "run:mock:2",
						"status":     "started",
						"messageSeq": 2,
					},
				})
			default:
				_ = conn.WriteJSON(map[string]any{
					"type":  "res",
					"id":    id,
					"error": map[string]any{"code": "method_not_found", "message": method},
				})
			}
		}
	}))
	return gateway
}

func (g *remoteModeChatGateway) record(method string) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.methods = append(g.methods, method)
}

func (g *remoteModeChatGateway) assertMethods(t *testing.T, want ...string) {
	t.Helper()
	g.mu.Lock()
	defer g.mu.Unlock()
	if len(g.methods) != len(want) {
		t.Fatalf("gateway methods = %#v, want %#v", g.methods, want)
	}
	for i := range want {
		if g.methods[i] != want[i] {
			t.Fatalf("gateway methods = %#v, want %#v", g.methods, want)
		}
	}
}
