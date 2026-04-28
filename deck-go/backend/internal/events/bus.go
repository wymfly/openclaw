package events

import (
	"sync"
	"time"
)

type Event struct {
	ID        int64
	Type      string
	Data      []byte
	Timestamp int64
}

type Bus struct {
	mu          sync.RWMutex
	noop        bool
	nextID      int64
	buffer      []Event
	bufferSize  int
	subscribers map[chan Event]struct{}
}

func NewBus(bufferSize int) *Bus {
	if bufferSize <= 0 {
		bufferSize = 2000
	}
	return &Bus{
		bufferSize:  bufferSize,
		subscribers: map[chan Event]struct{}{},
	}
}

func NewNoopBus() *Bus {
	return &Bus{noop: true}
}

func (b *Bus) Publish(eventType string, data []byte) Event {
	if b == nil || b.noop {
		return Event{
			Type:      eventType,
			Data:      append([]byte(nil), data...),
			Timestamp: time.Now().UnixMilli(),
		}
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	b.nextID++
	event := Event{
		ID:        b.nextID,
		Type:      eventType,
		Data:      append([]byte(nil), data...),
		Timestamp: time.Now().UnixMilli(),
	}
	b.buffer = append(b.buffer, event)
	if len(b.buffer) > b.bufferSize {
		b.buffer = b.buffer[len(b.buffer)-b.bufferSize:]
	}
	for ch := range b.subscribers {
		select {
		case ch <- event:
		default:
		}
	}
	return event
}

func (b *Bus) Subscribe() chan Event {
	ch := make(chan Event, 32)
	if b == nil || b.noop {
		return ch
	}
	b.mu.Lock()
	b.subscribers[ch] = struct{}{}
	b.mu.Unlock()
	return ch
}

func (b *Bus) Unsubscribe(ch chan Event) {
	if b == nil || b.noop {
		close(ch)
		return
	}
	b.mu.Lock()
	if _, ok := b.subscribers[ch]; ok {
		delete(b.subscribers, ch)
		close(ch)
	}
	b.mu.Unlock()
}

func (b *Bus) EventsSince(lastID int64) (events []Event, gapDetected bool) {
	if b == nil || b.noop {
		return nil, false
	}
	b.mu.RLock()
	defer b.mu.RUnlock()
	if len(b.buffer) == 0 {
		return nil, false
	}
	if lastID == 0 {
		return append([]Event(nil), b.buffer...), false
	}
	oldest := b.buffer[0]
	gapDetected = lastID < oldest.ID
	for _, event := range b.buffer {
		if event.ID > lastID {
			events = append(events, event)
		}
	}
	return events, gapDetected
}
