package projection

import "testing"

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
	if len(messages) != 1 || messages[0].Id != "m1" || len(messages[0].Content) != 1 || messages[0].Content[0].Text != "hello" {
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
