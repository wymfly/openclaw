package openclaw

import (
	"context"
	"testing"

	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
)

type stubRequester struct {
	t       *testing.T
	calls   []string
	payload map[string]any
}

func (s *stubRequester) Request(_ context.Context, method string, params map[string]any) (any, error) {
	s.calls = append(s.calls, method)
	switch method {
	case "sessions.list":
		if params["includeDerivedTitles"] != true || params["includeLastMessage"] != true {
			s.t.Fatalf("unexpected sessions.list params: %#v", params)
		}
		return s.payload["sessions.list"], nil
	case "sessions.get":
		if params["key"] != "session-1" {
			s.t.Fatalf("unexpected sessions.get params: %#v", params)
		}
		return s.payload["sessions.get"], nil
	default:
		s.t.Fatalf("unexpected method: %s", method)
		return nil, nil
	}
}

func TestSessionQueries_ListSessions(t *testing.T) {
	requester := &stubRequester{
		t: t,
		payload: map[string]any{
			"sessions.list": map[string]any{
				"sessions": []any{map[string]any{
					"key":                "session-1",
					"agentId":            "main",
					"label":              "Test Session",
					"lastMessagePreview": "hello",
					"status":             "running",
				}},
			},
		},
	}

	query := NewSessionQueries(requester)
	items, err := query.ListSessions(context.Background(), DefaultRuntimeID)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 {
		t.Fatalf("unexpected sessions payload: %#v", items)
	}
	if items[0].Key != "session-1" || items[0].Title != "Test Session" {
		t.Fatalf("unexpected normalized session: %#v", items[0])
	}
}

func TestSessionQueries_ListSessionsWithParams(t *testing.T) {
	requester := &stubRequester{
		t: t,
		payload: map[string]any{
			"sessions.list": map[string]any{
				"sessions": []any{map[string]any{
					"key":     "session-1",
					"agentId": "main",
					"title":   "Filtered Session",
					"status":  "running",
				}},
			},
		},
	}

	query := NewSessionQueries(requester)
	items, err := query.ListSessionsWithParams(context.Background(), map[string]any{"agentId": "main", "limit": 5}, "main")
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].Title != "Filtered Session" || items[0].AgentId != "main" {
		t.Fatalf("unexpected filtered sessions payload: %#v", items)
	}
}

func TestSessionQueries_GetTimeline(t *testing.T) {
	requester := &stubRequester{
		t: t,
		payload: map[string]any{
			"sessions.get": map[string]any{
				"messages": []any{map[string]any{
					"id":   "msg-1",
					"role": "assistant",
					"content": []any{map[string]any{
						"type": "text",
						"text": "hello",
					}},
				}},
			},
			"sessions.list": map[string]any{
				"sessions": []any{map[string]any{
					"key":     "session-1",
					"agentId": "main",
					"title":   "Test Session",
					"status":  "running",
				}},
			},
		},
	}

	query := NewSessionQueries(requester)
	detail, err := query.GetTimeline(context.Background(), DefaultRuntimeID, "session-1")
	if err != nil {
		t.Fatal(err)
	}
	if detail.Session.Key != "session-1" || detail.Session.Status != "running" {
		t.Fatalf("unexpected detail session: %#v", detail.Session)
	}
	if len(detail.Messages) != 1 || detail.Messages[0].Id != "msg-1" {
		t.Fatalf("unexpected detail messages: %#v", detail.Messages)
	}
}

func TestSessionQueries_GetTimelineWithParams(t *testing.T) {
	requester := &stubRequester{
		t: t,
		payload: map[string]any{
			"sessions.get": map[string]any{
				"messages": []any{map[string]any{
					"id":   "msg-1",
					"role": "assistant",
					"content": []any{map[string]any{
						"type": "text",
						"text": "hello",
					}},
				}},
			},
			"sessions.list": map[string]any{
				"sessions": []any{map[string]any{
					"key":     "session-1",
					"agentId": "main",
					"title":   "Filtered Session",
					"status":  "running",
				}},
			},
		},
	}

	query := NewSessionQueries(requester)
	detail, err := query.GetTimelineWithParams(context.Background(), "session-1", "main", 25)
	if err != nil {
		t.Fatal(err)
	}
	if detail.Session.Key != "session-1" || detail.Session.AgentId != "main" || detail.Session.Title != "Filtered Session" {
		t.Fatalf("unexpected detail session: %#v", detail.Session)
	}
	if len(detail.Messages) != 1 || detail.Messages[0].Id != "msg-1" {
		t.Fatalf("unexpected detail messages: %#v", detail.Messages)
	}
}

var _ httpSessionQueryProvider = (*SessionQueries)(nil)

type httpSessionQueryProvider interface {
	ListSessions(context.Context, string) ([]deckapi.DeckGoSessionMeta, error)
	GetTimeline(context.Context, string, string) (deckapi.DeckGoSessionDetailResponse, error)
}
