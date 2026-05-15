package controld

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
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
	_ "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/local"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/envconf"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
	openclawrt "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/openclaw"
	runtimeregistry "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/registry"
	_ "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/remote"
	runtimestate "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/state"
	"github.com/openclaw/openclaw/deck-go/backend/internal/server"
)

var _ httpapi.MountRoutesProvider = (*openclawrt.ManagedRuntime)(nil)

const defaultListenAddr = "127.0.0.1:19528"

type EnvLookup func(string) string

type Dependencies struct {
	Store         *config.Store
	Runtime       openclawrt.ManagedRuntimeSurface
	RuntimeFacade facade.RuntimeFacade
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

func ValidateListenAddrSecurity(addr string, getenv EnvLookup) error {
	host := listenHost(addr)
	if isLoopbackListenHost(host) {
		return nil
	}
	if hasTLSConfig(getenv) {
		return nil
	}
	return fmt.Errorf("deck-go HTTP bind address %q is not loopback; configure TLS or bind to 127.0.0.1", addr)
}

func listenHost(addr string) string {
	host, _, err := net.SplitHostPort(strings.TrimSpace(addr))
	if err == nil {
		return strings.Trim(host, "[]")
	}
	if strings.HasPrefix(addr, ":") {
		return ""
	}
	return strings.TrimSpace(addr)
}

func isLoopbackListenHost(host string) bool {
	host = strings.TrimSpace(strings.Trim(host, "[]"))
	if strings.EqualFold(host, "localhost") {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func hasTLSConfig(getenv EnvLookup) bool {
	if getenv == nil {
		return false
	}
	cert := strings.TrimSpace(getenv("DECK_GO_TLS_CERT_FILE"))
	key := strings.TrimSpace(getenv("DECK_GO_TLS_KEY_FILE"))
	return cert != "" && key != ""
}

func NewDependenciesFromEnv() (*Dependencies, error) {
	loaded, err := envconf.Load(envconf.Options{})
	if err != nil {
		return nil, err
	}
	runtimeFacade, err := facade.BuildFacade(&loaded, runtimestate.Open(ResolveDeckStatePath()))
	if err != nil {
		return nil, err
	}
	return NewDependenciesWithRuntimeFacade(loaded, runtimeFacade)
}

func NewDependenciesWithRuntimeFacade(_ envconf.Loaded, runtimeFacade facade.RuntimeFacade) (*Dependencies, error) {
	store, err := config.NewStore()
	if err != nil {
		return nil, err
	}
	bus := events.NewBus(2000)
	managed := openclawrt.NewManagedRuntimeWithFacade(store, runtimeFacade, bus)
	return &Dependencies{
		Store:         store,
		Runtime:       managed,
		RuntimeFacade: runtimeFacade,
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
			w.Header().Set(
				"Access-Control-Allow-Headers",
				"Authorization, Content-Type, Last-Event-ID, x-deck-token, X-Request-Id",
			)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
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
		api.Use(server.GatewayConfiguredMiddleware(deps.RuntimeFacade))
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
			managed,
		)
		runtimeQueries := httpapi.RuntimeQueryProvider(registry)
		if deps.RuntimeFacade != nil {
			override := runtimeSummaryOverride{base: registry, runtime: deps.RuntimeFacade}
			if recorder, ok := managed.(runtimeStatusRecorder); ok {
				override.recorder = recorder
			}
			runtimeQueries = override
		}
		httpapi.MountRoutes(
			api,
			runtimeQueries,
			managed.SessionQueries(),
			managed,
			managed,
			managed,
		)
		wsapi.MountRoutes(api, registry)
	})

	root.Mount("/", server.NewRootHandlerWithRuntimeFacade(deps.Store, managed, deps.RuntimeFacade))
	return root
}

type runtimeSummaryOverride struct {
	base     httpapi.RuntimeQueryProvider
	runtime  facade.RuntimeFacade
	recorder runtimeStatusRecorder
}

type runtimeStatusRecorder interface {
	RecordRuntimeStatus(facade.RuntimeStatus)
}

func (p runtimeSummaryOverride) ListRuntimes(ctx context.Context) ([]runtimeregistry.RuntimeSummary, error) {
	items, err := p.base.ListRuntimes(ctx)
	if err != nil {
		return nil, err
	}
	for index := range items {
		items[index] = p.apply(ctx, items[index])
	}
	return items, nil
}

func (p runtimeSummaryOverride) GetRuntime(ctx context.Context, runtimeID string) (runtimeregistry.RuntimeSummary, bool, error) {
	item, ok, err := p.base.GetRuntime(ctx, runtimeID)
	if err != nil || !ok {
		return item, ok, err
	}
	return p.apply(ctx, item), true, nil
}

func (p runtimeSummaryOverride) apply(ctx context.Context, item runtimeregistry.RuntimeSummary) runtimeregistry.RuntimeSummary {
	if p.runtime == nil {
		return item
	}
	caps, err := p.runtime.Capabilities(ctx)
	if err != nil || caps.Mode != string(envconf.ModeRemote) {
		return item
	}
	item.Managed = false
	item.Configured = caps.Configured
	item.AutoStart = false
	status, err := p.runtime.RuntimeGatewayStatus(ctx)
	if err != nil {
		item.Status = "failed"
		item.Health = "unhealthy"
		lastError := err.Error()
		item.LastError = &lastError
		return item
	}
	if status.Status != "" {
		item.Status = status.Status
	}
	if status.Health != "" {
		item.Health = status.Health
	}
	if strings.TrimSpace(status.GatewayURL) != "" {
		item.GatewayURL = &status.GatewayURL
	}
	if status.LastError != nil && strings.TrimSpace(*status.LastError) != "" {
		item.LastError = status.LastError
	} else {
		item.LastError = nil
	}
	p.record(status)
	return item
}

func (p runtimeSummaryOverride) record(status facade.RuntimeStatus) {
	if p.recorder == nil || isRuntimeStatusEmpty(status) {
		return
	}
	p.recorder.RecordRuntimeStatus(status)
}

func isRuntimeStatusEmpty(status facade.RuntimeStatus) bool {
	return status.Mode == "" && status.Status == ""
}

func ResolveDeckStatePath() string {
	if explicit := strings.TrimSpace(os.Getenv("DECK_STATE_PATH")); explicit != "" {
		return explicit
	}
	if dataDir := strings.TrimSpace(os.Getenv("DECK_GO_DATA_DIR")); dataDir != "" {
		return filepath.Join(dataDir, "deck-state.json")
	}
	if home, err := os.UserHomeDir(); err == nil {
		return filepath.Join(home, ".openclaw", "deck-go", "deck-state.json")
	}
	return "deck-state.json"
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
