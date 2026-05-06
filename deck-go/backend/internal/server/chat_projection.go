package server

import "sync"

var chatProjectionStates sync.Map

func storeChatProjectionState(sessionKey string, a2uiState map[string]any) map[string]any {
	if sessionKey == "" {
		return nil
	}
	if a2uiState == nil {
		chatProjectionStates.Delete(sessionKey)
		return nil
	}
	sanitized := sanitizeChatProjectionA2UIState(a2uiState)
	chatProjectionStates.Store(sessionKey, sanitized)
	return sanitized
}

func loadChatProjectionState(sessionKey string) (map[string]any, bool) {
	value, ok := chatProjectionStates.Load(sessionKey)
	if !ok {
		return nil, false
	}
	state, ok := value.(map[string]any)
	if !ok {
		return nil, false
	}
	return sanitizeChatProjectionA2UIState(state), true
}

func sanitizeChatProjectionA2UIState(state map[string]any) map[string]any {
	if state == nil {
		return nil
	}
	sanitized := make(map[string]any, len(state))
	for key, value := range state {
		switch key {
		case "bridgeStatus", "treeData":
			continue
		default:
			sanitized[key] = value
		}
	}
	return sanitized
}
