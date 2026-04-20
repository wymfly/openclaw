package server

import (
	"context"

	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway"
)

func normalizeSessionCreateResponse(payload any) deckapi.DeckGoSessionCreateResponse {
	record := mapValue(payload)
	return deckapi.DeckGoSessionCreateResponse{
		Ok:                   boolValue(record["ok"]),
		Key:                  stringValue(record["key"], stringValue(record["sessionKey"], "")),
		SessionId:            stringValue(record["sessionId"], ""),
		RunId:                stringValue(record["runId"], ""),
		Status:               stringValue(record["status"], ""),
		MessageSeq:           numberValue(record["messageSeq"]),
		InterruptedActiveRun: boolValue(record["interruptedActiveRun"]),
		RunStarted:           boolValue(record["runStarted"]),
		RunError:             record["runError"],
		Entry:                mapValue(record["entry"]),
	}
}

func normalizeSessionSendResponse(payload any) deckapi.DeckGoSessionSendResponse {
	record := mapValue(payload)
	return deckapi.DeckGoSessionSendResponse{
		RunId:                stringValue(record["runId"], ""),
		Status:               stringValue(record["status"], ""),
		MessageSeq:           numberValue(record["messageSeq"]),
		InterruptedActiveRun: boolValue(record["interruptedActiveRun"]),
	}
}

func normalizeSessionAbortResponse(payload any) deckapi.DeckGoSessionAbortResponse {
	record := mapValue(payload)
	return deckapi.DeckGoSessionAbortResponse{
		Ok:           boolValue(record["ok"]),
		AbortedRunId: stringValue(record["abortedRunId"], ""),
		Status:       stringValue(record["status"], ""),
	}
}

func normalizeSessionMutationResponse(payload any, fallbackKey string) deckapi.DeckGoSessionMutationResponse {
	record := mapValue(payload)
	return deckapi.DeckGoSessionMutationResponse{
		Ok:    boolValue(record["ok"]),
		Key:   stringValue(record["key"], fallbackKey),
		Entry: mapValue(record["entry"]),
	}
}

func normalizeSessionMetas(payload any, fallbackAgentID string) []deckapi.DeckGoSessionMeta {
	items := extractSessionItems(payload)
	result := make([]deckapi.DeckGoSessionMeta, 0, len(items))
	for _, item := range items {
		result = append(result, normalizeSessionMeta(item, fallbackAgentID))
	}
	return result
}

func normalizeSessionMeta(record map[string]any, fallbackAgentID string) deckapi.DeckGoSessionMeta {
	return deckapi.DeckGoSessionMeta{
		Key:                stringValue(record["key"], stringValue(record["sessionKey"], "")),
		AgentId:            stringValue(record["agentId"], fallbackAgentID),
		Title:              firstString(record["derivedTitle"], record["label"], record["displayName"], record["title"]),
		UpdatedAt:          numberValue(record["updatedAt"]),
		LastMessagePreview: stringValue(record["lastMessagePreview"], stringValue(record["lastMessage"], "")),
		Status:             stringValue(record["status"], ""),
		StartedAt:          numberValue(record["startedAt"]),
		EndedAt:            numberValue(record["endedAt"]),
		RuntimeMs:          numberValue(record["runtimeMs"]),
		Model:              stringValue(record["model"], ""),
		ModelProvider:      stringValue(record["modelProvider"], ""),
	}
}

func extractSessionItems(payload any) []map[string]any {
	switch value := payload.(type) {
	case []any:
		items := make([]map[string]any, 0, len(value))
		for _, item := range value {
			if record, ok := item.(map[string]any); ok {
				items = append(items, record)
			}
		}
		return items
	case map[string]any:
		if sessions, ok := value["sessions"].([]any); ok {
			items := make([]map[string]any, 0, len(sessions))
			for _, item := range sessions {
				if record, ok := item.(map[string]any); ok {
					items = append(items, record)
				}
			}
			return items
		}
	}
	return nil
}

func normalizeSessionPreviews(payload any) deckapi.DeckGoSessionsPreviewResponse {
	record, ok := payload.(map[string]any)
	if !ok {
		return deckapi.DeckGoSessionsPreviewResponse{}
	}
	response := deckapi.DeckGoSessionsPreviewResponse{
		Ts: numberValue(record["ts"]),
	}
	previews, ok := record["previews"].([]any)
	if !ok {
		return response
	}
	response.Previews = make([]deckapi.DeckGoSessionPreviewEntry, 0, len(previews))
	for _, item := range previews {
		entry, ok := item.(map[string]any)
		if !ok {
			continue
		}
		preview := deckapi.DeckGoSessionPreviewEntry{
			Key:    stringValue(entry["key"], ""),
			Status: stringValue(entry["status"], ""),
		}
		items, _ := entry["items"].([]any)
		preview.Items = make([]deckapi.DeckGoSessionPreviewOverlay, 0, len(items))
		for _, rawItem := range items {
			record, ok := rawItem.(map[string]any)
			if !ok {
				continue
			}
			preview.Items = append(preview.Items, deckapi.DeckGoSessionPreviewOverlay{
				Role: stringValue(record["role"], "other"),
				Text: stringValue(record["text"], ""),
			})
		}
		response.Previews = append(response.Previews, preview)
	}
	return response
}

func normalizeSessionDetail(sessionKey string, historyPayload any, sessionsPayload any, fallbackAgentID string) deckapi.DeckGoSessionDetailResponse {
	metas := normalizeSessionMetas(sessionsPayload, fallbackAgentID)
	session := deckapi.DeckGoSessionMeta{
		Key:     sessionKey,
		AgentId: fallbackAgentID,
	}
	for _, item := range metas {
		if item.Key == sessionKey {
			session = item
			break
		}
	}
	response := deckapi.DeckGoSessionDetailResponse{
		Session:        session,
		Messages:       normalizeTranscriptMessages(historyPayload),
		ActiveApproval: nil,
		A2uiState:      nil,
	}
	return response
}

func fetchSessionDetailPayload(
	ctx context.Context,
	client *gateway.Client,
	sessionKey string,
	agentID string,
	limit int,
) (deckapi.DeckGoSessionDetailResponse, error) {
	historyParams := map[string]any{"key": sessionKey}
	if limit > 0 {
		historyParams["limit"] = limit
	}
	historyPayload, err := client.Request(ctx, "sessions.get", historyParams)
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
	sessionsPayload, err := client.Request(ctx, "sessions.list", sessionsParams)
	if err != nil {
		return deckapi.DeckGoSessionDetailResponse{}, err
	}
	return normalizeSessionDetail(sessionKey, historyPayload, sessionsPayload, agentID), nil
}

func normalizeTranscriptMessages(payload any) []deckapi.DeckGoTranscriptMessage {
	record, ok := payload.(map[string]any)
	if !ok {
		return nil
	}
	items, ok := record["messages"].([]any)
	if !ok {
		return nil
	}
	result := make([]deckapi.DeckGoTranscriptMessage, 0, len(items))
	for _, item := range items {
		message, ok := item.(map[string]any)
		if !ok {
			continue
		}
		result = append(result, deckapi.DeckGoTranscriptMessage{
			Id:        stringValue(message["id"], ""),
			Role:      stringValue(message["role"], ""),
			Content:   normalizeTranscriptBlocks(message["content"]),
			Timestamp: numberValue(message["timestamp"]),
			Streaming: boolValue(message["streaming"]),
			Error:     stringValue(message["error"], ""),
		})
	}
	return result
}

func normalizeTranscriptBlocks(raw any) []deckapi.DeckGoTranscriptBlock {
	items, ok := raw.([]any)
	if !ok {
		return nil
	}
	result := make([]deckapi.DeckGoTranscriptBlock, 0, len(items))
	for _, item := range items {
		block, ok := item.(map[string]any)
		if !ok {
			continue
		}
		result = append(result, deckapi.DeckGoTranscriptBlock{
			Type:            stringValue(block["type"], ""),
			Text:            stringValue(block["text"], ""),
			Id:              stringValue(block["id"], ""),
			Name:            stringValue(block["name"], ""),
			Input:           mapValue(block["input"]),
			ToolUseId:       stringValue(block["toolUseId"], ""),
			Content:         block["content"],
			IsError:         boolValue(block["isError"]),
			Data:            stringValue(block["data"], ""),
			MimeType:        stringValue(block["mimeType"], ""),
			FileName:        stringValue(block["fileName"], ""),
			Size:            numberValue(block["size"]),
			Kind:            stringValue(block["kind"], ""),
			Surface:         stringValue(block["surface"], ""),
			Render:          stringValue(block["render"], ""),
			Url:             stringValue(block["url"], ""),
			Title:           stringValue(block["title"], ""),
			PreferredHeight: numberValue(block["preferredHeight"]),
			Summary:         mapValue(block["summary"]),
		})
	}
	return result
}

func stringValue(value any, fallback string) string {
	if s, ok := value.(string); ok {
		return s
	}
	return fallback
}

func firstString(values ...any) string {
	for _, value := range values {
		if s, ok := value.(string); ok && s != "" {
			return s
		}
	}
	return ""
}

func numberValue(value any) float64 {
	switch n := value.(type) {
	case float64:
		return n
	case int:
		return float64(n)
	case int64:
		return float64(n)
	case uint64:
		return float64(n)
	default:
		return 0
	}
}

func boolValue(value any) bool {
	b, _ := value.(bool)
	return b
}

func mapValue(value any) map[string]any {
	record, _ := value.(map[string]any)
	return record
}
