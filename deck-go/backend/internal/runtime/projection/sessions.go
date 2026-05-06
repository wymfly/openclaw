package projection

import (
	"encoding/json"
	"fmt"

	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway/generated"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/coerce"
)

const unknownSummaryStringLimit = 160

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
			if text, ok := item.(string); ok {
				result = append(result, map[string]any{"type": "text", "text": text})
			}
			continue
		}
		if normalized := normalizeTranscriptBlock(block); normalized != nil {
			result = append(result, normalized)
		}
	}
	return result
}

func normalizeTranscriptBlock(block map[string]any) map[string]any {
	blockType := coerce.String(block["type"], "")
	switch blockType {
	case "text":
		return textBlock(coerce.FirstString(block["text"], block["content"]))
	case "thinking":
		return textLikeBlock("thinking", coerce.FirstString(block["text"], block["thinking"], block["reasoning"], block["analysis"]))
	case "tool_use":
		normalized := map[string]any{
			"type":  "tool_use",
			"id":    coerce.FirstString(block["id"], block["toolCallId"], block["tool_use_id"]),
			"name":  coerce.FirstString(block["name"], block["tool"], block["title"]),
			"input": normalizeToolInput(block["input"]),
		}
		if normalized["name"] == "" {
			normalized["name"] = "unknown"
		}
		return normalized
	case "tool_result":
		normalized := map[string]any{
			"type":      "tool_result",
			"toolUseId": coerce.FirstString(block["toolUseId"], block["tool_use_id"], block["toolCallId"], block["id"]),
			"content":   normalizeToolResultContent(firstPresent(block, "content", "result")),
		}
		if coerce.Bool(block["isError"]) || coerce.Bool(block["is_error"]) {
			normalized["isError"] = true
		}
		return normalized
	case "image":
		return normalizeImageBlock(block)
	case "file":
		return normalizeFileBlock(block)
	case "canvas":
		if canvas := normalizeCanvasBlock(block); canvas != nil {
			return canvas
		}
		return unknownBlock(block, blockType)
	case "unknown":
		return unknownBlock(block, coerce.String(block["rawType"], "unknown"))
	case "input_text", "output_text":
		return textBlock(coerce.FirstString(block["text"], block["content"]))
	case "reasoning", "analysis":
		return textLikeBlock("thinking", coerce.FirstString(block["text"], block["thinking"], block["reasoning"], block["analysis"]))
	case "toolCall":
		block["type"] = "tool_use"
		return normalizeTranscriptBlock(block)
	case "toolResult":
		block["type"] = "tool_result"
		return normalizeTranscriptBlock(block)
	default:
		if blockType != "" {
			return unknownBlock(block, blockType)
		}
		if text := coerce.FirstString(block["text"], block["content"]); text != "" {
			return textBlock(text)
		}
		if coerce.FirstString(block["thinking"], block["reasoning"], block["analysis"]) != "" {
			return textLikeBlock("thinking", coerce.FirstString(block["thinking"], block["reasoning"], block["analysis"]))
		}
		return nil
	}
}

func textBlock(text string) map[string]any {
	if text == "" {
		return nil
	}
	return map[string]any{"type": "text", "text": text}
}

func textLikeBlock(blockType string, text string) map[string]any {
	if text == "" {
		return nil
	}
	return map[string]any{"type": blockType, "text": text}
}

func normalizeToolInput(value any) map[string]any {
	if record := coerce.Map(value); record != nil {
		return record
	}
	if value == nil {
		return map[string]any{}
	}
	if raw, ok := value.(string); ok {
		var parsed map[string]any
		if err := json.Unmarshal([]byte(raw), &parsed); err == nil {
			return parsed
		}
		return map[string]any{"raw": raw}
	}
	return map[string]any{"value": value}
}

func firstPresent(record map[string]any, keys ...string) any {
	for _, key := range keys {
		if value, ok := record[key]; ok {
			return value
		}
	}
	return nil
}

func normalizeToolResultContent(value any) any {
	switch typed := value.(type) {
	case string:
		return typed
	case []any:
		return normalizeTranscriptBlocks(typed)
	case map[string]any:
		if nested, ok := typed["content"]; ok {
			return normalizeToolResultContent(nested)
		}
		if nested, ok := typed["result"]; ok {
			return normalizeToolResultContent(nested)
		}
		if block := normalizeTranscriptBlock(typed); block != nil {
			return []deckapi.DeckGoTranscriptBlock{block}
		}
		return jsonString(typed)
	case nil:
		return ""
	default:
		return jsonString(typed)
	}
}

func normalizeImageBlock(block map[string]any) map[string]any {
	data := coerce.String(block["data"], "")
	mimeType := coerce.FirstString(block["mimeType"], block["mediaType"])
	if data == "" {
		if source := coerce.Map(block["source"]); source != nil {
			data = coerce.String(source["data"], "")
			mimeType = coerce.FirstString(mimeType, source["media_type"])
		}
	}
	if data == "" || mimeType == "" {
		return unknownBlock(block, "image")
	}
	normalized := map[string]any{"type": "image", "data": data, "mimeType": mimeType}
	if fileName := coerce.String(block["fileName"], ""); fileName != "" {
		normalized["fileName"] = fileName
	}
	return normalized
}

func normalizeFileBlock(block map[string]any) map[string]any {
	data := coerce.FirstString(block["data"], block["content"])
	if data == "" {
		return unknownBlock(block, "file")
	}
	normalized := map[string]any{
		"type":     "file",
		"data":     data,
		"mimeType": coerce.FirstString(block["mimeType"], block["mime_type"], block["mediaType"], "application/octet-stream"),
		"fileName": coerce.FirstString(block["fileName"], block["file_name"], block["name"], "file"),
	}
	if size := coerce.Number(block["size"]); size != 0 {
		normalized["size"] = size
	}
	return normalized
}

func normalizeCanvasBlock(block map[string]any) map[string]any {
	preview := coerce.Map(block["preview"])
	url := coerce.FirstString(block["url"])
	if url == "" && preview != nil {
		url = coerce.String(preview["url"], "")
	}
	if url == "" {
		return nil
	}
	surface := "assistant_message"
	if coerce.String(block["surface"], "") == "assistant_message" {
		surface = "assistant_message"
	} else if preview != nil && coerce.String(preview["surface"], "") == "assistant_message" {
		surface = "assistant_message"
	}
	normalized := map[string]any{
		"type":    "canvas",
		"kind":    "canvas",
		"surface": surface,
		"render":  "url",
		"url":     url,
	}
	for _, key := range []string{"viewId", "title"} {
		if value := coerce.String(block[key], ""); value != "" {
			normalized[key] = value
		} else if preview != nil {
			if value := coerce.String(preview[key], ""); value != "" {
				normalized[key] = value
			}
		}
	}
	if preferredHeight := coerce.FirstNumber(block["preferredHeight"], valueFromMap(preview, "preferredHeight")); preferredHeight != 0 {
		normalized["preferredHeight"] = preferredHeight
	}
	return normalized
}

func valueFromMap(record map[string]any, key string) any {
	if record == nil {
		return nil
	}
	return record[key]
}

func unknownBlock(block map[string]any, rawType string) map[string]any {
	if block["type"] == "unknown" && coerce.String(block["rawType"], "") != "" {
		if summary := coerce.Map(block["summary"]); summary != nil {
			return map[string]any{
				"type":    "unknown",
				"rawType": coerce.String(block["rawType"], "unknown"),
				"summary": summary,
			}
		}
	}
	if rawType == "" {
		rawType = "unknown"
	}
	summary := make(map[string]any, len(block))
	for key, value := range block {
		summary[key] = summarizeUnknownValue(value)
	}
	return map[string]any{"type": "unknown", "rawType": rawType, "summary": summary}
}

func summarizeUnknownValue(value any) any {
	switch typed := value.(type) {
	case string:
		if len(typed) > unknownSummaryStringLimit {
			return typed[:unknownSummaryStringLimit-3] + "..."
		}
		return typed
	case nil, bool, float64, int, int64, uint64:
		return typed
	case []any:
		return fmt.Sprintf("[array:%d]", len(typed))
	case map[string]any:
		return "[object]"
	default:
		return fmt.Sprintf("%v", typed)
	}
}

func jsonString(value any) string {
	raw, err := json.Marshal(value)
	if err != nil {
		return fmt.Sprintf("%v", value)
	}
	return string(raw)
}
