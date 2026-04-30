package views

import (
	"context"
	"encoding/json"
	"sort"
	"strings"
)

var tierOrder = []string{"peer", "peer.parent", "guild+roles", "guild", "team", "account", "channel"}

func (r *Registry) RoutingList(ctx context.Context, params any) (any, error) {
	results, err := r.callBatch(ctx, "deck.routing.list", []batchCall{
		{id: "config", method: "config.get", params: map[string]any{}},
		{id: "agents", method: "agents.list", params: map[string]any{}},
	})
	if err != nil {
		return nil, err
	}
	config := configPayload(results["config"])
	_, defaultAgentID := agentNamesByID(results["agents"])
	p := paramsMap(params)

	bindingsRaw := asSlice(config["bindings"])
	enriched := make([]map[string]any, 0, len(bindingsRaw))
	for _, raw := range bindingsRaw {
		binding := asMap(raw)
		match := asMap(binding["match"])
		if match == nil {
			continue
		}
		agentID := asString(binding["agentId"])
		if filter := asString(p["agentId"]); filter != "" && agentID != filter {
			continue
		}
		if filter := asString(p["channel"]); filter != "" && asString(match["channel"]) != filter {
			continue
		}
		if filter := asString(p["accountId"]); filter != "" && asString(match["accountId"]) != filter {
			continue
		}
		entry := map[string]any{
			"id":      computeBindingID(match),
			"agentId": agentID,
			"tier":    classifyBindingTier(match),
			"match":   match,
		}
		if comment := asString(binding["comment"]); comment != "" {
			entry["comment"] = comment
		}
		enriched = append(enriched, entry)
	}
	sort.SliceStable(enriched, func(i, j int) bool {
		return tierRank(asString(enriched[i]["tier"])) < tierRank(asString(enriched[j]["tier"]))
	})

	dmScope := "main"
	if session := asMap(config["session"]); session != nil {
		if value := asString(session["dmScope"]); value != "" {
			dmScope = value
		}
	}

	return map[string]any{
		"bindings":       enriched,
		"defaultAgentId": defaultAgentID,
		"dmScope":        dmScope,
		"configHash":     computeConfigHash(bindingsRaw),
	}, nil
}

func classifyBindingTier(match map[string]any) string {
	if peer := asMap(match["peer"]); asString(peer["id"]) != "" {
		return "peer"
	}
	if asString(match["guildId"]) != "" {
		if roles := asSlice(match["roles"]); len(roles) > 0 {
			return "guild+roles"
		}
		return "guild"
	}
	if asString(match["teamId"]) != "" {
		return "team"
	}
	accountID := asString(match["accountId"])
	if accountID != "" && accountID != "*" {
		return "account"
	}
	return "channel"
}

func tierRank(tier string) int {
	for index, candidate := range tierOrder {
		if candidate == tier {
			return index
		}
	}
	return len(tierOrder)
}

func computeBindingID(match map[string]any) string {
	normalized := normalizeBindingMatchForHash(match)
	raw, _ := json.Marshal(normalized)
	return firstNHexSHA256(raw, 12)
}

func normalizeBindingMatchForHash(match map[string]any) map[string]any {
	out := map[string]any{}
	for _, key := range sortedMapKeys(match) {
		value := match[key]
		if value == nil {
			continue
		}
		switch typed := value.(type) {
		case string:
			out[key] = strings.ToLower(strings.TrimSpace(typed))
		case map[string]any:
			out[key] = normalizeBindingMatchForHash(typed)
		case []any:
			items := make([]any, 0, len(typed))
			for _, item := range typed {
				if text, ok := item.(string); ok {
					items = append(items, strings.ToLower(strings.TrimSpace(text)))
				} else {
					items = append(items, item)
				}
			}
			sort.Slice(items, func(i, j int) bool {
				return strings.Compare(toSortString(items[i]), toSortString(items[j])) < 0
			})
			out[key] = items
		default:
			out[key] = value
		}
	}
	return out
}

func toSortString(value any) string {
	raw, err := json.Marshal(value)
	if err != nil {
		return ""
	}
	return string(raw)
}

func computeConfigHash(bindings []any) string {
	raw, _ := json.Marshal(bindings)
	return firstNHexSHA256(raw, 16)
}
