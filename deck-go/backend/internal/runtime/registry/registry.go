package registry

import (
	"context"

	busevents "github.com/openclaw/openclaw/deck-go/backend/internal/events"
)

type Registry struct {
	summaries *Summaries
	feed      *EventFeed
}

func New(reader SnapshotReader, bus BusLike) *Registry {
	return NewWithCapabilities(reader, nil, bus)
}

func NewWithCapabilities(reader SnapshotReader, capabilities CapabilityLoader, bus BusLike) *Registry {
	return &Registry{
		summaries: NewSummariesWithCapabilities(reader, capabilities),
		feed:      NewEventFeed(bus),
	}
}

func (r *Registry) ListRuntimes(ctx context.Context) ([]RuntimeSummary, error) {
	return r.summaries.ListRuntimes(ctx)
}

func (r *Registry) GetRuntime(ctx context.Context, runtimeID string) (RuntimeSummary, bool, error) {
	return r.summaries.GetRuntime(ctx, runtimeID)
}

func (r *Registry) Replay(lastID int64) ([]busevents.Event, bool) {
	return r.feed.Replay(lastID)
}

func (r *Registry) SupportsRuntime(runtimeID string) bool {
	return r.feed.SupportsRuntime(runtimeID)
}

func (r *Registry) Subscribe(ctx context.Context) <-chan busevents.Event {
	return r.feed.Subscribe(ctx)
}
