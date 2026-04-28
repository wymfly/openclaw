package transport

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestProbeConnection_ReusesGatewayClientConnection(t *testing.T) {
	var connCount atomic.Int32
	server := newProbeGatewayServer(t, &connCount)
	defer server.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := ProbeConnection(ctx, strings.Replace(server.URL, "http://", "ws://", 1), "token-1"); err != nil {
		t.Fatal(err)
	}
	if err := ProbeConnection(ctx, strings.Replace(server.URL, "http://", "ws://", 1), "token-1"); err != nil {
		t.Fatal(err)
	}
	if got := connCount.Load(); got != 1 {
		t.Fatalf("expected health probes to reuse 1 connection, got %d", got)
	}
}

func newProbeGatewayServer(t *testing.T, connCount *atomic.Int32) *httptest.Server {
	t.Helper()
	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("upgrade failed: %v", err)
			return
		}
		connCount.Add(1)
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
			"payload": map[string]any{"ready": true},
		}); err != nil {
			t.Errorf("connect response write failed: %v", err)
			return
		}

		for {
			_, raw, err = conn.ReadMessage()
			if err != nil {
				return
			}
			var reqFrame map[string]any
			if err := json.Unmarshal(raw, &reqFrame); err != nil {
				continue
			}
			if err := conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      reqFrame["id"],
				"payload": map[string]any{"ok": true},
			}); err != nil {
				return
			}
		}
	}))
}
