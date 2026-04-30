package views

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway/generated"
)

func TestRegistryDispatchProjectsRoutingFromNonC3BatchCalls(t *testing.T) {
	t.Setenv("DECK_GO_BFF_VIEW_LAYER", "1")
	var got generated.GatewayBatchParams
	registry := NewRegistry(
		func(_ context.Context, params generated.GatewayBatchParams) (generated.GatewayBatchResult, error) {
			got = params
			return batchResult(t, `{"results":[
				{"id":"config","ok":true,"result":{"hash":"cfg-hash","config":{"bindings":[{"agentId":"main","match":{"channel":"discord"}}],"session":{"dmScope":"per-peer"}}}},
				{"id":"agents","ok":true,"result":{"defaultId":"main","agents":[{"id":"main","name":"Main"}]}}
			]}`), nil
		},
		nil,
	)

	payload, handled, err := registry.Dispatch(context.Background(), "deck.routing.list", map[string]any{"channel": "discord"})
	if err != nil {
		t.Fatal(err)
	}
	if !handled {
		t.Fatal("expected registry to handle C3 view")
	}
	if len(got.Calls) != 2 || got.Calls[0].Method != "config.get" || got.Calls[1].Method != "agents.list" {
		t.Fatalf("expected one outbound batch with non-C3 sub-calls, got %#v", got)
	}
	result := payload.(map[string]any)
	if result["dmScope"] != "per-peer" {
		t.Fatalf("unexpected payload: %#v", payload)
	}
	bindings := result["bindings"].([]map[string]any)
	if len(bindings) != 1 || bindings[0]["agentId"] != "main" {
		t.Fatalf("unexpected bindings: %#v", bindings)
	}
}

func TestRegistryDispatchProjectsSubagentsFromStateAndBatch(t *testing.T) {
	t.Setenv("DECK_GO_BFF_VIEW_LAYER", "1")
	stateDir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(stateDir, "subagents"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(
		filepath.Join(stateDir, "subagents", "runs.json"),
		[]byte(`{"version":2,"runs":{"run-1":{"runId":"run-1","childSessionKey":"agent:coder:subagent:child","requesterSessionKey":"agent:main:root","task":"work","createdAt":20,"startedAt":25,"model":"sonnet-4.6"}}}`),
		0o644,
	); err != nil {
		t.Fatal(err)
	}
	var got generated.GatewayBatchParams
	registry := NewRegistry(
		func(_ context.Context, params generated.GatewayBatchParams) (generated.GatewayBatchResult, error) {
			got = params
			return batchResult(t, `{"results":[
				{"id":"config","ok":true,"result":{"config":{}}},
				{"id":"agents","ok":true,"result":{"defaultId":"main","agents":[{"id":"coder","name":"Coder"},{"id":"main","name":"Main"}]}}
			]}`), nil
		},
		nil,
		WithStateDir(stateDir),
	)

	payload, handled, err := registry.Dispatch(context.Background(), "deck.subagents.list", map[string]any{"status": "active"})
	if err != nil {
		t.Fatal(err)
	}
	if !handled {
		t.Fatal("expected registry to handle C3 view")
	}
	if len(got.Calls) != 2 || got.Calls[0].Method != "config.get" || got.Calls[1].Method != "agents.list" {
		t.Fatalf("expected one outbound batch with non-C3 sub-calls, got %#v", got)
	}
	runs := payload.(map[string]any)["runs"].([]map[string]any)
	if len(runs) != 1 || runs[0]["childAgentName"] != "Coder" {
		t.Fatalf("unexpected runs: %#v", runs)
	}
}

func TestRegistryDispatchFallsBackUnlessDisabled(t *testing.T) {
	t.Setenv("DECK_GO_BFF_VIEW_LAYER", "1")
	registry := NewRegistry(
		func(context.Context, generated.GatewayBatchParams) (generated.GatewayBatchResult, error) {
			return generated.GatewayBatchResult{}, errors.New("boom")
		},
		func(_ context.Context, method string, params any) (any, error) {
			return map[string]any{"method": method, "params": params}, nil
		},
	)

	payload, handled, err := registry.Dispatch(context.Background(), "deck.identity.list", map[string]any{})
	if err != nil {
		t.Fatal(err)
	}
	if !handled || payload.(map[string]any)["method"] != "deck.identity.list" {
		t.Fatalf("unexpected fallback payload: handled=%v payload=%#v", handled, payload)
	}
	if registry.FallbackRate("deck.identity.list") != 1 {
		t.Fatalf("unexpected fallback rate: %v", registry.FallbackRate("deck.identity.list"))
	}

	t.Setenv("DECK_GO_BFF_VIEW_FALLBACK", "0")
	_, handled, err = registry.Dispatch(context.Background(), "deck.identity.list", map[string]any{})
	if !handled || err == nil {
		t.Fatalf("expected disabled fallback to return BFF error, handled=%v err=%v", handled, err)
	}
}

func TestRegistryIgnoresDisabledOrNonC3Methods(t *testing.T) {
	t.Setenv("DECK_GO_BFF_VIEW_LAYER", "0")
	registry := NewRegistry(nil, nil)
	if _, handled, err := registry.Dispatch(context.Background(), "deck.routing.list", nil); handled || err != nil {
		t.Fatalf("expected disabled registry to ignore method, handled=%v err=%v", handled, err)
	}
	t.Setenv("DECK_GO_BFF_VIEW_LAYER", "1")
	if _, handled, err := registry.Dispatch(context.Background(), "models.configured", nil); handled || err != nil {
		t.Fatalf("expected non-C3 method to be ignored, handled=%v err=%v", handled, err)
	}
}

func batchResult(t *testing.T, raw string) generated.GatewayBatchResult {
	t.Helper()
	var result generated.GatewayBatchResult
	if err := json.Unmarshal([]byte(raw), &result); err != nil {
		t.Fatal(err)
	}
	return result
}
