package gateway

import (
	"context"
	"encoding/json"
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

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		GatewayURL:   wsURL,
		GatewayToken: "test-token",
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

