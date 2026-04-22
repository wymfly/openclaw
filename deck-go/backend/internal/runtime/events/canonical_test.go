package events

import (
	"testing"
	"time"

	busevents "github.com/openclaw/openclaw/deck-go/backend/internal/events"
)

func TestNewConnectionEstablished(t *testing.T) {
	envelope := NewConnectionEstablished("epoch-test")
	if envelope.Type != "connection.established" {
		t.Fatalf("unexpected type: %#v", envelope)
	}
	if envelope.RuntimeID != DefaultRuntimeID {
		t.Fatalf("unexpected runtime id: %#v", envelope)
	}
	payload, ok := envelope.Payload.(map[string]any)
	if !ok || payload["state"] != "established" {
		t.Fatalf("unexpected payload: %#v", envelope.Payload)
	}
}

func TestFromBusEvent_MapsHighValueFamilies(t *testing.T) {
	now := time.Now().UnixMilli()

	t.Run("maps runtime status", func(t *testing.T) {
		envelope, emit := FromBusEvent(busevents.Event{
			ID:        7,
			Type:      "runtime.status",
			Data:      []byte(`{"status":"running"}`),
			Timestamp: now,
		}, "epoch-test")
		if !emit || envelope.Type != "runtime.status" {
			t.Fatalf("unexpected runtime envelope: %#v %v", envelope, emit)
		}
	})

	t.Run("maps session state", func(t *testing.T) {
		envelope, emit := FromBusEvent(busevents.Event{
			ID:        8,
			Type:      "session-state",
			Data:      []byte(`{"sessionKey":"session-1","status":"running"}`),
			Timestamp: now,
		}, "epoch-test")
		if !emit || envelope.Type != "session.updated" || envelope.SessionID != "session-1" {
			t.Fatalf("unexpected session envelope: %#v %v", envelope, emit)
		}
	})

	t.Run("maps chat final", func(t *testing.T) {
		envelope, emit := FromBusEvent(busevents.Event{
			ID:        9,
			Type:      "chat",
			Data:      []byte(`{"sessionKey":"session-1","state":"final"}`),
			Timestamp: now,
		}, "epoch-test")
		if !emit || envelope.Type != "chat.message.completed" {
			t.Fatalf("unexpected chat envelope: %#v %v", envelope, emit)
		}
	})

	t.Run("maps agent tool", func(t *testing.T) {
		envelope, emit := FromBusEvent(busevents.Event{
			ID:        10,
			Type:      "agent",
			Data:      []byte(`{"sessionKey":"session-1","stream":"tool"}`),
			Timestamp: now,
		}, "epoch-test")
		if !emit || envelope.Type != "tool.status" {
			t.Fatalf("unexpected tool envelope: %#v %v", envelope, emit)
		}
	})

	t.Run("maps canvas patch", func(t *testing.T) {
		envelope, emit := FromBusEvent(busevents.Event{
			ID:        11,
			Type:      "canvas",
			Data:      []byte(`{"sessionKey":"session-1","patch":{"x":1}}`),
			Timestamp: now,
		}, "epoch-test")
		if !emit || envelope.Type != "canvas.patch" {
			t.Fatalf("unexpected canvas envelope: %#v %v", envelope, emit)
		}
	})

	t.Run("drops unknown events", func(t *testing.T) {
		_, emit := FromBusEvent(busevents.Event{
			ID:        12,
			Type:      "unknown.event",
			Data:      []byte(`{}`),
			Timestamp: now,
		}, "epoch-test")
		if emit {
			t.Fatal("expected unknown event to be dropped")
		}
	})
}
