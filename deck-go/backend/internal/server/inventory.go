package server

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway"
)

func registerInventoryRoutes(mux interface {
	MethodFunc(string, string, http.HandlerFunc)
}, client *gateway.Client) {
	mux.MethodFunc("GET", "/channels", func(w http.ResponseWriter, r *http.Request) {
		params := map[string]any{}
		if probe := r.URL.Query().Get("probe"); probe == "1" || probe == "true" {
			params["probe"] = true
		}
		if timeoutRaw := r.URL.Query().Get("timeoutMs"); timeoutRaw != "" {
			if timeout, err := strconv.Atoi(timeoutRaw); err == nil {
				params["timeoutMs"] = timeout
			}
		}
		callGateway(w, r, client, "channels.status", params)
	})

	mux.MethodFunc("POST", "/channels/{channelId}/logout", func(w http.ResponseWriter, r *http.Request) {
		channelID := chi.URLParam(r, "channelId")
		if channelID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "channelId is required"})
			return
		}
		callGateway(w, r, client, "channels.logout", map[string]any{"channel": channelID})
	})

	mux.MethodFunc("PATCH", "/channels/{channelId}", func(w http.ResponseWriter, r *http.Request) {
		channelID := chi.URLParam(r, "channelId")
		if channelID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "channelId is required"})
			return
		}
		var patch map[string]any
		if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid json body"})
			return
		}

		ctx := r.Context()
		payload, err := client.Request(ctx, "config.get", map[string]any{})
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{
				"ok":    false,
				"error": err.Error(),
			})
			return
		}
		configPayload, ok := payload.(map[string]any)
		if !ok {
			writeJSON(w, http.StatusBadGateway, map[string]any{
				"ok":    false,
				"error": "unexpected config.get payload shape",
			})
			return
		}
		baseHash, _ := configPayload["baseHash"].(string)

		params := map[string]any{
			"raw": mustJSONString(map[string]any{
				"channels": map[string]any{
					channelID: patch,
				},
			}),
		}
		if baseHash != "" {
			params["baseHash"] = baseHash
		}
		callGateway(w, r, client, "config.patch", params)
	})

	mux.MethodFunc("GET", "/sessions", func(w http.ResponseWriter, r *http.Request) {
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
		ctx := r.Context()
		payload, err := client.Request(ctx, "sessions.list", params)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{
				"ok":    false,
				"error": err.Error(),
			})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"sessions": normalizeSessionMetas(payload, agentID),
		})
	})

	mux.MethodFunc("GET", "/sessions/{sessionKey}", func(w http.ResponseWriter, r *http.Request) {
		sessionKey := chi.URLParam(r, "sessionKey")
		if sessionKey == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "sessionKey is required"})
			return
		}

		query := r.URL.Query()
		agentID := query.Get("agentId")
		var limit int
		if limitRaw := query.Get("limit"); limitRaw != "" {
			if parsed, err := strconv.Atoi(limitRaw); err == nil && parsed > 0 {
				limit = parsed
			}
		}

		ctx := r.Context()
		detail, err := fetchSessionDetailPayload(ctx, client, sessionKey, agentID, limit)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, detail)
	})

	mux.MethodFunc("GET", "/deck/plugins", func(w http.ResponseWriter, r *http.Request) {
		params := map[string]any{}
		if capability := r.URL.Query().Get("capability"); capability == "all" {
			params["capability"] = capability
		}
		callGateway(w, r, client, "deck.plugins.list", params)
	})

	mux.MethodFunc("GET", "/logs", func(w http.ResponseWriter, r *http.Request) {
		params := map[string]any{}
		query := r.URL.Query()
		if cursorRaw := query.Get("cursor"); cursorRaw != "" {
			if cursor, err := strconv.Atoi(cursorRaw); err == nil {
				params["cursor"] = cursor
			}
		}
		if limitRaw := query.Get("limit"); limitRaw != "" {
			if limit, err := strconv.Atoi(limitRaw); err == nil {
				params["limit"] = limit
			}
		}
		if maxBytesRaw := query.Get("maxBytes"); maxBytesRaw != "" {
			if maxBytes, err := strconv.Atoi(maxBytesRaw); err == nil {
				params["maxBytes"] = maxBytes
			}
		}
		callGateway(w, r, client, "logs.tail", params)
	})
}
