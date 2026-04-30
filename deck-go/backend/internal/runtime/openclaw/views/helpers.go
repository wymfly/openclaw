package views

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

func paramsMap(params any) map[string]any {
	if params == nil {
		return map[string]any{}
	}
	if typed, ok := params.(map[string]any); ok {
		return typed
	}
	raw, err := json.Marshal(params)
	if err != nil {
		return map[string]any{}
	}
	var out map[string]any
	if err := json.Unmarshal(raw, &out); err != nil {
		return map[string]any{}
	}
	return out
}

func asMap(value any) map[string]any {
	if typed, ok := value.(map[string]any); ok {
		return typed
	}
	return nil
}

func asSlice(value any) []any {
	if typed, ok := value.([]any); ok {
		return typed
	}
	return nil
}

func asString(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case fmt.Stringer:
		return typed.String()
	default:
		return ""
	}
}

func asFloat(value any) (float64, bool) {
	switch typed := value.(type) {
	case float64:
		return typed, true
	case float32:
		return float64(typed), true
	case int:
		return float64(typed), true
	case int64:
		return float64(typed), true
	case json.Number:
		parsed, err := typed.Float64()
		return parsed, err == nil
	default:
		return 0, false
	}
}

func configPayload(configResult any) map[string]any {
	result := asMap(configResult)
	if result == nil {
		return nil
	}
	for _, key := range []string{"config", "parsed", "resolved", "sourceConfig", "runtimeConfig"} {
		if payload := asMap(result[key]); payload != nil {
			return payload
		}
	}
	return nil
}

func configResultHash(configResult any) string {
	return asString(asMap(configResult)["hash"])
}

func agentNamesByID(agentsResult any) (map[string]string, string) {
	result := asMap(agentsResult)
	names := map[string]string{}
	for _, raw := range asSlice(result["agents"]) {
		agent := asMap(raw)
		id := strings.ToLower(strings.TrimSpace(asString(agent["id"])))
		if id == "" {
			continue
		}
		name := strings.TrimSpace(asString(agent["name"]))
		if name == "" {
			name = strings.TrimSpace(asString(asMap(agent["identity"])["name"]))
		}
		if name != "" {
			names[id] = name
		}
	}
	defaultID := strings.ToLower(strings.TrimSpace(asString(result["defaultId"])))
	if defaultID == "" {
		defaultID = "main"
	}
	return names, defaultID
}

func firstNHexSHA256(raw []byte, n int) string {
	sum := sha256.Sum256(raw)
	encoded := hex.EncodeToString(sum[:])
	if n > len(encoded) {
		return encoded
	}
	return encoded[:n]
}

func resolveStateDir(override string) string {
	if strings.TrimSpace(override) != "" {
		return strings.TrimSpace(override)
	}
	if stateDir := strings.TrimSpace(os.Getenv("OPENCLAW_STATE_DIR")); stateDir != "" {
		return stateDir
	}
	home, err := os.UserHomeDir()
	if err != nil || home == "" {
		return ".openclaw"
	}
	return filepath.Join(home, ".openclaw")
}

func sortedMapKeys(input map[string]any) []string {
	keys := make([]string, 0, len(input))
	for key := range input {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}
