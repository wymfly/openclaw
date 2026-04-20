package server

import (
	"encoding/json"
	"net/http"

	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
)

func registerSettingsRoutes(mux interface {
	MethodFunc(string, string, http.HandlerFunc)
}, store *config.Store, bus *events.Bus) {
	mux.MethodFunc("GET", "/settings", func(w http.ResponseWriter, _ *http.Request) {
		current := store.Get()
		writeJSON(w, http.StatusOK, deckapi.DeckGoSettingsResponse{
			Ok:       true,
			Settings: toDeckSettings(current),
			Path:     store.Path(),
		})
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
		if err := store.Update(body); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{
				"ok":    false,
				"error": err.Error(),
			})
			return
		}
		current := store.Get()
		eventPayload, _ := json.Marshal(map[string]any{
			"type": "settings.saved",
			"path": store.Path(),
		})
		bus.Publish("runtime.status", eventPayload)
		writeJSON(w, http.StatusOK, deckapi.DeckGoSettingsSaveResponse{
			Ok:       true,
			Settings: toDeckSettings(current),
		})
	})
}

func toDeckSettings(current config.Settings) deckapi.DeckGoSettings {
	return deckapi.DeckGoSettings{
		AccessToken: current.AccessToken,
		ManagedGateway: deckapi.DeckGoManagedGatewaySettings{
			Mode:         current.ManagedGateway.Mode,
			Command:      current.ManagedGateway.Command,
			Args:         current.ManagedGateway.Args,
			WorkingDir:   current.ManagedGateway.WorkingDir,
			BindHost:     current.ManagedGateway.BindHost,
			BindPort:     float64(current.ManagedGateway.BindPort),
			GatewayToken: current.ManagedGateway.GatewayToken,
			AutoStart:    current.ManagedGateway.AutoStart,
			Env:          current.ManagedGateway.Env,
		},
	}
}
