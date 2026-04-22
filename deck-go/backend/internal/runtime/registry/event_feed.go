package registry

import (
	"context"

	busevents "github.com/openclaw/openclaw/deck-go/backend/internal/events"
)

type BusLike interface {
	EventsSince(lastID int64) ([]busevents.Event, bool)
	Subscribe() chan busevents.Event
	Unsubscribe(ch chan busevents.Event)
}

type EventFeed struct {
	bus BusLike
}

func NewEventFeed(bus BusLike) *EventFeed {
	return &EventFeed{bus: bus}
}

func (f *EventFeed) Replay(lastID int64) ([]busevents.Event, bool) {
	return f.bus.EventsSince(lastID)
}

func (f *EventFeed) SupportsRuntime(runtimeID string) bool {
	return runtimeID == "" || runtimeID == DefaultRuntimeID
}

func (f *EventFeed) Subscribe(ctx context.Context) <-chan busevents.Event {
	upstream := f.bus.Subscribe()
	out := make(chan busevents.Event, 32)
	go func() {
		defer close(out)
		defer f.bus.Unsubscribe(upstream)
		for {
			select {
			case <-ctx.Done():
				return
			case event, ok := <-upstream:
				if !ok {
					return
				}
				select {
				case out <- event:
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out
}
