package controld

import (
	"context"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/openclaw/openclaw/deck-go/backend/internal/access"
	httpapi "github.com/openclaw/openclaw/deck-go/backend/internal/api/http"
	wsapi "github.com/openclaw/openclaw/deck-go/backend/internal/api/ws"
	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
	"github.com/openclaw/openclaw/deck-go/backend/internal/localstore"
	openclawrt "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/openclaw"
	"github.com/openclaw/openclaw/deck-go/backend/internal/server"
)

const defaultListenAddr = "127.0.0.1:19528"

type EnvLookup func(string) string

type Dependencies struct {
	Store   *config.Store
	Runtime openclawrt.ManagedRuntimeSurface
}

func ResolveListenAddr(getenv EnvLookup) string {
	if getenv == nil {
		return defaultListenAddr
	}
	if addr := strings.TrimSpace(getenv("CONTROLD_ADDR")); addr != "" {
		return addr
	}
	if addr := strings.TrimSpace(getenv("DECK_GO_ADDR")); addr != "" {
		return addr
	}
	return defaultListenAddr
}

func NewHandler() http.Handler {
	deps, err := NewDependencies()
	if err != nil {
		panic(err)
	}
	return NewHandlerWithDependencies(deps)
}

func NewDependencies() (*Dependencies, error) {
	store, err := config.NewStore()
	if err != nil {
		return nil, err
	}
	bus := events.NewBus(2000)
	managed := openclawrt.NewManagedRuntime(store, bus)
	managed.EnsureAutoStart()
	return &Dependencies{
		Store:   store,
		Runtime: managed,
	}, nil
}

func NewHandlerWithDependencies(deps *Dependencies) http.Handler {
	if deps == nil || deps.Store == nil || deps.Runtime == nil {
		panic("controld dependencies are incomplete")
	}
	managed := deps.Runtime
	bus := managed.EventBus()
	registry := managed.RuntimeRegistry()
	if managed.GatewayQueries() == nil || managed.SessionCommands() == nil || managed.SessionQueries() == nil || managed.SessionSubscriptions() == nil || bus == nil || registry == nil {
		panic("controld managed runtime is incomplete")
	}

	root := chi.NewRouter()
	root.Use(func(next http.Handler) http.Handler {
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

	root.Route("/api/v1", func(api chi.Router) {
		api.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				valid, message := access.ValidateRequest(req, deps.Store)
				if !valid {
					http.Error(w, message, http.StatusUnauthorized)
					return
				}
				next.ServeHTTP(w, req)
			})
		})
		httpapi.MountAdminRoutes(
			api,
			managed,
			alertAdapter{},
			webhookAdapter{},
			managed,
			managed,
			managed,
			managed,
			managed,
			managed,
			managed,
			managed,
			managed,
			managed,
			managed,
		)
		httpapi.MountRoutes(
			api,
			registry,
			managed.SessionQueries(),
			managed,
			managed,
			managed,
			managed,
			managed,
			managed,
			managed,
			managed,
			managed,
			managed,
			managed,
			managed,
			managed,
			managed,
		)
		wsapi.MountRoutes(api, registry)
	})

	root.Mount("/", server.NewRootHandler(deps.Store, managed))
	return root
}

type alertAdapter struct{}

func (a alertAdapter) ListAlerts(ctx context.Context) (map[string]any, error) {
	rules := localstore.GetAlertRuleStore().All()
	slices.SortFunc(rules, func(left, right localstore.AlertRule) int {
		switch {
		case left.CreatedAt > right.CreatedAt:
			return -1
		case left.CreatedAt < right.CreatedAt:
			return 1
		default:
			return 0
		}
	})
	return map[string]any{"rules": rules}, nil
}

func (a alertAdapter) CreateAlert(ctx context.Context, input httpapi.AlertCreateInput) (map[string]any, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	cooldownMs := 300000.0
	if input.CooldownMs != nil {
		cooldownMs = *input.CooldownMs
	}
	enabled := true
	if input.Enabled != nil {
		enabled = *input.Enabled
	}
	action := input.Action
	if action == "" {
		action = "toast"
	}
	rule := localstore.AlertRule{
		ID:          "ar-" + randomHexID(6),
		Name:        input.Name,
		EntityType:  input.EntityType,
		Condition:   input.Condition,
		Threshold:   *input.Threshold,
		Action:      action,
		CooldownMs:  cooldownMs,
		LastFiredAt: nil,
		Enabled:     enabled,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	localstore.GetAlertRuleStore().Append(rule)
	return map[string]any{"rule": rule}, nil
}

func (a alertAdapter) UpdateAlert(ctx context.Context, ruleID string, patch httpapi.AlertPatchInput) (map[string]any, bool, error) {
	store := localstore.GetAlertRuleStore()
	if _, ok := store.Find(func(item localstore.AlertRule) bool { return item.ID == ruleID }); !ok {
		return nil, false, nil
	}
	store.UpdateItem(func(item localstore.AlertRule) bool { return item.ID == ruleID }, func(item localstore.AlertRule) localstore.AlertRule {
		item.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
		if patch.Name != nil {
			item.Name = *patch.Name
		}
		if patch.EntityType != nil {
			item.EntityType = *patch.EntityType
		}
		if patch.Condition != nil {
			item.Condition = *patch.Condition
		}
		if patch.Threshold != nil {
			item.Threshold = *patch.Threshold
		}
		if patch.Action != nil {
			item.Action = *patch.Action
		}
		if patch.CooldownMs != nil {
			item.CooldownMs = *patch.CooldownMs
		}
		if patch.Enabled != nil {
			item.Enabled = *patch.Enabled
		}
		return item
	})
	updated, _ := store.Find(func(item localstore.AlertRule) bool { return item.ID == ruleID })
	return map[string]any{"rule": updated}, true, nil
}

func (a alertAdapter) DeleteAlert(ctx context.Context, ruleID string) (bool, error) {
	removed := localstore.GetAlertRuleStore().RemoveWhere(func(item localstore.AlertRule) bool { return item.ID == ruleID })
	return removed > 0, nil
}

func randomHexID(bytes int) string {
	const alphabet = "0123456789abcdef"
	buf := make([]byte, bytes)
	now := time.Now().UnixNano()
	for i := range buf {
		buf[i] = alphabet[int((now>>uint(i*4))&0xf)]
	}
	return string(buf)
}
