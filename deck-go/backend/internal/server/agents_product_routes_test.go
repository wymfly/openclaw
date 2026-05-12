package server

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/gorilla/websocket"
)

func TestGatewayFacade_DeckAgentsProductActionRoutesThroughConfigPatch(t *testing.T) {
	expectedCalls := []string{"config.get", "config.patch"}
	callIndex := 0
	srv := newPersistentGatewayBackedServer(t, func(conn *websocket.Conn, method string, params map[string]any) {
		if callIndex >= len(expectedCalls) {
			t.Fatalf("unexpected extra method: %s", method)
		}
		if method != expectedCalls[callIndex] {
			t.Fatalf("unexpected method at index %d: %s", callIndex, method)
		}
		switch method {
		case "config.get":
			_ = conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      params["_requestID"],
				"ok":      true,
				"payload": map[string]any{"hash": "hash-1", "config": map[string]any{"agents": map[string]any{"list": []any{}}}},
			})
		case "config.patch":
			if params["baseHash"] != "hash-1" {
				t.Fatalf("unexpected baseHash: %#v", params)
			}
			raw, _ := params["raw"].(string)
			if !strings.Contains(raw, `"agents"`) || !strings.Contains(raw, `"thinkingDefault":"high"`) {
				t.Fatalf("unexpected raw patch: %s", raw)
			}
			_ = conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      params["_requestID"],
				"ok":      true,
				"payload": map[string]any{"ok": true, "hash": "hash-2"},
			})
		}
		callIndex++
	})
	defer srv.Close()

	req, err := http.NewRequest(http.MethodPost, srv.URL+"/api/deck/agents", strings.NewReader(`{"action":"cognition.set","agentId":"main","baseHash":"hash-1","thinkingDefault":"high"}`))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer admin-token")
	req.Header.Set("Content-Type", "application/json")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: %d", res.StatusCode)
	}
	if callIndex != len(expectedCalls) {
		t.Fatalf("expected %d gateway calls, got %d", len(expectedCalls), callIndex)
	}
}

func TestGatewayFacade_DeckAgentsDefaultsRoute(t *testing.T) {
	expectedCalls := []string{"config.get", "config.patch", "config.get"}
	callIndex := 0
	srv := newPersistentGatewayBackedServer(t, func(conn *websocket.Conn, method string, params map[string]any) {
		if callIndex >= len(expectedCalls) {
			t.Fatalf("unexpected extra method: %s", method)
		}
		if method != expectedCalls[callIndex] {
			t.Fatalf("unexpected method at index %d: %s", callIndex, method)
		}
		switch method {
		case "config.get":
			hash := "hash-1"
			if callIndex == 2 {
				hash = "hash-2"
			}
			_ = conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      params["_requestID"],
				"ok":      true,
				"payload": map[string]any{"hash": hash, "config": map[string]any{"agents": map[string]any{"defaults": map[string]any{}}}},
			})
		case "config.patch":
			raw, _ := params["raw"].(string)
			if !strings.Contains(raw, `"workspace":"/tmp/defaults"`) {
				t.Fatalf("unexpected defaults patch: %s", raw)
			}
			_ = conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      params["_requestID"],
				"ok":      true,
				"payload": map[string]any{"ok": true, "hash": "hash-2"},
			})
		}
		callIndex++
	})
	defer srv.Close()

	req, err := http.NewRequest(http.MethodPost, srv.URL+"/api/deck/agents/defaults", strings.NewReader(`{"action":"defaults.workspace.set","baseHash":"hash-1","value":{"workspace":"/tmp/defaults"}}`))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer admin-token")
	req.Header.Set("Content-Type", "application/json")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		var payload map[string]any
		_ = json.NewDecoder(res.Body).Decode(&payload)
		t.Fatalf("unexpected status: %d payload=%#v", res.StatusCode, payload)
	}
	if callIndex != len(expectedCalls) {
		t.Fatalf("expected %d gateway calls, got %d", len(expectedCalls), callIndex)
	}
}
