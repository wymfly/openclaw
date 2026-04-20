package gateway

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
)

func TestRealtime_SubscribeSessionPublishesSessionEventsToBus(t *testing.T) {
	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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
			"type":    "res",
			"id":      connectFrame["id"],
			"payload": map[string]any{"ready": true},
		})

		for i := 0; i < 2; i++ {
			_, raw, _ = conn.ReadMessage()
			var reqFrame map[string]any
			_ = json.Unmarshal(raw, &reqFrame)
			method, _ := reqFrame["method"].(string)
			_ = conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      reqFrame["id"],
				"payload": map[string]any{"ok": true, "method": method},
			})
		}

		_ = conn.WriteJSON(map[string]any{
			"type":  "event",
			"event": "session.message",
			"payload": map[string]any{
				"sessionKey": "session-1",
				"message": map[string]any{
					"id":   "msg-1",
					"role": "assistant",
					"content": []map[string]any{{
						"type": "text",
						"text": "hello",
					}},
					"timestamp": 1,
				},
			},
		})
		_ = conn.WriteJSON(map[string]any{
			"type":  "event",
			"event": "session.tool",
			"payload": map[string]any{
				"runId":      "run-1",
				"seq":        1,
				"stream":     "tool",
				"ts":         1,
				"sessionKey": "session-1",
				"data": map[string]any{
					"phase": "completed",
				},
			},
		})
		_ = conn.WriteJSON(map[string]any{
			"type":  "event",
			"event": "sessions.changed",
			"payload": map[string]any{
				"sessionKey": "session-1",
				"ts":         1,
				"reason":     "send",
			},
		})
		time.Sleep(100 * time.Millisecond)
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

	bus := events.NewBus(16)
	sub := bus.Subscribe()
	defer bus.Unsubscribe(sub)

	realtime := NewRealtime(store, bus)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := realtime.SubscribeSession(ctx, "session-1"); err != nil {
		t.Fatal(err)
	}

	expectBusEvent(t, sub, "session.message")
	expectBusEvent(t, sub, "session.tool")
	expectBusEvent(t, sub, "sessions.changed")
}

func expectBusEvent(t *testing.T, sub chan events.Event, expected string) {
	t.Helper()
	deadline := time.After(5 * time.Second)
	for {
		select {
		case <-deadline:
			t.Fatalf("timed out waiting for bus event %s", expected)
		case event := <-sub:
			if event.Type == expected {
				return
			}
		}
	}
}
