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

func TestServeEventStream_EmitsProjectionGapEvent(t *testing.T) {
	bus := events.NewBus(2)
	bus.Publish("a", []byte(`{}`))
	bus.Publish("b", []byte(`{}`))
	bus.Publish("c", []byte(`{}`))
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	req := httptest.NewRequest(http.MethodGet, "/api/stream", nil).WithContext(ctx)
	req.Header.Set("Last-Event-ID", "1")
	rec := httptest.NewRecorder()

	serveEventStream(rec, req, bus)
	body := rec.Body.String()
	if !strings.Contains(body, "event: projection.gap") || !strings.Contains(body, "\"reason\":\"events_pruned\"") {
		t.Fatalf("unexpected gap body: %s", body)
	}
}

func TestNormalizeMessagesAndMeta(t *testing.T) {
	messages := normalizeTranscriptMessages(map[string]any{
		"messages": []any{map[string]any{"id": "m1"}},
	})
	if len(messages) != 1 || messages[0].Id != "m1" {
		t.Fatalf("unexpected messages payload: %#v", messages)
	}

	metas := normalizeSessionMetas(map[string]any{
		"sessions": []any{
			map[string]any{"key": "session-1", "agentId": "main"},
		},
	}, "")
	if len(metas) != 1 || metas[0].Key != "session-1" {
		t.Fatalf("unexpected meta payload: %#v", metas)
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
