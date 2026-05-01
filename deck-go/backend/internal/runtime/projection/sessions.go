package projection

import (
	"encoding/json"

	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway/generated"
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
	if typed, ok := payload.(generated.SessionsPreviewResult); ok {
		response := deckapi.DeckGoSessionsPreviewResponse{
			Ts: typed.Ts,
		}
		response.Previews = make([]deckapi.DeckGoSessionPreviewEntry, 0, len(typed.Previews))
		for _, item := range typed.Previews {
			preview := deckapi.DeckGoSessionPreviewEntry{
				Key:    item.Key,
				Status: item.Status,
			}
			preview.Items = make([]deckapi.DeckGoSessionPreviewOverlay, 0, len(item.Items))
			for _, overlay := range item.Items {
				preview.Items = append(preview.Items, deckapi.DeckGoSessionPreviewOverlay{
					Role: overlay.Role,
					Text: overlay.Text,
				})
			}
			response.Previews = append(response.Previews, preview)
		}
		return response
	}
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
	switch history := payload.(type) {
	case generated.ChatHistoryResult:
		return normalizeGeneratedTranscriptMessages(history.Messages)
	case generated.SessionsGetResult:
		return normalizeRawTranscriptMessages(history.Messages)
	}
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

func normalizeGeneratedTranscriptMessages(messages []struct {
	Content   []any   `json:"content"`
	Id        string  `json:"id,omitempty"`
	Role      string  `json:"role"`
	Timestamp float64 `json:"timestamp"`
}) []deckapi.DeckGoTranscriptMessage {
	result := make([]deckapi.DeckGoTranscriptMessage, 0, len(messages))
	for _, message := range messages {
		result = append(result, deckapi.DeckGoTranscriptMessage{
			Id:        message.Id,
			Role:      message.Role,
			Content:   normalizeTranscriptBlocks(message.Content),
			Timestamp: message.Timestamp,
		})
	}
	return result
}

func normalizeRawTranscriptMessages(items []any) []deckapi.DeckGoTranscriptMessage {
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
		Key:                  coerce.String(record["key"], coerce.String(record["sessionKey"], "")),
		AgentId:              coerce.String(record["agentId"], fallbackAgentID),
		Label:                coerce.String(record["label"], ""),
		Title:                coerce.FirstString(record["derivedTitle"], record["label"], record["displayName"], record["title"]),
		Kind:                 coerce.String(record["kind"], ""),
		UpdatedAt:            coerce.Number(record["updatedAt"]),
		LastMessagePreview:   coerce.String(record["lastMessagePreview"], coerce.String(record["lastMessage"], "")),
		CompactionCount:      coerce.FirstNumber(record["compactionCount"], record["compactionCheckpointCount"]),
		Status:               coerce.String(record["status"], ""),
		StartedAt:            coerce.Number(record["startedAt"]),
		EndedAt:              coerce.Number(record["endedAt"]),
		RuntimeMs:            coerce.Number(record["runtimeMs"]),
		Model:                coerce.String(record["model"], ""),
		ModelProvider:        coerce.String(record["modelProvider"], ""),
		ThinkingLevel:        coerce.String(record["thinkingLevel"], ""),
		FastMode:             coerce.Bool(record["fastMode"]),
		VerboseLevel:         coerce.String(record["verboseLevel"], ""),
		ReasoningLevel:       coerce.String(record["reasoningLevel"], ""),
		ResponseUsage:        coerce.String(record["responseUsage"], ""),
		SendPolicy:           coerce.String(record["sendPolicy"], ""),
		InputTokens:          coerce.Number(record["inputTokens"]),
		OutputTokens:         coerce.Number(record["outputTokens"]),
		TotalTokens:          coerce.Number(record["totalTokens"]),
		TotalTokensFresh:     coerce.Bool(record["totalTokensFresh"]),
		EstimatedCostUsd:     coerce.Number(record["estimatedCostUsd"]),
		ContextTokens:        coerce.Number(record["contextTokens"]),
		ParentSessionKey:     coerce.String(record["parentSessionKey"], ""),
		ChildSessions:        stringSlice(record["childSessions"]),
		SubagentRole:         coerce.String(record["subagentRole"], ""),
		SubagentControlScope: coerce.String(record["subagentControlScope"], ""),
		SpawnedWorkspaceDir:  coerce.String(record["spawnedWorkspaceDir"], ""),
	}
}

func stringSlice(value any) []string {
	items, ok := value.([]any)
	if !ok {
		return nil
	}
	result := make([]string, 0, len(items))
	for _, item := range items {
		if value, ok := item.(string); ok {
			result = append(result, value)
		}
	}
	return result
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
	case generated.SessionsListResult:
		return structsToMaps(value.Sessions)
	}
	return nil
}

func structsToMaps(value any) []map[string]any {
	raw, err := json.Marshal(value)
	if err != nil {
		return nil
	}
	var items []map[string]any
	if err := json.Unmarshal(raw, &items); err != nil {
		return nil
	}
	return items
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
		// DeckGoTranscriptBlock is now a discriminated union on the TS side;
		// the Go codegen resolves the union to `any`, so the normalizer
		// builds a map matching the wire shape. Fields are emitted only when
		// they carry a real value, preserving the omitempty semantics that
		// the prior flat-struct codegen produced.
		normalized := map[string]any{
			"type": coerce.String(block["type"], ""),
		}
		setIfNonEmpty := func(key, value string) {
			if value != "" {
				normalized[key] = value
			}
		}
		setIfNonZero := func(key string, value float64) {
			if value != 0 {
				normalized[key] = value
			}
		}
		setIfNonNil := func(key string, value map[string]any) {
			if value != nil {
				normalized[key] = value
			}
		}
		setIfNonEmpty("text", coerce.String(block["text"], ""))
		setIfNonEmpty("id", coerce.String(block["id"], ""))
		setIfNonEmpty("name", coerce.String(block["name"], ""))
		setIfNonNil("input", coerce.Map(block["input"]))
		setIfNonEmpty("toolUseId", coerce.String(block["toolUseId"], ""))
		if content, present := block["content"]; present && content != nil {
			normalized["content"] = content
		}
		if coerce.Bool(block["isError"]) {
			normalized["isError"] = true
		}
		setIfNonEmpty("data", coerce.String(block["data"], ""))
		setIfNonEmpty("mimeType", coerce.String(block["mimeType"], ""))
		setIfNonEmpty("fileName", coerce.String(block["fileName"], ""))
		setIfNonZero("size", coerce.Number(block["size"]))
		setIfNonEmpty("kind", coerce.String(block["kind"], ""))
		setIfNonEmpty("surface", coerce.String(block["surface"], ""))
		setIfNonEmpty("render", coerce.String(block["render"], ""))
		setIfNonEmpty("url", coerce.String(block["url"], ""))
		setIfNonEmpty("title", coerce.String(block["title"], ""))
		setIfNonZero("preferredHeight", coerce.Number(block["preferredHeight"]))
		setIfNonNil("summary", coerce.Map(block["summary"]))
		// `unknown` variant carries the original wire `type` in `rawType`.
		setIfNonEmpty("rawType", coerce.String(block["rawType"], ""))
		result = append(result, normalized)
	}
	return result
}
