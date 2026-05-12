package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
)

type agentsProductSurface interface {
	ConfigGet(ctx context.Context) (any, error)
	ConfigPatch(ctx context.Context, raw string, baseHash string, note string) (any, error)
	ConfigApply(ctx context.Context, raw string, baseHash string) (any, error)
	AgentsUpdate(ctx context.Context, body map[string]any) (deckapi.DeckGoAgentMutationResponse, error)
	DeckAgentsDetail(ctx context.Context, agentID string) (any, error)
	DeckAgentsImpactPreviewGet(ctx context.Context, body map[string]any) (any, error)
}

type agentsProductActionSpec struct {
	actionID   string
	bucket     string
	fields     map[string]string
	allowlist  []string
	workspace  bool
	detailKeys []string
}

var perAgentProductActionSpecs = map[string]agentsProductActionSpec{
	"cognition.set": {
		actionID: "agents.cognition.set",
		bucket:   "cognition",
		fields: map[string]string{
			"thinkingDefault":  "thinkingDefault",
			"verboseDefault":   "verboseDefault",
			"reasoningDefault": "reasoningDefault",
			"fastModeDefault":  "fastModeDefault",
			"memorySearch":     "memorySearch",
		},
		allowlist: []string{
			"agents.list[id].thinkingDefault",
			"agents.list[id].verboseDefault",
			"agents.list[id].reasoningDefault",
			"agents.list[id].fastModeDefault",
			"agents.list[id].memorySearch",
		},
		detailKeys: []string{"thinkingDefault", "verboseDefault", "reasoningDefault", "fastModeDefault", "memorySearch"},
	},
	"workspace.set": {
		actionID:  "agents.workspace.set",
		bucket:    "workspace",
		workspace: true,
		fields: map[string]string{
			"workspace":       "workspace",
			"agentDir":        "agentDir",
			"runtime":         "runtime",
			"sandbox":         "sandbox",
			"embeddedHarness": "embeddedHarness",
			"embeddedPi":      "embeddedPi",
			"params":          "params",
		},
		allowlist: []string{
			"agents.list[id].workspace",
			"agents.list[id].agentDir",
			"agents.list[id].runtime",
			"agents.list[id].sandbox",
			"agents.list[id].embeddedHarness",
			"agents.list[id].embeddedPi",
			"agents.list[id].params",
		},
		detailKeys: []string{"workspace", "agentDir", "runtime", "sandbox", "embeddedHarness", "embeddedPi", "params"},
	},
	"conversation.set": {
		actionID: "agents.conversation.set",
		bucket:   "conversation",
		fields: map[string]string{
			"systemPromptOverride": "systemPromptOverride",
			"humanDelay":           "humanDelay",
			"groupChat":            "groupChat",
		},
		allowlist: []string{
			"agents.list[id].systemPromptOverride",
			"agents.list[id].humanDelay",
			"agents.list[id].groupChat",
		},
		detailKeys: []string{"systemPromptOverride", "humanDelay", "groupChat"},
	},
	"delivery.set": {
		actionID: "agents.delivery.set",
		bucket:   "delivery",
		fields: map[string]string{
			"eventStreams": "channels.eventStreams",
			"heartbeat":    "heartbeat",
		},
		allowlist: []string{
			"agents.list[id].channels.eventStreams",
			"agents.list[id].heartbeat",
		},
		detailKeys: []string{"eventStreams", "heartbeat"},
	},
	"toolsOverride.set": {
		actionID: "agents.toolsOverride.set",
		bucket:   "toolsOverride",
		fields: map[string]string{
			"tools": "tools",
		},
		allowlist: []string{
			"agents.list[id].tools",
		},
		detailKeys: []string{"tools"},
	},
}

func handleAgentsProductAction(ctx context.Context, adapter agentsProductSurface, action string, body map[string]any) (any, int, bool, error) {
	if strings.TrimSpace(action) == "impactPreview.get" {
		payload, err := adapter.DeckAgentsImpactPreviewGet(ctx, body)
		if err != nil {
			return nil, http.StatusBadGateway, true, err
		}
		return payload, http.StatusOK, true, nil
	}
	if strings.HasSuffix(action, ".get") {
		setAction := strings.TrimSuffix(action, ".get") + ".set"
		spec, ok := perAgentProductActionSpecs[setAction]
		if !ok {
			return nil, http.StatusOK, false, nil
		}
		payload, status, err := handleAgentsProductGet(ctx, adapter, spec, body)
		return payload, status, true, err
	}
	spec, ok := perAgentProductActionSpecs[action]
	if !ok {
		return nil, http.StatusOK, false, nil
	}
	payload, status, err := handleAgentsProductSet(ctx, adapter, spec, body)
	return payload, status, true, err
}

func handleAgentsProductGet(ctx context.Context, adapter agentsProductSurface, spec agentsProductActionSpec, body map[string]any) (deckapi.DeckGoAgentProductActionResponse, int, error) {
	agentID := strings.TrimSpace(stringFromMap(body, "agentId"))
	if agentID == "" {
		return deckapi.DeckGoAgentProductActionResponse{}, http.StatusBadRequest, errors.New("agentId is required")
	}
	detailPayload, err := adapter.DeckAgentsDetail(ctx, agentID)
	if err != nil {
		return deckapi.DeckGoAgentProductActionResponse{}, http.StatusBadGateway, err
	}
	detail := mapFromAny(detailPayload)
	value := selectKeys(detail, spec.detailKeys)
	return deckapi.DeckGoAgentProductActionResponse{
		Ok:      true,
		AgentId: agentID,
		Bucket:  spec.bucket,
		Value:   value,
	}, http.StatusOK, nil
}

func handleAgentsProductSet(ctx context.Context, adapter agentsProductSurface, spec agentsProductActionSpec, body map[string]any) (deckapi.DeckGoAgentProductActionResponse, int, error) {
	agentID := strings.TrimSpace(stringFromMap(body, "agentId"))
	if agentID == "" {
		return deckapi.DeckGoAgentProductActionResponse{}, http.StatusBadRequest, errors.New("agentId is required")
	}
	baseHash := strings.TrimSpace(stringFromMap(body, "baseHash"))
	if err := validateBaseHash(baseHash); err != nil {
		return deckapi.DeckGoAgentProductActionResponse{}, http.StatusBadRequest, err
	}
	if err := rejectUnknownAgentActionKeys(spec.actionID, body, allowedAgentActionKeys(spec.fields, "agentId", "baseHash", "reset")); err != nil {
		return deckapi.DeckGoAgentProductActionResponse{}, http.StatusBadRequest, err
	}
	if status, err := ensureAgentsBaseHash(ctx, adapter, baseHash); err != nil {
		return deckapi.DeckGoAgentProductActionResponse{}, status, err
	}

	fields, err := buildActionFields(spec, body)
	if err != nil {
		return deckapi.DeckGoAgentProductActionResponse{}, http.StatusBadRequest, err
	}

	workspaceUpdated := false
	if spec.workspace {
		if value, exists := body["workspace"]; exists && value != nil {
			workspace, ok := value.(string)
			if !ok || strings.TrimSpace(workspace) == "" {
				return deckapi.DeckGoAgentProductActionResponse{}, http.StatusBadRequest, errors.New("workspace must be a non-empty string")
			}
			if _, err := adapter.AgentsUpdate(ctx, map[string]any{"agentId": agentID, "workspace": workspace}); err != nil {
				return deckapi.DeckGoAgentProductActionResponse{}, http.StatusBadGateway, err
			}
			delete(fields, "workspace")
			workspaceUpdated = true
		}
	}

	nextHash := ""
	patchBaseHash := baseHash
	if workspaceUpdated {
		nextHash = readAgentsPostPatchHash(ctx, adapter)
		if nextHash != "" {
			patchBaseHash = nextHash
		}
	}
	if len(fields) > 0 {
		patch := agentListPatch(agentID, fields)
		if err := guardAgentConfigWrite(spec.actionID, patch, spec.allowlist); err != nil {
			return deckapi.DeckGoAgentProductActionResponse{}, http.StatusBadRequest, err
		}
		payload, err := adapter.ConfigPatch(ctx, mustJSONString(patch), patchBaseHash, "")
		if err != nil {
			status, mapped := classifyConfigPatchError(err)
			return deckapi.DeckGoAgentProductActionResponse{}, status, mapped
		}
		nextHash = extractConfigPatchHash(payload)
	}
	return deckapi.DeckGoAgentProductActionResponse{
		Ok:       true,
		AgentId:  agentID,
		Bucket:   spec.bucket,
		BaseHash: baseHash,
		NextHash: nextHash,
		Value:    fields,
	}, http.StatusOK, nil
}

func buildActionFields(spec agentsProductActionSpec, body map[string]any) (map[string]any, error) {
	fields := map[string]any{}
	for requestKey, configPath := range spec.fields {
		if value, exists := body[requestKey]; exists {
			setDottedValue(fields, configPath, value)
		}
	}
	for _, reset := range stringSliceFromAny(body["reset"]) {
		configPath, ok := configPathForReset(spec.fields, reset)
		if !ok {
			return nil, fmt.Errorf("reset field %q is not supported for %s", reset, spec.actionID)
		}
		setDottedValue(fields, configPath, nil)
	}
	return fields, nil
}

func agentListPatch(agentID string, fields map[string]any) map[string]any {
	entry := map[string]any{"id": agentID}
	mergeMap(entry, fields)
	return map[string]any{
		"agents": map[string]any{
			"list": []any{entry},
		},
	}
}

func ensureAgentsBaseHash(ctx context.Context, adapter agentsProductSurface, expected string) (int, error) {
	payload, err := adapter.ConfigGet(ctx)
	if err != nil {
		return http.StatusBadGateway, err
	}
	hash := configHashFromPayload(payload)
	if hash != "" && hash != expected {
		return http.StatusConflict, errModelsControlConflict
	}
	return http.StatusOK, nil
}

func readAgentsPostPatchHash(ctx context.Context, adapter agentsProductSurface) string {
	payload, err := adapter.ConfigGet(ctx)
	if err != nil {
		return ""
	}
	return configHashFromPayload(payload)
}

func writeAgentsProductActionError(w http.ResponseWriter, status int, err error) {
	if guardErr, ok := err.(*agentsConfigWriteGuardError); ok {
		writeJSON(w, status, map[string]any{
			"ok":       false,
			"code":     guardErr.Code,
			"actionId": guardErr.ActionID,
			"path":     guardErr.Path,
			"error":    guardErr.Error(),
		})
		return
	}
	writeJSON(w, status, map[string]any{"ok": false, "error": err.Error()})
}

func rejectUnknownAgentActionKeys(actionID string, body map[string]any, allowed []string) error {
	allowedSet := map[string]struct{}{}
	for _, key := range allowed {
		allowedSet[key] = struct{}{}
	}
	for key, value := range body {
		if _, ok := allowedSet[key]; ok {
			continue
		}
		return &agentsConfigWriteGuardError{
			Code:     agentsConfigPathOutOfScopeCode,
			ActionID: actionID,
			Path:     firstBodyPath(key, value),
		}
	}
	return nil
}

func firstBodyPath(key string, value any) string {
	switch typed := value.(type) {
	case map[string]any:
		for childKey, child := range typed {
			return key + "." + firstBodyPath(childKey, child)
		}
	case []any:
		if len(typed) > 0 {
			return key + "[]"
		}
	}
	return key
}

func setDottedValue(target map[string]any, path string, value any) {
	parts := strings.Split(path, ".")
	current := target
	for i, part := range parts {
		if i == len(parts)-1 {
			current[part] = value
			return
		}
		next, _ := current[part].(map[string]any)
		if next == nil {
			next = map[string]any{}
			current[part] = next
		}
		current = next
	}
}

func mergeMap(target map[string]any, source map[string]any) {
	for key, value := range source {
		if sourceMap, ok := value.(map[string]any); ok {
			if targetMap, ok := target[key].(map[string]any); ok {
				mergeMap(targetMap, sourceMap)
				continue
			}
		}
		target[key] = value
	}
}

func configPathForReset(fields map[string]string, reset string) (string, bool) {
	if path, ok := fields[reset]; ok {
		return path, true
	}
	for _, path := range fields {
		if path == reset {
			return path, true
		}
	}
	return "", false
}

func stringFromMap(body map[string]any, key string) string {
	value, _ := body[key].(string)
	return value
}

func mapKeys(input map[string]string) []string {
	keys := make([]string, 0, len(input))
	for key := range input {
		keys = append(keys, key)
	}
	return keys
}

func mapFromAny(value any) map[string]any {
	if record, ok := value.(map[string]any); ok {
		return record
	}
	raw, err := json.Marshal(value)
	if err != nil {
		return map[string]any{}
	}
	var record map[string]any
	if err := json.Unmarshal(raw, &record); err != nil {
		return map[string]any{}
	}
	if record == nil {
		return map[string]any{}
	}
	return record
}

func allowedAgentActionKeys(fields map[string]string, values ...string) []string {
	keys := mapKeys(fields)
	return append(keys, values...)
}

func selectKeys(record map[string]any, keys []string) map[string]any {
	out := map[string]any{}
	for _, key := range keys {
		if value, ok := record[key]; ok {
			out[key] = value
		}
	}
	return out
}
