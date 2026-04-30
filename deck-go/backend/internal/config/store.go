package config

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
)

const (
	defaultManagedGatewayMode     = "managed"
	defaultManagedGatewayCommand  = "node"
	defaultManagedGatewayBindHost = "127.0.0.1"
	defaultManagedGatewayBindPort = 18789
)

type ManagedGatewaySettings struct {
	Mode                string            `json:"mode,omitempty"`
	Command             string            `json:"command,omitempty"`
	Args                []string          `json:"args,omitempty"`
	WorkingDir          string            `json:"workingDir,omitempty"`
	BindHost            string            `json:"bindHost,omitempty"`
	BindPort            int               `json:"bindPort,omitempty"`
	GatewayToken        string            `json:"gatewayToken,omitempty"`
	AutoStart           bool              `json:"autoStart"`
	AutoStartConfigured bool              `json:"-"`
	Env                 map[string]string `json:"env,omitempty"`
}

type Settings struct {
	AccessToken    string                 `json:"accessToken,omitempty"`
	ManagedGateway ManagedGatewaySettings `json:"managedGateway,omitempty"`
	Appearance     map[string]any         `json:"appearance,omitempty"`
	Notifications  map[string]any         `json:"notifications,omitempty"`
	PairedDevices  []map[string]any       `json:"pairedDevices,omitempty"`
}

type ServiceTokenStatus struct {
	Configured bool
	Source     string
}

type Store struct {
	path string
	mu   sync.RWMutex
	data Settings
}

func NewStore() (*Store, error) {
	dir := os.Getenv("DECK_GO_DATA_DIR")
	if dir == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return nil, err
		}
		dir = filepath.Join(home, ".openclaw", "deck-go")
	}
	if err := ensurePrivateDir(dir); err != nil {
		return nil, err
	}
	store := &Store{path: filepath.Join(dir, "settings.json")}
	if err := store.load(); err != nil {
		return nil, err
	}
	return store, nil
}

func (s *Store) Path() string {
	return s.path
}

func (s *Store) Get() Settings {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return cloneSettings(s.data)
}

func (s *Store) Effective() Settings {
	current := s.Get()
	if v := os.Getenv("DECK_GO_ACCESS_TOKEN"); v != "" {
		current.AccessToken = v
	}

	managed := current.ManagedGateway
	if managed.Mode == "" {
		managed.Mode = defaultManagedGatewayMode
	}
	if v := os.Getenv("DECK_GO_GATEWAY_MODE"); v != "" {
		managed.Mode = v
	}

	if managed.Command == "" {
		managed.Command = defaultManagedGatewayCommand
	}
	if v := os.Getenv("DECK_GO_GATEWAY_COMMAND"); v != "" {
		managed.Command = v
	}

	if managed.WorkingDir == "" {
		if root, err := resolveDefaultManagedGatewayWorkingDir(); err == nil {
			managed.WorkingDir = root
		}
	}
	if v := os.Getenv("DECK_GO_GATEWAY_WORKDIR"); v != "" {
		managed.WorkingDir = v
	}

	if managed.BindHost == "" {
		managed.BindHost = defaultManagedGatewayBindHost
	}
	if v := os.Getenv("DECK_GO_GATEWAY_BIND_HOST"); v != "" {
		managed.BindHost = v
	}

	if managed.BindPort <= 0 {
		managed.BindPort = defaultManagedGatewayBindPort
	}
	if v := os.Getenv("DECK_GO_GATEWAY_BIND_PORT"); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil && parsed > 0 {
			managed.BindPort = parsed
		}
	}

	if len(managed.Args) == 0 {
		managed.Args = defaultManagedGatewayArgs(managed)
	}
	if v := os.Getenv("DECK_GO_GATEWAY_ARGS_JSON"); v != "" {
		if parsed, err := parseArgsJSON(v); err == nil {
			managed.Args = parsed
		}
	} else if v := os.Getenv("DECK_GO_GATEWAY_ARGS"); v != "" {
		managed.Args = strings.Fields(v)
	}

	if v := os.Getenv("DECK_GO_GATEWAY_AUTO_START"); v != "" {
		if parsed, err := strconv.ParseBool(v); err == nil {
			managed.AutoStart = parsed
			managed.AutoStartConfigured = true
		}
	}

	if v := os.Getenv("DECK_GO_GATEWAY_ENV_JSON"); v != "" {
		if parsed, err := parseEnvJSON(v); err == nil {
			managed.Env = parsed
		}
	}

	current.ManagedGateway = managed
	return applyCanonicalServiceToken(current, os.Getenv("DECK_GO_GATEWAY_TOKEN"))
}

func (s *Store) Update(next Settings) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data = applyCanonicalServiceToken(Settings{
		AccessToken:    next.AccessToken,
		ManagedGateway: normalizeManagedGatewaySettings(next.ManagedGateway),
		Appearance:     cloneAnyMap(next.Appearance),
		Notifications:  cloneAnyMap(next.Notifications),
		PairedDevices:  cloneAnyMapSlice(next.PairedDevices),
	}, "")
	return s.saveLocked()
}

func (s *Store) GatewayConnection() (string, string, bool) {
	current := s.Effective()
	if current.ManagedGateway.Mode != defaultManagedGatewayMode {
		return "", "", false
	}
	if strings.TrimSpace(current.ManagedGateway.GatewayToken) == "" {
		return "", "", false
	}
	return ManagedGatewayURL(current.ManagedGateway), current.ManagedGateway.GatewayToken, true
}

func (s *Store) ServiceTokenStatus() ServiceTokenStatus {
	current := s.Get()
	if strings.TrimSpace(os.Getenv("DECK_GO_ACCESS_TOKEN")) != "" {
		return ServiceTokenStatus{Configured: true, Source: "env"}
	}
	if strings.TrimSpace(current.AccessToken) != "" {
		return ServiceTokenStatus{Configured: true, Source: "settings"}
	}
	if strings.TrimSpace(os.Getenv("DECK_GO_GATEWAY_TOKEN")) != "" {
		return ServiceTokenStatus{Configured: true, Source: "legacy-env"}
	}
	if strings.TrimSpace(current.ManagedGateway.GatewayToken) != "" {
		return ServiceTokenStatus{Configured: true, Source: "legacy-settings"}
	}
	return ServiceTokenStatus{Configured: false, Source: "none"}
}

func ManagedGatewayURL(settings ManagedGatewaySettings) string {
	normalized := normalizeManagedGatewaySettings(settings)
	return fmt.Sprintf("ws://%s:%d", normalized.BindHost, normalized.BindPort)
}

func (s *Store) load() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	raw, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		s.data = Settings{}
		return nil
	}
	if err != nil {
		return err
	}
	if len(raw) == 0 {
		s.data = Settings{}
		return nil
	}
	var parsed Settings
	autoStartConfigured := managedGatewayAutoStartConfigured(raw)
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return err
	}
	parsed.ManagedGateway.AutoStartConfigured = autoStartConfigured
	parsed.ManagedGateway = normalizeManagedGatewaySettings(parsed.ManagedGateway)
	s.data = cloneSettings(parsed)
	return nil
}

func (s *Store) saveLocked() error {
	raw, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}

func normalizeManagedGatewaySettings(settings ManagedGatewaySettings) ManagedGatewaySettings {
	next := settings
	if next.Mode == "" {
		next.Mode = defaultManagedGatewayMode
	}
	if next.Command == "" {
		next.Command = defaultManagedGatewayCommand
	}
	if next.BindHost == "" {
		next.BindHost = defaultManagedGatewayBindHost
	}
	if next.BindPort <= 0 {
		next.BindPort = defaultManagedGatewayBindPort
	}
	if !next.AutoStartConfigured {
		next.AutoStart = true
	}
	if len(next.Args) == 0 {
		next.Args = defaultManagedGatewayArgs(next)
	}
	if next.Env == nil {
		next.Env = map[string]string{}
	}
	return next
}

func defaultManagedGatewayArgs(settings ManagedGatewaySettings) []string {
	bindMode := settings.BindHost
	if bindMode == "" || bindMode == "127.0.0.1" || bindMode == "localhost" {
		bindMode = "loopback"
	}
	port := settings.BindPort
	if port <= 0 {
		port = defaultManagedGatewayBindPort
	}
	return []string{
		"dist/entry.js",
		"gateway",
		"run",
		"--bind",
		bindMode,
		"--port",
		strconv.Itoa(port),
		"--allow-unconfigured",
	}
}

func applyCanonicalServiceToken(settings Settings, legacyGatewayToken string) Settings {
	next := cloneSettings(settings)
	token := strings.TrimSpace(next.AccessToken)
	if token == "" {
		token = strings.TrimSpace(legacyGatewayToken)
	}
	if token == "" {
		token = strings.TrimSpace(next.ManagedGateway.GatewayToken)
	}
	next.AccessToken = token
	next.ManagedGateway.GatewayToken = token
	next.ManagedGateway = normalizeManagedGatewaySettings(next.ManagedGateway)
	return next
}

func managedGatewayAutoStartConfigured(raw []byte) bool {
	var envelope struct {
		ManagedGateway map[string]json.RawMessage `json:"managedGateway"`
	}
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return false
	}
	if envelope.ManagedGateway == nil {
		return false
	}
	_, ok := envelope.ManagedGateway["autoStart"]
	return ok
}

func ensurePrivateDir(path string) error {
	if err := os.MkdirAll(path, 0o700); err != nil {
		return err
	}
	return os.Chmod(path, 0o700)
}

func resolveDefaultManagedGatewayWorkingDir() (string, error) {
	cwd, err := os.Getwd()
	if err != nil {
		return "", err
	}
	dir := cwd
	for {
		if looksLikeOpenClawRepoRoot(dir) {
			return dir, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return cwd, nil
		}
		dir = parent
	}
}

func looksLikeOpenClawRepoRoot(dir string) bool {
	required := []string{
		filepath.Join(dir, "package.json"),
		filepath.Join(dir, "openclaw.mjs"),
		filepath.Join(dir, "ui", "vite.config.ts"),
	}
	for _, candidate := range required {
		if _, err := os.Stat(candidate); err != nil {
			return false
		}
	}
	return true
}

func parseArgsJSON(raw string) ([]string, error) {
	var parsed []string
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return nil, err
	}
	return parsed, nil
}

func parseEnvJSON(raw string) (map[string]string, error) {
	var parsed map[string]string
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return nil, err
	}
	return parsed, nil
}

func cloneSettings(settings Settings) Settings {
	cloned := settings
	cloned.ManagedGateway = settings.ManagedGateway
	cloned.ManagedGateway.Args = append([]string(nil), settings.ManagedGateway.Args...)
	if settings.ManagedGateway.Env != nil {
		cloned.ManagedGateway.Env = map[string]string{}
		for key, value := range settings.ManagedGateway.Env {
			cloned.ManagedGateway.Env[key] = value
		}
	}
	cloned.Appearance = cloneAnyMap(settings.Appearance)
	cloned.Notifications = cloneAnyMap(settings.Notifications)
	cloned.PairedDevices = cloneAnyMapSlice(settings.PairedDevices)
	return cloned
}

func cloneAnyMap(src map[string]any) map[string]any {
	if src == nil {
		return nil
	}
	cloned := make(map[string]any, len(src))
	for key, value := range src {
		cloned[key] = value
	}
	return cloned
}

func cloneAnyMapSlice(src []map[string]any) []map[string]any {
	if src == nil {
		return nil
	}
	cloned := make([]map[string]any, len(src))
	for idx, item := range src {
		cloned[idx] = cloneAnyMap(item)
	}
	return cloned
}
