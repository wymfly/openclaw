package projection

import (
	"testing"

	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
)

func TestBuildTimelineSnapshot(t *testing.T) {
	snapshot := BuildTimelineSnapshot("rt_local", "session-1", deckapi.DeckGoSessionDetailResponse{
		Session: deckapi.DeckGoSessionMeta{
			Key:     "session-1",
			AgentId: "main",
			Status:  "running",
		},
		Messages: []deckapi.DeckGoTranscriptMessage{{
			Id:   "msg-1",
			Role: "assistant",
		}},
	})

	if snapshot.RuntimeID != "rt_local" || snapshot.SessionID != "session-1" {
		t.Fatalf("unexpected ids: %#v", snapshot)
	}
	if len(snapshot.Timeline) != 1 || snapshot.Timeline[0].Id != "msg-1" {
		t.Fatalf("unexpected timeline: %#v", snapshot)
	}
	if snapshot.ActiveRun == nil || snapshot.ActiveRun["status"] != "running" {
		t.Fatalf("unexpected active run: %#v", snapshot.ActiveRun)
	}
}

func TestBuildTimelineSnapshot_OmitsInactiveRun(t *testing.T) {
	snapshot := BuildTimelineSnapshot("rt_local", "session-1", deckapi.DeckGoSessionDetailResponse{
		Session: deckapi.DeckGoSessionMeta{
			Key:     "session-1",
			AgentId: "main",
			Status:  "done",
		},
	})

	if snapshot.ActiveRun != nil {
		t.Fatalf("expected nil active run, got %#v", snapshot.ActiveRun)
	}
}
