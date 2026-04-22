package projection

import "github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"

type TimelineSnapshot struct {
	RuntimeID string                         `json:"runtimeId"`
	SessionID string                         `json:"sessionId"`
	Timeline  []deckapi.DeckGoTranscriptMessage `json:"timeline"`
	ActiveRun map[string]any                 `json:"activeRun,omitempty"`
}

func BuildTimelineSnapshot(runtimeID string, sessionID string, detail deckapi.DeckGoSessionDetailResponse) TimelineSnapshot {
	return TimelineSnapshot{
		RuntimeID: runtimeID,
		SessionID: sessionID,
		Timeline:  detail.Messages,
		ActiveRun: activeRunSummary(detail),
	}
}

func activeRunSummary(detail deckapi.DeckGoSessionDetailResponse) map[string]any {
	if detail.Session.Key == "" && detail.Session.Status == "" {
		return nil
	}
	status := detail.Session.Status
	if status != "running" && status != "starting" {
		return nil
	}
	return map[string]any{
		"status":    status,
		"sessionId": detail.Session.Key,
		"agentId":   detail.Session.AgentId,
	}
}
