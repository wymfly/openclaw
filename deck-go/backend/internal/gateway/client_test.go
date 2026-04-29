package gateway

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
)

func TestClientRequest_CompletesChallengeConnectAndRequest(t *testing.T) {
	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("upgrade failed: %v", err)
			return
		}
		defer conn.Close()

		if err := conn.WriteJSON(map[string]any{
			"type":  "event",
			"event": "connect.challenge",
			"payload": map[string]any{
				"nonce": "nonce-1",
			},
		}); err != nil {
			t.Errorf("challenge write failed: %v", err)
			return
		}

		_, raw, err := conn.ReadMessage()
		if err != nil {
			t.Errorf("connect read failed: %v", err)
			return
		}
		var connectFrame map[string]any
		if err := json.Unmarshal(raw, &connectFrame); err != nil {
			t.Errorf("connect frame parse failed: %v", err)
			return
		}
		if connectFrame["method"] != "connect" {
			t.Errorf("expected connect method, got %#v", connectFrame["method"])
			return
		}
		params, _ := connectFrame["params"].(map[string]any)
		device, _ := params["device"].(map[string]any)
		if strings.TrimSpace(fmt.Sprint(device["id"])) == "" {
			t.Errorf("expected signed device identity on connect frame, got %#v", params["device"])
			return
		}
		if err := conn.WriteJSON(map[string]any{
			"type": "res",
			"id":   connectFrame["id"],
			"ok":   true,
			"payload": map[string]any{
				"ready": true,
			},
		}); err != nil {
			t.Errorf("connect response write failed: %v", err)
			return
		}

		_, raw, err = conn.ReadMessage()
		if err != nil {
			t.Errorf("request read failed: %v", err)
			return
		}
		var reqFrame map[string]any
		if err := json.Unmarshal(raw, &reqFrame); err != nil {
			t.Errorf("request frame parse failed: %v", err)
			return
		}
		if reqFrame["method"] != "gateway.describe" {
			t.Errorf("expected gateway.describe method, got %#v", reqFrame["method"])
			return
		}
		if err := conn.WriteJSON(map[string]any{
			"type": "res",
			"id":   reqFrame["id"],
			"ok":   true,
			"payload": map[string]any{
				"protocol": 3,
			},
		}); err != nil {
			t.Errorf("request response write failed: %v", err)
			return
		}
	}))
	defer server.Close()

	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		ManagedGateway: config.ManagedGatewaySettings{
			BindHost:     "127.0.0.1",
			BindPort:     mustPort(t, server.URL),
			GatewayToken: "test-token",
		},
	}); err != nil {
		t.Fatal(err)
	}

	client := New(store)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	payload, err := client.Request(ctx, "gateway.describe", map[string]any{
		"filter":         "all",
		"includeSchemas": true,
	})
	if err != nil {
		t.Fatal(err)
	}
	result, ok := payload.(map[string]any)
	if !ok {
		t.Fatalf("unexpected payload type: %#v", payload)
	}
	if result["protocol"] != float64(3) {
		t.Fatalf("unexpected payload: %#v", result)
	}
}

func TestRequestDirect_RejectsMissingManagedConnection(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	client := New(store)
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if _, err := client.Request(ctx, "health", map[string]any{}); err == nil {
		t.Fatal("expected managed connection error")
	}
}

func TestRequestDirectWithOptionsUsesHeadersAndTLSVerifyToggle(t *testing.T) {
	authHeaders := make(chan string, 1)
	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeaders <- r.Header.Get("Authorization")
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("upgrade failed: %v", err)
			return
		}
		defer conn.Close()

		if err := conn.WriteJSON(map[string]any{
			"type":    "event",
			"event":   "connect.challenge",
			"payload": map[string]any{"nonce": "nonce-1"},
		}); err != nil {
			t.Errorf("challenge write failed: %v", err)
			return
		}
		_, raw, err := conn.ReadMessage()
		if err != nil {
			t.Errorf("connect read failed: %v", err)
			return
		}
		var connectFrame map[string]any
		if err := json.Unmarshal(raw, &connectFrame); err != nil {
			t.Errorf("connect frame parse failed: %v", err)
			return
		}
		if err := conn.WriteJSON(map[string]any{
			"type":    "res",
			"id":      connectFrame["id"],
			"payload": map[string]any{"ok": true},
		}); err != nil {
			t.Errorf("connect response write failed: %v", err)
			return
		}
		_, raw, err = conn.ReadMessage()
		if err != nil {
			t.Errorf("request read failed: %v", err)
			return
		}
		var reqFrame map[string]any
		if err := json.Unmarshal(raw, &reqFrame); err != nil {
			t.Errorf("request frame parse failed: %v", err)
			return
		}
		if err := conn.WriteJSON(map[string]any{
			"type":    "res",
			"id":      reqFrame["id"],
			"payload": map[string]any{"ok": true},
		}); err != nil {
			t.Errorf("request response write failed: %v", err)
		}
	}))
	defer server.Close()

	wsURL := "wss://" + strings.TrimPrefix(server.URL, "https://")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	payload, err := RequestDirectWithOptions(ctx, wsURL, "secret-token", "gateway.describe", map[string]any{}, DirectRequestOptions{
		InsecureSkipTLSVerify: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if result, ok := payload.(map[string]any); !ok || result["ok"] != true {
		t.Fatalf("unexpected payload: %#v", payload)
	}
	if got := <-authHeaders; got != "Bearer secret-token" {
		t.Fatalf("Authorization header = %q", got)
	}
}

func mustPort(t *testing.T, serverURL string) int {
	t.Helper()
	value := strings.TrimPrefix(serverURL, "http://127.0.0.1:")
	var port int
	if _, err := fmt.Sscanf(value, "%d", &port); err != nil {
		t.Fatalf("failed to parse port from %q: %v", serverURL, err)
	}
	return port
}
