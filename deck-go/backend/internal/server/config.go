package server

import (
	"encoding/json"
	"net/http"

	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway"
)

func registerConfigRoutes(mux interface{ MethodFunc(string, string, http.HandlerFunc) }, client *gateway.Client) {
	mux.MethodFunc("GET", "/config", func(w http.ResponseWriter, r *http.Request) {
		callGateway(w, r, client, "config.get", map[string]any{})
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
		if body.BaseHash != "" {
			params["baseHash"] = body.BaseHash
		}
		callGateway(w, r, client, "config.patch", params)
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
		params := map[string]any{"raw": body.Raw}
		if body.BaseHash != "" {
			params["baseHash"] = body.BaseHash
		}
		callGateway(w, r, client, "config.apply", params)
	})
}

func mustJSONString(value any) string {
	raw, _ := json.Marshal(value)
	return string(raw)
}
