package openclaw

import (
	"context"
	"errors"
	"os/exec"
	"testing"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
)

func TestManagedSupervisorWithOptions_PublishesLifecycleEvents(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		ManagedGateway: config.ManagedGatewaySettings{
			Command:      "echo",
			GatewayToken: "token",
		},
	}); err != nil {
		t.Fatal(err)
	}

	bus := events.NewBus(16)
	sub := bus.Subscribe()
	defer bus.Unsubscribe(sub)

	supervisor := NewManagedSupervisorWithOptions(
		store,
		bus,
		WithManagedLauncher(func(config.ManagedGatewaySettings) (*exec.Cmd, error) {
			return nil, errors.New("launch failed")
		}),
	)

	if _, err := supervisor.Start(context.Background()); err == nil {
		t.Fatal("expected launch failure")
	}

	expectManagedEvent(t, sub, "runtime.gateway.status")
}

func expectManagedEvent(t *testing.T, sub <-chan events.Event, eventType string) {
	t.Helper()
	select {
	case event := <-sub:
		if event.Type != eventType {
			t.Fatalf("expected event %s, got %#v", eventType, event)
		}
	case <-time.After(2 * time.Second):
		t.Fatalf("timed out waiting for %s", eventType)
	}
}
