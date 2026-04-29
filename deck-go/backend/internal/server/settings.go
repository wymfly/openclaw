package server

import (
	"encoding/json"
	"net/http"
	"slices"

	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	openclawrt "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/openclaw"
)

func registerSettingsRoutes(mux interface {
	MethodFunc(string, string, http.HandlerFunc)
}, store *config.Store, managed openclawrt.ManagedRuntimeSurface) {
	mux.MethodFunc("GET", "/settings", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, settingsPayload(store))
	})

	mux.MethodFunc("PUT", "/settings", sensitiveBody(func(w http.ResponseWriter, r *http.Request) {
		var raw map[string]json.RawMessage
		if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"ok":    false,
				"error": "invalid json body",
			})
			return
		}
		if rejected := firstRejectedSettingsField(raw); rejected != "" {
			writeRuntimeError(w, http.StatusBadRequest, "invalid_settings_field", "field "+rejected+" is not accepted")
			return
		}
		next := store.Get()
		if rawAppearance, ok := raw["appearance"]; ok {
			var value map[string]any
			if err := json.Unmarshal(rawAppearance, &value); err != nil {
				writeRuntimeError(w, http.StatusBadRequest, "invalid_settings_field", "field appearance must be an object")
				return
			}
			next.Appearance = value
		}
		if rawNotifications, ok := raw["notifications"]; ok {
			var value map[string]any
			if err := json.Unmarshal(rawNotifications, &value); err != nil {
				writeRuntimeError(w, http.StatusBadRequest, "invalid_settings_field", "field notifications must be an object")
				return
			}
			next.Notifications = value
		}
		if rawPairedDevices, ok := raw["pairedDevices"]; ok {
			var value []map[string]any
			if err := json.Unmarshal(rawPairedDevices, &value); err != nil {
				writeRuntimeError(w, http.StatusBadRequest, "invalid_settings_field", "field pairedDevices must be an array")
				return
			}
			next.PairedDevices = value
		}
		if err := store.Update(next); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{
				"ok":    false,
				"error": err.Error(),
			})
			return
		}
		writeJSON(w, http.StatusOK, settingsPayload(store))
	}))

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

func settingsPayload(store *config.Store) map[string]any {
	settings := map[string]any{
		"accessTokenConfigured": false,
	}
	path := ""
	if store != nil {
		current := store.Get()
		token := store.ServiceTokenStatus()
		path = store.Path()
		settings["accessTokenConfigured"] = token.Configured
		settings["accessTokenSource"] = token.Source
		if current.Appearance != nil {
			settings["appearance"] = current.Appearance
		}
		if current.Notifications != nil {
			settings["notifications"] = current.Notifications
		}
		if current.PairedDevices != nil {
			settings["pairedDevices"] = current.PairedDevices
		}
	}
	return map[string]any{
		"ok":       true,
		"settings": settings,
		"path":     path,
	}
}

func firstRejectedSettingsField(raw map[string]json.RawMessage) string {
	allowed := []string{"appearance", "notifications", "pairedDevices"}
	for key := range raw {
		if !slices.Contains(allowed, key) {
			return key
		}
	}
	return ""
}
