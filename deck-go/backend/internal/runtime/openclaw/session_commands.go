package openclaw

import (
	"context"

	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/coerce"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/projection"
)

type SessionCommands struct {
	requester Requester
}

func NewSessionCommands(requester Requester) *SessionCommands {
	return &SessionCommands{requester: requester}
}

func (c *SessionCommands) Delete(ctx context.Context, sessionKey string) (deckapi.DeckGoSessionMutationResponse, error) {
	payload, err := c.requester.Request(ctx, "sessions.delete", map[string]any{"key": sessionKey})
	if err != nil {
		return deckapi.DeckGoSessionMutationResponse{}, err
	}
	return normalizeSessionMutationResponse(payload, sessionKey), nil
}

func (c *SessionCommands) Preview(ctx context.Context, keys []string) (deckapi.DeckGoSessionsPreviewResponse, error) {
	payload, err := c.requester.Request(ctx, "sessions.preview", map[string]any{"keys": keys})
	if err != nil {
		return deckapi.DeckGoSessionsPreviewResponse{}, err
	}
	return projection.NormalizeSessionPreviews(payload), nil
}

func (c *SessionCommands) Reset(ctx context.Context, sessionKey string, reason string) (deckapi.DeckGoSessionMutationResponse, error) {
	payload, err := c.requester.Request(ctx, "sessions.reset", map[string]any{
		"key":    sessionKey,
		"reason": reason,
	})
	if err != nil {
		return deckapi.DeckGoSessionMutationResponse{}, err
	}
	return normalizeSessionMutationResponse(payload, sessionKey), nil
}

func (c *SessionCommands) Clear(ctx context.Context, sessionKey string) (deckapi.DeckGoSessionMutationResponse, error) {
	payload, err := c.requester.Request(ctx, "sessions.clear", map[string]any{"key": sessionKey})
	if err != nil {
		return deckapi.DeckGoSessionMutationResponse{}, err
	}
	return normalizeSessionMutationResponse(payload, sessionKey), nil
}

func (c *SessionCommands) Patch(ctx context.Context, sessionKey string, body map[string]any) (deckapi.DeckGoSessionMutationResponse, error) {
	payload, err := c.requester.Request(ctx, "sessions.patch", body)
	if err != nil {
		return deckapi.DeckGoSessionMutationResponse{}, err
	}
	return normalizeSessionMutationResponse(payload, sessionKey), nil
}

func (c *SessionCommands) Create(ctx context.Context, params map[string]any) (deckapi.DeckGoSessionCreateResponse, error) {
	payload, err := c.requester.Request(ctx, "sessions.create", params)
	if err != nil {
		return deckapi.DeckGoSessionCreateResponse{}, err
	}
	return normalizeSessionCreateResponse(payload), nil
}

func (c *SessionCommands) Send(ctx context.Context, params map[string]any) (deckapi.DeckGoSessionSendResponse, error) {
	payload, err := c.requester.Request(ctx, "sessions.send", params)
	if err != nil {
		return deckapi.DeckGoSessionSendResponse{}, err
	}
	return normalizeSessionSendResponse(payload), nil
}

func (c *SessionCommands) Abort(ctx context.Context, params map[string]any) (deckapi.DeckGoSessionAbortResponse, error) {
	payload, err := c.requester.Request(ctx, "sessions.abort", params)
	if err != nil {
		return deckapi.DeckGoSessionAbortResponse{}, err
	}
	return normalizeSessionAbortResponse(payload), nil
}

func (c *SessionCommands) Compact(ctx context.Context, sessionKey string) (any, error) {
	return c.requester.Request(ctx, "sessions.compact", map[string]any{"key": sessionKey})
}

func (c *SessionCommands) CompactionList(ctx context.Context, sessionKey string) (any, error) {
	return c.requester.Request(ctx, "sessions.compaction.list", map[string]any{"key": sessionKey})
}

func (c *SessionCommands) CompactionBranch(ctx context.Context, sessionKey string, checkpointID string) (any, error) {
	return c.requester.Request(ctx, "sessions.compaction.branch", map[string]any{
		"key":          sessionKey,
		"checkpointId": checkpointID,
	})
}

func (c *SessionCommands) CompactionRestore(ctx context.Context, sessionKey string, checkpointID string) (any, error) {
	return c.requester.Request(ctx, "sessions.compaction.restore", map[string]any{
		"key":          sessionKey,
		"checkpointId": checkpointID,
	})
}

func (c *SessionCommands) Steer(ctx context.Context, sessionKey string, message string) (any, error) {
	return c.requester.Request(ctx, "sessions.steer", map[string]any{
		"key":     sessionKey,
		"message": message,
	})
}

func normalizeSessionCreateResponse(payload any) deckapi.DeckGoSessionCreateResponse {
	record := coerce.Map(payload)
	return deckapi.DeckGoSessionCreateResponse{
		Ok:                   coerce.Bool(record["ok"]),
		Key:                  coerce.String(record["key"], coerce.String(record["sessionKey"], "")),
		SessionId:            coerce.String(record["sessionId"], ""),
		RunId:                coerce.String(record["runId"], ""),
		Status:               coerce.String(record["status"], ""),
		MessageSeq:           coerce.Number(record["messageSeq"]),
		InterruptedActiveRun: coerce.Bool(record["interruptedActiveRun"]),
		RunStarted:           coerce.Bool(record["runStarted"]),
		RunError:             record["runError"],
		Entry:                coerce.Map(record["entry"]),
	}
}

func normalizeSessionSendResponse(payload any) deckapi.DeckGoSessionSendResponse {
	record := coerce.Map(payload)
	return deckapi.DeckGoSessionSendResponse{
		RunId:                coerce.String(record["runId"], ""),
		Status:               coerce.String(record["status"], ""),
		MessageSeq:           coerce.Number(record["messageSeq"]),
		InterruptedActiveRun: coerce.Bool(record["interruptedActiveRun"]),
	}
}

func normalizeSessionAbortResponse(payload any) deckapi.DeckGoSessionAbortResponse {
	record := coerce.Map(payload)
	return deckapi.DeckGoSessionAbortResponse{
		Ok:           coerce.Bool(record["ok"]),
		AbortedRunId: coerce.String(record["abortedRunId"], ""),
		Status:       coerce.String(record["status"], ""),
	}
}

func normalizeSessionMutationResponse(payload any, fallbackKey string) deckapi.DeckGoSessionMutationResponse {
	record := coerce.Map(payload)
	return deckapi.DeckGoSessionMutationResponse{
		Ok:    coerce.Bool(record["ok"]),
		Key:   coerce.String(record["key"], fallbackKey),
		Entry: coerce.Map(record["entry"]),
	}
}
