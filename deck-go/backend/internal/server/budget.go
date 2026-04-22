package server

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
	"github.com/openclaw/openclaw/deck-go/backend/internal/localstore"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/coerce"
)

type budgetGatewayAdapter interface {
	UsageCost(context.Context, map[string]any) (any, error)
}

func registerBudgetRoutes(mux interface {
	MethodFunc(string, string, http.HandlerFunc)
}, adapter budgetGatewayAdapter, bus *events.Bus) {
	const defaultPeriod = "monthly"
	validDimension := map[string]bool{"tokensIn": true, "tokensOut": true, "totalTokens": true, "cost": true}
	validPeriod := map[string]bool{"daily": true, "weekly": true, "monthly": true}

	mux.MethodFunc("GET", "/usage/budget", func(w http.ResponseWriter, _ *http.Request) {
		rules := localstore.GetBudgetRuleStore().All()
		writeJSON(w, http.StatusOK, map[string]any{"rules": rules})
	})

	mux.MethodFunc("POST", "/usage/budget", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Name          string   `json:"name"`
			Scope         string   `json:"scope"`
			AgentID       *string  `json:"agentId"`
			TaskID        *string  `json:"taskId"`
			Dimension     string   `json:"dimension"`
			WarnThreshold *float64 `json:"warnThreshold"`
			OverThreshold *float64 `json:"overThreshold"`
			Period        string   `json:"period"`
			Enabled       *bool    `json:"enabled"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
			return
		}
		if body.Name == "" || body.Dimension == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "name and dimension are required"})
			return
		}
		if !validDimension[body.Dimension] {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Invalid dimension"})
			return
		}
		period := body.Period
		if period == "" {
			period = defaultPeriod
		}
		if !validPeriod[period] {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Invalid period"})
			return
		}
		enabled := true
		if body.Enabled != nil {
			enabled = *body.Enabled
		}
		now := time.Now().UTC().Format(time.RFC3339)
		rule := localstore.BudgetRule{
			ID:            "br-" + randomID(6),
			Name:          body.Name,
			Scope:         defaultString(body.Scope, "global"),
			AgentID:       body.AgentID,
			TaskID:        body.TaskID,
			Dimension:     body.Dimension,
			WarnThreshold: body.WarnThreshold,
			OverThreshold: body.OverThreshold,
			Period:        period,
			Enabled:       enabled,
			CreatedAt:     now,
			UpdatedAt:     now,
		}
		localstore.GetBudgetRuleStore().Append(rule)
		writeJSON(w, http.StatusCreated, rule)
	})

	mux.MethodFunc("PATCH", "/usage/budget/{ruleId}", func(w http.ResponseWriter, r *http.Request) {
		ruleID := chi.URLParam(r, "ruleId")
		store := localstore.GetBudgetRuleStore()
		if _, ok := store.Find(func(item localstore.BudgetRule) bool { return item.ID == ruleID }); !ok {
			writeJSON(w, http.StatusNotFound, map[string]any{"error": "Rule not found"})
			return
		}
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
			return
		}
		if dimension, ok := body["dimension"].(string); ok && !validDimension[dimension] {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Invalid dimension"})
			return
		}
		if period, ok := body["period"].(string); ok && !validPeriod[period] {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Invalid period"})
			return
		}
		if len(body) == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "No fields to update"})
			return
		}
		store.UpdateItem(func(item localstore.BudgetRule) bool { return item.ID == ruleID }, func(item localstore.BudgetRule) localstore.BudgetRule {
			item.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
			if value, ok := body["name"].(string); ok {
				item.Name = value
			}
			if value, ok := body["scope"].(string); ok {
				item.Scope = value
			}
			if value, ok := body["agentId"].(string); ok {
				item.AgentID = &value
			} else if body["agentId"] == nil {
				item.AgentID = nil
			}
			if value, ok := body["taskId"].(string); ok {
				item.TaskID = &value
			} else if body["taskId"] == nil {
				item.TaskID = nil
			}
			if value, ok := body["dimension"].(string); ok {
				item.Dimension = value
			}
			if value, ok := body["warnThreshold"].(float64); ok {
				item.WarnThreshold = &value
			} else if body["warnThreshold"] == nil {
				item.WarnThreshold = nil
			}
			if value, ok := body["overThreshold"].(float64); ok {
				item.OverThreshold = &value
			} else if body["overThreshold"] == nil {
				item.OverThreshold = nil
			}
			if value, ok := body["period"].(string); ok {
				item.Period = value
			}
			if value, ok := body["enabled"].(bool); ok {
				item.Enabled = value
			}
			return item
		})
		updated, _ := store.Find(func(item localstore.BudgetRule) bool { return item.ID == ruleID })
		writeJSON(w, http.StatusOK, updated)
	})

	mux.MethodFunc("DELETE", "/usage/budget/{ruleId}", func(w http.ResponseWriter, r *http.Request) {
		ruleID := chi.URLParam(r, "ruleId")
		removed := localstore.GetBudgetRuleStore().RemoveWhere(func(item localstore.BudgetRule) bool { return item.ID == ruleID })
		if removed == 0 {
			writeJSON(w, http.StatusNotFound, map[string]any{"error": "Rule not found"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
	})

	mux.MethodFunc("GET", "/usage/budget/evaluate", func(w http.ResponseWriter, r *http.Request) {
		rules := localstore.GetBudgetRuleStore().All()
		enabledRules := make([]localstore.BudgetRule, 0, len(rules))
		for _, rule := range rules {
			if rule.Enabled {
				enabledRules = append(enabledRules, rule)
			}
		}
		if len(enabledRules) == 0 {
			writeJSON(w, http.StatusOK, map[string]any{"evaluations": []any{}})
			return
		}
		payload, err := adapter.UsageCost(r.Context(), map[string]any{"days": 30})
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"error": "Failed to fetch usage data"})
			return
		}
		record, _ := payload.(map[string]any)
		totals, _ := record["totals"].(map[string]any)
		values := map[string]float64{
			"tokensIn":    coerce.Number(totals["input"]),
			"tokensOut":   coerce.Number(totals["output"]),
			"totalTokens": coerce.Number(totals["totalTokens"]),
			"cost":        coerce.Number(totals["totalCost"]),
		}
		evaluations := make([]map[string]any, 0, len(enabledRules))
		for _, rule := range enabledRules {
			currentValue := values[rule.Dimension]
			status := "ok"
			if rule.OverThreshold != nil && currentValue >= *rule.OverThreshold {
				status = "over"
			} else if rule.WarnThreshold != nil && currentValue >= *rule.WarnThreshold {
				status = "warn"
			}
			evaluation := map[string]any{
				"ruleId":        rule.ID,
				"ruleName":      rule.Name,
				"dimension":     rule.Dimension,
				"status":        status,
				"currentValue":  currentValue,
				"warnThreshold": rule.WarnThreshold,
				"overThreshold": rule.OverThreshold,
			}
			if status == "warn" || status == "over" {
				raw, _ := json.Marshal(evaluation)
				bus.Publish("budget."+status, raw)
			}
			evaluations = append(evaluations, evaluation)
		}
		writeJSON(w, http.StatusOK, map[string]any{"evaluations": evaluations})
	})
}

func defaultString(value string, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}
