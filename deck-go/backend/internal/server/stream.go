package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
	openclawrt "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/openclaw"
)

const (
	streamHeartbeatInterval = 15 * time.Second
	logPollInterval         = 1 * time.Second
)

func registerEventStreamRoutes(
	mux interface {
		MethodFunc(string, string, http.HandlerFunc)
	},
	managed openclawrt.ManagedRuntimeSurface,
) {
	mux.MethodFunc("GET", "/stream", func(w http.ResponseWriter, r *http.Request) {
		serveEventStream(w, r, managed)
	})

	mux.MethodFunc("GET", "/logs/stream", func(w http.ResponseWriter, r *http.Request) {
		serveLogsStream(w, r, managed)
	})
}

func serveEventStream(w http.ResponseWriter, r *http.Request, managed openclawrt.ManagedRuntimeSurface) {
	lastID, _ := strconv.ParseInt(r.Header.Get("Last-Event-ID"), 10, 64)
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache, no-transform")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	for _, event := range func() []events.Event {
		items, gap := managed.EventsSince(lastID)
		if gap {
			_, _ = fmt.Fprintf(w, "event: projection.gap\ndata: {\"reason\":\"events_pruned\"}\n\n")
			flusher.Flush()
		}
		return items
	}() {
		writeSSEEvent(w, event.ID, event.Type, event.Data)
		flusher.Flush()
	}

	sub, unsubscribe := managed.SubscribeStream()
	defer unsubscribe()

	ticker := time.NewTicker(streamHeartbeatInterval)
	defer ticker.Stop()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			_, _ = fmt.Fprint(w, ": heartbeat\n\n")
			flusher.Flush()
		case event := <-sub:
			writeSSEEvent(w, event.ID, event.Type, event.Data)
			flusher.Flush()
		}
	}
}

func serveLogsStream(w http.ResponseWriter, r *http.Request, managed openclawrt.ManagedRuntimeSurface) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache, no-transform")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	lastEventID := r.Header.Get("Last-Event-ID")
	var cursor int
	if lastEventID != "" {
		if parsed, err := strconv.Atoi(lastEventID); err == nil {
			cursor = parsed
		}
	}

	ctx := r.Context()
	poll := func() error {
		pollCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
		defer cancel()
		params := map[string]any{
			"limit":    500,
			"maxBytes": 65536,
		}
		if cursor > 0 {
			params["cursor"] = cursor
		}
		payload, err := managed.LogsTail(pollCtx, params)
		if err != nil {
			return err
		}
		record, ok := payload.(map[string]any)
		if !ok {
			return nil
		}
		if reset, _ := record["reset"].(bool); reset {
			cursor = 0
			_, _ = fmt.Fprint(w, "event: log.reset\ndata: {}\n\n")
			flusher.Flush()
		}
		if nextCursor, ok := record["cursor"].(float64); ok {
			cursor = int(nextCursor)
		}
		lines, _ := record["lines"].([]any)
		if len(lines) > 0 {
			raw, _ := json.Marshal(map[string]any{
				"lines":  lines,
				"cursor": cursor,
			})
			_, _ = fmt.Fprintf(w, "id: %d\nevent: log.batch\ndata: %s\n\n", cursor, raw)
			flusher.Flush()
		}
		return nil
	}

	_ = poll()
	pollTicker := time.NewTicker(logPollInterval)
	heartbeatTicker := time.NewTicker(streamHeartbeatInterval)
	defer pollTicker.Stop()
	defer heartbeatTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-pollTicker.C:
			_ = poll()
		case <-heartbeatTicker.C:
			_, _ = fmt.Fprint(w, ": heartbeat\n\n")
			flusher.Flush()
		}
	}
}

func writeSSEEvent(w http.ResponseWriter, id int64, eventType string, data []byte) {
	_, _ = fmt.Fprintf(w, "id: %d\nevent: %s\ndata: %s\n\n", id, eventType, data)
}
