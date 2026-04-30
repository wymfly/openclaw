package registry

import (
	"context"
	"testing"

	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/bundled"
)

type stubSnapshotReader struct {
	snapshot bundled.Snapshot
}

func (s stubSnapshotReader) Snapshot() bundled.Snapshot {
	return s.snapshot
}

func TestSummaries_ListAndGet(t *testing.T) {
	summaries := NewSummaries(stubSnapshotReader{
		snapshot: bundled.Snapshot{
			Managed:    true,
			Configured: true,
			Status:     bundled.StatusRunning,
			Health:     bundled.HealthHealthy,
			GatewayURL: "ws://127.0.0.1:18789",
			LastError:  "none",
			AutoStart:  true,
		},
	})

	items, err := summaries.ListRuntimes(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 {
		t.Fatalf("unexpected runtime list: %#v", items)
	}
	if items[0].RuntimeID != DefaultRuntimeID || items[0].Status != string(bundled.StatusRunning) {
		t.Fatalf("unexpected runtime summary: %#v", items[0])
	}
	if items[0].Managed != true || items[0].Configured != true {
		t.Fatalf("unexpected runtime management fields: %#v", items[0])
	}
	if items[0].GatewayURL == nil || *items[0].GatewayURL != "ws://127.0.0.1:18789" {
		t.Fatalf("unexpected runtime gateway url: %#v", items[0])
	}
	if items[0].LastError == nil || *items[0].LastError != "none" {
		t.Fatalf("unexpected runtime last error: %#v", items[0])
	}
	if items[0].AutoStart != true {
		t.Fatalf("unexpected runtime autoStart: %#v", items[0])
	}

	item, ok, err := summaries.GetRuntime(context.Background(), DefaultRuntimeID)
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Fatal("expected runtime to exist")
	}
	if item.Health != string(bundled.HealthHealthy) {
		t.Fatalf("unexpected runtime health: %#v", item)
	}

	_, ok, err = summaries.GetRuntime(context.Background(), "rt_other")
	if err != nil {
		t.Fatal(err)
	}
	if ok {
		t.Fatal("expected unknown runtime lookup to be false")
	}
}
