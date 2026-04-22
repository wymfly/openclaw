package server

import (
	"encoding/json"
	"net/http"

	openclawrt "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/openclaw"
)

func registerOnboardingRoutes(mux interface {
	MethodFunc(string, string, http.HandlerFunc)
}, managed openclawrt.ManagedRuntimeSurface) {
	mux.MethodFunc("GET", "/onboarding/status", func(w http.ResponseWriter, r *http.Request) {
		payload, err := managed.GetOnboardingStatus(r.Context())
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("POST", "/onboarding/test-connection", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			URL   string `json:"url"`
			Token string `json:"token"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"success": false,
				"error":   "invalid json body",
			})
			return
		}
		payload, err := managed.TestOnboardingConnection(r.Context(), body.URL, body.Token)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"success": false, "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("POST", "/onboarding/save-settings", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			GatewayURL   string `json:"gatewayUrl"`
			GatewayToken string `json:"gatewayToken"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
			return
		}
		payload, status, err := managed.SaveOnboardingSettings(r.Context(), body.GatewayURL, body.GatewayToken)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
			return
		}
		writeJSON(w, status, payload)
	})
}
