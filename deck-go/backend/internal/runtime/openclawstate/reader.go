// Package openclawstate reads the Gateway-owned openclaw.json state file.
package openclawstate

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

const defaultGatewayPort = 18789

var (
	ErrStateDirNotSet    = errors.New("openclawstate: state dir not set")
	ErrStateFileNotFound = errors.New("openclawstate: openclaw.json not found")
)

var envTemplateRE = regexp.MustCompile(`^\$\{([A-Z][A-Z0-9_]{0,127})\}$`)

type GatewayConfig struct {
	Bind  string
	Port  int
	Token string
}

func (GatewayConfig) ResolveLoopbackHost() string {
	return "127.0.0.1"
}

func (cfg GatewayConfig) ResolvePort() int {
	if cfg.Port > 0 {
		return cfg.Port
	}
	return defaultGatewayPort
}

type Reader struct {
	stateDir string
}

func NewReader(stateDir string) *Reader {
	return &Reader{stateDir: strings.TrimSpace(stateDir)}
}

func (r *Reader) Load(env map[string]string) (GatewayConfig, error) {
	if r == nil {
		return GatewayConfig{}, ErrStateDirNotSet
	}
	dir := resolveStateDir(r.stateDir, env)
	if dir == "" {
		return GatewayConfig{}, ErrStateDirNotSet
	}
	path := filepath.Join(dir, "openclaw.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return GatewayConfig{}, ErrStateFileNotFound
		}
		return GatewayConfig{}, fmt.Errorf("openclawstate: read %s: %w", path, err)
	}

	var state struct {
		Gateway struct {
			Bind string `json:"bind"`
			Port int    `json:"port"`
			Auth struct {
				Mode  string          `json:"mode"`
				Token json.RawMessage `json:"token"`
			} `json:"auth"`
		} `json:"gateway"`
	}
	if err := json.Unmarshal(raw, &state); err != nil {
		return GatewayConfig{}, fmt.Errorf("openclawstate: parse %s: %w", path, err)
	}

	cfg := GatewayConfig{
		Bind: strings.TrimSpace(state.Gateway.Bind),
		Port: state.Gateway.Port,
	}
	if isTokenAuthMode(state.Gateway.Auth.Mode) {
		cfg.Token = resolveSecretInputToken(state.Gateway.Auth.Token, env)
		if cfg.Token == "" {
			cfg.Token = strings.TrimSpace(envValue(env, "OPENCLAW_GATEWAY_TOKEN"))
		}
	}
	return cfg, nil
}

func resolveStateDir(stateDir string, env map[string]string) string {
	if trimmed := strings.TrimSpace(stateDir); trimmed != "" {
		return expandTilde(trimmed, env)
	}
	home := homeFromEnv(env)
	if home == "" {
		return ""
	}
	return filepath.Join(home, ".openclaw"+profileSuffix(envValue(env, "OPENCLAW_PROFILE")))
}

func expandTilde(path string, env map[string]string) string {
	if path == "~" {
		if home := homeFromEnv(env); home != "" {
			return home
		}
		return path
	}
	if strings.HasPrefix(path, "~/") {
		if home := homeFromEnv(env); home != "" {
			return filepath.Join(home, strings.TrimPrefix(path, "~/"))
		}
	}
	return path
}

func homeFromEnv(env map[string]string) string {
	if env == nil {
		return ""
	}
	if home := strings.TrimSpace(envValue(env, "HOME")); home != "" {
		return home
	}
	if home, err := os.UserHomeDir(); err == nil {
		return home
	}
	return ""
}

func profileSuffix(raw string) string {
	profile := strings.TrimSpace(raw)
	if profile == "" || strings.EqualFold(profile, "default") {
		return ""
	}
	return "-" + profile
}

func envValue(env map[string]string, key string) string {
	if env == nil {
		return ""
	}
	return env[key]
}

func isTokenAuthMode(raw string) bool {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "none", "password", "trusted-proxy":
		return false
	default:
		return true
	}
}

func resolveSecretInputToken(raw json.RawMessage, env map[string]string) string {
	if len(raw) == 0 || string(raw) == "null" {
		return ""
	}
	var literal string
	if err := json.Unmarshal(raw, &literal); err == nil {
		return resolveSecretString(literal, env)
	}
	var ref struct {
		Source string `json:"source"`
		ID     string `json:"id"`
	}
	if err := json.Unmarshal(raw, &ref); err != nil {
		return ""
	}
	if !strings.EqualFold(strings.TrimSpace(ref.Source), "env") {
		return ""
	}
	return strings.TrimSpace(envValue(env, strings.TrimSpace(ref.ID)))
}

func resolveSecretString(value string, env map[string]string) string {
	trimmed := strings.TrimSpace(value)
	matches := envTemplateRE.FindStringSubmatch(trimmed)
	if matches == nil {
		return trimmed
	}
	return strings.TrimSpace(envValue(env, matches[1]))
}
