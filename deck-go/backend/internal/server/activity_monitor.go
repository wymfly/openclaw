package server

import (
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/projection"
)

func registerActivityMonitorRoutes(mux interface {
	MethodFunc(string, string, http.HandlerFunc)
}, bus *events.Bus) {
	mux.MethodFunc("GET", "/activity", func(w http.ResponseWriter, r *http.Request) {
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
		writeJSON(w, http.StatusOK, map[string]any{"events": projection.CollectActivityEntries(bus, limit)})
	})

	mux.MethodFunc("GET", "/monitor/runs", func(w http.ResponseWriter, r *http.Request) {
		runs := projection.AggregateRuns(bus)
		agentID := r.URL.Query().Get("agentId")
		sessionKey := r.URL.Query().Get("sessionKey")
		status := r.URL.Query().Get("status")
		since := r.URL.Query().Get("since")
		until := r.URL.Query().Get("until")
		cursor := r.URL.Query().Get("cursor")
		limit := 20
		if raw := r.URL.Query().Get("limit"); raw != "" {
			if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
				limit = parsed
			}
		}
		filtered := make([]projection.RunRecord, 0, len(runs))
		for _, run := range runs {
			if agentID != "" && run.AgentID != agentID {
				continue
			}
			if sessionKey != "" && run.SessionKey != sessionKey {
				continue
			}
			if status != "" && run.Status != status {
				continue
			}
			if since != "" && run.FirstEventAt < since {
				continue
			}
			if until != "" && run.FirstEventAt > until {
				continue
			}
			filtered = append(filtered, run)
		}
		sort.Slice(filtered, func(i, j int) bool { return filtered[i].LastEventAt > filtered[j].LastEventAt })
		startIdx := 0
		if cursor != "" {
			for idx, run := range filtered {
				if run.RunID == cursor {
					startIdx = idx + 1
					break
				}
			}
		}
		pageEnd := startIdx + limit
		if pageEnd > len(filtered) {
			pageEnd = len(filtered)
		}
		page := filtered[startIdx:pageEnd]
		nextCursor := any(nil)
		if pageEnd < len(filtered) && len(page) > 0 {
			nextCursor = page[len(page)-1].RunID
		}
		writeJSON(w, http.StatusOK, map[string]any{"runs": page, "nextCursor": nextCursor})
	})

	mux.MethodFunc("GET", "/monitor/runs/{runId}", func(w http.ResponseWriter, r *http.Request) {
		runID := chi.URLParam(r, "runId")
		runs := projection.AggregateRuns(bus)
		detailEvents := projection.AggregateRunEvents(bus, runID)
		for _, run := range runs {
			if run.RunID != runID {
				continue
			}
			firstAt, _ := time.Parse(time.RFC3339, run.FirstEventAt)
			lastAt, _ := time.Parse(time.RFC3339, run.LastEventAt)
			writeJSON(w, http.StatusOK, map[string]any{
				"summary": map[string]any{
					"toolCalls":      run.ToolCalls,
					"modelCalls":     run.ModelCalls,
					"fileOps":        run.FileOps,
					"subagentSpawns": run.SubagentSpawns,
					"compacted":      run.Compacted,
					"totalTokens":    run.TotalTokens,
					"durationMs":     lastAt.Sub(firstAt).Milliseconds(),
					"eventCount":     run.EventCount,
				},
				"events": detailEvents,
			})
			return
		}
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "Run not found"})
	})

	mux.MethodFunc("GET", "/monitor/stats", func(w http.ResponseWriter, _ *http.Request) {
		stats := projection.BuildMonitorStats(projection.AggregateRuns(bus), time.Now())
		writeJSON(w, http.StatusOK, stats)
	})
}
