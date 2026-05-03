package openclaw

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/localstore"
	runtimecoerce "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/coerce"
)

type BudgetCreateInput struct {
	Name          string
	Scope         string
	AgentID       *string
	TaskID        *string
	Dimension     string
	WarnThreshold *float64
	OverThreshold *float64
	Period        string
	Enabled       *bool
}

type BudgetPatchInput struct {
	Name          *string
	Scope         *string
	AgentID       *string
	TaskID        *string
	Dimension     *string
	WarnThreshold *float64
	OverThreshold *float64
	Period        *string
	Enabled       *bool
}

func (m *ManagedRuntime) ListBudgetRules(ctx context.Context) (map[string]any, error) {
	return map[string]any{"rules": localstore.GetBudgetRuleStore().All()}, nil
}

func (m *ManagedRuntime) CreateBudgetRule(ctx context.Context, input BudgetCreateInput) (any, int, error) {
	const defaultPeriod = "monthly"
	validDimension := map[string]bool{"tokensIn": true, "tokensOut": true, "totalTokens": true, "cost": true}
	validPeriod := map[string]bool{"daily": true, "weekly": true, "monthly": true}
	if input.Name == "" || input.Dimension == "" {
		return map[string]any{"error": "name and dimension are required"}, http.StatusBadRequest, nil
	}
	if !validDimension[input.Dimension] {
		return map[string]any{"error": "Invalid dimension"}, http.StatusBadRequest, nil
	}
	period := input.Period
	if period == "" {
		period = defaultPeriod
	}
	if !validPeriod[period] {
		return map[string]any{"error": "Invalid period"}, http.StatusBadRequest, nil
	}
	enabled := true
	if input.Enabled != nil {
		enabled = *input.Enabled
	}
	now := time.Now().UTC().Format(time.RFC3339)
	rule := localstore.BudgetRule{
		ID:            "br-" + randomHexID(6),
		Name:          input.Name,
		Scope:         defaultString(input.Scope, "global"),
		AgentID:       input.AgentID,
		TaskID:        input.TaskID,
		Dimension:     input.Dimension,
		WarnThreshold: input.WarnThreshold,
		OverThreshold: input.OverThreshold,
		Period:        period,
		Enabled:       enabled,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	localstore.GetBudgetRuleStore().Append(rule)
	return budgetRuleToMap(rule), http.StatusCreated, nil
}

func (m *ManagedRuntime) UpdateBudgetRule(ctx context.Context, ruleID string, patch BudgetPatchInput) (any, bool, int, error) {
	validDimension := map[string]bool{"tokensIn": true, "tokensOut": true, "totalTokens": true, "cost": true}
	validPeriod := map[string]bool{"daily": true, "weekly": true, "monthly": true}
	store := localstore.GetBudgetRuleStore()
	if _, ok := store.Find(func(item localstore.BudgetRule) bool { return item.ID == ruleID }); !ok {
		return nil, false, 0, nil
	}
	if patch.Dimension != nil && !validDimension[*patch.Dimension] {
		return map[string]any{"error": "Invalid dimension"}, true, http.StatusBadRequest, nil
	}
	if patch.Period != nil && !validPeriod[*patch.Period] {
		return map[string]any{"error": "Invalid period"}, true, http.StatusBadRequest, nil
	}
	if patch.Name == nil && patch.Scope == nil && patch.AgentID == nil && patch.TaskID == nil && patch.Dimension == nil && patch.WarnThreshold == nil && patch.OverThreshold == nil && patch.Period == nil && patch.Enabled == nil {
		return map[string]any{"error": "No fields to update"}, true, http.StatusBadRequest, nil
	}
	store.UpdateItem(func(item localstore.BudgetRule) bool { return item.ID == ruleID }, func(item localstore.BudgetRule) localstore.BudgetRule {
		item.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
		if patch.Name != nil {
			item.Name = *patch.Name
		}
		if patch.Scope != nil {
			item.Scope = *patch.Scope
		}
		if patch.AgentID != nil {
			item.AgentID = patch.AgentID
		}
		if patch.TaskID != nil {
			item.TaskID = patch.TaskID
		}
		if patch.Dimension != nil {
			item.Dimension = *patch.Dimension
		}
		if patch.WarnThreshold != nil {
			item.WarnThreshold = patch.WarnThreshold
		}
		if patch.OverThreshold != nil {
			item.OverThreshold = patch.OverThreshold
		}
		if patch.Period != nil {
			item.Period = *patch.Period
		}
		if patch.Enabled != nil {
			item.Enabled = *patch.Enabled
		}
		return item
	})
	updated, _ := store.Find(func(item localstore.BudgetRule) bool { return item.ID == ruleID })
	return budgetRuleToMap(updated), true, http.StatusOK, nil
}

func (m *ManagedRuntime) DeleteBudgetRule(ctx context.Context, ruleID string) (bool, error) {
	removed := localstore.GetBudgetRuleStore().RemoveWhere(func(item localstore.BudgetRule) bool { return item.ID == ruleID })
	return removed > 0, nil
}

func (m *ManagedRuntime) EvaluateBudgetRules(ctx context.Context) (any, int, error) {
	rules := localstore.GetBudgetRuleStore().All()
	enabledRules := make([]localstore.BudgetRule, 0, len(rules))
	for _, rule := range rules {
		if rule.Enabled {
			enabledRules = append(enabledRules, rule)
		}
	}
	if len(enabledRules) == 0 {
		return map[string]any{"evaluations": []any{}}, http.StatusOK, nil
	}
	payload, err := m.UsageCost(ctx, map[string]any{"days": 30})
	if err != nil {
		return map[string]any{"error": "Failed to fetch usage data"}, http.StatusBadGateway, nil
	}
	values := budgetUsageValues(payload)
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
		if m.bus != nil && (status == "warn" || status == "over") {
			raw, _ := json.Marshal(evaluation)
			m.bus.Publish("budget."+status, raw)
		}
		evaluations = append(evaluations, evaluation)
	}
	return map[string]any{"evaluations": evaluations}, http.StatusOK, nil
}

func budgetUsageValues(payload any) map[string]float64 {
	record, _ := payload.(map[string]any)
	if record == nil && payload != nil {
		raw, err := json.Marshal(payload)
		if err == nil {
			_ = json.Unmarshal(raw, &record)
		}
	}
	totals, _ := record["totals"].(map[string]any)
	return map[string]float64{
		"tokensIn":    runtimecoerce.Number(totals["input"]),
		"tokensOut":   runtimecoerce.Number(totals["output"]),
		"totalTokens": runtimecoerce.Number(totals["totalTokens"]),
		"cost":        runtimecoerce.Number(totals["totalCost"]),
	}
}

func budgetRuleToMap(rule localstore.BudgetRule) map[string]any {
	return map[string]any{
		"id":            rule.ID,
		"name":          rule.Name,
		"scope":         rule.Scope,
		"agentId":       rule.AgentID,
		"taskId":        rule.TaskID,
		"dimension":     rule.Dimension,
		"warnThreshold": rule.WarnThreshold,
		"overThreshold": rule.OverThreshold,
		"period":        rule.Period,
		"enabled":       rule.Enabled,
		"createdAt":     rule.CreatedAt,
		"updatedAt":     rule.UpdatedAt,
	}
}

func defaultString(value string, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}
