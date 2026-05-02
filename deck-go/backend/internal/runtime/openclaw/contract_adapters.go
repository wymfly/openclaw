package openclaw

import (
	"encoding/json"

	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway/generated"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/coerce"
)

func normalizeAgentsList(payload generated.AgentsListResult) deckapi.DeckGoAgentsListResponse {
	response := deckapi.DeckGoAgentsListResponse{
		DefaultId: payload.DefaultId,
		Agents:    make([]deckapi.DeckGoAgentSummary, 0, len(payload.Agents)),
	}
	for _, agent := range payload.Agents {
		agentID := agent.Id
		response.Agents = append(response.Agents, deckapi.DeckGoAgentSummary{
			Id:        agentID,
			Name:      firstNonEmpty(agent.Name, agent.Identity.Name, agentID),
			Emoji:     agent.Identity.Emoji,
			Avatar:    firstNonEmpty(agent.Identity.Avatar, agent.Identity.AvatarUrl),
			Workspace: agent.Workspace,
			Model:     agent.Model.Primary,
			IsDefault: agentID == payload.DefaultId,
			Status:    deckapi.DeckGoAgentStatus("idle"),
		})
	}
	return response
}

func normalizeAgentCreate(payload generated.AgentsCreateResult) deckapi.DeckGoAgentMutationResponse {
	return deckapi.DeckGoAgentMutationResponse{
		Ok: payload.Ok,
		Id: payload.AgentId,
	}
}

func normalizeAgentUpdate(payload generated.AgentsUpdateResult) deckapi.DeckGoAgentMutationResponse {
	return deckapi.DeckGoAgentMutationResponse{
		Ok: payload.Ok,
		Id: payload.AgentId,
	}
}

func normalizeAgentDelete(payload generated.AgentsDeleteResult) deckapi.DeckGoAgentMutationResponse {
	return deckapi.DeckGoAgentMutationResponse{
		Ok: payload.Ok,
		Id: payload.AgentId,
	}
}

func normalizeUsageCost(payload generated.UsageCostResult) deckapi.DeckGoUsageCostResponse {
	response := deckapi.DeckGoUsageCostResponse{
		UpdatedAt: payload.UpdatedAt,
		Days:      payload.Days,
		Daily:     make([]deckapi.DeckGoUsageCostEntry, 0, len(payload.Daily)),
	}
	for _, entry := range payload.Daily {
		response.Daily = append(response.Daily, deckapi.DeckGoUsageCostEntry{
			Date:      entry.Date,
			TotalCost: entry.TotalCost,
			Cost:      entry.TotalCost,
		})
	}
	return response
}

func normalizeUsageProviders(payload generated.UsageStatusResult) deckapi.DeckGoUsageProvidersResponse {
	response := deckapi.DeckGoUsageProvidersResponse{
		UpdatedAt: payload.UpdatedAt,
		Providers: make([]deckapi.DeckGoUsageProviderStatus, 0, len(payload.Providers)),
	}
	for _, provider := range payload.Providers {
		item := deckapi.DeckGoUsageProviderStatus{
			Provider:    provider.Provider,
			DisplayName: provider.DisplayName,
			Plan:        provider.Plan,
			Error:       provider.Error,
			Windows:     make([]deckapi.DeckGoUsageProviderWindow, 0, len(provider.Windows)),
		}
		for _, window := range provider.Windows {
			item.Windows = append(item.Windows, deckapi.DeckGoUsageProviderWindow{
				Label:       window.Label,
				UsedPercent: window.UsedPercent,
				ResetAt:     window.ResetAt,
			})
		}
		response.Providers = append(response.Providers, item)
	}
	return response
}

func normalizeUsageSessions(payload generated.SessionsUsageResult) deckapi.DeckGoUsageSessionsResponse {
	response := deckapi.DeckGoUsageSessionsResponse{
		UpdatedAt:  payload.UpdatedAt,
		StartDate:  payload.StartDate,
		EndDate:    payload.EndDate,
		Sessions:   make([]deckapi.DeckGoUsageSessionEntry, 0, len(payload.Sessions)),
		Totals:     usageTotalsFromAny(payload.Totals),
		Aggregates: objectFromAny(payload.Aggregates),
	}
	for _, session := range payload.Sessions {
		entry := deckapi.DeckGoUsageSessionEntry{
			Key:       session.Key,
			Label:     session.Label,
			SessionId: session.SessionId,
			UpdatedAt: session.UpdatedAt,
			AgentId:   session.AgentId,
			Channel:   session.Channel,
			Usage:     objectFromAny(session.Usage),
		}
		if contextWeight := objectFromAny(session.ContextWeight); len(contextWeight) > 0 {
			report := contextWeightReportFromMap(contextWeight)
			entry.ContextWeight = &report
		}
		response.Sessions = append(response.Sessions, entry)
	}
	return response
}

func normalizeUsageSessionLogs(payload generated.SessionsUsageLogsResult) deckapi.DeckGoUsageSessionLogsResponse {
	response := deckapi.DeckGoUsageSessionLogsResponse{
		Logs: make([]deckapi.DeckGoUsageSessionLogEntry, 0, len(payload.Logs)),
	}
	for _, rawLog := range payload.Logs {
		logRecord := objectFromAny(rawLog)
		if len(logRecord) == 0 {
			continue
		}
		response.Logs = append(response.Logs, deckapi.DeckGoUsageSessionLogEntry{
			Timestamp: coerce.Number(logRecord["timestamp"]),
			Role:      coerce.String(logRecord["role"], ""),
			Content:   coerce.String(logRecord["content"], ""),
			Tokens:    coerce.Number(logRecord["tokens"]),
			Cost:      coerce.Number(logRecord["cost"]),
		})
	}
	return response
}

func normalizeApprovalPolicyFromGet(payload generated.ExecApprovalsGetResult) deckapi.DeckGoApprovalPolicyResponse {
	return deckapi.DeckGoApprovalPolicyResponse{
		Hash: payload.Hash,
		File: objectFromAny(payload.File),
	}
}

func normalizeApprovalPolicyFromSet(payload generated.ExecApprovalsSetResult) deckapi.DeckGoApprovalPolicyResponse {
	return deckapi.DeckGoApprovalPolicyResponse{
		Hash: payload.Hash,
		File: objectFromAny(payload.File),
	}
}

func normalizePendingApprovals(payload any) deckapi.DeckGoPendingApprovalsResponse {
	items, ok := payload.([]any)
	if !ok {
		record := objectFromAny(payload)
		items, _ = record["pending"].([]any)
	}
	response := deckapi.DeckGoPendingApprovalsResponse{
		Pending: make([]deckapi.DeckGoPendingApproval, 0, len(items)),
	}
	for _, rawItem := range items {
		record := objectFromAny(rawItem)
		request := objectFromAny(record["request"])
		response.Pending = append(response.Pending, deckapi.DeckGoPendingApproval{
			Id:          coerce.String(record["id"], ""),
			Command:     coerce.String(request["command"], ""),
			CommandArgv: stringListFromAny(request["commandArgv"]),
			AgentId:     coerce.String(request["agentId"], ""),
			SessionKey:  coerce.String(request["sessionKey"], ""),
			RunId:       coerce.String(request["runId"], ""),
			Cwd:         coerce.String(request["cwd"], ""),
			CreatedAtMs: coerce.Number(record["createdAtMs"]),
			ExpiresAtMs: coerce.Number(record["expiresAtMs"]),
		})
	}
	return response
}

func usageTotalsFromAny(value any) deckapi.DeckGoUsageTotals {
	record := objectFromAny(value)
	return deckapi.DeckGoUsageTotals{
		Input:       coerce.Number(record["input"]),
		Output:      coerce.Number(record["output"]),
		CacheRead:   coerce.Number(record["cacheRead"]),
		CacheWrite:  coerce.Number(record["cacheWrite"]),
		TotalTokens: coerce.Number(record["totalTokens"]),
		TotalCost:   coerce.Number(record["totalCost"]),
	}
}

func contextWeightReportFromMap(record map[string]any) deckapi.DeckGoContextWeightReport {
	return deckapi.DeckGoContextWeightReport{
		Source:                 coerce.String(record["source"], ""),
		GeneratedAt:            coerce.Number(record["generatedAt"]),
		SessionId:              coerce.String(record["sessionId"], ""),
		SessionKey:             coerce.String(record["sessionKey"], ""),
		Provider:               coerce.String(record["provider"], ""),
		Model:                  coerce.String(record["model"], ""),
		WorkspaceDir:           coerce.String(record["workspaceDir"], ""),
		SystemPrompt:           objectFromAny(record["systemPrompt"]),
		InjectedWorkspaceFiles: objectListFromAny(record["injectedWorkspaceFiles"]),
		Skills:                 objectFromAny(record["skills"]),
		Tools:                  objectFromAny(record["tools"]),
	}
}

func objectFromAny(value any) map[string]any {
	if value == nil {
		return nil
	}
	if record, ok := value.(map[string]any); ok {
		return record
	}
	raw, err := json.Marshal(value)
	if err != nil {
		return nil
	}
	var record map[string]any
	if err := json.Unmarshal(raw, &record); err != nil {
		return nil
	}
	return record
}

func objectListFromAny(value any) []map[string]any {
	items, ok := value.([]any)
	if !ok {
		raw, err := json.Marshal(value)
		if err != nil {
			return nil
		}
		if err := json.Unmarshal(raw, &items); err != nil {
			return nil
		}
	}
	result := make([]map[string]any, 0, len(items))
	for _, item := range items {
		if record := objectFromAny(item); len(record) > 0 {
			result = append(result, record)
		}
	}
	return result
}

func stringListFromAny(value any) []string {
	switch items := value.(type) {
	case []string:
		return items
	case []any:
		result := make([]string, 0, len(items))
		for _, item := range items {
			if text, ok := item.(string); ok {
				result = append(result, text)
			}
		}
		return result
	default:
		return nil
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
