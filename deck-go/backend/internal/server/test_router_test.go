package server

import (
	"context"
	"net/http"

	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/bundled"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
	openclawrt "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/openclaw"
)

type managedRuntimeHarnessProvider interface {
	openclawrt.ManagedConnectionProvider
	Snapshot() bundled.Snapshot
	Start(context.Context) (bundled.Snapshot, error)
	Stop(context.Context) (bundled.Snapshot, error)
	Restart(context.Context) (bundled.Snapshot, error)
}

func newManagedTestRouter(store *config.Store, provider managedRuntimeHarnessProvider, bus *events.Bus) http.Handler {
	return NewRootHandler(store, openclawrt.NewManagedRuntimeWithStoreAndSupervisor(store, provider, bus))
}

func newTestRouter(store *config.Store, provider managedRuntimeHarnessProvider, bus *events.Bus) http.Handler {
	return newManagedTestRouter(store, provider, bus)
}

func newTestRouterWithFacade(
	store *config.Store,
	provider managedRuntimeHarnessProvider,
	bus *events.Bus,
	runtimeFacade facade.RuntimeFacade,
) http.Handler {
	managed := openclawrt.NewManagedRuntimeWithStoreAndSupervisor(store, provider, bus)
	return NewRootHandlerWithRuntimeFacade(store, managed, runtimeFacade)
}
