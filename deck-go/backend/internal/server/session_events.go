package server

import (
	"encoding/json"
	"net/http"

	openclawrt "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/openclaw"
)

func registerSessionEventRoute(mux interface {
	MethodFunc(string, string, http.HandlerFunc)
}, managed openclawrt.ManagedRuntimeSurface) {
	mux.MethodFunc("POST", "/chat/session-events", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Action     string `json:"action"`
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
		switch body.Action {
		case "subscribe":
			if err := managed.SubscribeSession(r.Context(), body.SessionKey); err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
				return
			}
		case "unsubscribe":
			if err := managed.UnsubscribeSession(r.Context(), body.SessionKey); err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
				return
			}
		default:
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "action must be subscribe or unsubscribe"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":         true,
			"sessionKey": body.SessionKey,
			"action":     body.Action,
		})
	})
}
