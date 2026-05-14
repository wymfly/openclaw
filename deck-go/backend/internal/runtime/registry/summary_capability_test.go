package registry

import (
	"context"
	"errors"
	"testing"

	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
)

type stubCapabilityProvider struct {
	summary CapabilitySummary
	err     error
}

func (s stubCapabilityProvider) Load(context.Context) (CapabilitySummary, error) {
	if s.err != nil {
		return CapabilitySummary{}, s.err
	}
	return s.summary, nil
}

func TestSummaries_IncludeCapabilityVersionWhenAvailable(t *testing.T) {
	summaries := NewSummariesWithCapabilities(
		stubStatusReader{
			status: facade.RuntimeStatus{
				Status: "running",
				Health: "healthy",
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
	)

	items, err := summaries.ListRuntimes(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 {
		t.Fatalf("unexpected runtime list: %#v", items)
	}
	if items[0].CapabilityVersion == nil || *items[0].CapabilityVersion != "3.1" {
		t.Fatalf("expected capability version, got %#v", items[0])
	}
	if items[0].MethodCount == nil || *items[0].MethodCount != 81 {
		t.Fatalf("expected method count, got %#v", items[0])
	}
	if items[0].EventCount == nil || *items[0].EventCount != 5 {
		t.Fatalf("expected event count, got %#v", items[0])
	}
}

func TestSummaries_IgnoreCapabilityErrors(t *testing.T) {
	summaries := NewSummariesWithCapabilities(
		stubStatusReader{
			status: facade.RuntimeStatus{
				Status: "running",
				Health: "healthy",
			},
		},
		stubCapabilityProvider{err: errors.New("describe failed")},
	)

	items, err := summaries.ListRuntimes(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 {
		t.Fatalf("unexpected runtime list: %#v", items)
	}
	if items[0].CapabilityVersion != nil {
		t.Fatalf("expected missing capability version on error, got %#v", items[0])
	}
}
