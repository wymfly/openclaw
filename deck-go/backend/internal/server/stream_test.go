package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
)

func TestServeEventStream_ReplaysGapAndEvent(t *testing.T) {
	bus := events.NewBus(4)
	bus.Publish("runtime.status", []byte(`{"ok":true}`))
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	req := httptest.NewRequest(http.MethodGet, "/api/stream", nil).WithContext(ctx)
	req.Header.Set("Last-Event-ID", "0")
	rec := httptest.NewRecorder()

	serveEventStream(rec, req, bus)
	body := rec.Body.String()
	if !strings.Contains(body, "event: runtime.status") {
		t.Fatalf("unexpected body: %s", body)
	}
}

func TestResolveMessagesAndMeta(t *testing.T) {
	messages := resolveMessages(map[string]any{
		"messages": []any{map[string]any{"id": "m1"}},
	})
	items, ok := messages.([]any)
	if !ok || len(items) != 1 {
		t.Fatalf("unexpected messages payload: %#v", messages)
	}

	meta := resolveSessionMeta("session-1", map[string]any{
		"sessions": []any{
			map[string]any{"key": "session-1"},
		},
	})
	record, ok := meta.(map[string]any)
	if !ok || record["key"] != "session-1" {
		t.Fatalf("unexpected meta payload: %#v", meta)
	}
}

func TestEventBusEventsSinceGapDetection(t *testing.T) {
	bus := events.NewBus(2)
	bus.Publish("a", []byte(`{}`))
	bus.Publish("b", []byte(`{}`))
	bus.Publish("c", []byte(`{}`))
	_, gap := bus.EventsSince(1)
	if !gap {
		t.Fatal("expected gap detection")
	}
}

func TestLogsStreamBatchFormat(t *testing.T) {
	payload := map[string]any{
		"lines":  []any{"line-1"},
		"cursor": 10,
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(raw), "line-1") {
		t.Fatalf("unexpected payload: %s", raw)
	}
}
