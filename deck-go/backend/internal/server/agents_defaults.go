package server

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/coerce"
)

type agentsDefaultsActionSpec struct {
	actionID  string
	bucket    string
	fields    map[string]string
	allowlist []string
}

var agentsDefaultsActionSpecs = map[string]agentsDefaultsActionSpec{
	"cognition": {
		actionID: "agents.defaults.cognition.set",
		bucket:   "cognition",
		fields: map[string]string{
			"thinkingDefault":        "thinkingDefault",
			"verboseDefault":         "verboseDefault",
			"reasoningDefault":       "reasoningDefault",
			"fastModeDefault":        "fastModeDefault",
			"elevatedDefault":        "elevatedDefault",
			"blockStreamingDefault":  "blockStreamingDefault",
			"blockStreamingBreak":    "blockStreamingBreak",
			"blockStreamingChunk":    "blockStreamingChunk",
			"blockStreamingCoalesce": "blockStreamingCoalesce",
			"memorySearch":           "memorySearch",
		},
		allowlist: []string{
			"agents.defaults.thinkingDefault",
			"agents.defaults.verboseDefault",
			"agents.defaults.reasoningDefault",
			"agents.defaults.fastModeDefault",
			"agents.defaults.elevatedDefault",
			"agents.defaults.blockStreamingDefault",
			"agents.defaults.blockStreamingBreak",
			"agents.defaults.blockStreamingChunk",
			"agents.defaults.blockStreamingCoalesce",
			"agents.defaults.memorySearch",
		},
	},
	"workspace": {
		actionID: "agents.defaults.workspace.set",
		bucket:   "workspace",
		fields: map[string]string{
			"workspace":                        "workspace",
			"sandbox":                          "sandbox",
			"embeddedHarness":                  "embeddedHarness",
			"embeddedPi":                       "embeddedPi",
			"params":                           "params",
			"repoRoot":                         "repoRoot",
			"skipBootstrap":                    "skipBootstrap",
			"contextInjection":                 "contextInjection",
			"bootstrapMaxChars":                "bootstrapMaxChars",
			"bootstrapTotalMaxChars":           "bootstrapTotalMaxChars",
			"localModelMode":                   "localModelMode",
			"bootstrapPromptTruncationWarning": "bootstrapPromptTruncationWarning",
			"startupContext":                   "startupContext",
			"contextTokens":                    "contextTokens",
			"cliBackends":                      "cliBackends",
			"contextPruning":                   "contextPruning",
			"llm":                              "llm",
			"maxConcurrent":                    "maxConcurrent",
		},
		allowlist: []string{
			"agents.defaults.workspace",
			"agents.defaults.sandbox",
			"agents.defaults.embeddedHarness",
			"agents.defaults.embeddedPi",
			"agents.defaults.params",
			"agents.defaults.repoRoot",
			"agents.defaults.skipBootstrap",
			"agents.defaults.contextInjection",
			"agents.defaults.bootstrapMaxChars",
			"agents.defaults.bootstrapTotalMaxChars",
			"agents.defaults.localModelMode",
			"agents.defaults.bootstrapPromptTruncationWarning",
			"agents.defaults.startupContext",
			"agents.defaults.contextTokens",
			"agents.defaults.cliBackends",
			"agents.defaults.contextPruning",
			"agents.defaults.llm",
			"agents.defaults.maxConcurrent",
		},
	},
	"skills": {
		actionID:  "agents.defaults.skills.set",
		bucket:    "skills",
		fields:    map[string]string{"skills": "skills"},
		allowlist: []string{"agents.defaults.skills"},
	},
	"subagents": {
		actionID:  "agents.defaults.subagents.set",
		bucket:    "subagents",
		fields:    map[string]string{"subagents": "subagents"},
		allowlist: []string{"agents.defaults.subagents"},
	},
	"conversation": {
		actionID: "agents.defaults.conversation.set",
		bucket:   "conversation",
		fields: map[string]string{
			"systemPromptOverride":  "systemPromptOverride",
			"humanDelay":            "humanDelay",
			"timeFormat":            "timeFormat",
			"envelopeTimezone":      "envelopeTimezone",
			"envelopeTimestamp":     "envelopeTimestamp",
			"envelopeElapsed":       "envelopeElapsed",
			"timeoutSeconds":        "timeoutSeconds",
			"mediaMaxMb":            "mediaMaxMb",
			"imageMaxDimensionPx":   "imageMaxDimensionPx",
			"typingIntervalSeconds": "typingIntervalSeconds",
			"typingMode":            "typingMode",
		},
		allowlist: []string{
			"agents.defaults.systemPromptOverride",
			"agents.defaults.humanDelay",
			"agents.defaults.timeFormat",
			"agents.defaults.envelopeTimezone",
			"agents.defaults.envelopeTimestamp",
			"agents.defaults.envelopeElapsed",
			"agents.defaults.timeoutSeconds",
			"agents.defaults.mediaMaxMb",
			"agents.defaults.imageMaxDimensionPx",
			"agents.defaults.typingIntervalSeconds",
			"agents.defaults.typingMode",
		},
	},
	"eventStreams": {
		actionID:  "agents.defaults.eventStreams.set",
		bucket:    "eventStreams",
		fields:    map[string]string{"eventStreams": "channels.eventStreams"},
		allowlist: []string{"agents.defaults.channels.eventStreams"},
	},
	"delivery": {
		actionID: "agents.defaults.delivery.set",
		bucket:   "delivery",
		fields: map[string]string{
			"eventStreams": "channels.eventStreams",
			"heartbeat":    "heartbeat",
		},
		allowlist: []string{
			"agents.defaults.channels.eventStreams",
			"agents.defaults.heartbeat",
		},
	},
}

func handleAgentsDefaultsAction(ctx context.Context, adapter agentsProductSurface, action string, body map[string]any) (any, int, bool, error) {
	bucket, verb, ok := parseAgentsDefaultsAction(action, body)
	if !ok {
		return nil, http.StatusOK, false, nil
	}
	spec, ok := agentsDefaultsActionSpecs[bucket]
	if !ok {
		return nil, http.StatusBadRequest, true, fmt.Errorf("defaults bucket %q is not supported", bucket)
	}
	switch verb {
	case "get":
		payload, status, err := handleAgentsDefaultsGet(ctx, adapter, spec)
		return payload, status, true, err
	case "set":
		payload, status, err := handleAgentsDefaultsSet(ctx, adapter, spec, body)
		return payload, status, true, err
	default:
		return nil, http.StatusBadRequest, true, fmt.Errorf("defaults action %q is not supported", action)
	}
}

func parseAgentsDefaultsAction(action string, body map[string]any) (bucket string, verb string, ok bool) {
	action = strings.TrimSpace(action)
	if strings.HasPrefix(action, "defaults.") {
		parts := strings.Split(action, ".")
		if len(parts) == 3 {
			return parts[1], parts[2], true
		}
	}
	if strings.HasSuffix(action, ".get") || strings.HasSuffix(action, ".set") {
		parts := strings.Split(action, ".")
		if len(parts) == 2 {
			return parts[0], parts[1], true
		}
	}
	bucket = strings.TrimSpace(coerce.String(body["bucket"], ""))
	if bucket != "" {
		if strings.HasSuffix(action, ".get") {
			return bucket, "get", true
		}
		if strings.HasSuffix(action, ".set") {
			return bucket, "set", true
		}
	}
	return "", "", false
}

func handleAgentsDefaultsGet(ctx context.Context, adapter agentsProductSurface, spec agentsDefaultsActionSpec) (deckapi.DeckGoAgentProductActionResponse, int, error) {
	payload, err := adapter.ConfigGet(ctx)
	if err != nil {
		return deckapi.DeckGoAgentProductActionResponse{}, http.StatusBadGateway, err
	}
	configMap, hash, _ := extractConfigMap(payload)
	agents := coerce.Map(configMap["agents"])
	defaults := map[string]any{}
	if agents != nil {
		if record := coerce.Map(agents["defaults"]); record != nil {
			defaults = record
		}
	}
	value := selectDottedValues(defaults, spec.fields)
	return deckapi.DeckGoAgentProductActionResponse{
		Ok:       true,
		Bucket:   spec.bucket,
		BaseHash: hash,
		Value:    value,
	}, http.StatusOK, nil
}

func handleAgentsDefaultsSet(ctx context.Context, adapter agentsProductSurface, spec agentsDefaultsActionSpec, body map[string]any) (deckapi.DeckGoAgentProductActionResponse, int, error) {
	baseHash := strings.TrimSpace(stringFromMap(body, "baseHash"))
	if err := validateBaseHash(baseHash); err != nil {
		return deckapi.DeckGoAgentProductActionResponse{}, http.StatusBadRequest, err
	}
	value := coerce.Map(body["value"])
	if value == nil {
		value = map[string]any{}
	}
	if err := rejectUnknownAgentActionKeys(spec.actionID, body, []string{"baseHash", "bucket", "value", "reset"}); err != nil {
		return deckapi.DeckGoAgentProductActionResponse{}, http.StatusBadRequest, err
	}
	if err := rejectUnknownDefaultsValueKeys(spec, value); err != nil {
		return deckapi.DeckGoAgentProductActionResponse{}, http.StatusBadRequest, err
	}
	if status, err := ensureAgentsBaseHash(ctx, adapter, baseHash); err != nil {
		return deckapi.DeckGoAgentProductActionResponse{}, status, err
	}
	fields, err := buildDefaultsFields(spec, value, stringSliceFromAny(body["reset"]))
	if err != nil {
		return deckapi.DeckGoAgentProductActionResponse{}, http.StatusBadRequest, err
	}
	patch := map[string]any{"agents": map[string]any{"defaults": fields}}
	if err := guardAgentConfigWrite(spec.actionID, patch, spec.allowlist); err != nil {
		return deckapi.DeckGoAgentProductActionResponse{}, http.StatusBadRequest, err
	}
	payload, err := adapter.ConfigPatch(ctx, mustJSONString(patch), baseHash, "")
	if err != nil {
		status, mapped := classifyConfigPatchError(err)
		return deckapi.DeckGoAgentProductActionResponse{}, status, mapped
	}
	nextHash := extractConfigPatchHash(payload)
	if nextHash == "" {
		nextHash = readAgentsPostPatchHash(ctx, adapter)
	}
	return deckapi.DeckGoAgentProductActionResponse{
		Ok:       true,
		Bucket:   spec.bucket,
		BaseHash: baseHash,
		NextHash: nextHash,
		Value:    fields,
	}, http.StatusOK, nil
}

func buildDefaultsFields(spec agentsDefaultsActionSpec, value map[string]any, reset []string) (map[string]any, error) {
	fields := map[string]any{}
	for requestKey, configPath := range spec.fields {
		if fieldValue, exists := value[requestKey]; exists {
			setDottedValue(fields, configPath, fieldValue)
		}
	}
	for _, resetKey := range reset {
		configPath, ok := configPathForReset(spec.fields, resetKey)
		if !ok {
			return nil, fmt.Errorf("reset field %q is not supported for %s", resetKey, spec.actionID)
		}
		setDottedValue(fields, configPath, nil)
	}
	return fields, nil
}

func rejectUnknownDefaultsValueKeys(spec agentsDefaultsActionSpec, value map[string]any) error {
	for key, child := range value {
		if _, ok := spec.fields[key]; ok {
			continue
		}
		return &agentsConfigWriteGuardError{
			Code:     agentsConfigPathOutOfScopeCode,
			ActionID: spec.actionID,
			Path:     firstBodyPath(key, child),
		}
	}
	return nil
}

func selectDottedValues(defaults map[string]any, fields map[string]string) map[string]any {
	out := map[string]any{}
	for requestKey, configPath := range fields {
		if value, ok := getDottedValue(defaults, configPath); ok {
			out[requestKey] = value
		}
	}
	return out
}

func getDottedValue(record map[string]any, path string) (any, bool) {
	if record == nil {
		return nil, false
	}
	var current any = record
	for _, part := range strings.Split(path, ".") {
		currentMap := coerce.Map(current)
		if currentMap == nil {
			return nil, false
		}
		value, ok := currentMap[part]
		if !ok {
			return nil, false
		}
		current = value
	}
	return current, true
}
