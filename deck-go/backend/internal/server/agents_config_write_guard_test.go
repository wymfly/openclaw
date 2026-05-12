package server

import "testing"

func TestGuardAgentConfigWriteAllowsScopedAgentAndDefaultsPaths(t *testing.T) {
	agentPatch := map[string]any{
		"agents": map[string]any{
			"list": []any{map[string]any{
				"id":              "main",
				"thinkingDefault": "high",
				"memorySearch":    map[string]any{"enabled": true},
			}},
		},
	}
	if err := guardAgentConfigWrite("agents.cognition.set", agentPatch, []string{
		"agents.list[id].thinkingDefault",
		"agents.list[id].memorySearch",
	}); err != nil {
		t.Fatalf("expected agent patch to pass guard: %v", err)
	}

	defaultsPatch := map[string]any{
		"agents": map[string]any{
			"defaults": map[string]any{
				"workspace": "/tmp/openclaw",
				"params":    map[string]any{"temperature": 0.2},
			},
		},
	}
	if err := guardAgentConfigWrite("agents.defaults.workspace.set", defaultsPatch, []string{
		"agents.defaults.workspace",
		"agents.defaults.params",
	}); err != nil {
		t.Fatalf("expected defaults patch to pass guard: %v", err)
	}
}

func TestGuardAgentConfigWriteRejectsOutOfScopePaths(t *testing.T) {
	cases := []struct {
		name string
		diff map[string]any
		path string
	}{
		{
			name: "models providers",
			diff: map[string]any{"models": map[string]any{"providers": map[string]any{"x": map[string]any{}}}},
			path: "models.providers.x",
		},
		{
			name: "bindings",
			diff: map[string]any{"bindings": []any{map[string]any{"agentId": "main"}}},
			path: "bindings[].agentId",
		},
		{
			name: "root tools",
			diff: map[string]any{"tools": map[string]any{"approvals": map[string]any{"mode": "auto"}}},
			path: "tools.approvals.mode",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := guardAgentConfigWrite("agents.cognition.set", tc.diff, []string{"agents.list[id].thinkingDefault"})
			guardErr, ok := err.(*agentsConfigWriteGuardError)
			if !ok {
				t.Fatalf("expected guard error, got %#v", err)
			}
			if guardErr.Code != agentsConfigPathOutOfScopeCode || guardErr.Path != tc.path {
				t.Fatalf("unexpected guard error: %#v", guardErr)
			}
		})
	}
}
