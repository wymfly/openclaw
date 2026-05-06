package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	openclawrt "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/openclaw"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/projection"
)

func buildSessionsListParams(r *http.Request) (map[string]any, string) {
	params := map[string]any{}
	query := r.URL.Query()
	agentID := query.Get("agentId")
	if agentID != "" {
		params["agentId"] = agentID
	}
	if search := query.Get("search"); search != "" {
		params["search"] = search
	}
	if limitRaw := query.Get("limit"); limitRaw != "" {
		if limit, err := strconv.Atoi(limitRaw); err == nil {
			params["limit"] = limit
		}
	}
	if activeMinutesRaw := query.Get("activeMinutes"); activeMinutesRaw != "" {
		if activeMinutes, err := strconv.Atoi(activeMinutesRaw); err == nil {
			params["activeMinutes"] = activeMinutes
		}
	}
	return params, agentID
}

func registerChatRoutes(mux interface {
	MethodFunc(string, string, http.HandlerFunc)
}, managed openclawrt.ManagedRuntimeSurface) {
	mux.MethodFunc("GET", "/chat/sessions", func(w http.ResponseWriter, r *http.Request) {
		params, agentID := buildSessionsListParams(r)
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		items, err := managed.ListSessionsWithParams(ctx, params, agentID)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"sessions": items,
		})
	})

	mux.MethodFunc("DELETE", "/chat/sessions", func(w http.ResponseWriter, r *http.Request) {
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
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := managed.Delete(ctx, body.SessionKey)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

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
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := managed.ChatHistory(ctx, params)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"messages": projection.NormalizeTranscriptMessages(payload),
		})
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
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := managed.Preview(ctx, body.Keys)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
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
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := managed.Reset(ctx, body.SessionKey, reason)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
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
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := managed.Clear(ctx, body.SessionKey)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
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
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := managed.Patch(ctx, sessionKey, body)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
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
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := managed.Create(ctx, params)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("POST", "/chat/send", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Message        string           `json:"message"`
			SessionKey     string           `json:"sessionKey"`
			Thinking       string           `json:"thinking"`
			IdempotencyKey string           `json:"idempotencyKey"`
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
		if err := validateChatModelAttachments(body.Attachments); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"ok":    false,
				"code":  "unsupported_attachment",
				"error": err.Error(),
			})
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
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := managed.Send(ctx, params)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
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
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := managed.Abort(ctx, params)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("POST", "/chat/compact", func(w http.ResponseWriter, r *http.Request) {
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
		payload, err := managed.Compact(r.Context(), body.SessionKey)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("POST", "/chat/compaction", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Action       string `json:"action"`
			Key          string `json:"key"`
			CheckpointID string `json:"checkpointId"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid json body"})
			return
		}
		if body.Key == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "key is required"})
			return
		}
		switch body.Action {
		case "list":
			payload, err := managed.CompactionList(r.Context(), body.Key)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
			return
		case "branch":
			if body.CheckpointID == "" {
				writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "checkpointId is required"})
				return
			}
			payload, err := managed.CompactionBranch(r.Context(), body.Key, body.CheckpointID)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
			return
		case "restore":
			if body.CheckpointID == "" {
				writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "checkpointId is required"})
				return
			}
			payload, err := managed.CompactionRestore(r.Context(), body.Key, body.CheckpointID)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
			return
		default:
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": `unknown action "` + body.Action + `"`})
			return
		}
	})

	mux.MethodFunc("POST", "/chat/steer", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			SessionKey string `json:"sessionKey"`
			Message    string `json:"message"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid json body"})
			return
		}
		if body.SessionKey == "" || body.Message == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "sessionKey and message are required"})
			return
		}
		payload, err := managed.Steer(r.Context(), body.SessionKey, body.Message)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("POST", "/chat/projection", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			SessionKey string         `json:"sessionKey"`
			A2uiState  map[string]any `json:"a2uiState"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
			return
		}
		if body.SessionKey == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "sessionKey is required"})
			return
		}
		stored := storeChatProjectionState(body.SessionKey, body.A2uiState)
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "a2uiState": stored})
	})
}

func validateChatModelAttachments(attachments []map[string]any) error {
	for index, attachment := range attachments {
		if attachment == nil {
			continue
		}
		attachmentType, _ := attachment["type"].(string)
		mimeType, _ := attachment["mimeType"].(string)
		if attachmentType == "image" || strings.HasPrefix(strings.ToLower(mimeType), "image/") {
			continue
		}
		fileName, _ := attachment["fileName"].(string)
		if fileName == "" {
			fileName = fmt.Sprintf("attachment-%d", index+1)
		}
		return fmt.Errorf("%s is not a supported model attachment; OpenClaw currently accepts image attachments only", fileName)
	}
	return nil
}
