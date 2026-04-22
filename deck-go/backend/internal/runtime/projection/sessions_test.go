package projection

import "testing"

func TestNormalizeSessionMetas(t *testing.T) {
	metas := NormalizeSessionMetas(map[string]any{
		"sessions": []any{
			map[string]any{
				"key":                "session-1",
				"agentId":            "main",
				"label":              "Test Session",
				"lastMessagePreview": "hello",
				"status":             "running",
			},
		},
	}, "")
	if len(metas) != 1 || metas[0].Key != "session-1" || metas[0].Title != "Test Session" {
		t.Fatalf("unexpected metas: %#v", metas)
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
