package server

import (
	"context"
	"net/http"

	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
	runtimecontrol "github.com/openclaw/openclaw/deck-go/backend/internal/runtime"
	openclawrt "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/openclaw"
)

type managedRuntimeHarnessProvider interface {
	openclawrt.ManagedConnectionProvider
	Snapshot() runtimecontrol.Snapshot
	Start(context.Context) (runtimecontrol.Snapshot, error)
	Stop(context.Context) (runtimecontrol.Snapshot, error)
	Restart(context.Context) (runtimecontrol.Snapshot, error)
}

func newManagedTestRouter(store *config.Store, provider managedRuntimeHarnessProvider, bus *events.Bus) http.Handler {
	return NewRootHandler(store, openclawrt.NewManagedRuntimeWithStoreAndSupervisor(store, provider, bus))
}

func newTestRouter(store *config.Store, provider managedRuntimeHarnessProvider, bus *events.Bus) http.Handler {
	return newManagedTestRouter(store, provider, bus)
}
