package server

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway"
)

func registerGatewayRoutes(mux interface{ MethodFunc(string, string, http.HandlerFunc) }, client *gateway.Client, store *config.Store) {
	mux.MethodFunc("GET", "/bootstrap/status", func(w http.ResponseWriter, _ *http.Request) {
		effective := store.Effective()
		payload := deckapi.DeckGoBootstrapStatusResponse{
			Ok: true,
			Settings: deckapi.DeckGoBootstrapSettingsStatus{
				Path:                  store.Path(),
				GatewayUrlConfigured:  effective.GatewayURL != "",
				GatewayTokenConfigured: effective.GatewayToken != "",
				AccessTokenConfigured: effective.AccessToken != "",
			},
			Gateway: deckapi.DeckGoBootstrapGatewayStatus{
				Connected: false,
			},
		}

		if effective.GatewayURL != "" && effective.GatewayToken != "" {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			describePayload, err := client.Request(ctx, "gateway.describe", map[string]any{
				"filter":         "all",
				"includeSchemas": false,
			})
			if err != nil {
				payload.Gateway = deckapi.DeckGoBootstrapGatewayStatus{
					Connected: false,
					Error:     err.Error(),
				}
			} else {
				payload.Gateway = deckapi.DeckGoBootstrapGatewayStatus{
					Connected: true,
					Describe:  describePayload,
				}
			}
		}

		writeJSON(w, http.StatusOK, payload)
	})

	registerGatewayRPCGet(mux, client, "/gateway/describe", "gateway.describe", map[string]any{
		"filter":         "all",
		"includeSchemas": true,
	})
	registerGatewayRPCGet(mux, client, "/gateway/health", "health", map[string]any{})
	registerGatewayRPCGet(mux, client, "/gateway/status", "status", map[string]any{})

	mux.MethodFunc("POST", "/config/schema-lookup", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Path string `json:"path"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Path == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"ok":    false,
				"error": "path is required",
			})
			return
		}
		callGateway(w, r, client, "config.schema.lookup", map[string]any{"path": body.Path})
	})
}

func registerGatewayRPCGet(mux interface{ MethodFunc(string, string, http.HandlerFunc) }, client *gateway.Client, path string, method string, params map[string]any) {
	mux.MethodFunc("GET", path, func(w http.ResponseWriter, r *http.Request) {
		callGateway(w, r, client, method, params)
	})
}

func callGateway(w http.ResponseWriter, r *http.Request, client *gateway.Client, method string, params map[string]any) {
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	payload, err := client.Request(ctx, method, params)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]any{
			"ok":     false,
			"method": method,
			"error":  err.Error(),
		})
		return
	}
	writeJSON(w, http.StatusOK, payload)
}
