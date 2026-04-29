package openclaw

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway"
)

func TestProbeConnection_UsesGatewayHandshakeAndHealth(t *testing.T) {
	gateway.ShutdownProbeClients()
	t.Cleanup(gateway.ShutdownProbeClients)

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
		if reqFrame["method"] != "health" {
			t.Errorf("expected health method, got %#v", reqFrame["method"])
			return
		}
		if err := conn.WriteJSON(map[string]any{
			"type": "res",
			"id":   reqFrame["id"],
			"ok":   true,
			"payload": map[string]any{
				"ok": true,
			},
		}); err != nil {
			t.Errorf("health response write failed: %v", err)
			return
		}
	}))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := ProbeConnection(ctx, wsURL, "token-1"); err != nil {
		t.Fatalf("expected probe to succeed: %v", err)
	}
}

func TestProbeManagedHealth_UsesManagedGatewaySettings(t *testing.T) {
	gateway.ShutdownProbeClients()
	t.Cleanup(gateway.ShutdownProbeClients)

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
				"nonce": "nonce-2",
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
		if reqFrame["method"] != "health" {
			t.Errorf("expected health method, got %#v", reqFrame["method"])
			return
		}
		if err := conn.WriteJSON(map[string]any{
			"type": "res",
			"id":   reqFrame["id"],
			"ok":   true,
			"payload": map[string]any{
				"ok": true,
			},
		}); err != nil {
			t.Errorf("health response write failed: %v", err)
			return
		}
	}))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := ProbeManagedHealth(ctx, config.ManagedGatewaySettings{
		BindHost:     mustHost(t, server.URL),
		BindPort:     mustPortFromURL(t, server.URL),
		GatewayToken: "token-2",
	}); err != nil {
		t.Fatalf("expected managed probe to succeed: %v", err)
	}
	if wsURL == "" {
		t.Fatal("expected websocket url")
	}
}

func mustHost(t *testing.T, rawURL string) string {
	t.Helper()
	parsed, err := url.Parse(rawURL)
	if err != nil {
		t.Fatal(err)
	}
	return parsed.Hostname()
}

func mustPortFromURL(t *testing.T, rawURL string) int {
	t.Helper()
	parsed, err := url.Parse(rawURL)
	if err != nil {
		t.Fatal(err)
	}
	port, err := strconv.Atoi(parsed.Port())
	if err != nil {
		t.Fatal(err)
	}
	return port
}
