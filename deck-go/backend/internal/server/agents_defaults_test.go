package server

import (
	"context"
	"strings"
	"testing"

	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
)

func TestAgentsDefaultsSetPatchesAllowedBucketFields(t *testing.T) {
	fake := newFakeAgentsProductSurface()
	payload, status, handled, err := handleAgentsDefaultsAction(context.Background(), fake, "defaults.workspace.set", map[string]any{
		"baseHash": "hash-1",
		"value": map[string]any{
			"workspace":  "/tmp/defaults",
			"embeddedPi": map[string]any{"executionContract": "strict-agentic"},
		},
	})
	if err != nil || !handled || status != 200 {
		t.Fatalf("unexpected result handled=%v status=%d err=%v payload=%#v", handled, status, err, payload)
	}
	if got := strings.Join(fake.calls, ","); got != "config.get,config.patch" {
		t.Fatalf("unexpected calls: %s", got)
	}
	raw := mustJSONString(fake.patches[0])
	for _, want := range []string{`"defaults"`, `"workspace":"/tmp/defaults"`, `"embeddedPi"`} {
		if !strings.Contains(raw, want) {
			t.Fatalf("expected %s in patch: %s", want, raw)
		}
	}
}

func TestAgentsDefaultsSetRejectsOutOfScopeValue(t *testing.T) {
	fake := newFakeAgentsProductSurface()
	_, status, handled, err := handleAgentsDefaultsAction(context.Background(), fake, "defaults.cognition.set", map[string]any{
		"baseHash": "hash-1",
		"value": map[string]any{
			"models": map[string]any{"providers": map[string]any{"evil": map[string]any{}}},
		},
	})
	if !handled || status != 400 {
		t.Fatalf("unexpected handled/status: %v/%d", handled, status)
	}
	guardErr, ok := err.(*agentsConfigWriteGuardError)
	if !ok || guardErr.Code != agentsConfigPathOutOfScopeCode || guardErr.Path != "models.providers.evil" {
		t.Fatalf("unexpected error: %#v", err)
	}
	if len(fake.patches) != 0 {
		t.Fatalf("out-of-scope defaults request must not patch config: %#v", fake.patches)
	}
}

func TestAgentsDefaultsResetEmitsNullDeleteKey(t *testing.T) {
	fake := newFakeAgentsProductSurface()
	_, status, handled, err := handleAgentsDefaultsAction(context.Background(), fake, "defaults.cognition.set", map[string]any{
		"baseHash": "hash-1",
		"reset":    []any{"memorySearch"},
	})
	if err != nil || !handled || status != 200 {
		t.Fatalf("unexpected result handled=%v status=%d err=%v", handled, status, err)
	}
	raw := mustJSONString(fake.patches[0])
	if !strings.Contains(raw, `"memorySearch":null`) {
		t.Fatalf("reset should use null delete-key semantics, got %s", raw)
	}
}

func TestAgentsDefaultsGetProjectsCurrentBucket(t *testing.T) {
	fake := newFakeAgentsProductSurface()
	payload, status, handled, err := handleAgentsDefaultsAction(context.Background(), fake, "defaults.cognition.get", map[string]any{})
	if err != nil || !handled || status != 200 {
		t.Fatalf("unexpected result handled=%v status=%d err=%v", handled, status, err)
	}
	response, ok := payload.(deckapi.DeckGoAgentProductActionResponse)
	if !ok {
		t.Fatalf("unexpected payload type: %T", payload)
	}
	if response.Value["thinkingDefault"] != "low" {
		t.Fatalf("expected cognition defaults, got %#v", response.Value)
	}
}
