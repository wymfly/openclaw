package views

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
)

var threadBindingChannels = map[string]struct{}{"discord": {}}

type persistedThreadBindings struct {
	Version  int                               `json:"version"`
	Bindings map[string]persistedThreadBinding `json:"bindings"`
}

type persistedThreadBinding struct {
	AccountID        string  `json:"accountId"`
	ChannelID        string  `json:"channelId"`
	ThreadID         string  `json:"threadId"`
	TargetKind       string  `json:"targetKind"`
	TargetSessionKey string  `json:"targetSessionKey"`
	AgentID          string  `json:"agentId"`
	BoundBy          string  `json:"boundBy"`
	BoundAt          float64 `json:"boundAt"`
	LastActivityAt   float64 `json:"lastActivityAt"`
	Label            string  `json:"label,omitempty"`
}

func (r *Registry) ThreadsList(ctx context.Context, params any) (any, error) {
	_, err := r.callBatch(ctx, "deck.threads.list", []batchCall{
		{id: "config", method: "config.get", params: map[string]any{}},
	})
	if err != nil {
		return nil, err
	}
	p := paramsMap(params)
	channel := asString(p["channel"])
	if channel != "" {
		if _, ok := threadBindingChannels[channel]; !ok {
			return map[string]any{"threads": []map[string]any{}}, nil
		}
	}
	agentID := asString(p["agentId"])
	status := asString(p["status"])

	bindings, err := r.loadThreadBindings()
	if err != nil {
		return nil, err
	}
	threads := make([]map[string]any, 0, len(bindings))
	for _, binding := range bindings {
		if agentID != "" && binding.AgentID != agentID {
			continue
		}
		if status != "" && status != "all" && status != "active" {
			continue
		}
		entry := map[string]any{
			"threadId":         binding.ThreadID,
			"channelId":        binding.ChannelID,
			"agentId":          binding.AgentID,
			"targetSessionKey": binding.TargetSessionKey,
			"targetKind":       binding.TargetKind,
			"boundAt":          binding.BoundAt,
			"lastActivityAt":   binding.LastActivityAt,
			"accountId":        binding.AccountID,
			"boundBy":          binding.BoundBy,
		}
		if binding.Label != "" {
			entry["label"] = binding.Label
		}
		threads = append(threads, entry)
	}
	return map[string]any{"threads": threads}, nil
}

func (r *Registry) loadThreadBindings() ([]persistedThreadBinding, error) {
	pathname := filepath.Join(resolveStateDir(r.stateDir), "discord", "thread-bindings.json")
	raw, err := os.ReadFile(pathname)
	if err != nil {
		if os.IsNotExist(err) {
			return []persistedThreadBinding{}, nil
		}
		return nil, err
	}
	var payload persistedThreadBindings
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, err
	}
	if payload.Version != 1 || payload.Bindings == nil {
		return []persistedThreadBinding{}, nil
	}
	out := make([]persistedThreadBinding, 0, len(payload.Bindings))
	for _, binding := range payload.Bindings {
		if binding.ThreadID == "" {
			continue
		}
		out = append(out, binding)
	}
	return out, nil
}
