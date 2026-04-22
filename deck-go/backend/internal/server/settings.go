package server

import (
	"encoding/json"
	"net/http"

	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	openclawrt "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/openclaw"
)

func registerSettingsRoutes(mux interface {
	MethodFunc(string, string, http.HandlerFunc)
}, managed openclawrt.ManagedRuntimeSurface) {
	mux.MethodFunc("GET", "/settings", func(w http.ResponseWriter, r *http.Request) {
		payload, err := managed.GetSettings(r.Context())
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("PUT", "/settings", func(w http.ResponseWriter, r *http.Request) {
		var body config.Settings
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"ok":    false,
				"error": "invalid json body",
			})
			return
		}
		payload, err := managed.UpdateSettingsFromConfig(r.Context(), body)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{
				"ok":    false,
				"error": err.Error(),
			})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("POST", "/settings/test-connection", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			URL   string `json:"url"`
			Token string `json:"token"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"ok":    false,
				"error": "invalid json body",
			})
			return
		}
		payload, err := managed.TestLegacySettingsConnection(r.Context(), body.URL, body.Token)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{
				"ok":    false,
				"error": err.Error(),
			})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("GET", "/settings/version", func(w http.ResponseWriter, r *http.Request) {
		payload, err := managed.GetVersion(r.Context())
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})
}
