package server

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway"
)

func registerChatSnapshotRoute(mux interface{ MethodFunc(string, string, http.HandlerFunc) }, client *gateway.Client) {
	mux.MethodFunc("GET", "/chat/snapshot", func(w http.ResponseWriter, r *http.Request) {
		sessionKey := r.URL.Query().Get("sessionKey")
		if sessionKey == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "sessionKey is required"})
			return
		}
		agentID := r.URL.Query().Get("agentId")
		limitRaw := r.URL.Query().Get("limit")
		var limit int
		if limitRaw != "" {
			if parsed, err := strconv.Atoi(limitRaw); err == nil && parsed > 0 {
				limit = parsed
			}
		}

		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()

		historyParams := map[string]any{"sessionKey": sessionKey}
		if limit > 0 {
			historyParams["limit"] = limit
		}
		historyPayload, err := client.Request(ctx, "chat.history", historyParams)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		sessionsParams := map[string]any{
			"includeDerivedTitles": true,
			"includeLastMessage":   true,
			"limit":                50,
		}
		if agentID != "" {
			sessionsParams["agentId"] = agentID
		}
		sessionsPayload, err := client.Request(ctx, "sessions.list", sessionsParams)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}

		meta := resolveSessionMeta(sessionKey, sessionsPayload)
		messages := resolveMessages(historyPayload)

		writeJSON(w, http.StatusOK, map[string]any{
			"messages":       messages,
			"meta":           meta,
			"activeApproval": nil,
			"a2uiState":      nil,
		})
	})

	_ = chi.URLParam // keep chi imported in this package cluster for future session routes
}

func resolveSessionMeta(sessionKey string, payload any) any {
	if items, ok := payload.([]any); ok {
		for _, item := range items {
			if record, ok := item.(map[string]any); ok {
				if record["key"] == sessionKey || record["sessionKey"] == sessionKey {
					return record
				}
			}
		}
		return nil
	}
	if record, ok := payload.(map[string]any); ok {
		if sessions, ok := record["sessions"].([]any); ok {
			for _, item := range sessions {
				if session, ok := item.(map[string]any); ok {
					if session["key"] == sessionKey || session["sessionKey"] == sessionKey {
						return session
					}
				}
			}
		}
	}
	return nil
}

func resolveMessages(payload any) any {
	if record, ok := payload.(map[string]any); ok {
		if messages, ok := record["messages"]; ok {
			return messages
		}
	}
	return []any{}
}

