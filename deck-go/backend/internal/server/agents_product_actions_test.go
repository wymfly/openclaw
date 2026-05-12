package server

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
)

type fakeAgentsProductSurface struct {
	hash          string
	config        map[string]any
	calls         []string
	patches       []map[string]any
	patchBaseHash []string
	updateBodies  []map[string]any
	impactPreview map[string]any
}

func newFakeAgentsProductSurface() *fakeAgentsProductSurface {
	return &fakeAgentsProductSurface{
		hash: "hash-1",
		config: map[string]any{
			"agents": map[string]any{
				"defaults": map[string]any{
					"thinkingDefault": "low",
					"workspace":       "/tmp/default-workspace",
				},
				"list": []any{map[string]any{
					"id":              "main",
					"name":            "Main",
					"workspace":       "/tmp/main",
					"thinkingDefault": "medium",
					"tools":           map[string]any{"mode": "override"},
				}},
			},
		},
		impactPreview: map[string]any{"agentId": "main", "operation": "edit-workspace"},
	}
}

func (s *fakeAgentsProductSurface) ConfigGet(_ context.Context) (any, error) {
	s.calls = append(s.calls, "config.get")
	return map[string]any{"hash": s.hash, "config": cloneConfigMap(s.config)}, nil
}

func (s *fakeAgentsProductSurface) ConfigPatch(_ context.Context, raw string, baseHash string, _ string) (any, error) {
	s.calls = append(s.calls, "config.patch")
	if baseHash != s.hash {
		return nil, errors.New("base hash conflict")
	}
	var patch map[string]any
	if err := json.Unmarshal([]byte(raw), &patch); err != nil {
		return nil, err
	}
	s.patches = append(s.patches, patch)
	s.patchBaseHash = append(s.patchBaseHash, baseHash)
	s.hash = "hash-next"
	return map[string]any{"ok": true, "hash": s.hash}, nil
}

func (s *fakeAgentsProductSurface) ConfigApply(_ context.Context, raw string, baseHash string) (any, error) {
	s.calls = append(s.calls, "config.apply")
	if baseHash != s.hash {
		return nil, errors.New("base hash conflict")
	}
	var next map[string]any
	if err := json.Unmarshal([]byte(raw), &next); err != nil {
		return nil, err
	}
	s.config = next
	s.hash = "hash-next"
	return map[string]any{"ok": true, "hash": s.hash}, nil
}

func (s *fakeAgentsProductSurface) AgentsUpdate(_ context.Context, body map[string]any) (deckapi.DeckGoAgentMutationResponse, error) {
	s.calls = append(s.calls, "agents.update")
	s.updateBodies = append(s.updateBodies, body)
	s.hash = "hash-workspace"
	return deckapi.DeckGoAgentMutationResponse{Ok: true, Id: stringFromMap(body, "agentId")}, nil
}

func (s *fakeAgentsProductSurface) DeckAgentsDetail(_ context.Context, agentID string) (any, error) {
	s.calls = append(s.calls, "deck.agents.detail")
	return map[string]any{
		"id":              agentID,
		"workspace":       "/tmp/" + agentID,
		"thinkingDefault": "medium",
		"tools":           map[string]any{"mode": "override"},
	}, nil
}

func (s *fakeAgentsProductSurface) DeckAgentsImpactPreviewGet(_ context.Context, body map[string]any) (any, error) {
	s.calls = append(s.calls, "deck.agents.impactPreview.get")
	return s.impactPreview, nil
}

func TestAgentsProductActionCognitionSetPatchesAllowlistedPath(t *testing.T) {
	fake := newFakeAgentsProductSurface()
	payload, status, handled, err := handleAgentsProductAction(context.Background(), fake, "cognition.set", map[string]any{
		"agentId":         "main",
		"baseHash":        "hash-1",
		"thinkingDefault": "high",
	})
	if err != nil || !handled || status != 200 {
		t.Fatalf("unexpected result handled=%v status=%d err=%v payload=%#v", handled, status, err, payload)
	}
	if got := strings.Join(fake.calls, ","); got != "config.get,config.patch" {
		t.Fatalf("unexpected calls: %s", got)
	}
	if len(fake.patches) != 1 {
		t.Fatalf("expected one patch, got %#v", fake.patches)
	}
	raw := mustJSONString(fake.patches[0])
	if !strings.Contains(raw, `"list":[{"id":"main","thinkingDefault":"high"}]`) {
		t.Fatalf("unexpected patch: %s", raw)
	}
}

func TestAgentsProductActionRejectsForgedOutOfScopeBody(t *testing.T) {
	fake := newFakeAgentsProductSurface()
	_, status, handled, err := handleAgentsProductAction(context.Background(), fake, "cognition.set", map[string]any{
		"agentId":  "main",
		"baseHash": "hash-1",
		"models":   map[string]any{"providers": map[string]any{"evil": map[string]any{}}},
	})
	if !handled || status != 400 {
		t.Fatalf("unexpected handled/status: %v/%d", handled, status)
	}
	guardErr, ok := err.(*agentsConfigWriteGuardError)
	if !ok || guardErr.Code != agentsConfigPathOutOfScopeCode || guardErr.Path != "models.providers.evil" {
		t.Fatalf("unexpected error: %#v", err)
	}
	if len(fake.patches) != 0 {
		t.Fatalf("forged request must not call config.patch: %#v", fake.patches)
	}
}

func TestAgentsProductActionWorkspacePathUsesAgentsUpdate(t *testing.T) {
	fake := newFakeAgentsProductSurface()
	_, status, handled, err := handleAgentsProductAction(context.Background(), fake, "workspace.set", map[string]any{
		"agentId":   "main",
		"baseHash":  "hash-1",
		"workspace": "/tmp/new-main",
	})
	if err != nil || !handled || status != 200 {
		t.Fatalf("unexpected result handled=%v status=%d err=%v", handled, status, err)
	}
	if got := strings.Join(fake.calls, ","); got != "config.get,agents.update,config.get" {
		t.Fatalf("unexpected calls: %s", got)
	}
	if len(fake.updateBodies) != 1 || fake.updateBodies[0]["workspace"] != "/tmp/new-main" {
		t.Fatalf("workspace path must route through agents.update: %#v", fake.updateBodies)
	}
	if len(fake.patches) != 0 {
		t.Fatalf("workspace-only edit should not use config.patch: %#v", fake.patches)
	}
}

func TestAgentsProductActionWorkspaceAdvancedFieldsUsePostUpdateHash(t *testing.T) {
	fake := newFakeAgentsProductSurface()
	_, status, handled, err := handleAgentsProductAction(context.Background(), fake, "workspace.set", map[string]any{
		"agentId":   "main",
		"baseHash":  "hash-1",
		"workspace": "/tmp/new-main",
		"params": map[string]any{
			"temperature": 0.2,
		},
	})
	if err != nil || !handled || status != 200 {
		t.Fatalf("unexpected result handled=%v status=%d err=%v", handled, status, err)
	}
	if got := strings.Join(fake.calls, ","); got != "config.get,agents.update,config.get,config.patch" {
		t.Fatalf("unexpected calls: %s", got)
	}
	if len(fake.patchBaseHash) != 1 || fake.patchBaseHash[0] != "hash-workspace" {
		t.Fatalf("advanced patch must use post-agents.update hash, got %#v", fake.patchBaseHash)
	}
	raw := mustJSONString(fake.patches[0])
	if strings.Contains(raw, `"workspace"`) || !strings.Contains(raw, `"params":{"temperature":0.2}`) {
		t.Fatalf("unexpected advanced patch: %s", raw)
	}
}

func TestAgentsProductActionResetEmitsNullDeleteKey(t *testing.T) {
	fake := newFakeAgentsProductSurface()
	_, status, handled, err := handleAgentsProductAction(context.Background(), fake, "toolsOverride.set", map[string]any{
		"agentId":  "main",
		"baseHash": "hash-1",
		"reset":    []any{"tools"},
	})
	if err != nil || !handled || status != 200 {
		t.Fatalf("unexpected result handled=%v status=%d err=%v", handled, status, err)
	}
	raw := mustJSONString(fake.patches[0])
	if !strings.Contains(raw, `"tools":null`) {
		t.Fatalf("reset should use null delete-key semantics, got %s", raw)
	}
}

func TestAgentsProductActionImpactPreviewDelegatesToGatewayRPC(t *testing.T) {
	fake := newFakeAgentsProductSurface()
	_, status, handled, err := handleAgentsProductAction(context.Background(), fake, "impactPreview.get", map[string]any{
		"agentId":   "main",
		"operation": "edit-workspace",
	})
	if err != nil || !handled || status != 200 {
		t.Fatalf("unexpected result handled=%v status=%d err=%v", handled, status, err)
	}
	if got := strings.Join(fake.calls, ","); got != "deck.agents.impactPreview.get" {
		t.Fatalf("unexpected calls: %s", got)
	}
}
