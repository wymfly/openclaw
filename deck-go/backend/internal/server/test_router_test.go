package server

import (
	"net/http"

	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
	openclawrt "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/openclaw"
)

type managedRuntimeHarnessProvider interface {
	facade.RuntimeFacade
}

func newManagedTestRouter(store *config.Store, provider managedRuntimeHarnessProvider, bus *events.Bus) http.Handler {
	return NewRootHandler(store, openclawrt.NewManagedRuntimeWithFacade(store, provider, bus))
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
	_ = provider
	managed := openclawrt.NewManagedRuntimeWithFacade(store, runtimeFacade, bus)
	return NewRootHandlerWithRuntimeFacade(store, managed, runtimeFacade)
}
