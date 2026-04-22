package projection

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
)

func TestCollectActivityEntriesAndRuns(t *testing.T) {
	bus := events.NewBus(32)

	now := time.Now().UnixMilli()
	activityPayload, _ := json.Marshal(map[string]any{
		"id":          "act-1",
		"timestamp":   now,
		"type":        "alert",
		"agentId":     "main",
		"agentName":   "Main",
		"description": "Alert fired",
		"details":     "details",
	})
	bus.Publish("activity.event", activityPayload)

	chatPayload, _ := json.Marshal(map[string]any{
		"runId":      "run-1",
		"sessionKey": "agent:main:session-1",
		"state":      "final",
		"usage": map[string]any{
			"input_tokens":  10,
			"output_tokens": 20,
		},
	})
	bus.Publish("chat", chatPayload)

	agentPayload, _ := json.Marshal(map[string]any{
		"runId":      "run-1",
		"sessionKey": "agent:main:session-1",
		"stream":     "tool",
		"data": map[string]any{
			"name": "write",
		},
	})
	bus.Publish("agent", agentPayload)

	entries := CollectActivityEntries(bus, 10)
	if len(entries) < 3 {
		t.Fatalf("expected synthesized activity entries, got %#v", entries)
	}

	runs := AggregateRuns(bus)
	if len(runs) != 1 || runs[0].RunID != "run-1" || runs[0].Status != "completed" {
		t.Fatalf("unexpected runs: %#v", runs)
	}
	if runs[0].FileOps != 1 || runs[0].TotalTokens != 30 {
		t.Fatalf("unexpected run aggregation: %#v", runs[0])
	}

	rows := AggregateRunEvents(bus, "run-1")
	if len(rows) != 2 {
		t.Fatalf("unexpected run events: %#v", rows)
	}

	stats := BuildMonitorStats(runs, time.Now())
	if stats.TotalRuns != 1 || len(stats.TopAgents) != 1 || stats.TopAgents[0].AgentID != "main" {
		t.Fatalf("unexpected stats: %#v", stats)
	}
}
