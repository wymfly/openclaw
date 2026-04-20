package server

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/openclaw/openclaw/deck-go/backend/internal/access"
	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway"
	runtimecontrol "github.com/openclaw/openclaw/deck-go/backend/internal/runtime"
)

func New() http.Handler {
	store, err := config.NewStore()
	if err != nil {
		panic(err)
	}
	bus := events.NewBus(2000)
	supervisor := runtimecontrol.NewSupervisor(store, bus)
	gatewayClient := gateway.New(supervisor)
	realtime := gateway.NewRealtime(supervisor, bus)
	supervisor.EnsureAutoStart()
	return newRouter(store, gatewayClient, realtime, supervisor, bus)
}

type gatewaySupervisor interface {
	Snapshot() runtimecontrol.Snapshot
	Start(context.Context) (runtimecontrol.Snapshot, error)
	Stop(context.Context) (runtimecontrol.Snapshot, error)
	Restart(context.Context) (runtimecontrol.Snapshot, error)
}

func newRouter(
	store *config.Store,
	gatewayClient *gateway.Client,
	realtime *gateway.Realtime,
	supervisor gatewaySupervisor,
	bus *events.Bus,
) http.Handler {
	r := chi.NewRouter()
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, x-deck-token")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, OPTIONS")
			if req.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, req)
		})
	})
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			valid, message := access.ValidateRequest(req, store)
			if !valid {
				writeJSON(w, http.StatusUnauthorized, map[string]any{
					"ok":    false,
					"error": message,
				})
				return
			}
			next.ServeHTTP(w, req)
		})
	})

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":      true,
			"service": "deck-go-backend",
		})
	})

	r.Route("/api", func(api chi.Router) {
		registerSettingsRoutes(api, store, bus)
		registerGatewayRoutes(api, gatewayClient, store, supervisor)
		registerConfigRoutes(api, gatewayClient)
		registerInventoryRoutes(api, gatewayClient)
		registerChatRoutes(api, gatewayClient)
		registerSessionEventRoute(api, realtime)
		registerChatSnapshotRoute(api, gatewayClient)
		registerEventStreamRoutes(api, bus, gatewayClient)
		registerRuntimeRoutes(api, supervisor)
	})

	registerStaticRoutes(r)

	return r
}

func notImplemented(surface string) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusNotImplemented, map[string]any{
			"ok":      false,
			"surface": surface,
			"error":   "not implemented in scaffold",
		})
	}
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
