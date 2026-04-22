package openclaw

import (
	"testing"

	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
)

func TestNewManagedRuntime_ComposesSupervisorAdapterAndRegistry(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())

	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	bus := events.NewBus(8)

	managed := NewManagedRuntime(store, bus)
	if managed == nil {
		t.Fatal("expected managed runtime bundle")
	}
	if managed.RuntimeSupervisor() == nil {
		t.Fatal("expected supervisor in managed runtime bundle")
	}
	if managed.RuntimeAdapter() == nil {
		t.Fatal("expected adapter in managed runtime bundle")
	}
	if managed.RuntimeRegistry() == nil {
		t.Fatal("expected registry in managed runtime bundle")
	}
	if managed.EventBus() != bus {
		t.Fatal("expected event bus in managed runtime bundle")
	}
	if managed.GatewayQueries() == nil {
		t.Fatal("expected managed runtime facade to expose gateway queries directly")
	}
	if managed.SessionCommands() == nil {
		t.Fatal("expected managed runtime facade to expose session commands directly")
	}
	if _, err := managed.ListRuns(t.Context(), "rt_local"); err != nil {
		t.Fatalf("expected managed runtime facade to expose monitor queries: %v", err)
	}
	if _, err := managed.GetStats(t.Context(), "rt_local"); err != nil {
		t.Fatalf("expected managed runtime facade to expose monitor stats: %v", err)
	}

	items, err := managed.ListRuntimes(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 {
		t.Fatalf("unexpected runtime registry contents: %#v", items)
	}
	if _, _, ok := managed.GatewayConnection(); ok {
		t.Fatal("expected unmanaged test supervisor to report disconnected gateway")
	}
}
