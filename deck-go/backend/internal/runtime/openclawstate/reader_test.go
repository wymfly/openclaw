package openclawstate

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const sampleStateJSON = `{
  "gateway": {
    "mode": "local",
    "port": 18900,
    "bind": "loopback",
    "auth": {"mode": "token", "token": "test-token-abc"}
  }
}`

func writeStateFile(t *testing.T, contents string) string {
	t.Helper()
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "openclaw.json"), []byte(contents), 0o600); err != nil {
		t.Fatalf("write state file: %v", err)
	}
	return dir
}

func TestReaderLoadHappyPath(t *testing.T) {
	dir := writeStateFile(t, sampleStateJSON)
	cfg, err := NewReader(dir).Load(nil)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Token != "test-token-abc" {
		t.Fatalf("Token = %q, want test-token-abc", cfg.Token)
	}
	if cfg.Port != 18900 {
		t.Fatalf("Port = %d, want 18900", cfg.Port)
	}
	if cfg.Bind != "loopback" {
		t.Fatalf("Bind = %q, want loopback", cfg.Bind)
	}
}

func TestReaderLoadMissingStateDirNoEnvReturnsSentinel(t *testing.T) {
	_, err := NewReader("").Load(nil)
	if !errors.Is(err, ErrStateDirNotSet) {
		t.Fatalf("err = %v, want ErrStateDirNotSet", err)
	}
}

func TestReaderLoadDefaultsToUserHomeDotOpenclaw(t *testing.T) {
	home := t.TempDir()
	dir := filepath.Join(home, ".openclaw")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "openclaw.json"), []byte(`{"gateway":{"auth":{"token":"home-token"}}}`), 0o600); err != nil {
		t.Fatal(err)
	}
	cfg, err := NewReader("").Load(map[string]string{"HOME": home})
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Token != "home-token" {
		t.Fatalf("Token = %q, want home-token", cfg.Token)
	}
}

func TestReaderLoadHomeDirAppliesProfileSuffix(t *testing.T) {
	home := t.TempDir()
	dir := filepath.Join(home, ".openclaw-staging")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "openclaw.json"), []byte(`{"gateway":{"auth":{"token":"staging"}}}`), 0o600); err != nil {
		t.Fatal(err)
	}
	cfg, err := NewReader("").Load(map[string]string{"HOME": home, "OPENCLAW_PROFILE": "staging"})
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Token != "staging" {
		t.Fatalf("Token = %q, want staging", cfg.Token)
	}
}

func TestReaderLoadDefaultProfileHasNoSuffix(t *testing.T) {
	home := t.TempDir()
	dir := filepath.Join(home, ".openclaw")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "openclaw.json"), []byte(`{"gateway":{"auth":{"token":"default-profile"}}}`), 0o600); err != nil {
		t.Fatal(err)
	}
	cfg, err := NewReader("").Load(map[string]string{"HOME": home, "OPENCLAW_PROFILE": " Default "})
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Token != "default-profile" {
		t.Fatalf("Token = %q, want default-profile", cfg.Token)
	}
}

func TestReaderLoadTildeStateDirExpandsViaHomeEnv(t *testing.T) {
	home := t.TempDir()
	dir := filepath.Join(home, "custom-state")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "openclaw.json"), []byte(`{"gateway":{"auth":{"token":"tilde-token"}}}`), 0o600); err != nil {
		t.Fatal(err)
	}
	cfg, err := NewReader("~/custom-state").Load(map[string]string{"HOME": home})
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Token != "tilde-token" {
		t.Fatalf("Token = %q, want tilde-token", cfg.Token)
	}
}

func TestReaderLoadMissingFileReturnsSentinel(t *testing.T) {
	_, err := NewReader(t.TempDir()).Load(nil)
	if !errors.Is(err, ErrStateFileNotFound) {
		t.Fatalf("err = %v, want ErrStateFileNotFound", err)
	}
}

func TestReaderLoadAuthModeUnsetDefaultsToToken(t *testing.T) {
	dir := writeStateFile(t, `{"gateway":{"auth":{"token":"present-but-no-mode"}}}`)
	cfg, err := NewReader(dir).Load(nil)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Token != "present-but-no-mode" {
		t.Fatalf("Token = %q, want present-but-no-mode", cfg.Token)
	}
}

func TestReaderLoadNonTokenAuthModesSkipToken(t *testing.T) {
	for _, mode := range []string{"none", "password", "trusted-proxy"} {
		t.Run(mode, func(t *testing.T) {
			dir := writeStateFile(t, `{"gateway":{"auth":{"mode":"`+mode+`","token":"ignored"}}}`)
			cfg, err := NewReader(dir).Load(map[string]string{"OPENCLAW_GATEWAY_TOKEN": "fallback"})
			if err != nil {
				t.Fatalf("Load: %v", err)
			}
			if cfg.Token != "" {
				t.Fatalf("Token = %q, want empty when auth.mode=%s", cfg.Token, mode)
			}
		})
	}
}

func TestReaderLoadMissingPortDefaultsTo18789(t *testing.T) {
	dir := writeStateFile(t, `{"gateway":{"auth":{"token":"t"}}}`)
	cfg, err := NewReader(dir).Load(nil)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if got := cfg.ResolvePort(); got != 18789 {
		t.Fatalf("ResolvePort() = %d, want 18789", got)
	}
}

func TestReaderLoadMalformedJSON(t *testing.T) {
	dir := writeStateFile(t, `{not valid json`)
	_, err := NewReader(dir).Load(nil)
	if err == nil {
		t.Fatal("expected parse error")
	}
	if errors.Is(err, ErrStateDirNotSet) || errors.Is(err, ErrStateFileNotFound) {
		t.Fatalf("err = %v should be parse error, not sentinel", err)
	}
	if !strings.Contains(err.Error(), "parse") {
		t.Fatalf("err = %v, want parse error message", err)
	}
}

func TestReaderLoadResolveLoopbackHostAlwaysLocalhost(t *testing.T) {
	for _, bind := range []string{"", "loopback", "lan", "custom"} {
		cfg := GatewayConfig{Bind: bind}
		if got := cfg.ResolveLoopbackHost(); got != "127.0.0.1" {
			t.Fatalf("bind=%q ResolveLoopbackHost() = %q, want 127.0.0.1", bind, got)
		}
	}
}

func TestReaderLoadTokenAsEnvTemplate(t *testing.T) {
	dir := writeStateFile(t, `{"gateway":{"auth":{"mode":"token","token":"${MY_GW_TOKEN}"}}}`)
	cfg, err := NewReader(dir).Load(map[string]string{"MY_GW_TOKEN": "from-env-template"})
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Token != "from-env-template" {
		t.Fatalf("Token = %q, want from-env-template", cfg.Token)
	}
}

func TestReaderLoadTokenAsEnvSecretRef(t *testing.T) {
	dir := writeStateFile(t, `{"gateway":{"auth":{"mode":"token","token":{"source":"env","provider":"default","id":"MY_GW_TOKEN"}}}}`)
	cfg, err := NewReader(dir).Load(map[string]string{"MY_GW_TOKEN": "from-secret-ref"})
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Token != "from-secret-ref" {
		t.Fatalf("Token = %q, want from-secret-ref", cfg.Token)
	}
}

func TestReaderLoadNonEnvSecretRefFallsBackToOpenclawGatewayToken(t *testing.T) {
	dir := writeStateFile(t, `{"gateway":{"auth":{"mode":"token","token":{"source":"file","provider":"default","id":"/etc/secrets/gw"}}}}`)
	cfg, err := NewReader(dir).Load(map[string]string{"OPENCLAW_GATEWAY_TOKEN": "fallback-token"})
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Token != "fallback-token" {
		t.Fatalf("Token = %q, want fallback-token", cfg.Token)
	}
}

func TestReaderLoadConfigTokenWinsOverFallback(t *testing.T) {
	dir := writeStateFile(t, `{"gateway":{"auth":{"mode":"token","token":"config-token"}}}`)
	cfg, err := NewReader(dir).Load(map[string]string{"OPENCLAW_GATEWAY_TOKEN": "env-override"})
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Token != "config-token" {
		t.Fatalf("Token = %q, want config-token", cfg.Token)
	}
}
