package server

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/openclaw/openclaw/deck-go/backend/internal/localstore"
)

func registerAlertsRoutes(mux interface{ MethodFunc(string, string, http.HandlerFunc) }) {
	mux.MethodFunc("GET", "/alerts", func(w http.ResponseWriter, _ *http.Request) {
		rules := localstore.GetAlertRuleStore().All()
		writeJSON(w, http.StatusOK, map[string]any{"rules": rules})
	})

	mux.MethodFunc("POST", "/alerts", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Name       string   `json:"name"`
			EntityType string   `json:"entityType"`
			Condition  string   `json:"condition"`
			Threshold  *float64 `json:"threshold"`
			Action     string   `json:"action"`
			CooldownMs *float64 `json:"cooldownMs"`
			Enabled    *bool    `json:"enabled"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
			return
		}
		if body.Name == "" || body.EntityType == "" || body.Condition == "" || body.Threshold == nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"error": "Missing required fields: name, entityType, condition, threshold",
			})
			return
		}
		now := time.Now().UTC().Format(time.RFC3339)
		cooldownMs := 300000.0
		if body.CooldownMs != nil {
			cooldownMs = *body.CooldownMs
		}
		enabled := true
		if body.Enabled != nil {
			enabled = *body.Enabled
		}
		action := body.Action
		if action == "" {
			action = "toast"
		}
		rule := localstore.AlertRule{
			ID:          "ar-" + randomID(6),
			Name:        body.Name,
			EntityType:  body.EntityType,
			Condition:   body.Condition,
			Threshold:   *body.Threshold,
			Action:      action,
			CooldownMs:  cooldownMs,
			LastFiredAt: nil,
			Enabled:     enabled,
			CreatedAt:   now,
			UpdatedAt:   now,
		}
		localstore.GetAlertRuleStore().Append(rule)
		writeJSON(w, http.StatusCreated, map[string]any{"rule": rule})
	})

	mux.MethodFunc("PATCH", "/alerts/{ruleId}", func(w http.ResponseWriter, r *http.Request) {
		ruleID := chi.URLParam(r, "ruleId")
		if ruleID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Rule not found"})
			return
		}
		store := localstore.GetAlertRuleStore()
		if _, ok := store.Find(func(item localstore.AlertRule) bool { return item.ID == ruleID }); !ok {
			writeJSON(w, http.StatusNotFound, map[string]any{"error": "Rule not found"})
			return
		}

		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
			return
		}
		allowed := map[string]bool{
			"name": true, "entityType": true, "condition": true, "threshold": true,
			"action": true, "cooldownMs": true, "enabled": true,
		}
		hasUpdate := false
		for key := range body {
			if allowed[key] {
				hasUpdate = true
				break
			}
		}
		if !hasUpdate {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "No fields to update"})
			return
		}

		store.UpdateItem(func(item localstore.AlertRule) bool { return item.ID == ruleID }, func(item localstore.AlertRule) localstore.AlertRule {
			item.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
			if value, ok := body["name"].(string); ok {
				item.Name = value
			}
			if value, ok := body["entityType"].(string); ok {
				item.EntityType = value
			}
			if value, ok := body["condition"].(string); ok {
				item.Condition = value
			}
			if value, ok := body["threshold"].(float64); ok {
				item.Threshold = value
			}
			if value, ok := body["action"].(string); ok {
				item.Action = value
			}
			if value, ok := body["cooldownMs"].(float64); ok {
				item.CooldownMs = value
			}
			if value, ok := body["enabled"].(bool); ok {
				item.Enabled = value
			}
			return item
		})
		updated, _ := store.Find(func(item localstore.AlertRule) bool { return item.ID == ruleID })
		writeJSON(w, http.StatusOK, map[string]any{"rule": updated})
	})

	mux.MethodFunc("DELETE", "/alerts/{ruleId}", func(w http.ResponseWriter, r *http.Request) {
		ruleID := chi.URLParam(r, "ruleId")
		if ruleID == "" {
			writeJSON(w, http.StatusNotFound, map[string]any{"error": "Rule not found"})
			return
		}
		removed := localstore.GetAlertRuleStore().RemoveWhere(func(item localstore.AlertRule) bool { return item.ID == ruleID })
		if removed == 0 {
			writeJSON(w, http.StatusNotFound, map[string]any{"error": "Rule not found"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	})
}

func randomID(bytes int) string {
	buf := make([]byte, bytes)
	if _, err := rand.Read(buf); err != nil {
		return time.Now().UTC().Format("20060102150405")
	}
	return hex.EncodeToString(buf)
}
