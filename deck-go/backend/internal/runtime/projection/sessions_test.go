package projection

import (
	"encoding/json"
	"testing"

	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway/generated"
)

func TestNormalizeSessionMetas(t *testing.T) {
	metas := NormalizeSessionMetas(map[string]any{
		"sessions": []any{
			map[string]any{
				"key":                  "session-1",
				"agentId":              "main",
				"label":                "Test Session",
				"kind":                 "direct",
				"lastMessagePreview":   "hello",
				"status":               "running",
				"thinkingLevel":        "high",
				"fastMode":             true,
				"inputTokens":          120,
				"outputTokens":         80,
				"totalTokens":          200,
				"totalTokensFresh":     true,
				"estimatedCostUsd":     0.25,
				"contextTokens":        1000,
				"parentSessionKey":     "parent-1",
				"childSessions":        []any{"child-1", "child-2"},
				"subagentRole":         "leaf",
				"subagentControlScope": "children",
				"spawnedWorkspaceDir":  "/tmp/session-1",
			},
		},
	}, "")
	if len(metas) != 1 || metas[0].Key != "session-1" || metas[0].Title != "Test Session" {
		t.Fatalf("unexpected metas: %#v", metas)
	}
	meta := metas[0]
	if meta.Label != "Test Session" || meta.Kind != "direct" || meta.ThinkingLevel != "high" || !meta.FastMode {
		t.Fatalf("missing session directive metadata: %#v", meta)
	}
	if meta.InputTokens != 120 || meta.OutputTokens != 80 || meta.TotalTokens != 200 || !meta.TotalTokensFresh {
		t.Fatalf("missing token metadata: %#v", meta)
	}
	if meta.EstimatedCostUsd != 0.25 || meta.ContextTokens != 1000 {
		t.Fatalf("missing cost/context metadata: %#v", meta)
	}
	if meta.ParentSessionKey != "parent-1" || len(meta.ChildSessions) != 2 || meta.ChildSessions[1] != "child-2" {
		t.Fatalf("missing session relationship metadata: %#v", meta)
	}
	if meta.SubagentRole != "leaf" || meta.SubagentControlScope != "children" || meta.SpawnedWorkspaceDir != "/tmp/session-1" {
		t.Fatalf("missing subagent metadata: %#v", meta)
	}
}

func TestNormalizeSessionMetasFromGeneratedGatewayDTO(t *testing.T) {
	var payload generated.SessionsListResult
	mustDecodeSessionFixture(t, `{
		"count": 1,
		"defaults": {"contextTokens": 4096, "model": "gpt-5.4", "modelProvider": "openai"},
		"path": "/tmp/sessions.json",
		"ts": 1714560000,
		"sessions": [
			{
				"key": "session-1",
				"agentId": "main",
				"label": "Typed Gateway Session",
				"kind": "direct",
				"lastMessagePreview": "hello",
				"status": "running",
				"updatedAt": 1714560100,
				"inputTokens": 120,
				"outputTokens": 80,
				"totalTokens": 200,
				"totalTokensFresh": true,
				"estimatedCostUsd": 0.25,
				"contextTokens": 1000,
				"childSessions": ["child-1"],
				"thinkingLevel": "high",
				"fastMode": true
			}
		]
	}`, &payload)

	metas := NormalizeSessionMetas(payload, "main")
	if len(metas) != 1 {
		t.Fatalf("expected one session meta, got %#v", metas)
	}
	meta := metas[0]
	if meta.Key != "session-1" || meta.Title != "Typed Gateway Session" || meta.AgentId != "main" {
		t.Fatalf("generated session DTO was not converted to Deck DTO: %#v", meta)
	}
	if meta.TotalTokens != 200 || !meta.TotalTokensFresh || meta.ChildSessions[0] != "child-1" {
		t.Fatalf("generated session token/relationship fields were not preserved: %#v", meta)
	}
}

func TestNormalizeSessionDetailFromGeneratedGatewayDTOs(t *testing.T) {
	var sessions generated.SessionsListResult
	mustDecodeSessionFixture(t, `{
		"count": 1,
		"defaults": {"contextTokens": 4096, "model": "gpt-5.4", "modelProvider": "openai"},
		"path": "/tmp/sessions.json",
		"ts": 1714560000,
		"sessions": [{"key": "session-1", "agentId": "main", "label": "Typed Gateway Session", "kind": "direct", "updatedAt": 1714560100}]
	}`, &sessions)
	var history generated.ChatHistoryResult
	mustDecodeSessionFixture(t, `{
		"sessionId": "raw-session-1",
		"sessionKey": "session-1",
		"messages": [
			{"id": "m1", "role": "assistant", "timestamp": 1714560200, "content": [{"type": "text", "text": "hello"}]}
		]
	}`, &history)

	detail := NormalizeSessionDetail("session-1", history, sessions, "main")
	if detail.Session.Key != "session-1" || detail.Session.Title != "Typed Gateway Session" {
		t.Fatalf("generated session list was not converted in detail: %#v", detail.Session)
	}
	if len(detail.Messages) != 1 || detail.Messages[0].Id != "m1" {
		t.Fatalf("generated chat history was not converted in detail: %#v", detail.Messages)
	}
	if block := transcriptBlockMap(detail.Messages[0].Content[0]); block["text"] != "hello" {
		t.Fatalf("generated chat history was not converted in detail: %#v", detail.Messages)
	}
}

// transcriptBlockMap unwraps a DeckGoTranscriptBlock value (a discriminated
// union on the TS side, `any` on the Go side) into its underlying map shape.
func transcriptBlockMap(block deckapi.DeckGoTranscriptBlock) map[string]any {
	if m, ok := block.(map[string]any); ok {
		return m
	}
	return nil
}

func TestNormalizeTranscriptMessages(t *testing.T) {
	messages := NormalizeTranscriptMessages(map[string]any{
		"messages": []any{
			map[string]any{
				"id":   "m1",
				"role": "assistant",
				"content": []any{
					map[string]any{"type": "text", "text": "hello"},
				},
			},
		},
	})
	if len(messages) != 1 || messages[0].Id != "m1" || len(messages[0].Content) != 1 {
		t.Fatalf("unexpected messages: %#v", messages)
	}
	if block := transcriptBlockMap(messages[0].Content[0]); block["text"] != "hello" {
		t.Fatalf("unexpected messages: %#v", messages)
	}
}

func TestNormalizeSessionPreviews(t *testing.T) {
	previews := NormalizeSessionPreviews(map[string]any{
		"ts": 100,
		"previews": []any{
			map[string]any{
				"key":    "session-1",
				"status": "ok",
				"items": []any{
					map[string]any{"role": "assistant", "text": "preview text"},
				},
			},
		},
	})
	if previews.Ts != 100 || len(previews.Previews) != 1 || previews.Previews[0].Key != "session-1" {
		t.Fatalf("unexpected previews: %#v", previews)
	}
}

func mustDecodeSessionFixture(t *testing.T, raw string, target any) {
	t.Helper()
	if err := json.Unmarshal([]byte(raw), target); err != nil {
		t.Fatalf("decode fixture: %v", err)
	}
}
