package server

import (
	"context"
	"net/http"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	runtimecontrol "github.com/openclaw/openclaw/deck-go/backend/internal/runtime"
)

type RuntimeLifecycleProvider interface {
	Snapshot() runtimecontrol.Snapshot
	Start(context.Context) (runtimecontrol.Snapshot, error)
	Stop(context.Context) (runtimecontrol.Snapshot, error)
	Restart(context.Context) (runtimecontrol.Snapshot, error)
}

func registerRuntimeRoutes(
	mux interface {
		MethodFunc(string, string, http.HandlerFunc)
	},
	lifecycle RuntimeLifecycleProvider,
) {
	mux.MethodFunc("GET", "/runtime/gateway", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, runtimeGatewayStatusResponse(lifecycleSnapshot(lifecycle)))
	})

	mux.MethodFunc("POST", "/runtime/gateway/start", func(w http.ResponseWriter, r *http.Request) {
		runRuntimeAction(w, r, lifecycleAction(lifecycle, RuntimeLifecycleProvider.Start))
	})
	mux.MethodFunc("POST", "/runtime/gateway/stop", func(w http.ResponseWriter, r *http.Request) {
		runRuntimeAction(w, r, lifecycleAction(lifecycle, RuntimeLifecycleProvider.Stop))
	})
	mux.MethodFunc("POST", "/runtime/gateway/restart", func(w http.ResponseWriter, r *http.Request) {
		runRuntimeAction(w, r, lifecycleAction(lifecycle, RuntimeLifecycleProvider.Restart))
	})
}

func runtimeGatewayStatusResponse(snapshot runtimecontrol.Snapshot) deckapi.DeckGoRuntimeGatewayActionResponse {
	return deckapi.DeckGoRuntimeGatewayActionResponse{
		Ok:      true,
		Runtime: runtimeGatewayStatus(snapshot),
	}
}

func runtimeGatewayStatus(snapshot runtimecontrol.Snapshot) deckapi.DeckGoRuntimeGatewayStatus {
	return deckapi.DeckGoRuntimeGatewayStatus{
		Managed:      snapshot.Managed,
		Configured:   snapshot.Configured,
		Status:       string(snapshot.Status),
		FailurePhase: snapshot.FailurePhase,
		Pid:          float64(snapshot.PID),
		StartedAt:    snapshot.StartedAt,
		LastExitAt:   snapshot.LastExitAt,
		LastExitCode: float64(snapshot.LastExitCode),
		Health:       string(snapshot.Health),
		GatewayUrl:   snapshot.GatewayURL,
		LastError:    snapshot.LastError,
		AutoStart:    snapshot.AutoStart,
	}
}

func lifecycleSnapshot(lifecycle RuntimeLifecycleProvider) runtimecontrol.Snapshot {
	if lifecycle == nil {
		return runtimecontrol.Snapshot{}
	}
	return lifecycle.Snapshot()
}

func lifecycleAction(
	lifecycle RuntimeLifecycleProvider,
	action func(RuntimeLifecycleProvider, context.Context) (runtimecontrol.Snapshot, error),
) func(context.Context) (deckapi.DeckGoRuntimeGatewayActionResponse, error) {
	return func(ctx context.Context) (deckapi.DeckGoRuntimeGatewayActionResponse, error) {
		if lifecycle == nil {
			return runtimeGatewayStatusResponse(runtimecontrol.Snapshot{}), nil
		}
		snapshot, err := action(lifecycle, ctx)
		return deckapi.DeckGoRuntimeGatewayActionResponse{
			Ok:      err == nil,
			Runtime: runtimeGatewayStatus(snapshot),
		}, err
	}
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
