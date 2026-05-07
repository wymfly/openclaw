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
		MainKey:   payload.MainKey,
		Agents:    make([]deckapi.DeckGoAgentSummary, 0, len(payload.Agents)),
	}
	for _, agent := range payload.Agents {
		agentID := agent.Id
		isMainProtected := agentID == "main"
		protectedReasons := []string(nil)
		deleteDisabledReason := ""
		guardedEditReasons := []string{"Runtime edits can change live agent behavior"}
		if isMainProtected {
			protectedReasons = []string{"main is the protected system/fallback agent and cannot be deleted"}
			deleteDisabledReason = "main is the protected system/fallback agent"
			guardedEditReasons = []string{"Runtime edits affect the protected system/fallback agent"}
		}
		response.Agents = append(response.Agents, deckapi.DeckGoAgentSummary{
			Id:                  agentID,
			Name:                firstNonEmpty(agent.Name, agent.Identity.Name, agentID),
			Emoji:               agent.Identity.Emoji,
			Avatar:              firstNonEmpty(agent.Identity.Avatar, agent.Identity.AvatarUrl),
			Workspace:           agent.Workspace,
			Model:               agent.Model.Primary,
			IsDefault:           agentID == payload.DefaultId,
			IsConfiguredDefault: agentID == payload.DefaultId,
			IsMainProtected:     isMainProtected,
			MainKey:             payload.MainKey,
			ProtectedReasons:    protectedReasons,
			AvailableActions: deckapi.DeckGoAgentAvailableActions{
				CanEditIdentity:      true,
				CanEditRuntime:       true,
				CanDelete:            !isMainProtected,
				CanChangeDefault:     false,
				DeleteDisabledReason: deleteDisabledReason,
				GuardedEditReasons:   guardedEditReasons,
				UnsupportedReasons:   []string{"Default-agent switching is read-only in this pass"},
			},
			EffectiveSources: deckapi.DeckGoAgentEffectiveSources{
				Workspace: deckapi.DeckGoAgentEffectiveSource("gateway"),
				Model:     deckapi.DeckGoAgentEffectiveSource("gateway"),
			},
			Impact: deckapi.DeckGoAgentImpactSummary{
				DeleteRemovesFiles: false,
			},
			Status: deckapi.DeckGoAgentStatus("idle"),
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
		if contextWeight := objectFromAny(session.ContextWeight); hasContextWeightSignal(contextWeight) {
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
	items := objectListFromAny(payload)
	if len(items) == 0 {
		record := objectFromAny(payload)
		items = objectListFromAny(record["pending"])
	}
	response := deckapi.DeckGoPendingApprovalsResponse{
		Pending: make([]deckapi.DeckGoPendingApproval, 0, len(items)),
	}
	for _, record := range items {
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

func normalizePluginApprovals(payload any) []deckapi.DeckGoPluginApprovalEntry {
	items := objectListFromAny(payload)
	if len(items) == 0 {
		record := objectFromAny(payload)
		items = objectListFromAny(record["entries"])
	}
	response := make([]deckapi.DeckGoPluginApprovalEntry, 0, len(items))
	for _, record := range items {
		request := objectFromAny(record["request"])
		entry := deckapi.DeckGoPluginApprovalEntry{
			Id:          coerce.String(record["id"], ""),
			PluginId:    firstNonEmpty(coerce.String(record["pluginId"], ""), coerce.String(request["pluginId"], "")),
			Command:     firstNonEmpty(coerce.String(record["command"], ""), coerce.String(request["command"], ""), coerce.String(request["title"], ""), coerce.String(request["toolName"], "")),
			Description: firstNonEmpty(coerce.String(record["description"], ""), coerce.String(request["description"], "")),
			CreatedAtMs: coerce.Number(record["createdAtMs"]),
			ExpiresAtMs: coerce.Number(record["expiresAtMs"]),
			Status:      firstNonEmpty(coerce.String(record["status"], ""), coerce.String(request["status"], ""), "pending"),
			Decision:    coerce.String(record["decision"], ""),
		}
		response = append(response, entry)
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
		SystemPrompt:           normalizeContextWeightSystemPrompt(record["systemPrompt"]),
		InjectedWorkspaceFiles: normalizeContextWeightFiles(record["injectedWorkspaceFiles"]),
		Skills:                 normalizeContextWeightSkills(record["skills"]),
		Tools:                  normalizeContextWeightTools(record["tools"]),
	}
}

func normalizeContextWeightSystemPrompt(value any) map[string]any {
	record := objectFromAny(value)
	normalized := cloneObject(record)
	normalized["chars"] = coerce.Number(record["chars"])
	normalized["projectContextChars"] = coerce.Number(record["projectContextChars"])
	normalized["nonProjectContextChars"] = coerce.Number(record["nonProjectContextChars"])
	return normalized
}

func normalizeContextWeightFiles(value any) []map[string]any {
	items := objectListFromAny(value)
	normalized := make([]map[string]any, 0, len(items))
	for _, item := range items {
		record := cloneObject(item)
		record["name"] = coerce.String(item["name"], "")
		record["path"] = coerce.String(item["path"], "")
		record["missing"] = coerce.Bool(item["missing"])
		record["rawChars"] = coerce.Number(item["rawChars"])
		record["injectedChars"] = coerce.Number(item["injectedChars"])
		record["truncated"] = coerce.Bool(item["truncated"])
		normalized = append(normalized, record)
	}
	return normalized
}

func normalizeContextWeightSkills(value any) map[string]any {
	record := objectFromAny(value)
	normalized := cloneObject(record)
	normalized["promptChars"] = coerce.Number(record["promptChars"])
	normalized["entries"] = objectListFromAny(record["entries"])
	return normalized
}

func normalizeContextWeightTools(value any) map[string]any {
	record := objectFromAny(value)
	normalized := cloneObject(record)
	normalized["listChars"] = coerce.Number(record["listChars"])
	normalized["schemaChars"] = coerce.Number(record["schemaChars"])
	normalized["entries"] = objectListFromAny(record["entries"])
	return normalized
}

func hasContextWeightSignal(record map[string]any) bool {
	if len(record) == 0 {
		return false
	}
	for _, key := range []string{"source", "sessionId", "sessionKey", "provider", "model", "workspaceDir"} {
		if coerce.String(record[key], "") != "" {
			return true
		}
	}
	if coerce.Number(record["generatedAt"]) > 0 {
		return true
	}
	systemPrompt := objectFromAny(record["systemPrompt"])
	for _, key := range []string{"chars", "projectContextChars", "nonProjectContextChars"} {
		if coerce.Number(systemPrompt[key]) > 0 {
			return true
		}
	}
	if len(objectListFromAny(record["injectedWorkspaceFiles"])) > 0 {
		return true
	}
	skills := objectFromAny(record["skills"])
	if coerce.Number(skills["promptChars"]) > 0 || len(objectListFromAny(skills["entries"])) > 0 {
		return true
	}
	tools := objectFromAny(record["tools"])
	return coerce.Number(tools["listChars"]) > 0 ||
		coerce.Number(tools["schemaChars"]) > 0 ||
		len(objectListFromAny(tools["entries"])) > 0
}

func cloneObject(record map[string]any) map[string]any {
	normalized := make(map[string]any, len(record))
	for key, value := range record {
		normalized[key] = value
	}
	return normalized
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
