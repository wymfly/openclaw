package events

import (
	"encoding/json"
	"fmt"
	"time"

	busevents "github.com/openclaw/openclaw/deck-go/backend/internal/events"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/coerce"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/runtimeid"
)

const DefaultRuntimeID = runtimeid.Default

func NewConnectionEpoch() string {
	return fmt.Sprintf("epoch_%d", time.Now().UTC().UnixNano())
}

type CanonicalEnvelope struct {
	SchemaVersion   string `json:"schemaVersion"`
	EventID         string `json:"eventId"`
	Seq             int64  `json:"seq,omitempty"`
	Type            string `json:"type"`
	RuntimeID       string `json:"runtimeId"`
	SessionID       string `json:"sessionId,omitempty"`
	OccurredAt      string `json:"occurredAt"`
	ConnectionEpoch string `json:"connectionEpoch"`
	Payload         any    `json:"payload"`
}

func NewConnectionEstablished(epoch string) CanonicalEnvelope {
	return CanonicalEnvelope{
		SchemaVersion:   "v1",
		EventID:         "evt_bootstrap",
		Type:            "connection.established",
		RuntimeID:       DefaultRuntimeID,
		OccurredAt:      time.Now().UTC().Format(time.RFC3339),
		ConnectionEpoch: epoch,
		Payload: map[string]any{
			"state": "established",
		},
	}
}

func NewProjectionGap(epoch string, reason string) CanonicalEnvelope {
	return CanonicalEnvelope{
		SchemaVersion:   "v1",
		EventID:         "evt_gap",
		Type:            "projection.gap",
		RuntimeID:       DefaultRuntimeID,
		OccurredAt:      time.Now().UTC().Format(time.RFC3339),
		ConnectionEpoch: epoch,
		Payload: map[string]any{
			"reason": reason,
		},
	}
}

func FromBusEvent(event busevents.Event, epoch string) (CanonicalEnvelope, bool) {
	payload := map[string]any{}
	if len(event.Data) > 0 {
		_ = json.Unmarshal(event.Data, &payload)
	}

	envelope := CanonicalEnvelope{
		SchemaVersion:   "v1",
		EventID:         fmt.Sprintf("evt_%d", event.ID),
		Seq:             event.ID,
		RuntimeID:       DefaultRuntimeID,
		OccurredAt:      time.UnixMilli(event.Timestamp).UTC().Format(time.RFC3339),
		ConnectionEpoch: epoch,
		Payload:         payload,
	}

	switch event.Type {
	case "runtime.status", "runtime.gateway.status":
		envelope.Type = "runtime.status"
		return envelope, true
	case "session-state", "sessions.changed":
		envelope.Type = "session.updated"
		envelope.SessionID = coerce.String(payload["sessionKey"], "")
		return envelope, true
	case "chat":
		envelope.SessionID = coerce.String(payload["sessionKey"], "")
		switch coerce.String(payload["state"], "") {
		case "final":
			envelope.Type = "chat.message.completed"
		case "error":
			envelope.Type = "chat.message.failed"
		case "aborted":
			envelope.Type = "chat.run.aborted"
		default:
			envelope.Type = "chat.message.delta"
		}
		return envelope, true
	case "agent":
		envelope.SessionID = coerce.String(payload["sessionKey"], "")
		if coerce.String(payload["stream"], "") == "tool" {
			envelope.Type = "tool.status"
		} else {
			envelope.Type = "chat.run.updated"
		}
		return envelope, true
	case "canvas":
		envelope.SessionID = coerce.String(payload["sessionKey"], "")
		envelope.Type = "canvas.patch"
		return envelope, true
	default:
		return CanonicalEnvelope{}, false
	}
}
