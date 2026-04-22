package server

import (
	"context"
	"net/http"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	openclawrt "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/openclaw"
)

func registerRuntimeRoutes(
	mux interface {
		MethodFunc(string, string, http.HandlerFunc)
	},
	managed openclawrt.ManagedRuntimeSurface,
) {
	mux.MethodFunc("GET", "/runtime/gateway", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, managed.RuntimeGatewayStatusResponse())
	})

	mux.MethodFunc("POST", "/runtime/gateway/start", func(w http.ResponseWriter, r *http.Request) {
		runRuntimeAction(w, r, managed.StartRuntimeGateway)
	})
	mux.MethodFunc("POST", "/runtime/gateway/stop", func(w http.ResponseWriter, r *http.Request) {
		runRuntimeAction(w, r, managed.StopRuntimeGateway)
	})
	mux.MethodFunc("POST", "/runtime/gateway/restart", func(w http.ResponseWriter, r *http.Request) {
		runRuntimeAction(w, r, managed.RestartRuntimeGateway)
	})
}

func runRuntimeAction(
	w http.ResponseWriter,
	r *http.Request,
	action func(context.Context) (deckapi.DeckGoRuntimeGatewayActionResponse, error),
) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Minute)
	defer cancel()

	payload, err := action(ctx)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"ok":      false,
			"runtime": payload.Runtime,
			"error":   err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, payload)
}
