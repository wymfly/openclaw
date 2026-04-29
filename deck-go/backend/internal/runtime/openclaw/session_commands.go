package openclaw

import (
	"context"

	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway/generated"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/coerce"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/projection"
)

type SessionCommands struct {
	requester Requester
	typed     *generated.TypedClient
}

func NewSessionCommands(requester Requester) *SessionCommands {
	return &SessionCommands{
		requester: requester,
		typed:     generated.NewTypedClient(requester),
	}
}

func (c *SessionCommands) Delete(ctx context.Context, sessionKey string) (deckapi.DeckGoSessionMutationResponse, error) {
	payload, err := c.typed.SessionsDelete(ctx, generated.SessionsDeleteParams{Key: sessionKey})
	if err != nil {
		return deckapi.DeckGoSessionMutationResponse{}, err
	}
	return normalizeSessionMutationResponse(payload, sessionKey), nil
}

func (c *SessionCommands) Preview(ctx context.Context, keys []string) (deckapi.DeckGoSessionsPreviewResponse, error) {
	payload, err := c.typed.SessionsPreview(ctx, generated.SessionsPreviewParams{Keys: keys})
	if err != nil {
		return deckapi.DeckGoSessionsPreviewResponse{}, err
	}
	return projection.NormalizeSessionPreviews(payload), nil
}

func (c *SessionCommands) Reset(ctx context.Context, sessionKey string, reason string) (deckapi.DeckGoSessionMutationResponse, error) {
	payload, err := c.typed.SessionsReset(ctx, generated.SessionsResetParams{Key: sessionKey, Reason: reason})
	if err != nil {
		return deckapi.DeckGoSessionMutationResponse{}, err
	}
	return normalizeSessionMutationResponse(payload, sessionKey), nil
}

func (c *SessionCommands) Clear(ctx context.Context, sessionKey string) (deckapi.DeckGoSessionMutationResponse, error) {
	payload, err := c.typed.SessionsClear(ctx, generated.SessionsClearParams{Key: sessionKey})
	if err != nil {
		return deckapi.DeckGoSessionMutationResponse{}, err
	}
	return normalizeSessionMutationResponse(payload, sessionKey), nil
}

func (c *SessionCommands) Patch(ctx context.Context, sessionKey string, body map[string]any) (deckapi.DeckGoSessionMutationResponse, error) {
	params := make(map[string]any, len(body)+1)
	for key, value := range body {
		params[key] = value
	}
	params["key"] = sessionKey
	typedParams, err := typedParamsFromMap[generated.SessionsPatchParams](params)
	if err != nil {
		return deckapi.DeckGoSessionMutationResponse{}, err
	}
	payload, err := c.typed.SessionsPatch(ctx, typedParams)
	if err != nil {
		return deckapi.DeckGoSessionMutationResponse{}, err
	}
	return normalizeSessionMutationResponse(payload, sessionKey), nil
}

func (c *SessionCommands) Create(ctx context.Context, params map[string]any) (deckapi.DeckGoSessionCreateResponse, error) {
	typedParams, err := typedParamsFromMap[generated.SessionsCreateParams](params)
	if err != nil {
		return deckapi.DeckGoSessionCreateResponse{}, err
	}
	payload, err := c.typed.SessionsCreate(ctx, typedParams)
	if err != nil {
		return deckapi.DeckGoSessionCreateResponse{}, err
	}
	return normalizeSessionCreateResponse(payload), nil
}

func (c *SessionCommands) Send(ctx context.Context, params map[string]any) (deckapi.DeckGoSessionSendResponse, error) {
	typedParams, err := typedParamsFromMap[generated.SessionsSendParams](params)
	if err != nil {
		return deckapi.DeckGoSessionSendResponse{}, err
	}
	payload, err := c.typed.SessionsSend(ctx, typedParams)
	if err != nil {
		return deckapi.DeckGoSessionSendResponse{}, err
	}
	return normalizeSessionSendResponse(payload), nil
}

func (c *SessionCommands) Abort(ctx context.Context, params map[string]any) (deckapi.DeckGoSessionAbortResponse, error) {
	typedParams, err := typedParamsFromMap[generated.SessionsAbortParams](params)
	if err != nil {
		return deckapi.DeckGoSessionAbortResponse{}, err
	}
	payload, err := c.typed.SessionsAbort(ctx, typedParams)
	if err != nil {
		return deckapi.DeckGoSessionAbortResponse{}, err
	}
	return normalizeSessionAbortResponse(payload), nil
}

func (c *SessionCommands) Compact(ctx context.Context, sessionKey string) (any, error) {
	return c.typed.SessionsCompact(ctx, generated.SessionsCompactParams{Key: sessionKey})
}

func (c *SessionCommands) CompactionList(ctx context.Context, sessionKey string) (any, error) {
	return c.typed.SessionsCompactionList(ctx, generated.SessionsCompactionListParams{Key: sessionKey})
}

func (c *SessionCommands) CompactionBranch(ctx context.Context, sessionKey string, checkpointID string) (any, error) {
	return c.typed.SessionsCompactionBranch(ctx, generated.SessionsCompactionBranchParams{
		Key:          sessionKey,
		CheckpointId: checkpointID,
	})
}

func (c *SessionCommands) CompactionRestore(ctx context.Context, sessionKey string, checkpointID string) (any, error) {
	return c.typed.SessionsCompactionRestore(ctx, generated.SessionsCompactionRestoreParams{
		Key:          sessionKey,
		CheckpointId: checkpointID,
	})
}

func (c *SessionCommands) Steer(ctx context.Context, sessionKey string, message string) (any, error) {
	return c.typed.SessionsSteer(ctx, generated.SessionsSteerParams{
		Key:     sessionKey,
		Message: message,
	})
}

func normalizeSessionCreateResponse(payload any) deckapi.DeckGoSessionCreateResponse {
	if typed, ok := payload.(generated.SessionsCreateResult); ok {
		return deckapi.DeckGoSessionCreateResponse{
			Ok:                   typed.Ok,
			Key:                  typed.Key,
			SessionId:            typed.SessionId,
			RunId:                typed.RunId,
			Status:               typed.Status,
			MessageSeq:           float64(typed.MessageSeq),
			InterruptedActiveRun: typed.InterruptedActiveRun,
			RunStarted:           typed.RunStarted,
			RunError:             typed.RunError,
			Entry:                typed.Entry,
		}
	}
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
	if typed, ok := payload.(generated.SessionsSendResult); ok {
		return deckapi.DeckGoSessionSendResponse{
			RunId:                typed.RunId,
			Status:               typed.Status,
			MessageSeq:           float64(typed.MessageSeq),
			InterruptedActiveRun: typed.InterruptedActiveRun,
		}
	}
	record := coerce.Map(payload)
	return deckapi.DeckGoSessionSendResponse{
		RunId:                coerce.String(record["runId"], ""),
		Status:               coerce.String(record["status"], ""),
		MessageSeq:           coerce.Number(record["messageSeq"]),
		InterruptedActiveRun: coerce.Bool(record["interruptedActiveRun"]),
	}
}

func normalizeSessionAbortResponse(payload any) deckapi.DeckGoSessionAbortResponse {
	if typed, ok := payload.(generated.SessionsAbortResult); ok {
		return deckapi.DeckGoSessionAbortResponse{
			Ok:           typed.Ok,
			AbortedRunId: typed.AbortedRunId,
			Status:       typed.Status,
		}
	}
	record := coerce.Map(payload)
	return deckapi.DeckGoSessionAbortResponse{
		Ok:           coerce.Bool(record["ok"]),
		AbortedRunId: coerce.String(record["abortedRunId"], ""),
		Status:       coerce.String(record["status"], ""),
	}
}

func normalizeSessionMutationResponse(payload any, fallbackKey string) deckapi.DeckGoSessionMutationResponse {
	switch typed := payload.(type) {
	case generated.SessionsDeleteResult:
		return deckapi.DeckGoSessionMutationResponse{
			Ok:  typed.Ok,
			Key: coerce.FirstString(typed.Key, fallbackKey),
		}
	case generated.SessionsResetResult:
		return deckapi.DeckGoSessionMutationResponse{
			Ok:    typed.Ok,
			Key:   coerce.FirstString(typed.Key, fallbackKey),
			Entry: typed.Entry,
		}
	case generated.SessionsClearResult:
		return deckapi.DeckGoSessionMutationResponse{
			Ok:    typed.Ok,
			Key:   coerce.FirstString(typed.Key, fallbackKey),
			Entry: typed.Entry,
		}
	case generated.SessionsPatchResult:
		return deckapi.DeckGoSessionMutationResponse{
			Ok:    typed.Ok,
			Key:   coerce.FirstString(typed.Key, fallbackKey),
			Entry: typed.Entry,
		}
	}
	record := coerce.Map(payload)
	return deckapi.DeckGoSessionMutationResponse{
		Ok:    coerce.Bool(record["ok"]),
		Key:   coerce.String(record["key"], fallbackKey),
		Entry: coerce.Map(record["entry"]),
	}
}
