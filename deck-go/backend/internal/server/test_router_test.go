package server

import (
	"net/http"

	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
	openclawrt "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/openclaw"
)

func newManagedTestRouter(store *config.Store, provider openclawrt.ManagedRuntimeSupervisor, bus *events.Bus) http.Handler {
	return NewRootHandler(store, openclawrt.NewManagedRuntimeWithStoreAndSupervisor(store, provider, bus))
}

func newTestRouter(store *config.Store, provider openclawrt.ManagedRuntimeSupervisor, bus *events.Bus) http.Handler {
	return newManagedTestRouter(store, provider, bus)
}
