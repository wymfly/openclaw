package registry

import (
	"context"
	"testing"

	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
)

type stubStatusReader struct {
	status facade.RuntimeStatus
}

func (s stubStatusReader) LastStatus() facade.RuntimeStatus {
	return s.status
}

func TestSummaries_ListAndGet(t *testing.T) {
	summaries := NewSummaries(stubStatusReader{
		status: facade.RuntimeStatus{
			Mode:       "local",
			Configured: true,
			Status:     "running",
			Health:     "healthy",
			GatewayURL: "ws://127.0.0.1:18789",
			LastError:  testStringPtr("none"),
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
	if items[0].RuntimeID != DefaultRuntimeID || items[0].Status != "running" {
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
	if item.Health != "healthy" {
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

func TestSummaries_DeriveManagedFromRuntimeMode(t *testing.T) {
	summaries := NewSummaries(stubStatusReader{
		status: facade.RuntimeStatus{
			Mode:       "remote",
			Configured: true,
			Status:     "running",
			Health:     "healthy",
		},
	})

	items, err := summaries.ListRuntimes(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 {
		t.Fatalf("unexpected runtime list: %#v", items)
	}
	if items[0].Managed {
		t.Fatalf("expected remote runtime to be unmanaged, got %#v", items[0])
	}
}

func testStringPtr(value string) *string {
	return &value
}
