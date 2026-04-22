package registry

import (
	"context"
	"testing"
	"time"

	busevents "github.com/openclaw/openclaw/deck-go/backend/internal/events"
)

type stubBus struct {
	events       []busevents.Event
	gapDetected  bool
	subscriberCh chan busevents.Event
}

func (s *stubBus) EventsSince(lastID int64) ([]busevents.Event, bool) {
	return s.events, s.gapDetected
}

func (s *stubBus) Subscribe() chan busevents.Event {
	return s.subscriberCh
}

func (s *stubBus) Unsubscribe(ch chan busevents.Event) {
	if ch != nil {
		close(ch)
	}
}

func TestEventFeed_ReplayAndSubscribe(t *testing.T) {
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
	feed := NewEventFeed(bus)

	replayed, gap := feed.Replay(1)
	if !gap || len(replayed) != 1 || replayed[0].ID != 3 {
		t.Fatalf("unexpected replay result: gap=%v replayed=%#v", gap, replayed)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	sub := feed.Subscribe(ctx)
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

func TestEventFeed_SupportsRuntime(t *testing.T) {
	feed := NewEventFeed(&stubBus{subscriberCh: make(chan busevents.Event, 1)})
	if !feed.SupportsRuntime(DefaultRuntimeID) {
		t.Fatal("expected default runtime to be supported")
	}
	if feed.SupportsRuntime("rt_other") {
		t.Fatal("expected unknown runtime to be unsupported")
	}
}
