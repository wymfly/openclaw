package runtimecontrol

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
)

func syncManagedGatewayProviderConfig(settingsPath string) error {
	sourcePath, ok := resolveSourceOpenClawConfigPath()
	if !ok {
		return nil
	}
	sourceRaw, err := os.ReadFile(sourcePath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return err
	}
	var source map[string]any
	if err := json.Unmarshal(sourceRaw, &source); err != nil {
		return err
	}
	sourceModels, _ := source["models"].(map[string]any)
	sourceProviders, _ := sourceModels["providers"].(map[string]any)
	if len(sourceProviders) == 0 {
		return nil
	}

	stateDir := filepath.Join(filepath.Dir(settingsPath), "managed-gateway-state")
	if err := os.MkdirAll(stateDir, 0o700); err != nil {
		return err
	}
	if err := os.Chmod(stateDir, 0o700); err != nil {
		return err
	}
	targetPath := filepath.Join(stateDir, "openclaw.json")

	target := map[string]any{}
	if targetRaw, err := os.ReadFile(targetPath); err == nil && len(targetRaw) > 0 {
		_ = json.Unmarshal(targetRaw, &target)
	} else if err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}

	targetModels, _ := target["models"].(map[string]any)
	if targetModels == nil {
		targetModels = map[string]any{}
	}
	clonedProviders := make(map[string]any, len(sourceProviders))
	for key, value := range sourceProviders {
		clonedProviders[key] = value
	}
	targetModels["providers"] = clonedProviders
	target["models"] = targetModels

	raw, err := json.MarshalIndent(target, "", "  ")
	if err != nil {
		return err
	}
	tmpPath := targetPath + ".tmp"
	if err := os.WriteFile(tmpPath, append(raw, '\n'), 0o600); err != nil {
		return err
	}
	return os.Rename(tmpPath, targetPath)
}

func resolveSourceOpenClawConfigPath() (string, bool) {
	if explicit := os.Getenv("OPENCLAW_CONFIG_PATH"); explicit != "" {
		return explicit, true
	}
	stateDir := os.Getenv("OPENCLAW_STATE_DIR")
	if stateDir == "" {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return "", false
		}
		stateDir = filepath.Join(homeDir, ".openclaw")
	}
	return filepath.Join(stateDir, "openclaw.json"), true
}
