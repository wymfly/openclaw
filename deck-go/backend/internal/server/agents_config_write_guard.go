package server

import (
	"fmt"
	"sort"
	"strings"
)

const agentsConfigPathOutOfScopeCode = "agents_config_path_out_of_scope"

type agentsConfigWriteGuardError struct {
	Code     string `json:"code"`
	ActionID string `json:"actionId"`
	Path     string `json:"path"`
}

func (e *agentsConfigWriteGuardError) Error() string {
	return fmt.Sprintf("%s: %s cannot write %s", e.Code, e.ActionID, e.Path)
}

func guardAgentConfigWrite(actionID string, diff map[string]any, allowlist []string) error {
	if len(diff) == 0 {
		return nil
	}
	allowed := make([]string, 0, len(allowlist))
	for _, entry := range allowlist {
		entry = strings.TrimSpace(entry)
		if entry != "" {
			allowed = append(allowed, entry)
		}
	}
	sort.Strings(allowed)

	for _, path := range collectAgentConfigWritePaths(diff) {
		if !agentConfigPathAllowed(path, allowed) {
			return &agentsConfigWriteGuardError{
				Code:     agentsConfigPathOutOfScopeCode,
				ActionID: actionID,
				Path:     path,
			}
		}
	}
	return nil
}

func agentConfigPathAllowed(path string, allowlist []string) bool {
	for _, allowed := range allowlist {
		if path == allowed || strings.HasPrefix(path, allowed+".") || strings.HasPrefix(path, allowed+"[") {
			return true
		}
	}
	return false
}

func collectAgentConfigWritePaths(value any) []string {
	paths := make([]string, 0)
	collectAgentConfigWritePathsInto(&paths, "", value)
	sort.Strings(paths)
	return paths
}

func collectAgentConfigWritePathsInto(paths *[]string, prefix string, value any) {
	switch typed := value.(type) {
	case map[string]any:
		if len(typed) == 0 && prefix != "" {
			*paths = append(*paths, prefix)
			return
		}
		for key, child := range typed {
			if prefix == "agents.list[id]" && key == "id" {
				continue
			}
			next := key
			if prefix != "" {
				next = prefix + "." + key
			}
			collectAgentConfigWritePathsInto(paths, next, child)
		}
	case []any:
		if len(typed) == 0 {
			if prefix != "" {
				*paths = append(*paths, prefix)
			}
			return
		}
		for _, child := range typed {
			childPrefix := prefix + "[]"
			if prefix == "agents.list" {
				if record, ok := child.(map[string]any); ok {
					if id, _ := record["id"].(string); strings.TrimSpace(id) != "" {
						childPrefix = "agents.list[id]"
					}
				}
			}
			collectAgentConfigWritePathsInto(paths, childPrefix, child)
		}
	case []string:
		if prefix != "" {
			*paths = append(*paths, prefix)
		}
	default:
		if prefix != "" {
			*paths = append(*paths, prefix)
		}
	}
}
