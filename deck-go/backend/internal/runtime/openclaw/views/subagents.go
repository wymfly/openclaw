package views

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

const maxLineageNodes = 50

type persistedSubagentRegistry struct {
	Version int                          `json:"version"`
	Runs    map[string]subagentRunRecord `json:"runs"`
}

type subagentRunRecord struct {
	RunID               string  `json:"runId"`
	ChildSessionKey     string  `json:"childSessionKey"`
	RequesterSessionKey string  `json:"requesterSessionKey"`
	Task                string  `json:"task,omitempty"`
	Label               string  `json:"label,omitempty"`
	Model               string  `json:"model,omitempty"`
	SpawnMode           string  `json:"spawnMode,omitempty"`
	CreatedAt           float64 `json:"createdAt"`
	StartedAt           float64 `json:"startedAt,omitempty"`
	EndedAt             float64 `json:"endedAt,omitempty"`
	Outcome             any     `json:"outcome,omitempty"`
}

func (r *Registry) SubagentsList(ctx context.Context, params any) (any, error) {
	results, err := r.callBatch(ctx, "deck.subagents.list", []batchCall{
		{id: "config", method: "config.get", params: map[string]any{}},
		{id: "agents", method: "agents.list", params: map[string]any{}},
	})
	if err != nil {
		return nil, err
	}
	names, _ := agentNamesByID(results["agents"])
	runs, err := r.loadSubagentRuns()
	if err != nil {
		return nil, err
	}
	p := paramsMap(params)
	statusFilter := asString(p["status"])
	if statusFilter == "" {
		statusFilter = "all"
	}
	agentIDFilter := strings.ToLower(strings.TrimSpace(asString(p["agentId"])))
	requesterAgentIDFilter := strings.ToLower(strings.TrimSpace(asString(p["requesterAgentId"])))
	limit := intParam(p, "limit", 50)
	offset := intParam(p, "offset", 0)

	filtered := make([]subagentRunRecord, 0, len(runs))
	for _, run := range runs {
		status := deriveSubagentStatus(run)
		if statusFilter != "all" && status != statusFilter {
			continue
		}
		childAgentID := resolveAgentIDFromSessionKey(run.ChildSessionKey)
		if agentIDFilter != "" && childAgentID != agentIDFilter {
			continue
		}
		requesterAgentID := resolveAgentIDFromSessionKey(run.RequesterSessionKey)
		if requesterAgentIDFilter != "" && requesterAgentID != requesterAgentIDFilter {
			continue
		}
		filtered = append(filtered, run)
	}
	sort.SliceStable(filtered, func(i, j int) bool {
		return filtered[i].CreatedAt > filtered[j].CreatedAt
	})
	total := len(filtered)
	if offset > total {
		offset = total
	}
	end := offset + limit
	if end > total {
		end = total
	}

	out := make([]map[string]any, 0, end-offset)
	for _, run := range filtered[offset:end] {
		out = append(out, projectSubagentRun(run, names))
	}
	return map[string]any{"runs": out, "total": total}, nil
}

func (r *Registry) SubagentsLineage(ctx context.Context, params any) (any, error) {
	results, err := r.callBatch(ctx, "deck.subagents.lineage", []batchCall{
		{id: "config", method: "config.get", params: map[string]any{}},
		{id: "agents", method: "agents.list", params: map[string]any{}},
	})
	if err != nil {
		return nil, err
	}
	names, _ := agentNamesByID(results["agents"])
	runs, err := r.loadSubagentRuns()
	if err != nil {
		return nil, err
	}
	p := paramsMap(params)
	runID := asString(p["runId"])
	sessionKey := asString(p["sessionKey"])
	if runID == "" && sessionKey == "" {
		return nil, fmt.Errorf("either runId or sessionKey is required")
	}

	startSessionKey := sessionKey
	if runID != "" {
		if run, ok := runs[runID]; ok {
			startSessionKey = run.ChildSessionKey
		}
	}
	if startSessionKey == "" {
		return nil, fmt.Errorf("run or session not found")
	}

	rootSessionKey := startSessionKey
	upVisited := map[string]struct{}{rootSessionKey: {}}
	for {
		parentRun, ok := findRunByChildSessionKey(runs, rootSessionKey)
		if !ok {
			break
		}
		nextKey := parentRun.RequesterSessionKey
		if _, seen := upVisited[nextKey]; seen {
			break
		}
		upVisited[nextKey] = struct{}{}
		rootSessionKey = nextKey
	}

	descendants := make([]subagentRunRecord, 0)
	depthBySessionKey := map[string]int{rootSessionKey: 0}
	queue := []string{rootSessionKey}
	downVisited := map[string]struct{}{rootSessionKey: {}}
	orderedRuns := runsSortedByCreatedAt(runs, false)
	for i := 0; i < len(queue) && len(descendants) < maxLineageNodes; i++ {
		current := queue[i]
		currentDepth := depthBySessionKey[current]
		for _, run := range orderedRuns {
			if run.RequesterSessionKey != current {
				continue
			}
			descendants = append(descendants, run)
			childDepth := currentDepth + 1
			depthBySessionKey[run.ChildSessionKey] = childDepth
			if len(descendants) >= maxLineageNodes {
				break
			}
			if _, seen := downVisited[run.ChildSessionKey]; !seen {
				downVisited[run.ChildSessionKey] = struct{}{}
				queue = append(queue, run.ChildSessionKey)
			}
		}
	}

	nodes := make([]map[string]any, 0, len(descendants))
	for _, run := range descendants {
		agentID := resolveAgentIDFromSessionKey(run.ChildSessionKey)
		node := map[string]any{
			"runId":       run.RunID,
			"sessionKey":  run.ChildSessionKey,
			"agentId":     agentID,
			"task":        run.Task,
			"depth":       depthBySessionKey[run.ChildSessionKey],
			"parentRunId": parentRunID(runs, run.RequesterSessionKey),
			"status":      deriveSubagentStatus(run),
		}
		if name := names[agentID]; name != "" {
			node["agentName"] = name
		}
		if duration, ok := computeDurationMs(run); ok {
			node["durationMs"] = duration
		}
		nodes = append(nodes, node)
	}
	rootAgentID := resolveAgentIDFromSessionKey(rootSessionKey)
	root := map[string]any{
		"sessionKey": rootSessionKey,
		"agentId":    rootAgentID,
	}
	if name := names[rootAgentID]; name != "" {
		root["agentName"] = name
	}
	return map[string]any{"root": root, "nodes": nodes}, nil
}

func (r *Registry) loadSubagentRuns() (map[string]subagentRunRecord, error) {
	pathname := filepath.Join(resolveStateDir(r.stateDir), "subagents", "runs.json")
	raw, err := os.ReadFile(pathname)
	if err != nil {
		if os.IsNotExist(err) {
			return map[string]subagentRunRecord{}, nil
		}
		return nil, err
	}
	var registry persistedSubagentRegistry
	if err := json.Unmarshal(raw, &registry); err != nil {
		return nil, err
	}
	if registry.Version != 1 && registry.Version != 2 {
		return map[string]subagentRunRecord{}, nil
	}
	if registry.Runs == nil {
		return map[string]subagentRunRecord{}, nil
	}
	return registry.Runs, nil
}

func projectSubagentRun(run subagentRunRecord, names map[string]string) map[string]any {
	childAgentID := resolveAgentIDFromSessionKey(run.ChildSessionKey)
	requesterAgentID := resolveAgentIDFromSessionKey(run.RequesterSessionKey)
	out := map[string]any{
		"runId":               run.RunID,
		"childSessionKey":     run.ChildSessionKey,
		"childAgentId":        childAgentID,
		"requesterSessionKey": run.RequesterSessionKey,
		"requesterAgentId":    requesterAgentID,
		"task":                run.Task,
		"spawnMode":           spawnMode(run),
		"depth":               getSubagentDepth(run.ChildSessionKey),
		"createdAt":           run.CreatedAt,
		"status":              deriveSubagentStatus(run),
	}
	if name := names[childAgentID]; name != "" {
		out["childAgentName"] = name
	}
	if name := names[requesterAgentID]; name != "" {
		out["requesterAgentName"] = name
	}
	if run.Label != "" {
		out["label"] = run.Label
	}
	if run.Model != "" {
		out["model"] = run.Model
	}
	if run.StartedAt > 0 {
		out["startedAt"] = run.StartedAt
	}
	if run.EndedAt > 0 {
		out["endedAt"] = run.EndedAt
	}
	if duration, ok := computeDurationMs(run); ok {
		out["durationMs"] = duration
	}
	if run.Outcome != nil {
		out["outcome"] = run.Outcome
	}
	return out
}

func deriveSubagentStatus(run subagentRunRecord) string {
	if run.EndedAt <= 0 {
		return "active"
	}
	outcome := asMap(run.Outcome)
	switch asString(outcome["status"]) {
	case "timeout":
		return "timeout"
	case "error":
		return "failed"
	default:
		return "completed"
	}
}

func computeDurationMs(run subagentRunRecord) (float64, bool) {
	if run.EndedAt <= 0 {
		return 0, false
	}
	start := run.StartedAt
	if start <= 0 {
		start = run.CreatedAt
	}
	duration := run.EndedAt - start
	if duration < 0 {
		duration = 0
	}
	return duration, true
}

func spawnMode(run subagentRunRecord) string {
	if strings.TrimSpace(run.SpawnMode) == "" {
		return "run"
	}
	return run.SpawnMode
}

func intParam(params map[string]any, key string, fallback int) int {
	value, ok := asFloat(params[key])
	if !ok {
		return fallback
	}
	if value < 0 {
		return fallback
	}
	return int(value)
}

func resolveAgentIDFromSessionKey(sessionKey string) string {
	parts := make([]string, 0)
	for _, part := range strings.Split(strings.ToLower(strings.TrimSpace(sessionKey)), ":") {
		if part != "" {
			parts = append(parts, part)
		}
	}
	if len(parts) >= 3 && parts[0] == "agent" && parts[1] != "" {
		return parts[1]
	}
	return "main"
}

func getSubagentDepth(sessionKey string) int {
	return strings.Count(strings.ToLower(strings.TrimSpace(sessionKey)), ":subagent:")
}

func findRunByChildSessionKey(runs map[string]subagentRunRecord, sessionKey string) (subagentRunRecord, bool) {
	var selected subagentRunRecord
	ok := false
	for _, run := range runs {
		if run.ChildSessionKey != sessionKey {
			continue
		}
		if !ok || run.CreatedAt > selected.CreatedAt {
			selected = run
			ok = true
		}
	}
	return selected, ok
}

func parentRunID(runs map[string]subagentRunRecord, requesterSessionKey string) any {
	for _, run := range runs {
		if run.ChildSessionKey == requesterSessionKey {
			return run.RunID
		}
	}
	return nil
}

func runsSortedByCreatedAt(runs map[string]subagentRunRecord, descending bool) []subagentRunRecord {
	out := make([]subagentRunRecord, 0, len(runs))
	for _, run := range runs {
		out = append(out, run)
	}
	sort.SliceStable(out, func(i, j int) bool {
		if descending {
			return out[i].CreatedAt > out[j].CreatedAt
		}
		return out[i].CreatedAt < out[j].CreatedAt
	})
	return out
}
