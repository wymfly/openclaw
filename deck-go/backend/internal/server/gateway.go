package server

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	openclawrt "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/openclaw"
)

func registerGatewayRoutes(
	mux interface {
		MethodFunc(string, string, http.HandlerFunc)
	},
	managed openclawrt.ManagedRuntimeSurface,
) {
	mux.MethodFunc("GET", "/bootstrap/status", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		payload, err := managed.BootstrapStatus(ctx)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("GET", "/gateway/describe", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := managed.Describe(ctx, true)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "gateway.describe", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})
	mux.MethodFunc("GET", "/gateway/health", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := managed.Health(ctx)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "health", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})
	mux.MethodFunc("GET", "/gateway/status", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := managed.Status(ctx)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "status", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("POST", "/config/schema-lookup", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Path *string `json:"path"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Path == nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"ok":    false,
				"error": "path is required",
			})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := managed.ConfigSchemaLookup(ctx, *body.Path)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "config.schema.lookup", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})
}
