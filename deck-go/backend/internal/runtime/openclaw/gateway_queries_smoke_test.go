package openclaw

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway"
)

type gatewayQuerySmokeProvider struct {
	url   string
	token string
}

func (p gatewayQuerySmokeProvider) GatewayConnection() (string, string, bool) {
	return p.url, p.token, true
}

func TestGatewayQueriesRepresentativeWrappersSmoke(t *testing.T) {
	var connCount atomic.Int32
	requests := make(chan gatewayQuerySmokeRequest, 8)
	server := newGatewayQueriesSmokeServer(t, &connCount, requests)
	defer server.Close()

	realtime := gateway.NewRealtime(
		gatewayQuerySmokeProvider{url: strings.Replace(server.URL, "http://", "ws://", 1), token: "token-1"},
		events.NewNoopBus(),
	)
	defer realtime.Close()

	queries := NewGatewayQueries(gateway.NewClientWithRealtime(realtime))
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cases := []struct {
		name   string
		call   func() (any, error)
		method string
		params map[string]any
	}{
		{
			name: "agents list",
			call: func() (any, error) {
				return queries.AgentsList(ctx)
			},
			method: "agents.list",
			params: map[string]any{},
		},
		{
			name: "usage cost",
			call: func() (any, error) {
				return queries.UsageCost(ctx, map[string]any{"from": "today"})
			},
			method: "usage.cost",
			params: map[string]any{"from": "today"},
		},
		{
			name: "sessions list",
			call: func() (any, error) {
				return queries.SessionsListRaw(ctx, map[string]any{"limit": 5})
			},
			method: "sessions.list",
			params: map[string]any{"limit": 5},
		},
		{
			name: "health",
			call: func() (any, error) {
				return queries.Health(ctx)
			},
			method: "health",
			params: map[string]any{},
		},
		{
			name: "config get",
			call: func() (any, error) {
				return queries.ConfigGet(ctx)
			},
			method: "config.get",
			params: map[string]any{},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := tc.call()
			if err != nil {
				t.Fatal(err)
			}
			req := expectGatewayQuerySmokeRequest(t, requests, tc.method)
			if !reflect.DeepEqual(req.params, normalizeGatewayQuerySmokeParams(t, tc.params)) {
				t.Fatalf("expected params %#v, got %#v", tc.params, req.params)
			}
		})
	}
	if got := connCount.Load(); got != 1 {
		t.Fatalf("expected representative wrappers to share 1 websocket connection, got %d", got)
	}
}

type gatewayQuerySmokeRequest struct {
	method string
	params map[string]any
}

func newGatewayQueriesSmokeServer(
	t *testing.T,
	connCount *atomic.Int32,
	requests chan<- gatewayQuerySmokeRequest,
) *httptest.Server {
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
		if connectFrame["method"] != "connect" {
			t.Errorf("expected connect method, got %#v", connectFrame["method"])
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
			method, _ := reqFrame["method"].(string)
			params, _ := reqFrame["params"].(map[string]any)
			requests <- gatewayQuerySmokeRequest{method: method, params: params}
			if err := conn.WriteJSON(map[string]any{
				"type": "res",
				"id":   reqFrame["id"],
				"payload": map[string]any{
					"method": method,
					"params": params,
				},
			}); err != nil {
				return
			}
		}
	}))
}

func normalizeGatewayQuerySmokeParams(t *testing.T, params map[string]any) any {
	t.Helper()
	if len(params) == 0 {
		return map[string]any(nil)
	}
	raw, err := json.Marshal(params)
	if err != nil {
		t.Fatal(err)
	}
	var normalized map[string]any
	if err := json.Unmarshal(raw, &normalized); err != nil {
		t.Fatal(err)
	}
	return normalized
}

func expectGatewayQuerySmokeRequest(
	t *testing.T,
	requests <-chan gatewayQuerySmokeRequest,
	expected string,
) gatewayQuerySmokeRequest {
	t.Helper()
	select {
	case got := <-requests:
		if got.method != expected {
			t.Fatalf("expected method %q, got %q", expected, got.method)
		}
		return got
	case <-time.After(time.Second):
		t.Fatalf("timed out waiting for method %q", expected)
		return gatewayQuerySmokeRequest{}
	}
}
