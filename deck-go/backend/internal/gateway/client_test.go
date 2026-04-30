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
	defer client.realtime.Close()
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

func TestClientRequest_RejectsMissingManagedConnection(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	client := New(store)
	defer client.realtime.Close()
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if _, err := client.Request(ctx, "health", map[string]any{}); err == nil {
		t.Fatal("expected managed connection error")
	}
}

func TestCompleteConnect_NonceMissingFailsLoudly(t *testing.T) {
	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("upgrade failed: %v", err)
			return
		}
		defer conn.Close()
		_ = conn.WriteJSON(map[string]any{
			"type":    "event",
			"event":   "connect.challenge",
			"payload": map[string]any{},
		})
	}))
	defer server.Close()

	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	realtime := NewRealtime(&mutableProvider{url: wsURL(server.URL), token: "token-1", ok: true}, nil)
	defer realtime.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := realtime.Request(ctx, "health", map[string]any{})
	if err == nil || !strings.Contains(err.Error(), "nonce missing or non-string") {
		t.Fatalf("expected loud nonce error, got %v", err)
	}
}

func TestCompleteConnect_SignFailureFailsLoudly(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	identity, err := loadOrCreateDeviceIdentity()
	if err != nil {
		t.Fatal(err)
	}
	path, err := resolveDeviceIdentityPath()
	if err != nil {
		t.Fatal(err)
	}
	if err := persistDeviceIdentity(path, storedDeviceIdentity{
		Version:       1,
		DeviceID:      identity.deviceID,
		PublicKeyPEM:  identity.publicKeyPEM,
		PrivateKeyPEM: "not a pem private key",
		CreatedAtMS:   time.Now().UnixMilli(),
	}); err != nil {
		t.Fatal(err)
	}

	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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
		_ = conn.SetReadDeadline(time.Now().Add(200 * time.Millisecond))
		if _, _, err := conn.ReadMessage(); err == nil {
			t.Errorf("unexpected unsigned connect frame after signing failure")
		}
	}))
	defer server.Close()

	realtime := NewRealtime(&mutableProvider{url: wsURL(server.URL), token: "token-1", ok: true}, nil)
	defer realtime.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err = realtime.Request(ctx, "health", map[string]any{})
	if err == nil || !strings.Contains(err.Error(), "device signing failed") {
		t.Fatalf("expected loud signing error, got %v", err)
	}
}

func TestProbeHealthEvictsAfterConsecutiveFailures(t *testing.T) {
	ShutdownProbeClients()
	t.Cleanup(ShutdownProbeClients)
	t.Setenv("GATEWAY_PROBE_FAILURE_THRESHOLD", "2")

	server := newRPCGatewayServer(t, rpcGatewayOptions{
		errorFrames: map[string]responseError{
			"health": {
				Code:    "validation_failed",
				Message: "missing x",
			},
		},
	})
	defer server.Close()

	upstreamURL := wsURL(server.URL)
	token := "token-1"
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := ProbeHealth(ctx, upstreamURL, token); err == nil {
		t.Fatal("expected first probe failure")
	}
	first := mustProbeEntry(t, upstreamURL, token)
	if first.client.realtimeClosed() {
		t.Fatal("expected first failed probe to keep cached client below threshold")
	}

	if err := ProbeHealth(ctx, upstreamURL, token); err == nil {
		t.Fatal("expected second probe failure")
	}
	if _, ok := healthProbeClients.Load(healthProbeClientKey(upstreamURL, token)); ok {
		t.Fatal("expected cached probe client to be evicted at threshold")
	}
	if !first.client.realtimeClosed() {
		t.Fatal("expected evicted probe client realtime to close")
	}

	if err := ProbeHealth(ctx, upstreamURL, token); err == nil {
		t.Fatal("expected rebuilt probe client to still see server failure")
	}
	rebuilt := mustProbeEntry(t, upstreamURL, token)
	if rebuilt == first {
		t.Fatal("expected probe client to be rebuilt after eviction")
	}
}

func TestInvalidateProbeClientEvictsAndCloses(t *testing.T) {
	ShutdownProbeClients()
	t.Cleanup(ShutdownProbeClients)

	server := newRPCGatewayServer(t, rpcGatewayOptions{})
	defer server.Close()

	upstreamURL := wsURL(server.URL)
	token := "token-1"
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := ProbeHealth(ctx, upstreamURL, token); err != nil {
		t.Fatal(err)
	}
	entry := mustProbeEntry(t, upstreamURL, token)

	InvalidateProbeClient(upstreamURL, token)

	if _, ok := healthProbeClients.Load(healthProbeClientKey(upstreamURL, token)); ok {
		t.Fatal("expected explicit invalidate to evict probe client")
	}
	if !entry.client.realtimeClosed() {
		t.Fatal("expected explicit invalidate to close realtime")
	}
}

func TestShutdownProbeClientsClosesAllEntries(t *testing.T) {
	ShutdownProbeClients()
	t.Cleanup(ShutdownProbeClients)

	server := newRPCGatewayServer(t, rpcGatewayOptions{})
	defer server.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := ProbeHealth(ctx, wsURL(server.URL), "token-1"); err != nil {
		t.Fatal(err)
	}
	if err := ProbeHealth(ctx, wsURL(server.URL), "token-2"); err != nil {
		t.Fatal(err)
	}
	first := mustProbeEntry(t, wsURL(server.URL), "token-1")
	second := mustProbeEntry(t, wsURL(server.URL), "token-2")

	ShutdownProbeClients()

	for _, token := range []string{"token-1", "token-2"} {
		if _, ok := healthProbeClients.Load(healthProbeClientKey(wsURL(server.URL), token)); ok {
			t.Fatalf("expected probe client for %s to be evicted", token)
		}
	}
	if !first.client.realtimeClosed() || !second.client.realtimeClosed() {
		t.Fatal("expected shutdown to close all cached realtime clients")
	}
}

func TestRequestDirectWithOptionsUsesHeadersAndTLSVerifyToggle(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
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

	upstreamURL := "wss://" + strings.TrimPrefix(server.URL, "https://")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	payload, err := RequestDirectWithOptions(ctx, upstreamURL, "secret-token", "gateway.describe", map[string]any{}, DirectRequestOptions{
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

func mustProbeEntry(t *testing.T, upstreamURL string, token string) *healthProbeClientEntry {
	t.Helper()
	value, ok := healthProbeClients.Load(healthProbeClientKey(upstreamURL, token))
	if !ok {
		t.Fatalf("missing probe client entry for %s", upstreamURL)
	}
	entry, ok := value.(*healthProbeClientEntry)
	if !ok {
		t.Fatalf("expected healthProbeClientEntry, got %T", value)
	}
	return entry
}

func (c *Client) realtimeClosed() bool {
	c.realtime.mu.Lock()
	defer c.realtime.mu.Unlock()
	return c.realtime.closed
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
