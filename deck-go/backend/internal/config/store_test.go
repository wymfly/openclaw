package config

import "testing"

func TestStore_UpdateAndReload(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := NewStore()
	if err != nil {
		t.Fatal(err)
	}
	next := Settings{
		AccessToken:  "deck-token",
		GatewayURL:   "ws://127.0.0.1:18789/ws",
		GatewayToken: "gateway-token",
	}
	if err := store.Update(next); err != nil {
		t.Fatal(err)
	}

	other, err := NewStore()
	if err != nil {
		t.Fatal(err)
	}
	got := other.Get()
	if got != next {
		t.Fatalf("unexpected settings: %#v", got)
	}
}

func TestStore_EffectiveHonorsEnvOverrides(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(Settings{
		AccessToken:  "disk-access",
		GatewayURL:   "ws://disk",
		GatewayToken: "disk-gateway",
	}); err != nil {
		t.Fatal(err)
	}

	t.Setenv("DECK_GO_ACCESS_TOKEN", "env-access")
	t.Setenv("DECK_GO_GATEWAY_URL", "ws://env")
	t.Setenv("DECK_GO_GATEWAY_TOKEN", "env-gateway")

	got := store.Effective()
	if got.AccessToken != "env-access" || got.GatewayURL != "ws://env" || got.GatewayToken != "env-gateway" {
		t.Fatalf("unexpected effective settings: %#v", got)
	}
}

