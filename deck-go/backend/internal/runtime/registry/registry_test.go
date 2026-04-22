package registry

import (
	"context"
	"testing"
	"time"

	busevents "github.com/openclaw/openclaw/deck-go/backend/internal/events"
	runtimecontrol "github.com/openclaw/openclaw/deck-go/backend/internal/runtime"
)

func TestRegistry_CombinesSummaryAndEventFeed(t *testing.T) {
	bus := &stubBus{
		events: []busevents.Event{{
			ID:        3,
			Type:      "runtime.status",
			Data:      []byte(`{"status":"running"}`),
			Timestamp: time.Now().UnixMilli(),
		}},
		gapDetected:  true,
		subscriberCh: make(chan busevents.Event, 1),
	}

	registry := NewWithCapabilities(
		stubSnapshotReader{
			snapshot: runtimecontrol.Snapshot{
				Status: runtimecontrol.StatusRunning,
				Health: runtimecontrol.HealthHealthy,
			},
		},
		stubCapabilityProvider{
			summary: CapabilitySummary{
				Available:     true,
				SchemaVersion: "3.1",
				MethodCount:   81,
				EventCount:    5,
			},
		},
		bus,
	)

	items, err := registry.ListRuntimes(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].CapabilityVersion == nil || *items[0].CapabilityVersion != "3.1" {
		t.Fatalf("unexpected combined registry summary: %#v", items)
	}

	if !registry.SupportsRuntime(DefaultRuntimeID) || registry.SupportsRuntime("rt_other") {
		t.Fatal("unexpected runtime support resolution")
	}

	replayed, gap := registry.Replay(1)
	if !gap || len(replayed) != 1 || replayed[0].ID != 3 {
		t.Fatalf("unexpected replay result: gap=%v replayed=%#v", gap, replayed)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	sub := registry.Subscribe(ctx)
	bus.subscriberCh <- busevents.Event{
		ID:        4,
		Type:      "runtime.status",
		Data:      []byte(`{"status":"degraded"}`),
		Timestamp: time.Now().UnixMilli(),
	}
	select {
	case event := <-sub:
		if event.ID != 4 {
			t.Fatalf("unexpected subscribed event: %#v", event)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for subscribed event")
	}
}
