package server

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"

	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway/generated"
)

func TestNormalizeSkillsResponse_ProductFieldsAndSecretSanitization_MapFallback(t *testing.T) {
	response := normalizeSkillsResponse(
		map[string]any{
			"skills": []any{
				map[string]any{
					"skillKey":   "demo-skill",
					"name":       "Demo Skill",
					"source":     "openclaw-managed",
					"disabled":   false,
					"eligible":   true,
					"primaryEnv": "DEMO_API_KEY",
					"config": map[string]any{
						"apiKey":          "secret-demo-key",
						"SAFE_FLAG":       "enabled",
						"WEBHOOK_TOKEN":   "token-secret",
						"NESTED_SECRET":   map[string]any{"value": "nested-secret"},
						"lowercaseSecret": "lowercase-secret",
					},
					"install": []any{
						map[string]any{"id": "node", "label": "Node", "bins": []any{"node"}},
					},
				},
			},
		},
		skillNormalizationContext{
			agentIDsBySkill: map[string][]string{
				"demo-skill": {"main", "ops"},
			},
			apiKeyConfiguredBySkill: map[string]bool{
				"demo-skill": true,
			},
			owningPluginBySkill: map[string]*deckapi.DeckGoSkillOwningPluginRef{
				"demo-skill": {Id: "plugin-1", Name: "Plugin One"},
			},
		},
	)

	if len(response.Skills) != 1 {
		t.Fatalf("expected 1 skill, got %#v", response.Skills)
	}
	skill := response.Skills[0]
	if skill.SourceRaw != "openclaw-managed" || skill.Source != "managed" {
		t.Fatalf("unexpected source mapping: raw=%q product=%q", skill.SourceRaw, skill.Source)
	}
	if !skill.ApiKeyConfigured {
		t.Fatal("expected apiKeyConfigured to be true")
	}
	if skill.Config["apiKey"] != nil || skill.Config["WEBHOOK_TOKEN"] != nil || skill.Config["NESTED_SECRET"] != nil || skill.Config["lowercaseSecret"] != nil {
		t.Fatalf("secret keys leaked through config: %#v", skill.Config)
	}
	if skill.Config["SAFE_FLAG"] != "enabled" {
		t.Fatalf("expected safe config field to be preserved, got %#v", skill.Config)
	}
	if skill.AgentUsage.Count != 2 || !reflect.DeepEqual(skill.AgentUsage.AgentIds, []string{"main", "ops"}) {
		t.Fatalf("unexpected agent usage: %#v", skill.AgentUsage)
	}
	assertContainsAction(t, skill.AvailableActions, "disable")
	assertContainsAction(t, skill.AvailableActions, "updateApiKey")
	assertContainsAction(t, skill.AvailableActions, "clearApiKey")
	assertContainsAction(t, skill.AvailableActions, "updateEnv")
	assertContainsAction(t, skill.AvailableActions, "runInstallRecipe")
	assertContainsAction(t, skill.AvailableActions, "updateAllClawHub")
	if skill.UnsupportedReasons.Uninstall != "gateway-rpc-missing" || skill.UnsupportedReasons.Rotate != "gateway-rpc-missing" {
		t.Fatalf("expected uninstall/rotate unsupported reasons, got %#v", skill.UnsupportedReasons)
	}
	if skill.UnsupportedReasons.PerSkillUpgrade != "gateway-tracking-status-missing" {
		t.Fatalf("expected managed per-skill upgrade unsupported reason, got %#v", skill.UnsupportedReasons)
	}
	if skill.UnsupportedReasons.ApiKeyHint != "gateway-safe-secret-summary-missing" {
		t.Fatalf("expected apiKey hint unsupported reason, got %#v", skill.UnsupportedReasons)
	}
	if skill.OwningPlugin == nil || skill.OwningPlugin.Id != "plugin-1" || skill.OwningPlugin.Name != "Plugin One" {
		t.Fatalf("unexpected owning plugin: %#v", skill.OwningPlugin)
	}

	encoded, err := json.Marshal(response)
	if err != nil {
		t.Fatal(err)
	}
	body := string(encoded)
	for _, forbidden := range []string{"secret-demo-key", "token-secret", "nested-secret", "lowercase-secret", "apiKeyHintLast4", "installedVersion", "availableVersion", "updateState"} {
		if strings.Contains(body, forbidden) {
			t.Fatalf("response leaked forbidden value/field %q: %s", forbidden, body)
		}
	}
}

func TestNormalizeSkillsResponse_ProductFields_TypedBranch(t *testing.T) {
	var payload generated.SkillsStatusResult
	raw := []byte(`{
	  "managedSkillsDir": "/tmp/managed",
	  "workspaceDir": "/tmp/workspace",
	  "skills": [{
	    "skillKey": "workspace-skill",
	    "name": "Workspace Skill",
	    "source": "openclaw-workspace",
	    "disabled": true,
	    "eligible": true,
	    "missing": {"anyBins":[],"bins":[],"config":[],"env":[],"os":[]},
	    "install": [],
	    "configChecks": [],
	    "description": "Local workspace skill"
	  }]
	}`)
	if err := json.Unmarshal(raw, &payload); err != nil {
		t.Fatal(err)
	}

	response := normalizeSkillsResponse(payload, skillNormalizationContext{
		apiKeyConfiguredBySkill: map[string]bool{
			"workspace-skill": true,
		},
	})

	if len(response.Skills) != 1 {
		t.Fatalf("expected 1 skill, got %#v", response.Skills)
	}
	skill := response.Skills[0]
	if skill.SourceRaw != "openclaw-workspace" || skill.Source != "workspace" {
		t.Fatalf("unexpected source mapping: raw=%q product=%q", skill.SourceRaw, skill.Source)
	}
	if skill.Status != deckapi.DeckGoSkillStatus("disabled") || skill.Enabled {
		t.Fatalf("expected disabled status, got status=%q enabled=%v", skill.Status, skill.Enabled)
	}
	if !skill.ApiKeyConfigured {
		t.Fatal("expected apiKeyConfigured to be derived from safe config evidence")
	}
	if skill.OwningPlugin != nil {
		t.Fatalf("expected unresolved owning plugin to be nil, got %#v", skill.OwningPlugin)
	}
	assertContainsAction(t, skill.AvailableActions, "enable")
}

func TestNormalizedDeckSkillSourceTaxonomy(t *testing.T) {
	cases := map[string]string{
		"openclaw-bundled":       "bundled",
		"openclaw-managed":       "managed",
		"openclaw-workspace":     "workspace",
		"openclaw-extra":         "extra",
		"agents-skills-personal": "personal",
		"agents-skills-project":  "project",
		"plugin":                 "unknown",
		"":                       "unknown",
		"third-party":            "unknown",
	}
	for raw, want := range cases {
		if got := normalizedDeckSkillSource(raw); got != want {
			t.Fatalf("source %q normalized to %q, want %q", raw, got, want)
		}
	}
}

func assertContainsAction(t *testing.T, actions []deckapi.DeckGoSkillAvailableAction, want deckapi.DeckGoSkillAvailableAction) {
	t.Helper()
	for _, action := range actions {
		if action == want {
			return
		}
	}
	t.Fatalf("expected action %q in %#v", want, actions)
}
