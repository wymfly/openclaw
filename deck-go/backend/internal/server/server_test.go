package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway"
	runtimecontrol "github.com/openclaw/openclaw/deck-go/backend/internal/runtime"
)

type testSupervisor struct {
	snapshot runtimecontrol.Snapshot
}

func (s *testSupervisor) Snapshot() runtimecontrol.Snapshot {
	return s.snapshot
}

func (s *testSupervisor) Start(context.Context) (runtimecontrol.Snapshot, error) {
	s.snapshot.Status = runtimecontrol.StatusRunning
	s.snapshot.Health = runtimecontrol.HealthHealthy
	return s.snapshot, nil
}

func (s *testSupervisor) Stop(context.Context) (runtimecontrol.Snapshot, error) {
	s.snapshot.Status = runtimecontrol.StatusStopped
	s.snapshot.Health = runtimecontrol.HealthUnknown
	return s.snapshot, nil
}

func (s *testSupervisor) Restart(context.Context) (runtimecontrol.Snapshot, error) {
	s.snapshot.Status = runtimecontrol.StatusRunning
	s.snapshot.Health = runtimecontrol.HealthHealthy
	return s.snapshot, nil
}

func (s *testSupervisor) GatewayConnection() (string, string, bool) {
	if s.snapshot.GatewayURL == "" {
		return "", "", false
	}
	return s.snapshot.GatewayURL, "gateway-token", true
}

func TestSettingsRoute_RoundTrip(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")

	srv := httptest.NewServer(New())
	defer srv.Close()

	putReq, err := http.NewRequest(http.MethodPut, srv.URL+"/api/settings", strings.NewReader(`{
	  "managedGateway":{
	    "command":"pnpm",
	    "args":["openclaw","gateway","run"],
	    "bindHost":"127.0.0.1",
	    "bindPort":18789,
	    "gatewayToken":"gateway-token",
	    "autoStart":true
	  }
	}`))
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
		t.Fatalf("unexpected status: %d", putRes.StatusCode)
	}

	getReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/settings", nil)
	if err != nil {
		t.Fatal(err)
	}
	getReq.Header.Set("x-deck-token", "admin-token")
	getRes, err := http.DefaultClient.Do(getReq)
	if err != nil {
		t.Fatal(err)
	}
	defer getRes.Body.Close()
	if getRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: %d", getRes.StatusCode)
	}
	var payload map[string]any
	if err := json.NewDecoder(getRes.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	settings, ok := payload["settings"].(map[string]any)
	if !ok {
		t.Fatalf("unexpected payload: %#v", payload)
	}
	managed, ok := settings["managedGateway"].(map[string]any)
	if !ok {
		t.Fatalf("unexpected settings payload: %#v", settings)
	}
	if managed["gatewayToken"] != "gateway-token" {
		t.Fatalf("unexpected managed gateway payload: %#v", managed)
	}
}

func TestStaticShell_BypassesAuthWhileAPIStaysProtected(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")

	distDir := t.TempDir()
	if err := os.WriteFile(filepath.Join(distDir, "index.html"), []byte("<!doctype html><div>deck-go shell</div>"), 0o644); err != nil {
		t.Fatal(err)
	}
	t.Setenv("DECK_GO_FRONTEND_DIST", distDir)

	srv := httptest.NewServer(New())
	defer srv.Close()

	rootRes, err := http.Get(srv.URL + "/")
	if err != nil {
		t.Fatal(err)
	}
	defer rootRes.Body.Close()
	if rootRes.StatusCode != http.StatusOK {
		t.Fatalf("expected static shell to load without auth, got %d", rootRes.StatusCode)
	}

	apiRes, err := http.Get(srv.URL + "/api/settings")
	if err != nil {
		t.Fatal(err)
	}
	defer apiRes.Body.Close()
	if apiRes.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected api route to remain protected, got %d", apiRes.StatusCode)
	}
}

func TestBootstrapStatus_UsesGatewayDescribeAndRuntimeSnapshot(t *testing.T) {
	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	wsServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("upgrade failed: %v", err)
			return
		}
		defer conn.Close()

		_ = conn.WriteJSON(map[string]any{
			"type":  "event",
			"event": "connect.challenge",
			"payload": map[string]any{
				"nonce": "nonce-1",
			},
		})
		_, raw, _ := conn.ReadMessage()
		var connectFrame map[string]any
		_ = json.Unmarshal(raw, &connectFrame)
		_ = conn.WriteJSON(map[string]any{
			"type": "res",
			"id":   connectFrame["id"],
			"ok":   true,
			"payload": map[string]any{
				"ready": true,
			},
		})
		_, raw, _ = conn.ReadMessage()
		var reqFrame map[string]any
		_ = json.Unmarshal(raw, &reqFrame)
		_ = conn.WriteJSON(map[string]any{
			"type": "res",
			"id":   reqFrame["id"],
			"ok":   true,
			"payload": map[string]any{
				"protocol": 3,
				"methods":  map[string]any{},
				"events":   map[string]any{},
				"untyped":  []any{},
			},
		})
	}))
	defer wsServer.Close()

	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")
	t.Setenv("DECK_GO_GATEWAY_BIND_PORT", strconv.Itoa(mustPort(t, wsServer.URL)))
	t.Setenv("DECK_GO_GATEWAY_TOKEN", "gateway-token")

	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	bus := events.NewBus(4)
	supervisor := &testSupervisor{
		snapshot: runtimecontrol.Snapshot{
			Managed:    true,
			Configured: true,
			Status:     runtimecontrol.StatusRunning,
			Health:     runtimecontrol.HealthHealthy,
			GatewayURL: config.ManagedGatewayURL(store.Effective().ManagedGateway),
			AutoStart:  true,
		},
	}
	client := gateway.New(supervisor)
	realtime := gateway.NewRealtime(supervisor, bus)
	srv := httptest.NewServer(newRouter(store, client, realtime, supervisor, bus))
	defer srv.Close()

	req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/bootstrap/status", nil)
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
	runtimePayload, ok := payload["runtime"].(map[string]any)
	if !ok {
		t.Fatalf("unexpected payload: %#v", payload)
	}
	if runtimePayload["status"] != "running" {
		t.Fatalf("expected runtime running, got %#v", runtimePayload)
	}
	gatewayPayload, ok := payload["gateway"].(map[string]any)
	if !ok || gatewayPayload["connected"] != true {
		t.Fatalf("expected connected gateway payload, got %#v", payload)
	}
}

func TestBootstrapStatus_RemainsConnectedWhenDescribeScopeIsMissing(t *testing.T) {
	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	var callCount int
	wsServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("upgrade failed: %v", err)
			return
		}
		defer conn.Close()

		_ = conn.WriteJSON(map[string]any{
			"type":    "event",
			"event":   "connect.challenge",
			"payload": map[string]any{"nonce": "nonce-1"},
		})
		_, raw, _ := conn.ReadMessage()
		var connectFrame map[string]any
		_ = json.Unmarshal(raw, &connectFrame)
		_ = conn.WriteJSON(map[string]any{
			"type":    "res",
			"id":      connectFrame["id"],
			"payload": map[string]any{"ready": true},
		})
		_, raw, _ = conn.ReadMessage()
		var reqFrame map[string]any
		_ = json.Unmarshal(raw, &reqFrame)

		switch callCount {
		case 0:
			_ = conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      reqFrame["id"],
				"payload": map[string]any{"ok": true},
			})
		default:
			_ = conn.WriteJSON(map[string]any{
				"type": "res",
				"id":   reqFrame["id"],
				"error": map[string]any{
					"code":    "INVALID_REQUEST",
					"message": "missing scope: operator.read",
				},
			})
		}
		callCount++
	}))
	defer wsServer.Close()

	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")
	t.Setenv("DECK_GO_GATEWAY_BIND_PORT", strconv.Itoa(mustPort(t, wsServer.URL)))
	t.Setenv("DECK_GO_GATEWAY_TOKEN", "gateway-token")

	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	bus := events.NewBus(4)
	supervisor := &testSupervisor{
		snapshot: runtimecontrol.Snapshot{
			Managed:    true,
			Configured: true,
			Status:     runtimecontrol.StatusRunning,
			Health:     runtimecontrol.HealthHealthy,
			GatewayURL: config.ManagedGatewayURL(store.Effective().ManagedGateway),
			AutoStart:  true,
		},
	}
	client := gateway.New(supervisor)
	realtime := gateway.NewRealtime(supervisor, bus)
	srv := httptest.NewServer(newRouter(store, client, realtime, supervisor, bus))
	defer srv.Close()

	req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/bootstrap/status", nil)
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
	gatewayPayload, ok := payload["gateway"].(map[string]any)
	if !ok || gatewayPayload["connected"] != true {
		t.Fatalf("unexpected bootstrap payload: %#v", payload)
	}
	if gatewayPayload["error"] == nil {
		t.Fatalf("expected describe warning in bootstrap payload: %#v", payload)
	}
}

func TestStreamRoute_ReplaysEventFromBus(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	bus := events.NewBus(4)
	bus.Publish("runtime.gateway.status", []byte(`{"status":"running"}`))
	supervisor := &testSupervisor{}
	client := gateway.New(supervisor)
	realtime := gateway.NewRealtime(supervisor, bus)

	handler := newRouter(store, client, realtime, supervisor, bus)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	req := httptest.NewRequest(http.MethodGet, "/api/stream", nil).WithContext(ctx)
	req.Header.Set("Authorization", "Bearer admin-token")
	req.Header.Set("Last-Event-ID", "0")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	body := rec.Body.String()
	if !strings.Contains(body, "event: runtime.gateway.status") {
		t.Fatalf("unexpected body: %s", body)
	}
}

func TestRuntimeGatewayRoutes_UseSupervisorStateMachine(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")

	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	bus := events.NewBus(8)
	supervisor := &testSupervisor{
		snapshot: runtimecontrol.Snapshot{
			Managed:    true,
			Configured: true,
			Status:     runtimecontrol.StatusStopped,
			Health:     runtimecontrol.HealthUnknown,
			GatewayURL: "ws://127.0.0.1:18789",
			AutoStart:  true,
		},
	}
	client := gateway.New(supervisor)
	realtime := gateway.NewRealtime(supervisor, bus)

	srv := httptest.NewServer(newRouter(store, client, realtime, supervisor, bus))
	defer srv.Close()

	getReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/runtime/gateway", nil)
	if err != nil {
		t.Fatal(err)
	}
	getReq.Header.Set("Authorization", "Bearer admin-token")
	getRes, err := http.DefaultClient.Do(getReq)
	if err != nil {
		t.Fatal(err)
	}
	defer getRes.Body.Close()
	if getRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected get status: %d", getRes.StatusCode)
	}

	startReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/runtime/gateway/start", nil)
	if err != nil {
		t.Fatal(err)
	}
	startReq.Header.Set("Authorization", "Bearer admin-token")
	startRes, err := http.DefaultClient.Do(startReq)
	if err != nil {
		t.Fatal(err)
	}
	defer startRes.Body.Close()
	if startRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected start status: %d", startRes.StatusCode)
	}

	var payload map[string]any
	if err := json.NewDecoder(startRes.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	runtimePayload, ok := payload["runtime"].(map[string]any)
	if !ok || runtimePayload["status"] != "running" {
		t.Fatalf("unexpected runtime payload: %#v", payload)
	}
}

func TestRuntimeGatewayManagedSmoke_StartRestartStop(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")

	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		ManagedGateway: config.ManagedGatewaySettings{
			Command:      os.Args[0],
			Args:         []string{"-test.run=TestServerHelperProcess", "--", "gateway-mock", "18896"},
			BindHost:     "127.0.0.1",
			BindPort:     18896,
			GatewayToken: "smoke-token",
			AutoStart:    false,
		},
	}); err != nil {
		t.Fatal(err)
	}
	bus := events.NewBus(16)
	supervisor := runtimecontrol.NewSupervisorWithOptions(
		store,
		bus,
		runtimecontrol.WithLauncher(func(cfg config.ManagedGatewaySettings) (*exec.Cmd, error) {
			cmd := exec.Command(os.Args[0], "-test.run=TestServerHelperProcess", "--", "gateway-mock", strconv.Itoa(cfg.BindPort))
			cmd.Env = append(os.Environ(), "GO_WANT_SERVER_HELPER_PROCESS=1", "OPENCLAW_GATEWAY_TOKEN="+cfg.GatewayToken)
			return cmd, nil
		}),
		runtimecontrol.WithProbeInterval(20*time.Millisecond),
		runtimecontrol.WithStartupTimeout(2*time.Second),
	)
	client := gateway.New(supervisor)
	realtime := gateway.NewRealtime(supervisor, bus)
	srv := httptest.NewServer(newRouter(store, client, realtime, supervisor, bus))
	defer srv.Close()

	startReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/runtime/gateway/start", nil)
	if err != nil {
		t.Fatal(err)
	}
	startReq.Header.Set("Authorization", "Bearer admin-token")
	startRes, err := http.DefaultClient.Do(startReq)
	if err != nil {
		t.Fatal(err)
	}
	startRes.Body.Close()
	if startRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected start status: %d", startRes.StatusCode)
	}

	waitForHTTPRuntimeStatus(t, srv.URL, "admin-token", "running")

	bootstrapReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/bootstrap/status", nil)
	if err != nil {
		t.Fatal(err)
	}
	bootstrapReq.Header.Set("Authorization", "Bearer admin-token")
	bootstrapRes, err := http.DefaultClient.Do(bootstrapReq)
	if err != nil {
		t.Fatal(err)
	}
	defer bootstrapRes.Body.Close()
	var bootstrapPayload map[string]any
	if err := json.NewDecoder(bootstrapRes.Body).Decode(&bootstrapPayload); err != nil {
		t.Fatal(err)
	}
	gatewayPayload, ok := bootstrapPayload["gateway"].(map[string]any)
	if !ok || gatewayPayload["connected"] != true {
		t.Fatalf("unexpected bootstrap payload: %#v", bootstrapPayload)
	}

	restartReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/runtime/gateway/restart", nil)
	if err != nil {
		t.Fatal(err)
	}
	restartReq.Header.Set("Authorization", "Bearer admin-token")
	restartRes, err := http.DefaultClient.Do(restartReq)
	if err != nil {
		t.Fatal(err)
	}
	restartRes.Body.Close()
	if restartRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected restart status: %d", restartRes.StatusCode)
	}
	waitForHTTPRuntimeStatus(t, srv.URL, "admin-token", "running")

	stopReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/runtime/gateway/stop", nil)
	if err != nil {
		t.Fatal(err)
	}
	stopReq.Header.Set("Authorization", "Bearer admin-token")
	stopRes, err := http.DefaultClient.Do(stopReq)
	if err != nil {
		t.Fatal(err)
	}
	stopRes.Body.Close()
	if stopRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected stop status: %d", stopRes.StatusCode)
	}
	waitForHTTPRuntimeStatus(t, srv.URL, "admin-token", "stopped")
}

func TestBootstrapStatus_DoesNotDriftAfterSettingsChangeWhileRuntimeIsRunning(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")

	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		ManagedGateway: config.ManagedGatewaySettings{
			Command:      os.Args[0],
			Args:         []string{"-test.run=TestServerHelperProcess", "--", "gateway-mock", "18897"},
			BindHost:     "127.0.0.1",
			BindPort:     18897,
			GatewayToken: "smoke-token-a",
			AutoStart:    false,
		},
	}); err != nil {
		t.Fatal(err)
	}
	bus := events.NewBus(16)
	supervisor := runtimecontrol.NewSupervisorWithOptions(
		store,
		bus,
		runtimecontrol.WithLauncher(func(cfg config.ManagedGatewaySettings) (*exec.Cmd, error) {
			cmd := exec.Command(os.Args[0], "-test.run=TestServerHelperProcess", "--", "gateway-mock", strconv.Itoa(cfg.BindPort))
			cmd.Env = append(os.Environ(), "GO_WANT_SERVER_HELPER_PROCESS=1", "OPENCLAW_GATEWAY_TOKEN="+cfg.GatewayToken)
			return cmd, nil
		}),
		runtimecontrol.WithProbeInterval(20*time.Millisecond),
		runtimecontrol.WithStartupTimeout(2*time.Second),
	)
	client := gateway.New(supervisor)
	realtime := gateway.NewRealtime(supervisor, bus)
	srv := httptest.NewServer(newRouter(store, client, realtime, supervisor, bus))
	defer srv.Close()

	startReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/runtime/gateway/start", nil)
	if err != nil {
		t.Fatal(err)
	}
	startReq.Header.Set("Authorization", "Bearer admin-token")
	startRes, err := http.DefaultClient.Do(startReq)
	if err != nil {
		t.Fatal(err)
	}
	startRes.Body.Close()
	if startRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected start status: %d", startRes.StatusCode)
	}
	waitForHTTPRuntimeStatus(t, srv.URL, "admin-token", "running")

	if err := store.Update(config.Settings{
		ManagedGateway: config.ManagedGatewaySettings{
			Command:      "node",
			Args:         []string{"dist/entry.js", "gateway", "run"},
			BindHost:     "127.0.0.1",
			BindPort:     19999,
			GatewayToken: "smoke-token-b",
			AutoStart:    false,
		},
	}); err != nil {
		t.Fatal(err)
	}

	bootstrapReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/bootstrap/status", nil)
	if err != nil {
		t.Fatal(err)
	}
	bootstrapReq.Header.Set("Authorization", "Bearer admin-token")
	bootstrapRes, err := http.DefaultClient.Do(bootstrapReq)
	if err != nil {
		t.Fatal(err)
	}
	defer bootstrapRes.Body.Close()
	var payload map[string]any
	if err := json.NewDecoder(bootstrapRes.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	runtimePayload, _ := payload["runtime"].(map[string]any)
	if runtimePayload["gatewayUrl"] != "ws://127.0.0.1:18897" {
		t.Fatalf("expected pinned runtime url, got %#v", runtimePayload)
	}
	gatewayPayload, _ := payload["gateway"].(map[string]any)
	if gatewayPayload["connected"] != true {
		t.Fatalf("expected connected bootstrap after settings drift, got %#v", payload)
	}

	stopReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/runtime/gateway/stop", nil)
	if err != nil {
		t.Fatal(err)
	}
	stopReq.Header.Set("Authorization", "Bearer admin-token")
	stopRes, err := http.DefaultClient.Do(stopReq)
	if err != nil {
		t.Fatal(err)
	}
	stopRes.Body.Close()
}

func waitForHTTPRuntimeStatus(t *testing.T, baseURL string, token string, expected string) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		req, err := http.NewRequest(http.MethodGet, baseURL+"/api/runtime/gateway", nil)
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Authorization", "Bearer "+token)
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		var payload map[string]any
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			res.Body.Close()
			t.Fatal(err)
		}
		res.Body.Close()
		runtimePayload, _ := payload["runtime"].(map[string]any)
		if runtimePayload["status"] == expected {
			return
		}
		time.Sleep(50 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for runtime status %s", expected)
}

func TestServerHelperProcess(t *testing.T) {
	if os.Getenv("GO_WANT_SERVER_HELPER_PROCESS") != "1" {
		return
	}
	mode := "gateway-mock"
	port := "18896"
	for idx, arg := range os.Args {
		if arg == "--" && idx+2 < len(os.Args) {
			mode = os.Args[idx+1]
			port = os.Args[idx+2]
			break
		}
	}
	if mode != "gateway-mock" {
		os.Exit(2)
	}

	token := os.Getenv("OPENCLAW_GATEWAY_TOKEN")
	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	server := &http.Server{
		Addr: "127.0.0.1:" + port,
		Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			conn, err := upgrader.Upgrade(w, r, nil)
			if err != nil {
				os.Exit(3)
				return
			}
			defer conn.Close()

			_ = conn.WriteJSON(map[string]any{
				"type":    "event",
				"event":   "connect.challenge",
				"payload": map[string]any{"nonce": "nonce-1"},
			})

			for {
				_, raw, err := conn.ReadMessage()
				if err != nil {
					return
				}
				var frame map[string]any
				if err := json.Unmarshal(raw, &frame); err != nil {
					continue
				}
				method, _ := frame["method"].(string)
				id, _ := frame["id"].(string)
				params, _ := frame["params"].(map[string]any)

				switch method {
				case "connect":
					auth, _ := params["auth"].(map[string]any)
					if auth["token"] != token {
						_ = conn.WriteJSON(map[string]any{
							"type": "res",
							"id":   id,
							"error": map[string]any{
								"code":    "unauthorized",
								"message": "token mismatch",
							},
						})
						continue
					}
					_ = conn.WriteJSON(map[string]any{
						"type":    "res",
						"id":      id,
						"payload": map[string]any{"ready": true},
					})
				case "health":
					_ = conn.WriteJSON(map[string]any{
						"type":    "res",
						"id":      id,
						"payload": map[string]any{"ok": true},
					})
				case "gateway.describe":
					_ = conn.WriteJSON(map[string]any{
						"type": "res",
						"id":   id,
						"payload": map[string]any{
							"schemaVersion": "v1",
							"methods":       map[string]any{"health": map[string]any{}, "gateway.describe": map[string]any{}},
							"events":        map[string]any{"runtime.gateway.status": map[string]any{}},
						},
					})
				default:
					_ = conn.WriteJSON(map[string]any{
						"type":    "res",
						"id":      id,
						"payload": map[string]any{"ok": true},
					})
				}
			}
		}),
	}
	go func() {
		_ = server.ListenAndServe()
	}()
	select {}
}
