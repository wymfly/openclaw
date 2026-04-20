package config

import "testing"

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
		got.ManagedGateway.GatewayToken != next.ManagedGateway.GatewayToken ||
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
		got.ManagedGateway.GatewayToken != "env-gateway" ||
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
