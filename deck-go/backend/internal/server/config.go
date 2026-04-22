package server

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	openclawrt "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/openclaw"
)

func registerConfigRoutes(mux interface {
	MethodFunc(string, string, http.HandlerFunc)
}, managed openclawrt.ManagedRuntimeSurface) {
	mux.MethodFunc("GET", "/config", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := managed.ConfigGet(ctx)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "config.get", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("POST", "/config/patch", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Patch    map[string]any `json:"patch"`
			BaseHash string         `json:"baseHash"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid json body"})
			return
		}
		if body.Patch == nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "patch object is required"})
			return
		}
		params := map[string]any{"raw": mustJSONString(body.Patch)}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := managed.ConfigPatch(ctx, params["raw"].(string), body.BaseHash, "")
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "config.patch", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})

	mux.MethodFunc("POST", "/config/apply", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Raw      string `json:"raw"`
			BaseHash string `json:"baseHash"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid json body"})
			return
		}
		if body.Raw == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "raw config is required"})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := managed.ConfigApply(ctx, body.Raw, body.BaseHash)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "config.apply", "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, payload)
	})
}

func mustJSONString(value any) string {
	raw, _ := json.Marshal(value)
	return string(raw)
}
