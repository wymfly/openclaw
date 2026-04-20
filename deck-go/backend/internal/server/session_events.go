package server

import (
	"context"
	"encoding/json"
	"net/http"
)

type sessionRealtime interface {
	SubscribeSession(ctx context.Context, key string) error
	UnsubscribeSession(ctx context.Context, key string) error
}

func registerSessionEventRoute(mux interface{ MethodFunc(string, string, http.HandlerFunc) }, realtime sessionRealtime) {
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
			if err := realtime.SubscribeSession(r.Context(), body.SessionKey); err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
				return
			}
		case "unsubscribe":
			if err := realtime.UnsubscribeSession(r.Context(), body.SessionKey); err != nil {
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
