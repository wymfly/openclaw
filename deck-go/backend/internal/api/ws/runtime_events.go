package wsapi

import (
	"context"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/gorilla/websocket"
	busevents "github.com/openclaw/openclaw/deck-go/backend/internal/events"
	runtimeevents "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/events"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type RuntimeEventFeed interface {
	Replay(lastID int64) ([]busevents.Event, bool)
	SupportsRuntime(runtimeID string) bool
	Subscribe(ctx context.Context) <-chan busevents.Event
}

func MountRoutes(r chi.Router, feed RuntimeEventFeed) {
	serveRuntimeEvents := func(w http.ResponseWriter, req *http.Request) {
		conn, err := upgrader.Upgrade(w, req, nil)
		if err != nil {
			return
		}
		defer conn.Close()

		epoch := runtimeevents.NewConnectionEpoch()
		if err := conn.WriteJSON(runtimeevents.NewConnectionEstablished(epoch)); err != nil {
			return
		}

		lastEventID, _ := strconv.ParseInt(req.URL.Query().Get("lastEventId"), 10, 64)
		replayed, gapDetected := feed.Replay(lastEventID)
		if gapDetected {
			if err := conn.WriteJSON(runtimeevents.NewProjectionGap(epoch, "events_pruned")); err != nil {
				return
			}
		}
		for _, event := range replayed {
			envelope, emit := runtimeevents.FromBusEvent(event, epoch)
			if !emit {
				continue
			}
			if err := conn.WriteJSON(envelope); err != nil {
				return
			}
		}

		sub := feed.Subscribe(req.Context())

		for {
			select {
			case <-req.Context().Done():
				return
			case event, ok := <-sub:
				if !ok {
					return
				}
				envelope, emit := runtimeevents.FromBusEvent(event, epoch)
				if !emit {
					continue
				}
				if err := conn.WriteJSON(envelope); err != nil {
					return
				}
			}
		}
	}

	r.Get("/ws", serveRuntimeEvents)
	r.Get("/ws/runtimes/{runtimeId}/events", func(w http.ResponseWriter, req *http.Request) {
		runtimeID := chi.URLParam(req, "runtimeId")
		if !feed.SupportsRuntime(runtimeID) {
			http.NotFound(w, req)
			return
		}
		serveRuntimeEvents(w, req)
	})
}
