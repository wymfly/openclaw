package runtimecontrol

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestSyncManagedGatewayProviderConfig_CopiesUserProvidersIntoManagedState(t *testing.T) {
	root := t.TempDir()
	userStateDir := filepath.Join(root, ".openclaw")
	if err := os.MkdirAll(userStateDir, 0o755); err != nil {
		t.Fatal(err)
	}
	userConfigPath := filepath.Join(userStateDir, "openclaw.json")
	if err := os.WriteFile(userConfigPath, []byte(`{
  "models": {
    "providers": {
      "cpa": {
        "baseUrl": "http://example.test/v1",
        "apiKey": "demo-key",
        "api": "openai-responses",
        "models": [{"id":"gpt-5.4","name":"gpt-5.4"}]
      }
    }
  }
}`), 0o644); err != nil {
		t.Fatal(err)
	}

	settingsDir := filepath.Join(root, "deck-go")
	if err := os.MkdirAll(settingsDir, 0o755); err != nil {
		t.Fatal(err)
	}
	settingsPath := filepath.Join(settingsDir, "settings.json")
	if err := os.WriteFile(settingsPath, []byte(`{}`), 0o644); err != nil {
		t.Fatal(err)
	}

	t.Setenv("HOME", root)
	t.Setenv("OPENCLAW_CONFIG_PATH", userConfigPath)

	if err := syncManagedGatewayProviderConfig(settingsPath); err != nil {
		t.Fatal(err)
	}

	targetPath := filepath.Join(settingsDir, "managed-gateway-state", "openclaw.json")
	raw, err := os.ReadFile(targetPath)
	if err != nil {
		t.Fatal(err)
	}
	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		t.Fatal(err)
	}
	models, _ := payload["models"].(map[string]any)
	providers, _ := models["providers"].(map[string]any)
	cpa, _ := providers["cpa"].(map[string]any)
	if cpa["baseUrl"] != "http://example.test/v1" {
		t.Fatalf("unexpected synced provider payload: %#v", cpa)
	}
}
