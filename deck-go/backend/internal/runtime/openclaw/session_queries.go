package openclaw

import (
	"context"

	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/projection"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/runtimeid"
)

const DefaultRuntimeID = runtimeid.Default

type Requester interface {
	Request(ctx context.Context, method string, params map[string]any) (any, error)
}

type SessionQueries struct {
	requester Requester
}

func NewSessionQueries(requester Requester) *SessionQueries {
	return &SessionQueries{requester: requester}
}

func (q *SessionQueries) ListSessions(ctx context.Context, _ string) ([]deckapi.DeckGoSessionMeta, error) {
	return q.ListSessionsWithParams(ctx, map[string]any{}, "")
}

func (q *SessionQueries) ListSessionsWithParams(ctx context.Context, params map[string]any, fallbackAgentID string) ([]deckapi.DeckGoSessionMeta, error) {
	requestParams := cloneSessionListParams(params)
	requestParams["includeDerivedTitles"] = true
	requestParams["includeLastMessage"] = true
	payload, err := q.requester.Request(ctx, "sessions.list", requestParams)
	if err != nil {
		return nil, err
	}
	return projection.NormalizeSessionMetas(payload, fallbackAgentID), nil
}

func cloneSessionListParams(params map[string]any) map[string]any {
	requestParams := make(map[string]any, len(params)+2)
	for key, value := range params {
		requestParams[key] = value
	}
	return requestParams
}

func (q *SessionQueries) GetTimeline(ctx context.Context, _ string, sessionID string) (deckapi.DeckGoSessionDetailResponse, error) {
	return q.GetTimelineWithParams(ctx, sessionID, "", 0)
}

func (q *SessionQueries) GetTimelineWithParams(ctx context.Context, sessionID string, agentID string, limit int) (deckapi.DeckGoSessionDetailResponse, error) {
	return fetchSessionDetailPayload(ctx, q.requester, sessionID, agentID, limit)
}

func fetchSessionDetailPayload(
	ctx context.Context,
	requester Requester,
	sessionKey string,
	agentID string,
	limit int,
) (deckapi.DeckGoSessionDetailResponse, error) {
	historyParams := map[string]any{"key": sessionKey}
	if limit > 0 {
		historyParams["limit"] = limit
	}
	historyPayload, err := requester.Request(ctx, "sessions.get", historyParams)
	if err != nil {
		return deckapi.DeckGoSessionDetailResponse{}, err
	}
	sessionsParams := map[string]any{
		"includeDerivedTitles": true,
		"includeLastMessage":   true,
		"search":               sessionKey,
		"limit":                1,
	}
	if agentID != "" {
		sessionsParams["agentId"] = agentID
	}
	sessionsPayload, err := requester.Request(ctx, "sessions.list", sessionsParams)
	if err != nil {
		return deckapi.DeckGoSessionDetailResponse{}, err
	}
	return projection.NormalizeSessionDetail(sessionKey, historyPayload, sessionsPayload, agentID), nil
}
