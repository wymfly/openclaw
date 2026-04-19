package server

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway"
)

func registerChatRoutes(mux interface{ MethodFunc(string, string, http.HandlerFunc) }, client *gateway.Client) {
	mux.MethodFunc("GET", "/chat/history", func(w http.ResponseWriter, r *http.Request) {
		sessionKey := r.URL.Query().Get("sessionKey")
		if sessionKey == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "sessionKey is required"})
			return
		}
		params := map[string]any{"sessionKey": sessionKey}
		if limitRaw := r.URL.Query().Get("limit"); limitRaw != "" {
			if limit, err := strconv.Atoi(limitRaw); err == nil && limit > 0 {
				params["limit"] = limit
			}
		}
		callGateway(w, r, client, "chat.history", params)
	})

	mux.MethodFunc("POST", "/chat/sessions/preview", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Keys []string `json:"keys"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid json body"})
			return
		}
		if len(body.Keys) == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "keys[] is required"})
			return
		}
		callGateway(w, r, client, "sessions.preview", map[string]any{"keys": body.Keys})
	})

	mux.MethodFunc("POST", "/chat/sessions/reset", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			SessionKey string `json:"sessionKey"`
			Reason     string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid json body"})
			return
		}
		if body.SessionKey == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "sessionKey is required"})
			return
		}
		reason := body.Reason
		if reason == "" {
			reason = "reset"
		}
		callGateway(w, r, client, "sessions.reset", map[string]any{
			"key":    body.SessionKey,
			"reason": reason,
		})
	})

	mux.MethodFunc("POST", "/chat/sessions/clear", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			SessionKey string `json:"sessionKey"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid json body"})
			return
		}
		if body.SessionKey == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "sessionKey is required"})
			return
		}
		callGateway(w, r, client, "sessions.clear", map[string]any{"key": body.SessionKey})
	})

	mux.MethodFunc("POST", "/chat/sessions/patch", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid json body"})
			return
		}
		sessionKey, _ := body["sessionKey"].(string)
		if sessionKey == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "sessionKey is required"})
			return
		}
		delete(body, "sessionKey")
		body["key"] = sessionKey
		callGateway(w, r, client, "sessions.patch", body)
	})

	mux.MethodFunc("POST", "/chat/sessions/create", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			AgentID          string `json:"agentId"`
			Message          string `json:"message"`
			Model            string `json:"model"`
			Label            string `json:"label"`
			ParentSessionKey string `json:"parentSessionKey"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid json body"})
			return
		}
		params := map[string]any{}
		if body.AgentID != "" {
			params["agentId"] = body.AgentID
		}
		if body.Message != "" {
			params["message"] = body.Message
		}
		if body.Model != "" {
			params["model"] = body.Model
		}
		if body.Label != "" {
			params["label"] = body.Label
		}
		if body.ParentSessionKey != "" {
			params["parentSessionKey"] = body.ParentSessionKey
		}
		callGateway(w, r, client, "sessions.create", params)
	})

	mux.MethodFunc("POST", "/chat/send", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Message        string         `json:"message"`
			SessionKey     string         `json:"sessionKey"`
			Thinking       string         `json:"thinking"`
			IdempotencyKey string         `json:"idempotencyKey"`
			Attachments    []map[string]any `json:"attachments"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid json body"})
			return
		}
		if body.SessionKey == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "sessionKey is required"})
			return
		}
		if body.Message == "" && len(body.Attachments) == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "message or attachment required"})
			return
		}
		params := map[string]any{
			"key":     body.SessionKey,
			"message": body.Message,
		}
		if body.Thinking != "" {
			params["thinking"] = body.Thinking
		}
		if body.IdempotencyKey != "" {
			params["idempotencyKey"] = body.IdempotencyKey
		}
		if len(body.Attachments) > 0 {
			params["attachments"] = body.Attachments
		}
		callGateway(w, r, client, "sessions.send", params)
	})

	mux.MethodFunc("POST", "/chat/abort", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			SessionKey string `json:"sessionKey"`
			RunID      string `json:"runId"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid json body"})
			return
		}
		if body.SessionKey == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "sessionKey is required"})
			return
		}
		params := map[string]any{"key": body.SessionKey}
		if body.RunID != "" {
			params["runId"] = body.RunID
		}
		callGateway(w, r, client, "sessions.abort", params)
	})
}
