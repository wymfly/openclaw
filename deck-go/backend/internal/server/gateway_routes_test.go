package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
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

func TestGatewayFacade_ConfigSchemaLookup(t *testing.T) {
	srv := newGatewayBackedServer(t, func(conn *websocket.Conn, method string, params map[string]any) {
		if method != "config.schema.lookup" {
			t.Fatalf("unexpected method: %s", method)
		}
		if params["path"] != "agents.main" {
			t.Fatalf("unexpected params: %#v", params)
		}
		_ = conn.WriteJSON(map[string]any{
			"type": "res",
			"id":   params["_requestID"],
			"ok":   true,
			"payload": map[string]any{
				"path": "agents.main",
			},
		})
	})
	defer srv.Close()

	req, err := http.NewRequest(http.MethodPost, srv.URL+"/api/config/schema-lookup", strings.NewReader(`{"path":"agents.main"}`))
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
	var payload map[string]any
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if payload["path"] != "agents.main" {
		t.Fatalf("unexpected payload: %#v", payload)
	}
}

func TestGatewayFacade_ChatSend(t *testing.T) {
	srv := newGatewayBackedServer(t, func(conn *websocket.Conn, method string, params map[string]any) {
		if method != "sessions.send" {
			t.Fatalf("unexpected method: %s", method)
		}
		if params["key"] != "session-1" || params["message"] != "hello" {
			t.Fatalf("unexpected params: %#v", params)
		}
		_ = conn.WriteJSON(map[string]any{
			"type": "res",
			"id":   params["_requestID"],
			"ok":   true,
			"payload": map[string]any{
				"runId":      "run-1",
				"status":     "started",
				"messageSeq": 1,
			},
		})
	})
	defer srv.Close()

	req, err := http.NewRequest(http.MethodPost, srv.URL+"/api/chat/send", strings.NewReader(`{"sessionKey":"session-1","message":"hello"}`))
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
	var payload map[string]any
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if payload["runId"] != "run-1" || payload["status"] != "started" {
		t.Fatalf("unexpected payload: %#v", payload)
	}
}

func TestGatewayFacade_ChatSessionCreate(t *testing.T) {
	srv := newGatewayBackedServer(t, func(conn *websocket.Conn, method string, params map[string]any) {
		if method != "sessions.create" {
			t.Fatalf("unexpected method: %s", method)
		}
		if params["agentId"] != "main" || params["message"] != "hello" {
			t.Fatalf("unexpected params: %#v", params)
		}
		_ = conn.WriteJSON(map[string]any{
			"type": "res",
			"id":   params["_requestID"],
			"ok":   true,
			"payload": map[string]any{
				"key":        "session-1",
				"sessionId":  "session-1",
				"runStarted": true,
				"runId":      "run-1",
				"status":     "started",
			},
		})
	})
	defer srv.Close()

	req, err := http.NewRequest(http.MethodPost, srv.URL+"/api/chat/sessions/create", strings.NewReader(`{"agentId":"main","message":"hello"}`))
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
	var payload map[string]any
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if payload["key"] != "session-1" || payload["runId"] != "run-1" || payload["status"] != "started" {
		t.Fatalf("unexpected create payload: %#v", payload)
	}
}

func TestGatewayFacade_SessionsList(t *testing.T) {
	srv := newGatewayBackedServer(t, func(conn *websocket.Conn, method string, params map[string]any) {
		if method != "sessions.list" {
			t.Fatalf("unexpected method: %s", method)
		}
		_ = conn.WriteJSON(map[string]any{
			"type": "res",
			"id":   params["_requestID"],
			"ok":   true,
			"payload": map[string]any{
				"sessions": []map[string]any{{
					"key":                "session-1",
					"agentId":            "main",
					"title":              "Test Session",
					"lastMessagePreview": "hello",
					"status":             "running",
				}},
			},
		})
	})
	defer srv.Close()

	req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/sessions?limit=10", nil)
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
	sessions, ok := payload["sessions"].([]any)
	if !ok || len(sessions) != 1 {
		t.Fatalf("unexpected payload: %#v", payload)
	}
	session, ok := sessions[0].(map[string]any)
	if !ok || session["key"] != "session-1" || session["title"] != "Test Session" {
		t.Fatalf("unexpected normalized session payload: %#v", payload)
	}
}

func TestGatewayFacade_ChannelsAndPlugins(t *testing.T) {
	expectedCalls := []string{"channels.status", "deck.plugins.list"}
	callIndex := 0

	srv := newGatewayBackedServer(t, func(conn *websocket.Conn, method string, params map[string]any) {
		if callIndex >= len(expectedCalls) {
			t.Fatalf("unexpected extra method: %s", method)
		}
		if method != expectedCalls[callIndex] {
			t.Fatalf("unexpected method at index %d: %s", callIndex, method)
		}
		switch method {
		case "channels.status":
			_ = conn.WriteJSON(map[string]any{
				"type": "res",
				"id":   params["_requestID"],
				"ok":   true,
				"payload": map[string]any{
					"channelOrder": []string{"wechat"},
				},
			})
		case "deck.plugins.list":
			_ = conn.WriteJSON(map[string]any{
				"type": "res",
				"id":   params["_requestID"],
				"ok":   true,
				"payload": map[string]any{
					"plugins": []map[string]any{{"id": "wecom"}},
				},
			})
		}
		callIndex++
	})
	defer srv.Close()

	channelReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/channels?probe=true", nil)
	if err != nil {
		t.Fatal(err)
	}
	channelReq.Header.Set("Authorization", "Bearer admin-token")
	channelRes, err := http.DefaultClient.Do(channelReq)
	if err != nil {
		t.Fatal(err)
	}
	defer channelRes.Body.Close()
	if channelRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected channel status: %d", channelRes.StatusCode)
	}

	pluginReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/deck/plugins?capability=all", nil)
	if err != nil {
		t.Fatal(err)
	}
	pluginReq.Header.Set("Authorization", "Bearer admin-token")
	pluginRes, err := http.DefaultClient.Do(pluginReq)
	if err != nil {
		t.Fatal(err)
	}
	defer pluginRes.Body.Close()
	if pluginRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected plugin status: %d", pluginRes.StatusCode)
	}
}

func TestGatewayFacade_LogsAndGatewayHealth(t *testing.T) {
	expectedCalls := []string{"logs.tail", "health"}
	callIndex := 0

	srv := newGatewayBackedServer(t, func(conn *websocket.Conn, method string, params map[string]any) {
		if method != expectedCalls[callIndex] {
			t.Fatalf("unexpected method at index %d: %s", callIndex, method)
		}
		switch method {
		case "logs.tail":
			_ = conn.WriteJSON(map[string]any{
				"type": "res",
				"id":   params["_requestID"],
				"ok":   true,
				"payload": map[string]any{
					"lines": []string{"hello"},
				},
			})
		case "health":
			_ = conn.WriteJSON(map[string]any{
				"type": "res",
				"id":   params["_requestID"],
				"ok":   true,
				"payload": map[string]any{
					"ok": true,
				},
			})
		}
		callIndex++
	})
	defer srv.Close()

	logReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/logs?limit=1", nil)
	if err != nil {
		t.Fatal(err)
	}
	logReq.Header.Set("Authorization", "Bearer admin-token")
	logRes, err := http.DefaultClient.Do(logReq)
	if err != nil {
		t.Fatal(err)
	}
	defer logRes.Body.Close()
	if logRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected logs status: %d", logRes.StatusCode)
	}

	healthReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/gateway/health", nil)
	if err != nil {
		t.Fatal(err)
	}
	healthReq.Header.Set("Authorization", "Bearer admin-token")
	healthRes, err := http.DefaultClient.Do(healthReq)
	if err != nil {
		t.Fatal(err)
	}
	defer healthRes.Body.Close()
	if healthRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected gateway health status: %d", healthRes.StatusCode)
	}
}

func TestGatewayFacade_ChannelPatchUsesConfigGetThenConfigPatch(t *testing.T) {
	expectedCalls := []string{"config.get", "config.patch"}
	callIndex := 0

	srv := newGatewayBackedServer(t, func(conn *websocket.Conn, method string, params map[string]any) {
		if method != expectedCalls[callIndex] {
			t.Fatalf("unexpected method at index %d: %s", callIndex, method)
		}
		switch method {
		case "config.get":
			_ = conn.WriteJSON(map[string]any{
				"type": "res",
				"id":   params["_requestID"],
				"ok":   true,
				"payload": map[string]any{
					"config":   map[string]any{},
					"baseHash": "base-hash-1",
				},
			})
		case "config.patch":
			if params["baseHash"] != "base-hash-1" {
				t.Fatalf("expected baseHash passthrough, got %#v", params)
			}
			raw, _ := params["raw"].(string)
			if !strings.Contains(raw, "\"wechat\"") || !strings.Contains(raw, "\"enabled\":true") {
				t.Fatalf("unexpected patch raw payload: %s", raw)
			}
			_ = conn.WriteJSON(map[string]any{
				"type": "res",
				"id":   params["_requestID"],
				"ok":   true,
				"payload": map[string]any{
					"ok": true,
				},
			})
		}
		callIndex++
	})
	defer srv.Close()

	req, err := http.NewRequest(http.MethodPatch, srv.URL+"/api/channels/wechat", strings.NewReader(`{"enabled":true}`))
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
}

func TestGatewayFacade_ChatSnapshot(t *testing.T) {
	expectedCalls := []string{"sessions.get", "sessions.list"}
	callIndex := 0

	srv := newGatewayBackedServer(t, func(conn *websocket.Conn, method string, params map[string]any) {
		if method != expectedCalls[callIndex] {
			t.Fatalf("unexpected method at index %d: %s", callIndex, method)
		}
		switch method {
		case "sessions.get":
			if params["key"] != "session-1" {
				t.Fatalf("unexpected params: %#v", params)
			}
			_ = conn.WriteJSON(map[string]any{
				"type": "res",
				"id":   params["_requestID"],
				"ok":   true,
				"payload": map[string]any{
					"messages": []map[string]any{{
						"id":   "msg-1",
						"role": "assistant",
						"content": []map[string]any{{
							"type": "text",
							"text": "hello",
						}},
					}},
				},
			})
		case "sessions.list":
			if params["search"] != "session-1" || params["limit"] != float64(1) {
				t.Fatalf("unexpected sessions.list params: %#v", params)
			}
			_ = conn.WriteJSON(map[string]any{
				"type": "res",
				"id":   params["_requestID"],
				"ok":   true,
				"payload": map[string]any{
					"sessions": []map[string]any{{"key": "session-1", "label": "Test Session"}},
				},
			})
		}
		callIndex++
	})
	defer srv.Close()

	req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/chat/snapshot?sessionKey=session-1", nil)
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
	messages, ok := payload["messages"].([]any)
	if !ok || len(messages) != 1 {
		t.Fatalf("unexpected payload messages: %#v", payload)
	}
	message, ok := messages[0].(map[string]any)
	if !ok || message["id"] != "msg-1" || message["role"] != "assistant" {
		t.Fatalf("unexpected normalized message payload: %#v", payload)
	}
	session, ok := payload["session"].(map[string]any)
	if !ok || session["key"] != "session-1" {
		t.Fatalf("unexpected payload session: %#v", payload)
	}
}

func TestGatewayFacade_SessionDetail(t *testing.T) {
	expectedCalls := []string{"sessions.get", "sessions.list"}
	callIndex := 0

	srv := newGatewayBackedServer(t, func(conn *websocket.Conn, method string, params map[string]any) {
		if method != expectedCalls[callIndex] {
			t.Fatalf("unexpected method at index %d: %s", callIndex, method)
		}
		switch method {
		case "sessions.get":
			if params["key"] != "session-1" {
				t.Fatalf("unexpected params: %#v", params)
			}
			_ = conn.WriteJSON(map[string]any{
				"type": "res",
				"id":   params["_requestID"],
				"ok":   true,
				"payload": map[string]any{
					"messages": []map[string]any{{
						"id":   "msg-1",
						"role": "assistant",
						"content": []map[string]any{{
							"type": "text",
							"text": "hello",
						}},
					}},
				},
			})
		case "sessions.list":
			if params["search"] != "session-1" || params["limit"] != float64(1) {
				t.Fatalf("unexpected sessions.list params: %#v", params)
			}
			_ = conn.WriteJSON(map[string]any{
				"type": "res",
				"id":   params["_requestID"],
				"ok":   true,
				"payload": map[string]any{
					"sessions": []map[string]any{{
						"key":                "session-1",
						"agentId":            "main",
						"title":              "Test Session",
						"lastMessagePreview": "hello",
					}},
				},
			})
		}
		callIndex++
	})
	defer srv.Close()

	req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/sessions/session-1?agentId=main&limit=10", nil)
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
	session, ok := payload["session"].(map[string]any)
	if !ok || session["key"] != "session-1" || session["agentId"] != "main" {
		t.Fatalf("unexpected session detail payload: %#v", payload)
	}
	messages, ok := payload["messages"].([]any)
	if !ok || len(messages) != 1 {
		t.Fatalf("unexpected session detail messages: %#v", payload)
	}
}

func TestGatewayFacade_ChatHistory(t *testing.T) {
	srv := newGatewayBackedServer(t, func(conn *websocket.Conn, method string, params map[string]any) {
		if method != "chat.history" {
			t.Fatalf("unexpected method: %s", method)
		}
		if params["sessionKey"] != "session-1" {
			t.Fatalf("unexpected params: %#v", params)
		}
		_ = conn.WriteJSON(map[string]any{
			"type": "res",
			"id":   params["_requestID"],
			"ok":   true,
			"payload": map[string]any{
				"messages": []map[string]any{{
					"id":   "msg-1",
					"role": "assistant",
					"content": []map[string]any{{
						"type": "text",
						"text": "hello",
					}},
				}},
			},
		})
	})
	defer srv.Close()

	req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/chat/history?sessionKey=session-1&limit=20", nil)
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
	messages, ok := payload["messages"].([]any)
	if !ok || len(messages) != 1 {
		t.Fatalf("unexpected payload: %#v", payload)
	}
	message, ok := messages[0].(map[string]any)
	if !ok || message["role"] != "assistant" {
		t.Fatalf("unexpected normalized history payload: %#v", payload)
	}
}

func TestGatewayFacade_ChatAbort(t *testing.T) {
	srv := newGatewayBackedServer(t, func(conn *websocket.Conn, method string, params map[string]any) {
		if method != "sessions.abort" {
			t.Fatalf("unexpected method: %s", method)
		}
		if params["key"] != "session-1" || params["runId"] != "run-1" {
			t.Fatalf("unexpected params: %#v", params)
		}
		_ = conn.WriteJSON(map[string]any{
			"type": "res",
			"id":   params["_requestID"],
			"ok":   true,
			"payload": map[string]any{
				"ok":           true,
				"abortedRunId": "run-1",
				"status":       "aborted",
			},
		})
	})
	defer srv.Close()

	req, err := http.NewRequest(http.MethodPost, srv.URL+"/api/chat/abort", strings.NewReader(`{"sessionKey":"session-1","runId":"run-1"}`))
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
	var payload map[string]any
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if payload["abortedRunId"] != "run-1" || payload["status"] != "aborted" {
		t.Fatalf("unexpected abort payload: %#v", payload)
	}
}

func TestGatewayFacade_SessionPreviewResetClearAndPatch(t *testing.T) {
	expectedCalls := []string{"sessions.preview", "sessions.reset", "sessions.clear", "sessions.patch"}
	callIndex := 0

	srv := newGatewayBackedServer(t, func(conn *websocket.Conn, method string, params map[string]any) {
		if method != expectedCalls[callIndex] {
			t.Fatalf("unexpected method at index %d: %s", callIndex, method)
		}
		switch method {
		case "sessions.preview":
			keys, ok := params["keys"].([]any)
			if !ok || len(keys) != 1 || keys[0] != "session-1" {
				t.Fatalf("unexpected preview params: %#v", params)
			}
			_ = conn.WriteJSON(map[string]any{
				"type": "res",
				"id":   params["_requestID"],
				"ok":   true,
				"payload": map[string]any{
					"ts": 100,
					"previews": []map[string]any{{
						"key":    "session-1",
						"status": "ok",
						"items": []map[string]any{{
							"role": "assistant",
							"text": "preview text",
						}},
					}},
				},
			})
		case "sessions.reset":
			if params["key"] != "session-1" || params["reason"] != "reset" {
				t.Fatalf("unexpected reset params: %#v", params)
			}
			_ = conn.WriteJSON(map[string]any{"type": "res", "id": params["_requestID"], "ok": true, "payload": map[string]any{"ok": true}})
		case "sessions.clear":
			if params["key"] != "session-1" {
				t.Fatalf("unexpected clear params: %#v", params)
			}
			_ = conn.WriteJSON(map[string]any{"type": "res", "id": params["_requestID"], "ok": true, "payload": map[string]any{"ok": true}})
		case "sessions.patch":
			if params["key"] != "session-1" || params["model"] != "gpt-5.4" {
				t.Fatalf("unexpected patch params: %#v", params)
			}
			_ = conn.WriteJSON(map[string]any{"type": "res", "id": params["_requestID"], "ok": true, "payload": map[string]any{"ok": true}})
		}
		callIndex++
	})
	defer srv.Close()

	type requestCase struct {
		method string
		path   string
		body   string
	}

	cases := []requestCase{
		{method: http.MethodPost, path: "/api/chat/sessions/preview", body: `{"keys":["session-1"]}`},
		{method: http.MethodPost, path: "/api/chat/sessions/reset", body: `{"sessionKey":"session-1"}`},
		{method: http.MethodPost, path: "/api/chat/sessions/clear", body: `{"sessionKey":"session-1"}`},
		{method: http.MethodPost, path: "/api/chat/sessions/patch", body: `{"sessionKey":"session-1","model":"gpt-5.4"}`},
	}

	for _, tc := range cases {
		req, err := http.NewRequest(tc.method, srv.URL+tc.path, strings.NewReader(tc.body))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Authorization", "Bearer admin-token")
		req.Header.Set("Content-Type", "application/json")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		if res.StatusCode != http.StatusOK {
			res.Body.Close()
			t.Fatalf("unexpected status for %s: %d", tc.path, res.StatusCode)
		}
		if tc.path == "/api/chat/sessions/preview" {
			var payload map[string]any
			if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
				t.Fatal(err)
			}
			previews, ok := payload["previews"].([]any)
			if !ok || len(previews) != 1 {
				t.Fatalf("unexpected preview payload: %#v", payload)
			}
			preview, ok := previews[0].(map[string]any)
			if !ok || preview["key"] != "session-1" || preview["status"] != "ok" {
				t.Fatalf("unexpected normalized preview payload: %#v", payload)
			}
			items, ok := preview["items"].([]any)
			if !ok || len(items) != 1 {
				t.Fatalf("unexpected normalized preview items: %#v", payload)
			}
			item, ok := items[0].(map[string]any)
			if !ok || item["role"] != "assistant" || item["text"] != "preview text" {
				t.Fatalf("unexpected normalized preview payload: %#v", payload)
			}
		} else {
			var payload map[string]any
			if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
				t.Fatal(err)
			}
			if payload["key"] != "session-1" {
				t.Fatalf("expected mutation payload to carry session key: %#v", payload)
			}
		}
		res.Body.Close()
	}
}

func TestGatewayFacade_SessionEventsSubscribeAndUnsubscribe(t *testing.T) {
	expectedCalls := []string{"sessions.subscribe", "sessions.messages.subscribe", "sessions.messages.unsubscribe"}
	callIndex := 0
	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
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
			"ok":      true,
			"payload": map[string]any{"ready": true},
		})

		for callIndex < len(expectedCalls) {
			_, raw, err := conn.ReadMessage()
			if err != nil {
				t.Errorf("read failed: %v", err)
				return
			}
			var reqFrame map[string]any
			_ = json.Unmarshal(raw, &reqFrame)
			method := reqFrame["method"].(string)
			params, _ := reqFrame["params"].(map[string]any)
			if method != expectedCalls[callIndex] {
				t.Fatalf("unexpected method at index %d: %s", callIndex, method)
			}
			switch method {
			case "sessions.subscribe":
				_ = conn.WriteJSON(map[string]any{"type": "res", "id": reqFrame["id"], "ok": true, "payload": map[string]any{"ok": true}})
			case "sessions.messages.subscribe":
				if params["key"] != "session-1" {
					t.Fatalf("unexpected subscribe params: %#v", params)
				}
				_ = conn.WriteJSON(map[string]any{"type": "res", "id": reqFrame["id"], "ok": true, "payload": map[string]any{"ok": true}})
			case "sessions.messages.unsubscribe":
				if params["key"] != "session-1" {
					t.Fatalf("unexpected unsubscribe params: %#v", params)
				}
				_ = conn.WriteJSON(map[string]any{"type": "res", "id": reqFrame["id"], "ok": true, "payload": map[string]any{"ok": true}})
			}
			callIndex++
		}
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
	bus := events.NewBus(8)
	supervisor := &testSupervisor{
		snapshot: runtimecontrol.Snapshot{
			Managed:    true,
			Configured: true,
			Status:     runtimecontrol.StatusRunning,
			Health:     runtimecontrol.HealthHealthy,
			GatewayURL: config.ManagedGatewayURL(store.Effective().ManagedGateway),
			AutoStart:  false,
		},
	}
	client := gateway.New(supervisor)
	realtime := gateway.NewRealtime(supervisor, bus)
	srv := httptest.NewServer(newRouter(store, client, realtime, supervisor, bus))
	defer srv.Close()

	subscribeReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/chat/session-events", strings.NewReader(`{"action":"subscribe","sessionKey":"session-1"}`))
	if err != nil {
		t.Fatal(err)
	}
	subscribeReq.Header.Set("Authorization", "Bearer admin-token")
	subscribeReq.Header.Set("Content-Type", "application/json")
	subscribeRes, err := http.DefaultClient.Do(subscribeReq)
	if err != nil {
		t.Fatal(err)
	}
	if subscribeRes.StatusCode != http.StatusOK {
		subscribeRes.Body.Close()
		t.Fatalf("unexpected subscribe status: %d", subscribeRes.StatusCode)
	}
	var subscribePayload map[string]any
	if err := json.NewDecoder(subscribeRes.Body).Decode(&subscribePayload); err != nil {
		t.Fatal(err)
	}
	subscribeRes.Body.Close()
	if subscribePayload["sessionKey"] != "session-1" || subscribePayload["action"] != "subscribe" {
		t.Fatalf("unexpected subscribe payload: %#v", subscribePayload)
	}

	unsubscribeReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/chat/session-events", strings.NewReader(`{"action":"unsubscribe","sessionKey":"session-1"}`))
	if err != nil {
		t.Fatal(err)
	}
	unsubscribeReq.Header.Set("Authorization", "Bearer admin-token")
	unsubscribeReq.Header.Set("Content-Type", "application/json")
	unsubscribeRes, err := http.DefaultClient.Do(unsubscribeReq)
	if err != nil {
		t.Fatal(err)
	}
	if unsubscribeRes.StatusCode != http.StatusOK {
		unsubscribeRes.Body.Close()
		t.Fatalf("unexpected unsubscribe status: %d", unsubscribeRes.StatusCode)
	}
	var unsubscribePayload map[string]any
	if err := json.NewDecoder(unsubscribeRes.Body).Decode(&unsubscribePayload); err != nil {
		t.Fatal(err)
	}
	unsubscribeRes.Body.Close()
	if unsubscribePayload["sessionKey"] != "session-1" || unsubscribePayload["action"] != "unsubscribe" {
		t.Fatalf("unexpected unsubscribe payload: %#v", unsubscribePayload)
	}
}

func TestGatewayFacade_LogsStream(t *testing.T) {
	srv := newGatewayBackedServer(t, func(conn *websocket.Conn, method string, params map[string]any) {
		if method != "logs.tail" {
			t.Fatalf("unexpected method: %s", method)
		}
		_ = conn.WriteJSON(map[string]any{
			"type": "res",
			"id":   params["_requestID"],
			"ok":   true,
			"payload": map[string]any{
				"cursor": 10,
				"lines":  []string{"line-1"},
			},
		})
	})
	defer srv.Close()

	req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/logs/stream", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer admin-token")
	client := &http.Client{Timeout: 3 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: %d", res.StatusCode)
	}
	buf := make([]byte, 512)
	n, err := res.Body.Read(buf)
	if err != nil && n == 0 {
		t.Fatal(err)
	}
	body := string(buf[:n])
	if !strings.Contains(body, "event: log.batch") {
		t.Fatalf("unexpected stream body: %s", body)
	}
}

func newGatewayBackedServer(t *testing.T, handleMethod func(conn *websocket.Conn, method string, params map[string]any)) *httptest.Server {
	t.Helper()

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
		params, _ := reqFrame["params"].(map[string]any)
		if params == nil {
			params = map[string]any{}
		}
		params["_requestID"], _ = reqFrame["id"].(string)
		handleMethod(conn, reqFrame["method"].(string), params)
	}))
	t.Cleanup(wsServer.Close)

	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	t.Setenv("DECK_GO_ACCESS_TOKEN", "admin-token")
	t.Setenv("DECK_GO_GATEWAY_BIND_PORT", strconv.Itoa(mustPort(t, wsServer.URL)))
	t.Setenv("DECK_GO_GATEWAY_TOKEN", "gateway-token")

	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	bus := events.NewBus(8)
	supervisor := &testSupervisor{
		snapshot: runtimecontrol.Snapshot{
			Managed:    true,
			Configured: true,
			Status:     runtimecontrol.StatusRunning,
			Health:     runtimecontrol.HealthHealthy,
			GatewayURL: config.ManagedGatewayURL(store.Effective().ManagedGateway),
			AutoStart:  false,
		},
	}
	client := gateway.New(supervisor)
	realtime := gateway.NewRealtime(supervisor, bus)

	server := httptest.NewServer(newRouter(store, client, realtime, supervisor, bus))
	t.Cleanup(server.Close)
	return server
}
