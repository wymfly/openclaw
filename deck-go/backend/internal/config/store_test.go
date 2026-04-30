package config

import (
	"os"
	"runtime"
	"slices"
	"testing"
)

func TestStore_UpdateAndReload(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := NewStore()
	if err != nil {
		t.Fatal(err)
	}
	next := Settings{
		AccessToken: "deck-token",
		ManagedGateway: ManagedGatewaySettings{
			Command:      "/usr/bin/openclaw",
			Args:         []string{"gateway", "run"},
			WorkingDir:   "/tmp/deck-go",
			BindHost:     "127.0.0.1",
			BindPort:     18791,
			GatewayToken: "gateway-token",
			AutoStart:    true,
			Env: map[string]string{
				"NO_PROXY": "localhost,127.0.0.1",
			},
		},
	}
	if err := store.Update(next); err != nil {
		t.Fatal(err)
	}

	other, err := NewStore()
	if err != nil {
		t.Fatal(err)
	}
	got := other.Get()
	if got.AccessToken != next.AccessToken {
		t.Fatalf("unexpected access token: %#v", got)
	}
	if got.ManagedGateway.Command != next.ManagedGateway.Command ||
		got.ManagedGateway.BindPort != next.ManagedGateway.BindPort ||
		got.ManagedGateway.GatewayToken != next.AccessToken ||
		got.ManagedGateway.AutoStart != next.ManagedGateway.AutoStart {
		t.Fatalf("unexpected managed gateway: %#v", got.ManagedGateway)
	}
	if got.ManagedGateway.Env["NO_PROXY"] != "localhost,127.0.0.1" {
		t.Fatalf("unexpected env map: %#v", got.ManagedGateway.Env)
	}
}

func TestStore_EffectiveHonorsEnvOverrides(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(Settings{
		AccessToken: "disk-access",
		ManagedGateway: ManagedGatewaySettings{
			Command:      "disk-command",
			Args:         []string{"disk", "args"},
			WorkingDir:   "/disk",
			BindHost:     "127.0.0.2",
			BindPort:     18888,
			GatewayToken: "disk-gateway",
			AutoStart:    false,
		},
	}); err != nil {
		t.Fatal(err)
	}

	t.Setenv("DECK_GO_ACCESS_TOKEN", "env-access")
	t.Setenv("DECK_GO_GATEWAY_COMMAND", "env-command")
	t.Setenv("DECK_GO_GATEWAY_ARGS_JSON", `["env","args"]`)
	t.Setenv("DECK_GO_GATEWAY_WORKDIR", "/env")
	t.Setenv("DECK_GO_GATEWAY_BIND_HOST", "127.0.0.1")
	t.Setenv("DECK_GO_GATEWAY_BIND_PORT", "18789")
	t.Setenv("DECK_GO_GATEWAY_TOKEN", "env-gateway")
	t.Setenv("DECK_GO_GATEWAY_AUTO_START", "true")
	t.Setenv("DECK_GO_GATEWAY_ENV_JSON", `{"FOO":"bar"}`)

	got := store.Effective()
	if got.AccessToken != "env-access" {
		t.Fatalf("unexpected access token: %#v", got)
	}
	if got.ManagedGateway.Command != "env-command" ||
		got.ManagedGateway.WorkingDir != "/env" ||
		got.ManagedGateway.BindHost != "127.0.0.1" ||
		got.ManagedGateway.BindPort != 18789 ||
		got.ManagedGateway.GatewayToken != "env-access" ||
		!got.ManagedGateway.AutoStart {
		t.Fatalf("unexpected effective settings: %#v", got)
	}
	if len(got.ManagedGateway.Args) != 2 || got.ManagedGateway.Args[0] != "env" {
		t.Fatalf("unexpected args: %#v", got.ManagedGateway.Args)
	}
	if got.ManagedGateway.Env["FOO"] != "bar" {
		t.Fatalf("unexpected env overrides: %#v", got.ManagedGateway.Env)
	}
}

func TestStore_GatewayConnectionDerivesManagedURL(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(Settings{
		ManagedGateway: ManagedGatewaySettings{
			BindHost:     "127.0.0.1",
			BindPort:     18999,
			GatewayToken: "gateway-token",
		},
	}); err != nil {
		t.Fatal(err)
	}

	url, token, ok := store.GatewayConnection()
	if !ok {
		t.Fatal("expected managed gateway connection info")
	}
	if url != "ws://127.0.0.1:18999" || token != "gateway-token" {
		t.Fatalf("unexpected connection info: %s %s", url, token)
	}
}

func TestStore_EffectiveUsesLegacyGatewayTokenOnlyAsFallback(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := NewStore()
	if err != nil {
		t.Fatal(err)
	}
	t.Setenv("DECK_GO_GATEWAY_TOKEN", "legacy-gateway-token")

	got := store.Effective()
	if got.AccessToken != "legacy-gateway-token" {
		t.Fatalf("expected legacy gateway token to seed access token, got %#v", got)
	}
	if got.ManagedGateway.GatewayToken != "legacy-gateway-token" {
		t.Fatalf("expected canonical gateway token fallback, got %#v", got.ManagedGateway)
	}
}

func TestStore_DefaultsAutoStartToTrue(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := NewStore()
	if err != nil {
		t.Fatal(err)
	}

	if !store.Effective().ManagedGateway.AutoStart {
		t.Fatal("expected managed gateway auto-start to default to true")
	}
}

func TestStore_WritesSettingsWithOwnerOnlyPermissions(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("POSIX permissions are not meaningful on Windows")
	}
	dataDir := t.TempDir()
	t.Setenv("DECK_GO_DATA_DIR", dataDir)
	store, err := NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(Settings{AccessToken: "secret-token"}); err != nil {
		t.Fatal(err)
	}

	dirInfo, err := os.Stat(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	if dirInfo.Mode().Perm() != 0o700 {
		t.Fatalf("expected data dir mode 0700, got %#o", dirInfo.Mode().Perm())
	}
	fileInfo, err := os.Stat(store.Path())
	if err != nil {
		t.Fatal(err)
	}
	if fileInfo.Mode().Perm() != 0o600 {
		t.Fatalf("expected settings file mode 0600, got %#o", fileInfo.Mode().Perm())
	}
}

func TestDefaultManagedGatewayArgsDoNotForcePortReplacement(t *testing.T) {
	args := defaultManagedGatewayArgs(ManagedGatewaySettings{})
	if slices.Contains(args, "--force") {
		t.Fatalf("default managed gateway args must not include --force: %#v", args)
	}
}
