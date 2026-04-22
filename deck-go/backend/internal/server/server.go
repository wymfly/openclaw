package server

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/openclaw/openclaw/deck-go/backend/internal/access"
	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
	openclawrt "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/openclaw"
)

func New() http.Handler {
	store, err := config.NewStore()
	if err != nil {
		panic(err)
	}
	bus := events.NewBus(2000)
	managed := openclawrt.NewManagedRuntime(store, bus)
	managed.EnsureAutoStart()
	return NewRootHandler(store, managed)
}

func NewRootHandler(store *config.Store, managed openclawrt.ManagedRuntimeSurface) http.Handler {
	if managed == nil {
		panic("managed runtime is required")
	}
	bus := managed.EventBus()
	if bus == nil {
		panic("managed runtime event bus is required")
	}

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
		registerOnboardingRoutes(api, managed)
		registerSettingsRoutes(api, managed)
		registerGatewayRoutes(api, managed)
		registerConfigRoutes(api, managed)
		registerInventoryRoutes(api, openclawrt.NewLegacyInventorySurface(managed))
		registerAlertsRoutes(api)
		registerBudgetRoutes(api, managed, bus)
		registerWebhookRoutes(api)
		registerDocsRoutes(api, managed)
		registerActivityMonitorRoutes(api, bus)
		registerMemoryRoutes(api, managed)
		registerAssetRoutes(api, store)
		registerChatRoutes(api, managed)
		registerSessionEventRoute(api, managed)
		registerChatSnapshotRoute(api, managed)
		registerEventStreamRoutes(api, managed)
		registerRuntimeRoutes(api, managed)
	})

	registerGatewayCallbackProxyRoutes(r, store)
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
