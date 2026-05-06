package server

import (
	"net/http"
	"strconv"

	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	"github.com/openclaw/openclaw/deck-go/backend/internal/platform/audit"
)

func registerControlAuditRoutes(mux interface {
	MethodFunc(string, string, http.HandlerFunc)
}, log *audit.Log) {
	mux.MethodFunc("GET", "/audit/events", func(w http.ResponseWriter, r *http.Request) {
		limit := 100
		if raw := r.URL.Query().Get("limit"); raw != "" {
			if parsed, err := strconv.Atoi(raw); err == nil {
				if parsed < 1 {
					parsed = 1
				}
				if parsed > 500 {
					parsed = 500
				}
				limit = parsed
			}
		}
		writeJSON(w, http.StatusOK, auditResponse(log, limit))
	})
}

func auditResponse(log *audit.Log, limit int) deckapi.DeckGoControlAuditEventsResponse {
	retention := log.Retention()
	entries := log.Recent(limit)
	response := deckapi.DeckGoControlAuditEventsResponse{
		Events: make([]deckapi.DeckGoControlAuditEntry, 0, len(entries)),
		Retention: deckapi.DeckGoControlAuditRetention{
			Mode:       retention.Mode,
			MaxEntries: float64(retention.MaxEntries),
		},
	}
	for _, entry := range entries {
		response.Events = append(response.Events, deckapi.DeckGoControlAuditEntry{
			Id:         entry.ID,
			RequestId:  entry.RequestID,
			Actor:      entry.Actor,
			Method:     entry.Method,
			Path:       entry.Path,
			Action:     entry.Action,
			Target:     entry.Target,
			StatusCode: float64(entry.StatusCode),
			Ok:         entry.OK,
			DurationMs: float64(entry.DurationMs),
			Timestamp:  entry.Timestamp,
			Summary:    entry.Summary,
		})
	}
	return response
}
