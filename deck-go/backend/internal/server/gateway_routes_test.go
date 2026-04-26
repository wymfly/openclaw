package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
	openclawrt "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/openclaw"
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

func TestGatewayFacade_ConfigSchemaLookupAllowsRootPath(t *testing.T) {
	srv := newGatewayBackedServer(t, func(conn *websocket.Conn, method string, params map[string]any) {
		if method != "config.schema.lookup" {
			t.Fatalf("unexpected method: %s", method)
		}
		if params["path"] != "" {
			t.Fatalf("unexpected params: %#v", params)
		}
		_ = conn.WriteJSON(map[string]any{
			"type": "res",
			"id":   params["_requestID"],
			"ok":   true,
			"payload": map[string]any{
				"path":     "",
				"children": []any{},
			},
		})
	})
	defer srv.Close()

	req, err := http.NewRequest(http.MethodPost, srv.URL+"/api/config/schema-lookup", strings.NewReader(`{"path":""}`))
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
	if payload["path"] != "" {
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

func TestGatewayFacade_DeckCommandsDiscover(t *testing.T) {
	srv := newGatewayBackedServer(t, func(conn *websocket.Conn, method string, params map[string]any) {
		if method != "deck.commands.discover" {
			t.Fatalf("unexpected method: %s", method)
		}
		if params["agentId"] != "main" {
			t.Fatalf("unexpected params: %#v", params)
		}
		_ = conn.WriteJSON(map[string]any{
			"type": "res",
			"id":   params["_requestID"],
			"ok":   true,
			"payload": map[string]any{
				"commands": []map[string]any{{"name": "summarize", "source": "builtin"}},
			},
		})
	})
	defer srv.Close()

	req, err := http.NewRequest(http.MethodPost, srv.URL+"/api/deck/commands/discover", strings.NewReader(`{"agentId":"main"}`))
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
	commands, ok := payload["commands"].([]any)
	if !ok || len(commands) != 1 {
		t.Fatalf("unexpected payload: %#v", payload)
	}
}

func TestGatewayFacade_DeckToolsEffective(t *testing.T) {
	srv := newGatewayBackedServer(t, func(conn *websocket.Conn, method string, params map[string]any) {
		if method != "tools.effective" {
			t.Fatalf("unexpected method: %s", method)
		}
		if params["agentId"] != "main" || params["sessionKey"] != "agent:main:main" {
			t.Fatalf("unexpected params: %#v", params)
		}
		_ = conn.WriteJSON(map[string]any{
			"type": "res",
			"id":   params["_requestID"],
			"ok":   true,
			"payload": map[string]any{
				"groups": []map[string]any{{"name": "core", "tools": []map[string]any{{"id": "read", "allowed": true}}}},
			},
		})
	})
	defer srv.Close()

	req, err := http.NewRequest(http.MethodPost, srv.URL+"/api/deck/tools-effective", strings.NewReader(`{"agentId":"main","sessionKey":"agent:main:main"}`))
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
	groups, ok := payload["groups"].([]any)
	if !ok || len(groups) != 1 {
		t.Fatalf("unexpected payload: %#v", payload)
	}
}

func TestGatewayFacade_DeckAgents(t *testing.T) {
	expectedCalls := []string{"deck.agents.detail", "deck.agents.skills.get", "config.get", "config.patch"}
	callIndex := 0

	srv := newGatewayBackedServer(t, func(conn *websocket.Conn, method string, params map[string]any) {
		if method != expectedCalls[callIndex] {
			t.Fatalf("unexpected method at index %d: %s", callIndex, method)
		}
		switch method {
		case "deck.agents.detail":
			if params["agentId"] != "main" {
				t.Fatalf("unexpected params: %#v", params)
			}
			_ = conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      params["_requestID"],
				"ok":      true,
				"payload": map[string]any{"agentId": "main", "name": "Main"},
			})
		case "deck.agents.skills.get":
			if params["agentId"] != "main" {
				t.Fatalf("unexpected params: %#v", params)
			}
			_ = conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      params["_requestID"],
				"ok":      true,
				"payload": map[string]any{"skills": []string{"foo"}},
			})
		case "config.get":
			_ = conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      params["_requestID"],
				"ok":      true,
				"payload": map[string]any{"baseHash": "base-hash-1"},
			})
		case "config.patch":
			raw, _ := params["raw"].(string)
			if !strings.Contains(raw, "\"agents\"") || !strings.Contains(raw, "\"defaults\"") {
				t.Fatalf("unexpected raw patch: %s", raw)
			}
			_ = conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      params["_requestID"],
				"ok":      true,
				"payload": map[string]any{"ok": true},
			})
		}
		callIndex++
	})
	defer srv.Close()

	req1, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/deck/agents?agentId=main", nil)
	req1.Header.Set("Authorization", "Bearer admin-token")
	res1, err := http.DefaultClient.Do(req1)
	if err != nil {
		t.Fatal(err)
	}
	defer res1.Body.Close()
	if res1.StatusCode != http.StatusOK {
		t.Fatalf("unexpected deck agents GET status: %d", res1.StatusCode)
	}

	req2, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/deck/agents", strings.NewReader(`{"action":"skills.get","agentId":"main"}`))
	req2.Header.Set("Authorization", "Bearer admin-token")
	req2.Header.Set("Content-Type", "application/json")
	res2, err := http.DefaultClient.Do(req2)
	if err != nil {
		t.Fatal(err)
	}
	defer res2.Body.Close()
	if res2.StatusCode != http.StatusOK {
		t.Fatalf("unexpected deck agents skills.get status: %d", res2.StatusCode)
	}

	req3, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/deck/agents", strings.NewReader(`{"action":"config.patch","path":"agents.defaults.thinkingDefault","value":"low"}`))
	req3.Header.Set("Authorization", "Bearer admin-token")
	req3.Header.Set("Content-Type", "application/json")
	res3, err := http.DefaultClient.Do(req3)
	if err != nil {
		t.Fatal(err)
	}
	defer res3.Body.Close()
	if res3.StatusCode != http.StatusOK {
		t.Fatalf("unexpected deck agents config.patch status: %d", res3.StatusCode)
	}
}

func TestGatewayFacade_AgentsAndToolsCatalog(t *testing.T) {
	expectedCalls := []string{
		"agents.list",
		"config.get",
		"agents.create",
		"agents.delete",
		"agents.list",
		"agents.update",
		"agents.files.list",
		"agents.files.set",
		"agents.files.get",
		"agent.identity.get",
		"tools.catalog",
	}
	callIndex := 0

	srv := newGatewayBackedServer(t, func(conn *websocket.Conn, method string, params map[string]any) {
		if method != expectedCalls[callIndex] {
			t.Fatalf("unexpected method at index %d: %s", callIndex, method)
		}
		switch method {
		case "agents.list":
			_ = conn.WriteJSON(map[string]any{
				"type": "res",
				"id":   params["_requestID"],
				"ok":   true,
				"payload": map[string]any{
					"agents":    []map[string]any{{"id": "main", "name": "Main"}},
					"defaultId": "main",
				},
			})
		case "config.get":
			if params["path"] != "agents.defaults.workspace" {
				t.Fatalf("unexpected config.get params: %#v", params)
			}
			_ = conn.WriteJSON(map[string]any{
				"type": "res",
				"id":   params["_requestID"],
				"ok":   true,
				"payload": map[string]any{
					"exists": true,
					"raw":    "/tmp/default-agents-workspace",
				},
			})
		case "agents.create":
			if params["name"] != "Ops" || params["workspace"] != "/tmp/default-agents-workspace" {
				t.Fatalf("unexpected agents.create params: %#v", params)
			}
			_ = conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      params["_requestID"],
				"ok":      true,
				"payload": map[string]any{"id": "ops"},
			})
		case "agents.delete":
			if params["agentId"] != "ops" {
				t.Fatalf("unexpected agents.delete params: %#v", params)
			}
			_ = conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      params["_requestID"],
				"ok":      true,
				"payload": map[string]any{"ok": true},
			})
		case "agents.update":
			if params["agentId"] != "main" || params["name"] != "Renamed Main" {
				t.Fatalf("unexpected agents.update params: %#v", params)
			}
			_ = conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      params["_requestID"],
				"ok":      true,
				"payload": map[string]any{"ok": true},
			})
		case "agents.files.list":
			if params["agentId"] != "main" {
				t.Fatalf("unexpected agents.files.list params: %#v", params)
			}
			_ = conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      params["_requestID"],
				"ok":      true,
				"payload": map[string]any{"files": []string{"AGENTS.md"}},
			})
		case "agents.files.set":
			if params["agentId"] != "main" || params["name"] != "AGENTS.md" || params["content"] != "hello" {
				t.Fatalf("unexpected agents.files.set params: %#v", params)
			}
			_ = conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      params["_requestID"],
				"ok":      true,
				"payload": map[string]any{"ok": true},
			})
		case "agents.files.get":
			if params["agentId"] != "main" || params["name"] != "notes/README.md" {
				t.Fatalf("unexpected agents.files.get params: %#v", params)
			}
			_ = conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      params["_requestID"],
				"ok":      true,
				"payload": map[string]any{"content": "hello"},
			})
		case "agent.identity.get":
			if params["agentId"] != "main" {
				t.Fatalf("unexpected agent.identity.get params: %#v", params)
			}
			_ = conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      params["_requestID"],
				"ok":      true,
				"payload": map[string]any{"agentId": "main", "name": "Main"},
			})
		case "tools.catalog":
			if params["agentId"] != "main" || params["includePlugins"] != false {
				t.Fatalf("unexpected tools.catalog params: %#v", params)
			}
			_ = conn.WriteJSON(map[string]any{
				"type": "res",
				"id":   params["_requestID"],
				"ok":   true,
				"payload": map[string]any{
					"tools": []map[string]any{{"id": "search"}},
				},
			})
		}
		callIndex++
	})
	defer srv.Close()

	requests := []struct {
		method string
		path   string
		body   string
		header bool
	}{
		{method: http.MethodGet, path: "/api/agents", header: true},
		{method: http.MethodPost, path: "/api/agents", body: `{"name":"Ops"}`, header: true},
		{method: http.MethodDelete, path: "/api/agents?agentId=ops", header: true},
		{method: http.MethodGet, path: "/api/agents/main", header: true},
		{method: http.MethodPatch, path: "/api/agents/main", body: `{"name":"Renamed Main"}`, header: true},
		{method: http.MethodGet, path: "/api/agents/main/files", header: true},
		{method: http.MethodPost, path: "/api/agents/main/files", body: `{"name":"AGENTS.md","content":"hello"}`, header: true},
		{method: http.MethodGet, path: "/api/agents/main/files/notes/README.md", header: true},
		{method: http.MethodGet, path: "/api/agents/main/identity", header: true},
		{method: http.MethodPost, path: "/api/tools/catalog", body: `{"agentId":"main","includePlugins":false}`, header: true},
	}

	for _, tc := range requests {
		req, err := http.NewRequest(tc.method, srv.URL+tc.path, strings.NewReader(tc.body))
		if err != nil {
			t.Fatal(err)
		}
		if tc.header {
			req.Header.Set("Authorization", "Bearer admin-token")
		}
		if tc.body != "" {
			req.Header.Set("Content-Type", "application/json")
		}
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status for %s %s: %d", tc.method, tc.path, res.StatusCode)
		}
	}
}

func TestGatewayFacade_SkillsRoutes(t *testing.T) {
	expectedCalls := []string{
		"skills.status",
		"skills.update",
		"skills.install",
		"skills.update",
		"skills.search",
		"skills.detail",
		"skills.install",
		"skills.update",
		"skills.bins",
	}
	callIndex := 0

	srv := newGatewayBackedServer(t, func(conn *websocket.Conn, method string, params map[string]any) {
		if method != expectedCalls[callIndex] {
			t.Fatalf("unexpected method at index %d: %s", callIndex, method)
		}
		switch method {
		case "skills.status":
			if params["agentId"] != "main" {
				t.Fatalf("unexpected skills.status params: %#v", params)
			}
		case "skills.update":
			switch callIndex {
			case 1:
				if params["skillKey"] != "demo" || params["enabled"] != false {
					t.Fatalf("unexpected skills.update patch params: %#v", params)
				}
			case 3:
				if params["source"] != "clawhub" || params["slug"] != "test-skill" {
					t.Fatalf("unexpected update-clawhub params: %#v", params)
				}
			case 7:
				if params["source"] != "clawhub" || params["all"] != true {
					t.Fatalf("unexpected hub update params: %#v", params)
				}
			}
		case "skills.install":
			switch callIndex {
			case 2:
				if params["name"] != "foo" || params["installId"] != "bar" {
					t.Fatalf("unexpected skills.install params: %#v", params)
				}
			case 6:
				if params["source"] != "clawhub" || params["slug"] != "test-skill" || params["version"] != "1.0.0" {
					t.Fatalf("unexpected hub install params: %#v", params)
				}
			}
		case "skills.search":
			if params["query"] != "tool" || params["limit"] != float64(5) {
				t.Fatalf("unexpected skills.search params: %#v", params)
			}
		case "skills.detail":
			if params["slug"] != "test-skill" {
				t.Fatalf("unexpected skills.detail params: %#v", params)
			}
		case "skills.bins":
			if len(params) != 1 { // request id only
				t.Fatalf("unexpected skills.bins params: %#v", params)
			}
		}
		_ = conn.WriteJSON(map[string]any{
			"type":    "res",
			"id":      params["_requestID"],
			"ok":      true,
			"payload": map[string]any{"ok": true},
		})
		callIndex++
	})
	defer srv.Close()

	requests := []struct {
		method string
		path   string
		body   string
	}{
		{method: http.MethodGet, path: "/api/skills?agentId=main"},
		{method: http.MethodPatch, path: "/api/skills/demo", body: `{"enabled":false}`},
		{method: http.MethodPost, path: "/api/skills/install", body: `{"name":"foo","installId":"bar"}`},
		{method: http.MethodPost, path: "/api/skills/update-clawhub", body: `{"slug":"test-skill"}`},
		{method: http.MethodPost, path: "/api/skills/hub", body: `{"action":"search","query":"tool","limit":5}`},
		{method: http.MethodPost, path: "/api/skills/hub", body: `{"action":"detail","slug":"test-skill"}`},
		{method: http.MethodPost, path: "/api/skills/hub", body: `{"action":"install","slug":"test-skill","version":"1.0.0"}`},
		{method: http.MethodPost, path: "/api/skills/hub", body: `{"action":"update"}`},
		{method: http.MethodPost, path: "/api/skills/hub", body: `{"action":"bins"}`},
	}

	for _, tc := range requests {
		req, err := http.NewRequest(tc.method, srv.URL+tc.path, strings.NewReader(tc.body))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Authorization", "Bearer admin-token")
		if tc.body != "" {
			req.Header.Set("Content-Type", "application/json")
		}
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status for %s %s: %d", tc.method, tc.path, res.StatusCode)
		}
	}
}

func TestGatewayFacade_DeviceRoutes(t *testing.T) {
	expectedCalls := []string{
		"device.pair.list",
		"device.pair.approve",
		"device.pair.reject",
		"device.pair.remove",
		"device.token.rotate",
		"device.token.revoke",
	}
	callIndex := 0

	srv := newGatewayBackedServer(t, func(conn *websocket.Conn, method string, params map[string]any) {
		if method != expectedCalls[callIndex] {
			t.Fatalf("unexpected method at index %d: %s", callIndex, method)
		}
		switch method {
		case "device.pair.list":
		case "device.pair.approve", "device.pair.reject":
			if params["requestId"] != "req-1" {
				t.Fatalf("unexpected device pairing params: %#v", params)
			}
		case "device.pair.remove":
			if params["deviceId"] != "dev-1" {
				t.Fatalf("unexpected device remove params: %#v", params)
			}
		case "device.token.rotate", "device.token.revoke":
			if params["deviceId"] != "dev-1" || params["role"] != "operator" {
				t.Fatalf("unexpected device token params: %#v", params)
			}
		}
		_ = conn.WriteJSON(map[string]any{
			"type":    "res",
			"id":      params["_requestID"],
			"ok":      true,
			"payload": map[string]any{"ok": true},
		})
		callIndex++
	})
	defer srv.Close()

	requests := []struct {
		method string
		path   string
		body   string
	}{
		{method: http.MethodGet, path: "/api/devices"},
		{method: http.MethodPost, path: "/api/devices/approve", body: `{"requestId":"req-1"}`},
		{method: http.MethodPost, path: "/api/devices/reject", body: `{"requestId":"req-1"}`},
		{method: http.MethodPost, path: "/api/devices/remove", body: `{"deviceId":"dev-1"}`},
		{method: http.MethodPost, path: "/api/devices/token/rotate", body: `{"deviceId":"dev-1","role":"operator"}`},
		{method: http.MethodPost, path: "/api/devices/token/revoke", body: `{"deviceId":"dev-1","role":"operator"}`},
	}

	for _, tc := range requests {
		req, err := http.NewRequest(tc.method, srv.URL+tc.path, strings.NewReader(tc.body))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Authorization", "Bearer admin-token")
		if tc.body != "" {
			req.Header.Set("Content-Type", "application/json")
		}
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status for %s %s: %d", tc.method, tc.path, res.StatusCode)
		}
	}
}

func TestGatewayFacade_CommandsAndNodesRoutes(t *testing.T) {
	expectedCalls := []string{
		"commands.list",
		"node.list",
		"node.describe",
		"node.rename",
		"node.invoke",
		"node.pending.enqueue",
		"node.pair.list",
		"node.pair.request",
		"node.pair.approve",
		"node.pair.reject",
		"node.pair.verify",
	}
	callIndex := 0

	srv := newGatewayBackedServer(t, func(conn *websocket.Conn, method string, params map[string]any) {
		if method != expectedCalls[callIndex] {
			t.Fatalf("unexpected method at index %d: %s", callIndex, method)
		}
		switch method {
		case "node.describe":
			if params["nodeId"] != "node-1" {
				t.Fatalf("unexpected node.describe params: %#v", params)
			}
		case "node.rename":
			if params["nodeId"] != "node-1" || params["displayName"] != "Renamed Node" {
				t.Fatalf("unexpected node.rename params: %#v", params)
			}
		case "node.invoke":
			if params["nodeId"] != "node-1" || params["command"] != "system.notify" || params["idempotencyKey"] != "invoke-1" {
				t.Fatalf("unexpected node.invoke params: %#v", params)
			}
			nested, _ := params["params"].(map[string]any)
			if nested["title"] != "Deck" {
				t.Fatalf("unexpected node.invoke nested params: %#v", params)
			}
		case "node.pending.enqueue":
			if params["nodeId"] != "node-1" || params["type"] != "status.request" || params["priority"] != "high" || params["wake"] != true {
				t.Fatalf("unexpected node.pending.enqueue params: %#v", params)
			}
		case "node.pair.request":
			if params["nodeId"] != "node-1" {
				t.Fatalf("unexpected node.pair.request params: %#v", params)
			}
		case "node.pair.approve", "node.pair.reject":
			if params["requestId"] != "pair-1" {
				t.Fatalf("unexpected node pairing params: %#v", params)
			}
		case "node.pair.verify":
			if params["nodeId"] != "node-1" || params["token"] != "token-1" {
				t.Fatalf("unexpected node pairing params: %#v", params)
			}
		}
		_ = conn.WriteJSON(map[string]any{
			"type":    "res",
			"id":      params["_requestID"],
			"ok":      true,
			"payload": map[string]any{"ok": true},
		})
		callIndex++
	})
	defer srv.Close()

	requests := []struct {
		method string
		path   string
		body   string
	}{
		{method: http.MethodGet, path: "/api/commands"},
		{method: http.MethodGet, path: "/api/nodes"},
		{method: http.MethodPost, path: "/api/nodes", body: `{"action":"describe","nodeId":"node-1"}`},
		{method: http.MethodPost, path: "/api/nodes", body: `{"action":"rename","nodeId":"node-1","displayName":"Renamed Node"}`},
		{method: http.MethodPost, path: "/api/nodes", body: `{"action":"invoke","nodeId":"node-1","command":"system.notify","params":{"title":"Deck"},"timeoutMs":5000,"idempotencyKey":"invoke-1"}`},
		{method: http.MethodPost, path: "/api/nodes", body: `{"action":"pending.enqueue","nodeId":"node-1","type":"status.request","priority":"high","wake":true}`},
		{method: http.MethodGet, path: "/api/nodes/pair"},
		{method: http.MethodPost, path: "/api/nodes/pair", body: `{"action":"request","nodeId":"node-1"}`},
		{method: http.MethodPost, path: "/api/nodes/pair", body: `{"action":"approve","requestId":"pair-1"}`},
		{method: http.MethodPost, path: "/api/nodes/pair", body: `{"action":"reject","requestId":"pair-1"}`},
		{method: http.MethodPost, path: "/api/nodes/pair", body: `{"action":"verify","nodeId":"node-1","token":"token-1"}`},
	}

	for _, tc := range requests {
		req, err := http.NewRequest(tc.method, srv.URL+tc.path, strings.NewReader(tc.body))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Authorization", "Bearer admin-token")
		if tc.body != "" {
			req.Header.Set("Content-Type", "application/json")
		}
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status for %s %s: %d", tc.method, tc.path, res.StatusCode)
		}
	}
}

func TestGatewayFacade_CronRoutes(t *testing.T) {
	expectedCalls := []string{
		"cron.list",
		"cron.add",
		"cron.update",
		"cron.remove",
		"cron.run",
		"cron.runs",
		"cron.status",
	}
	callIndex := 0

	srv := newGatewayBackedServer(t, func(conn *websocket.Conn, method string, params map[string]any) {
		if method != expectedCalls[callIndex] {
			t.Fatalf("unexpected method at index %d: %s", callIndex, method)
		}
		switch method {
		case "cron.list":
			if params["limit"] != float64(10) && params["limit"] != 10 {
				t.Fatalf("unexpected cron.list params: %#v", params)
			}
			if params["offset"] != float64(5) && params["offset"] != 5 {
				t.Fatalf("unexpected cron.list params: %#v", params)
			}
			if params["query"] != "nightly" || params["enabled"] != "enabled" || params["sortBy"] != "name" || params["sortDir"] != "asc" || params["includeDisabled"] != true {
				t.Fatalf("unexpected cron.list params: %#v", params)
			}
		case "cron.add":
			if params["name"] != "Nightly" {
				t.Fatalf("unexpected cron.add params: %#v", params)
			}
		case "cron.update":
			if params["id"] != "job-1" {
				t.Fatalf("unexpected cron.update params: %#v", params)
			}
		case "cron.remove":
			if params["id"] != "job-1" {
				t.Fatalf("unexpected cron.remove params: %#v", params)
			}
		case "cron.run":
			if params["id"] != "job-1" || params["mode"] != "force" {
				t.Fatalf("unexpected cron.run params: %#v", params)
			}
		case "cron.runs":
			if params["jobId"] != "job-1" || params["scope"] != "job" {
				t.Fatalf("unexpected cron.runs params: %#v", params)
			}
			statuses, ok := params["statuses"].([]any)
			if !ok || len(statuses) != 2 || statuses[0] != "ok" || statuses[1] != "error" {
				t.Fatalf("unexpected cron.runs statuses: %#v", params)
			}
			if params["limit"] != float64(20) && params["limit"] != 20 {
				t.Fatalf("unexpected cron.runs params: %#v", params)
			}
			if params["offset"] != float64(5) && params["offset"] != 5 {
				t.Fatalf("unexpected cron.runs params: %#v", params)
			}
			if params["sortDir"] != "desc" {
				t.Fatalf("unexpected cron.runs params: %#v", params)
			}
		}
		_ = conn.WriteJSON(map[string]any{
			"type":    "res",
			"id":      params["_requestID"],
			"ok":      true,
			"payload": map[string]any{"ok": true},
		})
		callIndex++
	})
	defer srv.Close()

	requests := []struct {
		method string
		path   string
		body   string
	}{
		{method: http.MethodGet, path: "/api/cron?limit=10&offset=5&query=nightly&enabled=enabled&sortBy=name&sortDir=asc&includeDisabled=true"},
		{method: http.MethodPost, path: "/api/cron", body: `{"name":"Nightly","enabled":true}`},
		{method: http.MethodPatch, path: "/api/cron/job-1", body: `{"enabled":false}`},
		{method: http.MethodDelete, path: "/api/cron/job-1"},
		{method: http.MethodPost, path: "/api/cron/job-1/run", body: `{"mode":"force"}`},
		{method: http.MethodGet, path: "/api/cron/job-1/runs?limit=20&offset=5&sortDir=desc&statuses=ok,error"},
		{method: http.MethodGet, path: "/api/cron/status"},
	}

	for _, tc := range requests {
		req, err := http.NewRequest(tc.method, srv.URL+tc.path, strings.NewReader(tc.body))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Authorization", "Bearer admin-token")
		if tc.body != "" {
			req.Header.Set("Content-Type", "application/json")
		}
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status for %s %s: %d", tc.method, tc.path, res.StatusCode)
		}
	}
}

func TestGatewayFacade_ModelUsageRoutes(t *testing.T) {
	expectedCalls := []string{
		"usage.cost",
		"usage.status",
	}
	callIndex := 0

	srv := newGatewayBackedServer(t, func(conn *websocket.Conn, method string, params map[string]any) {
		if method != expectedCalls[callIndex] {
			t.Fatalf("unexpected method at index %d: %s", callIndex, method)
		}
		switch method {
		case "usage.cost":
			if params["days"] != 14 && params["days"] != float64(14) {
				t.Fatalf("unexpected usage.cost params: %#v", params)
			}
		case "usage.status":
			if len(params) != 1 {
				t.Fatalf("unexpected usage.status params: %#v", params)
			}
		}
		_ = conn.WriteJSON(map[string]any{
			"type":    "res",
			"id":      params["_requestID"],
			"ok":      true,
			"payload": map[string]any{"ok": true},
		})
		callIndex++
	})
	defer srv.Close()

	requests := []struct {
		method string
		path   string
	}{
		{method: http.MethodGet, path: "/api/models/usage/cost?days=14"},
		{method: http.MethodGet, path: "/api/models/usage/providers"},
	}

	for _, tc := range requests {
		req, err := http.NewRequest(tc.method, srv.URL+tc.path, nil)
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Authorization", "Bearer admin-token")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status for %s %s: %d", tc.method, tc.path, res.StatusCode)
		}
	}
}

func TestGatewayFacade_UsageSessionRoutes(t *testing.T) {
	expectedCalls := []string{
		"sessions.usage",
		"sessions.usage.logs",
		"sessions.usage.timeseries",
	}
	callIndex := 0

	srv := newGatewayBackedServer(t, func(conn *websocket.Conn, method string, params map[string]any) {
		if method != expectedCalls[callIndex] {
			t.Fatalf("unexpected method at index %d: %s", callIndex, method)
		}
		switch method {
		case "sessions.usage":
			if params["startDate"] != "2026-04-01" || params["endDate"] != "2026-04-06" || params["key"] != "session-1" || params["includeContextWeight"] != true {
				t.Fatalf("unexpected sessions.usage params: %#v", params)
			}
			if params["limit"] != 20 && params["limit"] != float64(20) {
				t.Fatalf("unexpected sessions.usage limit: %#v", params)
			}
		case "sessions.usage.logs":
			if params["key"] != "session-1" {
				t.Fatalf("unexpected sessions.usage.logs params: %#v", params)
			}
			if params["limit"] != 50 && params["limit"] != float64(50) {
				t.Fatalf("unexpected sessions.usage.logs limit: %#v", params)
			}
		case "sessions.usage.timeseries":
			if params["key"] != "session-1" || params["startDate"] != "2026-04-01" || params["endDate"] != "2026-04-07" || params["mode"] != "daily" || params["utcOffset"] != "+08:00" {
				t.Fatalf("unexpected sessions.usage.timeseries params: %#v", params)
			}
		}
		_ = conn.WriteJSON(map[string]any{
			"type":    "res",
			"id":      params["_requestID"],
			"ok":      true,
			"payload": map[string]any{"ok": true},
		})
		callIndex++
	})
	defer srv.Close()

	requests := []struct {
		method string
		path   string
	}{
		{method: http.MethodGet, path: "/api/usage/sessions?startDate=2026-04-01&endDate=2026-04-06&key=session-1&includeContextWeight=true&limit=20"},
		{method: http.MethodGet, path: "/api/usage/sessions/logs?key=session-1&limit=50"},
		{method: http.MethodGet, path: "/api/usage/timeseries?key=session-1&startDate=2026-04-01&endDate=2026-04-07&mode=daily&utcOffset=%2B08%3A00"},
	}

	for _, tc := range requests {
		req, err := http.NewRequest(tc.method, srv.URL+tc.path, nil)
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Authorization", "Bearer admin-token")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status for %s %s: %d", tc.method, tc.path, res.StatusCode)
		}
	}
}

func TestGatewayFacade_ModelsConfigRoute(t *testing.T) {
	expectedCalls := []string{
		"config.get",
		"config.patch",
	}
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
					"raw":  `{"models":{"providers":{}}}`,
					"hash": "h1",
				},
			})
		case "config.patch":
			if params["raw"] != `{"models":{"providers":{"openai":{}}}}` || params["baseHash"] != "h1" {
				t.Fatalf("unexpected config.patch params: %#v", params)
			}
			_ = conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      params["_requestID"],
				"ok":      true,
				"payload": map[string]any{"ok": true},
			})
		}
		callIndex++
	})
	defer srv.Close()

	getReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/models/config", nil)
	if err != nil {
		t.Fatal(err)
	}
	getReq.Header.Set("Authorization", "Bearer admin-token")
	getRes, err := http.DefaultClient.Do(getReq)
	if err != nil {
		t.Fatal(err)
	}
	getRes.Body.Close()
	if getRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected models/config GET status: %d", getRes.StatusCode)
	}

	patchReq, err := http.NewRequest(http.MethodPatch, srv.URL+"/api/models/config", strings.NewReader(`{"raw":"{\"models\":{\"providers\":{\"openai\":{}}}}","baseHash":"h1"}`))
	if err != nil {
		t.Fatal(err)
	}
	patchReq.Header.Set("Authorization", "Bearer admin-token")
	patchReq.Header.Set("Content-Type", "application/json")
	patchRes, err := http.DefaultClient.Do(patchReq)
	if err != nil {
		t.Fatal(err)
	}
	patchRes.Body.Close()
	if patchRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected models/config PATCH status: %d", patchRes.StatusCode)
	}
}

func TestGatewayFacade_DocsRoutes(t *testing.T) {
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
				"messages": []map[string]any{
					{
						"role": "assistant",
						"content": []map[string]any{
							{
								"type": "text",
								"text": "# Spec\n\nThis is a specification document with enough content to exceed the extraction threshold. " +
									"It includes API details, protocol notes, and schema expectations repeated to exceed two hundred characters. " +
									"API contract schema protocol specification document content for extraction.",
							},
						},
					},
				},
			},
		})
	})
	defer srv.Close()

	extractReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/docs/extract", strings.NewReader(`{"sessionKey":"session-1"}`))
	if err != nil {
		t.Fatal(err)
	}
	extractReq.Header.Set("Authorization", "Bearer admin-token")
	extractReq.Header.Set("Content-Type", "application/json")
	extractRes, err := http.DefaultClient.Do(extractReq)
	if err != nil {
		t.Fatal(err)
	}
	defer extractRes.Body.Close()
	if extractRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected extract status: %d", extractRes.StatusCode)
	}
	var extractPayload map[string]any
	if err := json.NewDecoder(extractRes.Body).Decode(&extractPayload); err != nil {
		t.Fatal(err)
	}
	if extractPayload["extracted"] != float64(1) {
		t.Fatalf("unexpected extract payload: %#v", extractPayload)
	}
	docs, ok := extractPayload["docs"].([]any)
	if !ok || len(docs) != 1 {
		t.Fatalf("unexpected docs payload: %#v", extractPayload)
	}
	doc, ok := docs[0].(map[string]any)
	if !ok {
		t.Fatalf("unexpected doc payload: %#v", docs[0])
	}
	docID, _ := doc["id"].(string)
	if docID == "" {
		t.Fatalf("missing doc id: %#v", doc)
	}

	listReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/docs?q=spec", nil)
	if err != nil {
		t.Fatal(err)
	}
	listReq.Header.Set("Authorization", "Bearer admin-token")
	listRes, err := http.DefaultClient.Do(listReq)
	if err != nil {
		t.Fatal(err)
	}
	defer listRes.Body.Close()
	if listRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected list status: %d", listRes.StatusCode)
	}

	getReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/docs/"+docID, nil)
	if err != nil {
		t.Fatal(err)
	}
	getReq.Header.Set("Authorization", "Bearer admin-token")
	getRes, err := http.DefaultClient.Do(getReq)
	if err != nil {
		t.Fatal(err)
	}
	defer getRes.Body.Close()
	if getRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected get status: %d", getRes.StatusCode)
	}

	deleteReq, err := http.NewRequest(http.MethodDelete, srv.URL+"/api/docs/"+docID, nil)
	if err != nil {
		t.Fatal(err)
	}
	deleteReq.Header.Set("Authorization", "Bearer admin-token")
	deleteRes, err := http.DefaultClient.Do(deleteReq)
	if err != nil {
		t.Fatal(err)
	}
	defer deleteRes.Body.Close()
	if deleteRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected delete status: %d", deleteRes.StatusCode)
	}
}

func TestGatewayFacade_MemoryRoutes(t *testing.T) {
	workspaceDir := t.TempDir()
	if err := os.WriteFile(filepath.Join(workspaceDir, "note.md"), []byte("hello"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(filepath.Join(workspaceDir, "memory"), 0o755); err != nil {
		t.Fatal(err)
	}

	srv := newGatewayBackedServer(t, func(conn *websocket.Conn, method string, params map[string]any) {
		switch method {
		case "agents.files.list":
			_ = conn.WriteJSON(map[string]any{
				"type": "res",
				"id":   params["_requestID"],
				"ok":   true,
				"payload": map[string]any{
					"workspace": workspaceDir,
				},
			})
		case "doctor.memory.status":
			_ = conn.WriteJSON(map[string]any{
				"type": "res",
				"id":   params["_requestID"],
				"ok":   true,
				"payload": map[string]any{
					"entries":        []map[string]any{{"agentId": "main", "provider": "lancedb"}},
					"lanceDbEnabled": true,
				},
			})
		case "doctor.memory.dreamDiary":
			_ = conn.WriteJSON(map[string]any{
				"type": "res",
				"id":   params["_requestID"],
				"ok":   true,
				"payload": map[string]any{
					"agentId": "main",
					"path":    filepath.Join(workspaceDir, "DREAMS.md"),
				},
			})
		default:
			t.Fatalf("unexpected method: %s", method)
		}
	})
	defer srv.Close()

	for _, path := range []string{
		"/api/memory/browse?agentId=main",
		"/api/memory/browse?agentId=main&path=note.md&read=1",
		"/api/memory/health",
		"/api/memory/search?q=test",
	} {
		req, err := http.NewRequest(http.MethodGet, srv.URL+path, nil)
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Authorization", "Bearer admin-token")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		if path == "/api/memory/search?q=test" {
			if res.StatusCode != http.StatusNotImplemented {
				t.Fatalf("unexpected search status: %d", res.StatusCode)
			}
			continue
		}
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status for %s: %d", path, res.StatusCode)
		}
	}

	dreamReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/memory/dreams", strings.NewReader(`{"action":"read"}`))
	if err != nil {
		t.Fatal(err)
	}
	dreamReq.Header.Set("Authorization", "Bearer admin-token")
	dreamReq.Header.Set("Content-Type", "application/json")
	dreamRes, err := http.DefaultClient.Do(dreamReq)
	if err != nil {
		t.Fatal(err)
	}
	dreamRes.Body.Close()
	if dreamRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected dreams status: %d", dreamRes.StatusCode)
	}
}

func TestGatewayFacade_ChatCompactCompactionAndSteer(t *testing.T) {
	expectedCalls := []string{
		"sessions.compact",
		"sessions.compaction.list",
		"sessions.compaction.branch",
		"sessions.compaction.restore",
		"sessions.steer",
	}
	callIndex := 0

	srv := newGatewayBackedServer(t, func(conn *websocket.Conn, method string, params map[string]any) {
		if method != expectedCalls[callIndex] {
			t.Fatalf("unexpected method at index %d: %s", callIndex, method)
		}
		switch method {
		case "sessions.compact":
			if params["key"] != "session-1" {
				t.Fatalf("unexpected compact params: %#v", params)
			}
		case "sessions.compaction.list":
			if params["key"] != "session-1" {
				t.Fatalf("unexpected compaction list params: %#v", params)
			}
		case "sessions.compaction.branch", "sessions.compaction.restore":
			if params["key"] != "session-1" || params["checkpointId"] != "cp-1" {
				t.Fatalf("unexpected compaction params: %#v", params)
			}
		case "sessions.steer":
			if params["key"] != "session-1" || params["message"] != "please continue" {
				t.Fatalf("unexpected steer params: %#v", params)
			}
		}
		_ = conn.WriteJSON(map[string]any{
			"type":    "res",
			"id":      params["_requestID"],
			"ok":      true,
			"payload": map[string]any{"ok": true},
		})
		callIndex++
	})
	defer srv.Close()

	requests := []struct {
		path string
		body string
	}{
		{path: "/api/chat/compact", body: `{"sessionKey":"session-1"}`},
		{path: "/api/chat/compaction", body: `{"action":"list","key":"session-1"}`},
		{path: "/api/chat/compaction", body: `{"action":"branch","key":"session-1","checkpointId":"cp-1"}`},
		{path: "/api/chat/compaction", body: `{"action":"restore","key":"session-1","checkpointId":"cp-1"}`},
		{path: "/api/chat/steer", body: `{"sessionKey":"session-1","message":"please continue"}`},
	}

	for _, tc := range requests {
		req, err := http.NewRequest(http.MethodPost, srv.URL+tc.path, strings.NewReader(tc.body))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Authorization", "Bearer admin-token")
		req.Header.Set("Content-Type", "application/json")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status for %s: %d", tc.path, res.StatusCode)
		}
	}
}

func TestGatewayFacade_ApprovalsPendingAndExecApproval(t *testing.T) {
	expectedCalls := []string{
		"exec.approval.list",
		"exec.approval.resolve",
	}
	callIndex := 0

	srv := newGatewayBackedServer(t, func(conn *websocket.Conn, method string, params map[string]any) {
		if method != expectedCalls[callIndex] {
			t.Fatalf("unexpected method at index %d: %s", callIndex, method)
		}
		switch method {
		case "exec.approval.list":
			_ = conn.WriteJSON(map[string]any{
				"type": "res",
				"id":   params["_requestID"],
				"ok":   true,
				"payload": []map[string]any{{
					"id":          "ap-1",
					"createdAtMs": 1,
					"expiresAtMs": 2,
					"request": map[string]any{
						"command":     "ls",
						"commandArgv": []string{"ls"},
						"agentId":     "main",
						"sessionKey":  "session-1",
						"cwd":         "/tmp",
					},
				}},
			})
		case "exec.approval.resolve":
			if params["id"] != "ap-1" || params["decision"] != "allow-once" {
				t.Fatalf("unexpected exec approval params: %#v", params)
			}
			_ = conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      params["_requestID"],
				"ok":      true,
				"payload": map[string]any{"ok": true},
			})
		}
		callIndex++
	})
	defer srv.Close()

	getReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/approvals/pending", nil)
	if err != nil {
		t.Fatal(err)
	}
	getReq.Header.Set("Authorization", "Bearer admin-token")
	getRes, err := http.DefaultClient.Do(getReq)
	if err != nil {
		t.Fatal(err)
	}
	defer getRes.Body.Close()
	if getRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected approvals pending status: %d", getRes.StatusCode)
	}

	postReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/exec/approval", strings.NewReader(`{"id":"ap-1","decision":"allow-once"}`))
	if err != nil {
		t.Fatal(err)
	}
	postReq.Header.Set("Authorization", "Bearer admin-token")
	postReq.Header.Set("Content-Type", "application/json")
	postRes, err := http.DefaultClient.Do(postReq)
	if err != nil {
		t.Fatal(err)
	}
	defer postRes.Body.Close()
	if postRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected exec approval status: %d", postRes.StatusCode)
	}
}

func TestGatewayFacade_ChatSessionsAlias(t *testing.T) {
	expectedCalls := []string{
		"sessions.list",
		"sessions.delete",
	}
	callIndex := 0

	srv := newGatewayBackedServer(t, func(conn *websocket.Conn, method string, params map[string]any) {
		if method != expectedCalls[callIndex] {
			t.Fatalf("unexpected method at index %d: %s", callIndex, method)
		}
		switch method {
		case "sessions.list":
			if params["agentId"] != "main" {
				t.Fatalf("unexpected sessions.list params: %#v", params)
			}
			_ = conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      params["_requestID"],
				"ok":      true,
				"payload": []any{map[string]any{"key": "session-1", "agentId": "main"}},
			})
		case "sessions.delete":
			if params["key"] != "session-1" {
				t.Fatalf("unexpected sessions.delete params: %#v", params)
			}
			_ = conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      params["_requestID"],
				"ok":      true,
				"payload": map[string]any{"ok": true, "key": "session-1"},
			})
		}
		callIndex++
	})
	defer srv.Close()

	getReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/chat/sessions?agentId=main", nil)
	if err != nil {
		t.Fatal(err)
	}
	getReq.Header.Set("Authorization", "Bearer admin-token")
	getRes, err := http.DefaultClient.Do(getReq)
	if err != nil {
		t.Fatal(err)
	}
	defer getRes.Body.Close()
	if getRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected chat sessions alias GET status: %d", getRes.StatusCode)
	}

	deleteReq, err := http.NewRequest(http.MethodDelete, srv.URL+"/api/chat/sessions", strings.NewReader(`{"sessionKey":"session-1"}`))
	if err != nil {
		t.Fatal(err)
	}
	deleteReq.Header.Set("Authorization", "Bearer admin-token")
	deleteReq.Header.Set("Content-Type", "application/json")
	deleteRes, err := http.DefaultClient.Do(deleteReq)
	if err != nil {
		t.Fatal(err)
	}
	defer deleteRes.Body.Close()
	if deleteRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected chat sessions alias DELETE status: %d", deleteRes.StatusCode)
	}
}

func TestGatewayFacade_ChannelTestThroughputAndProjection(t *testing.T) {
	expectedCalls := []string{
		"channels.status",
	}
	callIndex := 0

	srv := newGatewayBackedServer(t, func(conn *websocket.Conn, method string, params map[string]any) {
		if method != expectedCalls[callIndex] {
			t.Fatalf("unexpected method at index %d: %s", callIndex, method)
		}
		_ = conn.WriteJSON(map[string]any{
			"type": "res",
			"id":   params["_requestID"],
			"ok":   true,
			"payload": map[string]any{
				"channelAccounts": map[string]any{
					"telegram": []map[string]any{{
						"probe": map[string]any{"ok": true, "latencyMs": 123},
					}},
				},
			},
		})
		callIndex++
	})
	defer srv.Close()

	testReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/channels/telegram/test", strings.NewReader(`{}`))
	if err != nil {
		t.Fatal(err)
	}
	testReq.Header.Set("Authorization", "Bearer admin-token")
	testReq.Header.Set("Content-Type", "application/json")
	testRes, err := http.DefaultClient.Do(testReq)
	if err != nil {
		t.Fatal(err)
	}
	defer testRes.Body.Close()
	if testRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected channel test status: %d", testRes.StatusCode)
	}

	throughputReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/channels/telegram/throughput", nil)
	if err != nil {
		t.Fatal(err)
	}
	throughputReq.Header.Set("Authorization", "Bearer admin-token")
	throughputRes, err := http.DefaultClient.Do(throughputReq)
	if err != nil {
		t.Fatal(err)
	}
	defer throughputRes.Body.Close()
	if throughputRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected throughput status: %d", throughputRes.StatusCode)
	}

	projectionReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/chat/projection", strings.NewReader(`{"sessionKey":"session-1"}`))
	if err != nil {
		t.Fatal(err)
	}
	projectionReq.Header.Set("Authorization", "Bearer admin-token")
	projectionReq.Header.Set("Content-Type", "application/json")
	projectionRes, err := http.DefaultClient.Do(projectionReq)
	if err != nil {
		t.Fatal(err)
	}
	defer projectionRes.Body.Close()
	if projectionRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected projection status: %d", projectionRes.StatusCode)
	}
}

func TestGatewayFacade_DeckIdentity(t *testing.T) {
	expectedCalls := []string{"deck.identity.list", "deck.identity.link", "deck.identity.unlink"}
	callIndex := 0

	srv := newGatewayBackedServer(t, func(conn *websocket.Conn, method string, params map[string]any) {
		if method != expectedCalls[callIndex] {
			t.Fatalf("unexpected method at index %d: %s", callIndex, method)
		}
		switch method {
		case "deck.identity.list":
			_ = conn.WriteJSON(map[string]any{
				"type": "res",
				"id":   params["_requestID"],
				"ok":   true,
				"payload": map[string]any{
					"links": []map[string]any{{"canonical": "user:1"}},
				},
			})
		case "deck.identity.link":
			if params["canonical"] != "user:1" || params["channel"] != "telegram" || params["peerId"] != "42" {
				t.Fatalf("unexpected params: %#v", params)
			}
			if params["baseHash"] != "hash-1" {
				t.Fatalf("unexpected identity link baseHash: %#v", params)
			}
			_ = conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      params["_requestID"],
				"ok":      true,
				"payload": map[string]any{"ok": true},
			})
		case "deck.identity.unlink":
			if params["canonical"] != "user:1" || params["channel"] != "telegram" || params["peerId"] != "42" {
				t.Fatalf("unexpected params: %#v", params)
			}
			if params["baseHash"] != "hash-2" {
				t.Fatalf("unexpected identity unlink baseHash: %#v", params)
			}
			_ = conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      params["_requestID"],
				"ok":      true,
				"payload": map[string]any{"ok": true},
			})
		}
		callIndex++
	})
	defer srv.Close()

	listReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/deck/identity", nil)
	if err != nil {
		t.Fatal(err)
	}
	listReq.Header.Set("Authorization", "Bearer admin-token")
	listRes, err := http.DefaultClient.Do(listReq)
	if err != nil {
		t.Fatal(err)
	}
	defer listRes.Body.Close()
	if listRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected identity list status: %d", listRes.StatusCode)
	}

	linkReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/deck/identity", strings.NewReader(`{"action":"link","canonical":"user:1","channel":"telegram","peerId":"42","baseHash":"hash-1"}`))
	if err != nil {
		t.Fatal(err)
	}
	linkReq.Header.Set("Authorization", "Bearer admin-token")
	linkReq.Header.Set("Content-Type", "application/json")
	linkRes, err := http.DefaultClient.Do(linkReq)
	if err != nil {
		t.Fatal(err)
	}
	defer linkRes.Body.Close()
	if linkRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected identity link status: %d", linkRes.StatusCode)
	}

	unlinkReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/deck/identity", strings.NewReader(`{"action":"unlink","canonical":"user:1","channel":"telegram","peerId":"42","baseHash":"hash-2"}`))
	if err != nil {
		t.Fatal(err)
	}
	unlinkReq.Header.Set("Authorization", "Bearer admin-token")
	unlinkReq.Header.Set("Content-Type", "application/json")
	unlinkRes, err := http.DefaultClient.Do(unlinkReq)
	if err != nil {
		t.Fatal(err)
	}
	defer unlinkRes.Body.Close()
	if unlinkRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected identity unlink status: %d", unlinkRes.StatusCode)
	}
}

func TestGatewayFacade_DeckRouting(t *testing.T) {
	expectedCalls := []string{"deck.routing.list", "deck.routing.simulate"}
	callIndex := 0

	srv := newGatewayBackedServer(t, func(conn *websocket.Conn, method string, params map[string]any) {
		if method != expectedCalls[callIndex] {
			t.Fatalf("unexpected method at index %d: %s", callIndex, method)
		}
		switch method {
		case "deck.routing.list":
			if params["agentId"] != "main" {
				t.Fatalf("unexpected params: %#v", params)
			}
			_ = conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      params["_requestID"],
				"ok":      true,
				"payload": map[string]any{"bindings": []map[string]any{{"id": "binding-1"}}},
			})
		case "deck.routing.simulate":
			if params["channel"] != "telegram" {
				t.Fatalf("unexpected params: %#v", params)
			}
			_ = conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      params["_requestID"],
				"ok":      true,
				"payload": map[string]any{"tiers": []map[string]any{{"name": "match"}}},
			})
		}
		callIndex++
	})
	defer srv.Close()

	listReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/deck/routing?agentId=main", nil)
	if err != nil {
		t.Fatal(err)
	}
	listReq.Header.Set("Authorization", "Bearer admin-token")
	listRes, err := http.DefaultClient.Do(listReq)
	if err != nil {
		t.Fatal(err)
	}
	defer listRes.Body.Close()
	if listRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected routing list status: %d", listRes.StatusCode)
	}

	simReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/deck/routing", strings.NewReader(`{"action":"simulate","channel":"telegram"}`))
	if err != nil {
		t.Fatal(err)
	}
	simReq.Header.Set("Authorization", "Bearer admin-token")
	simReq.Header.Set("Content-Type", "application/json")
	simRes, err := http.DefaultClient.Do(simReq)
	if err != nil {
		t.Fatal(err)
	}
	defer simRes.Body.Close()
	if simRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected routing simulate status: %d", simRes.StatusCode)
	}
}

func TestGatewayFacade_DeckSubagentsAndThreads(t *testing.T) {
	expectedCalls := []string{"deck.subagents.list", "deck.subagents.lineage", "deck.threads.list"}
	callIndex := 0

	srv := newGatewayBackedServer(t, func(conn *websocket.Conn, method string, params map[string]any) {
		if method != expectedCalls[callIndex] {
			t.Fatalf("unexpected method at index %d: %s", callIndex, method)
		}
		switch method {
		case "deck.subagents.list":
			if params["status"] != "active" {
				t.Fatalf("unexpected params: %#v", params)
			}
			_ = conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      params["_requestID"],
				"ok":      true,
				"payload": map[string]any{"runs": []map[string]any{{"runId": "run-1"}}},
			})
		case "deck.subagents.lineage":
			if params["sessionKey"] != "sess-1" {
				t.Fatalf("unexpected params: %#v", params)
			}
			_ = conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      params["_requestID"],
				"ok":      true,
				"payload": map[string]any{"nodes": []map[string]any{{"runId": "run-1"}}},
			})
		case "deck.threads.list":
			if params["agentId"] != "main" {
				t.Fatalf("unexpected params: %#v", params)
			}
			if params["channel"] != "discord" || params["status"] != "all" {
				t.Fatalf("unexpected thread filters: %#v", params)
			}
			if _, ok := params["limit"]; ok {
				t.Fatalf("unexpected unsupported thread limit param: %#v", params)
			}
			_ = conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      params["_requestID"],
				"ok":      true,
				"payload": map[string]any{"threads": []map[string]any{{"threadId": "thread-1"}}},
			})
		}
		callIndex++
	})
	defer srv.Close()

	subReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/deck/subagents?status=active", nil)
	if err != nil {
		t.Fatal(err)
	}
	subReq.Header.Set("Authorization", "Bearer admin-token")
	subRes, err := http.DefaultClient.Do(subReq)
	if err != nil {
		t.Fatal(err)
	}
	defer subRes.Body.Close()
	if subRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected subagents list status: %d", subRes.StatusCode)
	}

	lineageReq, err := http.NewRequest(http.MethodPost, srv.URL+"/api/deck/subagents", strings.NewReader(`{"action":"lineage","sessionKey":"sess-1"}`))
	if err != nil {
		t.Fatal(err)
	}
	lineageReq.Header.Set("Authorization", "Bearer admin-token")
	lineageReq.Header.Set("Content-Type", "application/json")
	lineageRes, err := http.DefaultClient.Do(lineageReq)
	if err != nil {
		t.Fatal(err)
	}
	defer lineageRes.Body.Close()
	if lineageRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected subagents lineage status: %d", lineageRes.StatusCode)
	}

	threadReq, err := http.NewRequest(http.MethodGet, srv.URL+"/api/deck/threads?agentId=main&channel=discord&status=all&limit=10", nil)
	if err != nil {
		t.Fatal(err)
	}
	threadReq.Header.Set("Authorization", "Bearer admin-token")
	threadRes, err := http.DefaultClient.Do(threadReq)
	if err != nil {
		t.Fatal(err)
	}
	defer threadRes.Body.Close()
	if threadRes.StatusCode != http.StatusOK {
		t.Fatalf("unexpected threads status: %d", threadRes.StatusCode)
	}
}

func TestGatewayFacade_ApprovalsAndPolicyAndPlugins(t *testing.T) {
	expectedCalls := []string{
		"exec.approvals.get",
		"exec.approval.resolve",
		"exec.approvals.get",
		"exec.approvals.set",
		"plugin.approval.list",
		"plugin.approval.resolve",
	}
	callIndex := 0

	srv := newGatewayBackedServer(t, func(conn *websocket.Conn, method string, params map[string]any) {
		if method != expectedCalls[callIndex] {
			t.Fatalf("unexpected method at index %d: %s", callIndex, method)
		}
		switch method {
		case "exec.approvals.get":
			_ = conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      params["_requestID"],
				"ok":      true,
				"payload": map[string]any{"file": map[string]any{"defaults": map[string]any{}}},
			})
		case "exec.approval.resolve":
			if params["id"] != "ap-1" || params["decision"] != "approve" {
				t.Fatalf("unexpected params: %#v", params)
			}
			_ = conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      params["_requestID"],
				"ok":      true,
				"payload": map[string]any{"ok": true},
			})
		case "exec.approvals.set":
			if params["baseHash"] != "h1" {
				t.Fatalf("unexpected params: %#v", params)
			}
			_ = conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      params["_requestID"],
				"ok":      true,
				"payload": map[string]any{"ok": true},
			})
		case "plugin.approval.list":
			_ = conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      params["_requestID"],
				"ok":      true,
				"payload": []map[string]any{{"id": "plugin-ap-1"}},
			})
		case "plugin.approval.resolve":
			if params["id"] != "plugin-ap-1" || params["decision"] != "approve" {
				t.Fatalf("unexpected params: %#v", params)
			}
			_ = conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      params["_requestID"],
				"ok":      true,
				"payload": map[string]any{"ok": true},
			})
		}
		callIndex++
	})
	defer srv.Close()

	authHeader := "Bearer admin-token"

	req1, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/approvals", nil)
	req1.Header.Set("Authorization", authHeader)
	res1, err := http.DefaultClient.Do(req1)
	if err != nil {
		t.Fatal(err)
	}
	defer res1.Body.Close()
	if res1.StatusCode != http.StatusOK {
		t.Fatalf("unexpected approvals status: %d", res1.StatusCode)
	}

	req2, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/approvals", strings.NewReader(`{"id":"ap-1","decision":"approve"}`))
	req2.Header.Set("Authorization", authHeader)
	req2.Header.Set("Content-Type", "application/json")
	res2, err := http.DefaultClient.Do(req2)
	if err != nil {
		t.Fatal(err)
	}
	defer res2.Body.Close()
	if res2.StatusCode != http.StatusOK {
		t.Fatalf("unexpected approvals resolve status: %d", res2.StatusCode)
	}

	req3, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/approvals/policy", nil)
	req3.Header.Set("Authorization", authHeader)
	res3, err := http.DefaultClient.Do(req3)
	if err != nil {
		t.Fatal(err)
	}
	defer res3.Body.Close()
	if res3.StatusCode != http.StatusOK {
		t.Fatalf("unexpected approvals policy get status: %d", res3.StatusCode)
	}

	req4, _ := http.NewRequest(http.MethodPut, srv.URL+"/api/approvals/policy", strings.NewReader(`{"file":{"policy":"strict"},"baseHash":"h1"}`))
	req4.Header.Set("Authorization", authHeader)
	req4.Header.Set("Content-Type", "application/json")
	res4, err := http.DefaultClient.Do(req4)
	if err != nil {
		t.Fatal(err)
	}
	defer res4.Body.Close()
	if res4.StatusCode != http.StatusOK {
		t.Fatalf("unexpected approvals policy put status: %d", res4.StatusCode)
	}

	req5, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/approvals/plugins", nil)
	req5.Header.Set("Authorization", authHeader)
	res5, err := http.DefaultClient.Do(req5)
	if err != nil {
		t.Fatal(err)
	}
	defer res5.Body.Close()
	if res5.StatusCode != http.StatusOK {
		t.Fatalf("unexpected approvals plugins get status: %d", res5.StatusCode)
	}

	req6, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/approvals/plugins", strings.NewReader(`{"id":"plugin-ap-1","decision":"approve"}`))
	req6.Header.Set("Authorization", authHeader)
	req6.Header.Set("Content-Type", "application/json")
	res6, err := http.DefaultClient.Do(req6)
	if err != nil {
		t.Fatal(err)
	}
	defer res6.Body.Close()
	if res6.StatusCode != http.StatusOK {
		t.Fatalf("unexpected approvals plugins post status: %d", res6.StatusCode)
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
		snapshot: openclawrt.ManagedSnapshot{
			Managed:    true,
			Configured: true,
			Status:     openclawrt.ManagedStatusRunning,
			Health:     openclawrt.ManagedHealthHealthy,
			GatewayURL: config.ManagedGatewayURL(store.Effective().ManagedGateway),
			AutoStart:  false,
		},
	}
	srv := httptest.NewServer(newTestRouter(store, supervisor, bus))
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
		snapshot: openclawrt.ManagedSnapshot{
			Managed:    true,
			Configured: true,
			Status:     openclawrt.ManagedStatusRunning,
			Health:     openclawrt.ManagedHealthHealthy,
			GatewayURL: config.ManagedGatewayURL(store.Effective().ManagedGateway),
			AutoStart:  false,
		},
	}
	server := httptest.NewServer(newTestRouter(store, supervisor, bus))
	t.Cleanup(server.Close)
	return server
}
