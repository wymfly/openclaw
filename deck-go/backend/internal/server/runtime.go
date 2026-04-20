package server

import (
	"context"
	"net/http"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	runtimecontrol "github.com/openclaw/openclaw/deck-go/backend/internal/runtime"
)

func registerRuntimeRoutes(
	mux interface {
		MethodFunc(string, string, http.HandlerFunc)
	},
	supervisor gatewaySupervisor,
) {
	mux.MethodFunc("GET", "/runtime/gateway", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, deckapi.DeckGoRuntimeGatewayActionResponse{
			Ok:      true,
			Runtime: toRuntimeStatus(supervisor.Snapshot()),
		})
	})

	mux.MethodFunc("POST", "/runtime/gateway/start", func(w http.ResponseWriter, r *http.Request) {
		runRuntimeAction(w, r, supervisor.Start)
	})
	mux.MethodFunc("POST", "/runtime/gateway/stop", func(w http.ResponseWriter, r *http.Request) {
		runRuntimeAction(w, r, supervisor.Stop)
	})
	mux.MethodFunc("POST", "/runtime/gateway/restart", func(w http.ResponseWriter, r *http.Request) {
		runRuntimeAction(w, r, supervisor.Restart)
	})
}

func runRuntimeAction(
	w http.ResponseWriter,
	r *http.Request,
	action func(context.Context) (runtimecontrol.Snapshot, error),
) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Minute)
	defer cancel()

	snapshot, err := action(ctx)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"ok":      false,
			"runtime": toRuntimeStatus(snapshot),
			"error":   err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, deckapi.DeckGoRuntimeGatewayActionResponse{
		Ok:      true,
		Runtime: toRuntimeStatus(snapshot),
	})
}
