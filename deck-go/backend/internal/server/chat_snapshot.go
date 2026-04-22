package server

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	openclawrt "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/openclaw"
)

func registerChatSnapshotRoute(mux interface {
	MethodFunc(string, string, http.HandlerFunc)
}, managed openclawrt.ManagedRuntimeSurface) {
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

		detail, err := managed.GetTimelineWithParams(ctx, sessionKey, agentID, limit)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"session":        detail.Session,
			"messages":       detail.Messages,
			"activeApproval": detail.ActiveApproval,
			"a2uiState":      detail.A2uiState,
		})
	})

	_ = chi.URLParam // keep chi imported in this package cluster for future session routes
}
