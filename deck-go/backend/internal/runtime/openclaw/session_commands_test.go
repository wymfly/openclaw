package openclaw

import (
	"context"
	"testing"
)

func TestSessionCommands_CreateSendAbortAndMutation(t *testing.T) {
	commands := NewSessionCommands(&stubAdapterRequester{
		t: t,
		payload: map[string]any{
			"sessions.create": map[string]any{
				"key":        "session-1",
				"sessionId":  "session-1",
				"runId":      "run-1",
				"status":     "started",
				"runStarted": true,
			},
			"sessions.send": map[string]any{
				"runId":      "run-2",
				"status":     "started",
				"messageSeq": 2,
			},
			"sessions.abort": map[string]any{
				"ok":           true,
				"abortedRunId": "run-2",
				"status":       "aborted",
			},
			"sessions.delete": map[string]any{
				"ok":  true,
				"key": "session-1",
			},
		},
		errs: map[string]error{},
	})

	created, err := commands.Create(context.Background(), map[string]any{"agentId": "main", "message": "hello"})
	if err != nil {
		t.Fatal(err)
	}
	if created.Key != "session-1" || created.RunId != "run-1" || !created.RunStarted {
		t.Fatalf("unexpected create response: %#v", created)
	}

	sent, err := commands.Send(context.Background(), map[string]any{"key": "session-1", "message": "hello"})
	if err != nil {
		t.Fatal(err)
	}
	if sent.RunId != "run-2" || sent.Status != "started" {
		t.Fatalf("unexpected send response: %#v", sent)
	}

	aborted, err := commands.Abort(context.Background(), map[string]any{"key": "session-1", "runId": "run-2"})
	if err != nil {
		t.Fatal(err)
	}
	if aborted.AbortedRunId != "run-2" || aborted.Status != "aborted" {
		t.Fatalf("unexpected abort response: %#v", aborted)
	}

	deleted, err := commands.Delete(context.Background(), "session-1")
	if err != nil {
		t.Fatal(err)
	}
	if !deleted.Ok || deleted.Key != "session-1" {
		t.Fatalf("unexpected delete response: %#v", deleted)
	}
}

func TestSessionCommands_PreviewResetClearAndPatch(t *testing.T) {
	commands := NewSessionCommands(&stubAdapterRequester{
		t: t,
		payload: map[string]any{
			"sessions.preview": map[string]any{
				"ts": 100,
				"previews": []any{map[string]any{
					"key":    "session-1",
					"status": "ok",
					"items": []any{map[string]any{
						"role": "assistant",
						"text": "preview text",
					}},
				}},
			},
			"sessions.reset": map[string]any{"ok": true, "key": "session-1"},
			"sessions.clear": map[string]any{"ok": true, "key": "session-1"},
			"sessions.patch": map[string]any{"ok": true, "key": "session-1"},
		},
		errs: map[string]error{},
	})

	previews, err := commands.Preview(context.Background(), []string{"session-1"})
	if err != nil {
		t.Fatal(err)
	}
	if len(previews.Previews) != 1 || previews.Previews[0].Key != "session-1" {
		t.Fatalf("unexpected previews: %#v", previews)
	}

	reset, err := commands.Reset(context.Background(), "session-1", "reset")
	if err != nil {
		t.Fatal(err)
	}
	if !reset.Ok || reset.Key != "session-1" {
		t.Fatalf("unexpected reset response: %#v", reset)
	}

	cleared, err := commands.Clear(context.Background(), "session-1")
	if err != nil {
		t.Fatal(err)
	}
	if !cleared.Ok || cleared.Key != "session-1" {
		t.Fatalf("unexpected clear response: %#v", cleared)
	}

	patched, err := commands.Patch(context.Background(), "session-1", map[string]any{"key": "session-1", "model": "gpt-5.4"})
	if err != nil {
		t.Fatal(err)
	}
	if !patched.Ok || patched.Key != "session-1" {
		t.Fatalf("unexpected patch response: %#v", patched)
	}
}
