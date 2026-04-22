package projection

import (
	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/coerce"
)

func NormalizeSessionMetas(payload any, fallbackAgentID string) []deckapi.DeckGoSessionMeta {
	items := extractSessionItems(payload)
	result := make([]deckapi.DeckGoSessionMeta, 0, len(items))
	for _, item := range items {
		result = append(result, normalizeSessionMeta(item, fallbackAgentID))
	}
	return result
}

func NormalizeSessionPreviews(payload any) deckapi.DeckGoSessionsPreviewResponse {
	record, ok := payload.(map[string]any)
	if !ok {
		return deckapi.DeckGoSessionsPreviewResponse{}
	}
	response := deckapi.DeckGoSessionsPreviewResponse{
		Ts: coerce.Number(record["ts"]),
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
			Key:    coerce.String(entry["key"], ""),
			Status: coerce.String(entry["status"], ""),
		}
		items, _ := entry["items"].([]any)
		preview.Items = make([]deckapi.DeckGoSessionPreviewOverlay, 0, len(items))
		for _, rawItem := range items {
			record, ok := rawItem.(map[string]any)
			if !ok {
				continue
			}
			preview.Items = append(preview.Items, deckapi.DeckGoSessionPreviewOverlay{
				Role: coerce.String(record["role"], "other"),
				Text: coerce.String(record["text"], ""),
			})
		}
		response.Previews = append(response.Previews, preview)
	}
	return response
}

func NormalizeSessionDetail(sessionKey string, historyPayload any, sessionsPayload any, fallbackAgentID string) deckapi.DeckGoSessionDetailResponse {
	metas := NormalizeSessionMetas(sessionsPayload, fallbackAgentID)
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
	return deckapi.DeckGoSessionDetailResponse{
		Session:        session,
		Messages:       NormalizeTranscriptMessages(historyPayload),
		ActiveApproval: nil,
		A2uiState:      nil,
	}
}

func NormalizeTranscriptMessages(payload any) []deckapi.DeckGoTranscriptMessage {
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
			Id:        coerce.String(message["id"], ""),
			Role:      coerce.String(message["role"], ""),
			Content:   normalizeTranscriptBlocks(message["content"]),
			Timestamp: coerce.Number(message["timestamp"]),
			Streaming: coerce.Bool(message["streaming"]),
			Error:     coerce.String(message["error"], ""),
		})
	}
	return result
}

func normalizeSessionMeta(record map[string]any, fallbackAgentID string) deckapi.DeckGoSessionMeta {
	return deckapi.DeckGoSessionMeta{
		Key:                coerce.String(record["key"], coerce.String(record["sessionKey"], "")),
		AgentId:            coerce.String(record["agentId"], fallbackAgentID),
		Title:              coerce.FirstString(record["derivedTitle"], record["label"], record["displayName"], record["title"]),
		UpdatedAt:          coerce.Number(record["updatedAt"]),
		LastMessagePreview: coerce.String(record["lastMessagePreview"], coerce.String(record["lastMessage"], "")),
		CompactionCount:    coerce.FirstNumber(record["compactionCount"], record["compactionCheckpointCount"]),
		Status:             coerce.String(record["status"], ""),
		StartedAt:          coerce.Number(record["startedAt"]),
		EndedAt:            coerce.Number(record["endedAt"]),
		RuntimeMs:          coerce.Number(record["runtimeMs"]),
		Model:              coerce.String(record["model"], ""),
		ModelProvider:      coerce.String(record["modelProvider"], ""),
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
			Type:            coerce.String(block["type"], ""),
			Text:            coerce.String(block["text"], ""),
			Id:              coerce.String(block["id"], ""),
			Name:            coerce.String(block["name"], ""),
			Input:           coerce.Map(block["input"]),
			ToolUseId:       coerce.String(block["toolUseId"], ""),
			Content:         block["content"],
			IsError:         coerce.Bool(block["isError"]),
			Data:            coerce.String(block["data"], ""),
			MimeType:        coerce.String(block["mimeType"], ""),
			FileName:        coerce.String(block["fileName"], ""),
			Size:            coerce.Number(block["size"]),
			Kind:            coerce.String(block["kind"], ""),
			Surface:         coerce.String(block["surface"], ""),
			Render:          coerce.String(block["render"], ""),
			Url:             coerce.String(block["url"], ""),
			Title:           coerce.String(block["title"], ""),
			PreferredHeight: coerce.Number(block["preferredHeight"]),
			Summary:         coerce.Map(block["summary"]),
		})
	}
	return result
}
