package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gorilla/websocket"
	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway"
)

func TestSettingsRoute_RoundTrip(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")

	srv := httptest.NewServer(New())
	defer srv.Close()

	putReq, err := http.NewRequest(http.MethodPut, srv.URL+"/api/settings", strings.NewReader(`{
	  "gatewayUrl":"ws://127.0.0.1:18789/ws",
	  "gatewayToken":"gateway-token"
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
	if settings["gatewayUrl"] != "ws://127.0.0.1:18789/ws" {
		t.Fatalf("unexpected settings payload: %#v", settings)
	}
}

func TestBootstrapStatus_UsesGatewayDescribe(t *testing.T) {
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
	t.Setenv("DECK_GO_GATEWAY_URL", "ws"+strings.TrimPrefix(wsServer.URL, "http"))
	t.Setenv("DECK_GO_GATEWAY_TOKEN", "gateway-token")

	srv := httptest.NewServer(New())
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
	gateway, ok := payload["gateway"].(map[string]any)
	if !ok {
		t.Fatalf("unexpected payload: %#v", payload)
	}
	if gateway["connected"] != true {
		t.Fatalf("expected connected bootstrap status, got %#v", gateway)
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
	bus.Publish("runtime.status", []byte(`{"ok":true}`))
	client := gateway.New(store)
	realtime := gateway.NewRealtime(store, bus)

	handler := newRouter(store, client, realtime, bus)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	req := httptest.NewRequest(http.MethodGet, "/api/stream", nil).WithContext(ctx)
	req.Header.Set("Authorization", "Bearer admin-token")
	req.Header.Set("Last-Event-ID", "0")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	body := rec.Body.String()
	if !strings.Contains(body, "event: runtime.status") {
		t.Fatalf("unexpected body: %s", body)
	}
}
