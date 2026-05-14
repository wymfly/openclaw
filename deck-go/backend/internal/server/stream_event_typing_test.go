package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
	openclawrt "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/openclaw"
)

// These tests pin the SSE narrowing contract for events that are reverse
// engineered from the agents panel (`useAgentMetricsSSE.ts`). They are the
// "guard rail" referenced in OpenSpec change
// `deck-go-chat-agents-contract-typing` (spec
// `deck-go-stream-event-typing`): if upstream changes the payload shape,
// these tests fail before users see broken UI.

// captureStreamFrame publishes a single payload onto the in-process bus,
// drives one round of serveEventStream against a cancelled context, and
// returns the raw SSE response body for parsing.
func captureStreamFrame(t *testing.T, eventName string, payload []byte) string {
	t.Helper()
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatalf("config store: %v", err)
	}
	bus := events.NewBus(4)
	bus.Publish(eventName, payload)
	managed := openclawrt.NewManagedRuntimeWithFacade(store, &testSupervisor{}, bus)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	req := httptest.NewRequest(http.MethodGet, "/api/stream", nil).WithContext(ctx)
	req.Header.Set("Last-Event-ID", "0")
	rec := httptest.NewRecorder()
	serveEventStream(rec, req, managed)
	return rec.Body.String()
}

// dataForEvent returns the JSON `data:` line associated with the SSE frame
// whose `event:` line matches the given name, or an empty string when not
// present.
func dataForEvent(body, eventName string) string {
	frames := strings.Split(body, "\n\n")
	for _, frame := range frames {
		var hasEvent bool
		var data string
		for _, line := range strings.Split(frame, "\n") {
			if strings.TrimSpace(line) == "event: "+eventName {
				hasEvent = true
			}
			if strings.HasPrefix(line, "data: ") {
				data = strings.TrimPrefix(line, "data: ")
			}
		}
		if hasEvent {
			return data
		}
	}
	return ""
}

func TestServeEventStream_NarrowsActivityEvent(t *testing.T) {
	payload, err := json.Marshal(map[string]any{
		// Required fields under DeckGoActivityStreamEvent.
		"agentId": "main",
		"type":    "chat",
		// Open envelope fields tolerated by the index signature.
		"id":          "act-1",
		"timestamp":   int64(1714560000000),
		"agentName":   "Main",
		"description": "Chat run completed",
	})
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}
	body := captureStreamFrame(t, "activity.event", payload)
	if !strings.Contains(body, "event: activity.event") {
		t.Fatalf("expected activity.event frame, got: %s", body)
	}
	data := dataForEvent(body, "activity.event")
	if data == "" {
		t.Fatalf("missing data line for activity.event in: %s", body)
	}
	var typed deckapi.DeckGoActivityStreamEvent
	if err := json.Unmarshal([]byte(data), &typed); err != nil {
		t.Fatalf("contract narrowing failed: %v (data=%s)", err, data)
	}
	if typed.AgentId != "main" {
		t.Fatalf("expected AgentId=main, got %q", typed.AgentId)
	}
	if typed.Type != "chat" {
		t.Fatalf("expected Type=chat, got %q", typed.Type)
	}
}

func TestServeEventStream_NarrowsAgentStatusChanged(t *testing.T) {
	cases := []struct {
		name   string
		status string
	}{
		{name: "busy", status: "busy"},
		{name: "idle", status: "idle"},
		// Unknown status must still narrow successfully — the TS surface
		// tolerates new upstream values via `(string & {})`.
		{name: "unknown_starting", status: "starting"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			payload, err := json.Marshal(map[string]any{
				"agentId": "main",
				"status":  tc.status,
			})
			if err != nil {
				t.Fatalf("marshal payload: %v", err)
			}
			body := captureStreamFrame(t, "agent.status.changed", payload)
			if !strings.Contains(body, "event: agent.status.changed") {
				t.Fatalf("expected agent.status.changed frame, got: %s", body)
			}
			data := dataForEvent(body, "agent.status.changed")
			if data == "" {
				t.Fatalf("missing data line for agent.status.changed in: %s", body)
			}
			var typed deckapi.DeckGoAgentStatusChangedStreamEvent
			if err := json.Unmarshal([]byte(data), &typed); err != nil {
				t.Fatalf("contract narrowing failed: %v (data=%s)", err, data)
			}
			if typed.AgentId != "main" {
				t.Fatalf("expected AgentId=main, got %q", typed.AgentId)
			}
			if typed.Status != tc.status {
				t.Fatalf("expected Status=%q, got %q", tc.status, typed.Status)
			}
		})
	}
}
