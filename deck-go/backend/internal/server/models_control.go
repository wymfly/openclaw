package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway/generated"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/coerce"
	openclawrt "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/openclaw"
)

// modelsControlSurface is the minimal Gateway/runtime dependency needed by the
// typed Models BFF routes. It is split from LegacyInventorySurface so handler
// tests can supply a fake without standing up the whole runtime.
type modelsControlSurface interface {
	ConfigGet(ctx context.Context) (any, error)
	ConfigPatch(ctx context.Context, raw string, baseHash string, note string) (any, error)
	ModelsCatalogProviders(ctx context.Context) (any, error)
	ModelsConfigured(ctx context.Context) (any, error)
	DeckAuthOverview(ctx context.Context) (any, error)
}

// modelsControlImpactStore retains recently issued impact preview tokens so
// commit handlers can verify the preview is fresh and matches the current
// reference index. It is keyed by impactToken.
type modelsControlImpactStore struct {
	entries map[string]modelsControlImpactRecord
}

type modelsControlImpactRecord struct {
	Scope         string
	ProviderID    string
	ModelID       string
	Mode          string
	BaseHash      string
	ReferenceHash string
	IssuedAt      time.Time
}

func newModelsControlImpactStore() *modelsControlImpactStore {
	return &modelsControlImpactStore{entries: map[string]modelsControlImpactRecord{}}
}

const (
	modelsControlImpactTTL          = 5 * time.Minute
	modelsControlConfirmDeleteText  = "delete"
	modelsControlConfirmModeReplace = "replace"
)

func (s *modelsControlImpactStore) put(token string, record modelsControlImpactRecord) {
	if s == nil {
		return
	}
	s.gc()
	s.entries[token] = record
}

func (s *modelsControlImpactStore) consume(token string) (modelsControlImpactRecord, bool) {
	if s == nil {
		return modelsControlImpactRecord{}, false
	}
	s.gc()
	rec, ok := s.entries[token]
	if !ok {
		return modelsControlImpactRecord{}, false
	}
	delete(s.entries, token)
	return rec, true
}

func (s *modelsControlImpactStore) gc() {
	cutoff := time.Now().Add(-modelsControlImpactTTL)
	for k, v := range s.entries {
		if v.IssuedAt.Before(cutoff) {
			delete(s.entries, k)
		}
	}
}

// registerModelsControlRoutes mounts the typed Models BFF surface. The raw
// GET /models/config and PATCH /models/config routes registered by the
// inventory surface remain available and are reserved for the advanced editor
// fallback flow only.
func registerModelsControlRoutes(mux interface {
	MethodFunc(string, string, http.HandlerFunc)
}, adapter *openclawrt.LegacyInventorySurface) {
	store := newModelsControlImpactStore()
	mountModelsControlRoutes(mux, adapter, store)
}

func mountModelsControlRoutes(mux interface {
	MethodFunc(string, string, http.HandlerFunc)
}, adapter modelsControlSurface, store *modelsControlImpactStore) {
	mux.MethodFunc("GET", "/models/config/detail", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		response, err := buildModelsConfigDetail(ctx, adapter)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{
				"ok":     false,
				"method": "models.config.detail",
				"error":  err.Error(),
			})
			return
		}
		writeJSON(w, http.StatusOK, response)
	})

	mux.MethodFunc("POST", "/models/providers/upsert", func(w http.ResponseWriter, r *http.Request) {
		var req deckapi.DeckGoModelProviderUpsertRequest
		if err := decodeModelsControlBody(r, &req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		response, status, err := handleProviderUpsert(ctx, adapter, req)
		if err != nil {
			writeJSON(w, status, map[string]any{
				"ok":         false,
				"method":     "models.providers.upsert",
				"providerId": req.ProviderId,
				"error":      err.Error(),
			})
			return
		}
		writeJSON(w, http.StatusOK, response)
	})

	mux.MethodFunc("POST", "/models/providers/delete-preview", func(w http.ResponseWriter, r *http.Request) {
		var req deckapi.DeckGoModelProviderDeletePreviewRequest
		if err := decodeModelsControlBody(r, &req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		response, status, err := handleProviderDeletePreview(ctx, adapter, store, req)
		if err != nil {
			writeJSON(w, status, map[string]any{
				"ok":         false,
				"method":     "models.providers.delete-preview",
				"providerId": req.ProviderId,
				"error":      err.Error(),
			})
			return
		}
		writeJSON(w, http.StatusOK, response)
	})

	mux.MethodFunc("POST", "/models/providers/delete", func(w http.ResponseWriter, r *http.Request) {
		var req deckapi.DeckGoModelProviderDeleteCommitRequest
		if err := decodeModelsControlBody(r, &req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		response, status, err := handleProviderDeleteCommit(ctx, adapter, store, req)
		if err != nil {
			writeJSON(w, status, map[string]any{
				"ok":         false,
				"method":     "models.providers.delete",
				"providerId": req.ProviderId,
				"error":      err.Error(),
			})
			return
		}
		writeJSON(w, http.StatusOK, response)
	})

	mux.MethodFunc("POST", "/models/models/upsert", func(w http.ResponseWriter, r *http.Request) {
		var req deckapi.DeckGoModelUpsertRequest
		if err := decodeModelsControlBody(r, &req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		response, status, err := handleModelUpsert(ctx, adapter, req)
		if err != nil {
			writeJSON(w, status, map[string]any{
				"ok":         false,
				"method":     "models.models.upsert",
				"providerId": req.ProviderId,
				"modelId":    req.ModelId,
				"error":      err.Error(),
			})
			return
		}
		writeJSON(w, http.StatusOK, response)
	})

	mux.MethodFunc("POST", "/models/models/delete-preview", func(w http.ResponseWriter, r *http.Request) {
		var req deckapi.DeckGoModelDeletePreviewRequest
		if err := decodeModelsControlBody(r, &req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		response, status, err := handleModelDeletePreview(ctx, adapter, store, req)
		if err != nil {
			writeJSON(w, status, map[string]any{
				"ok":         false,
				"method":     "models.models.delete-preview",
				"providerId": req.ProviderId,
				"modelId":    req.ModelId,
				"error":      err.Error(),
			})
			return
		}
		writeJSON(w, http.StatusOK, response)
	})

	mux.MethodFunc("POST", "/models/models/delete", func(w http.ResponseWriter, r *http.Request) {
		var req deckapi.DeckGoModelDeleteCommitRequest
		if err := decodeModelsControlBody(r, &req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		response, status, err := handleModelDeleteCommit(ctx, adapter, store, req)
		if err != nil {
			writeJSON(w, status, map[string]any{
				"ok":         false,
				"method":     "models.models.delete",
				"providerId": req.ProviderId,
				"modelId":    req.ModelId,
				"error":      err.Error(),
			})
			return
		}
		writeJSON(w, http.StatusOK, response)
	})

	mux.MethodFunc("POST", "/models/mode/set", func(w http.ResponseWriter, r *http.Request) {
		var req deckapi.DeckGoModelModeSetRequest
		if err := decodeModelsControlBody(r, &req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		response, status, err := handleModeSet(ctx, adapter, store, req)
		if err != nil {
			writeJSON(w, status, map[string]any{
				"ok":     false,
				"method": "models.mode.set",
				"mode":   req.Mode,
				"error":  err.Error(),
			})
			return
		}
		writeJSON(w, http.StatusOK, response)
	})
}

func decodeModelsControlBody(r *http.Request, into any) error {
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(into); err != nil {
		if err.Error() == "EOF" {
			return errors.New("request body is required")
		}
		return fmt.Errorf("invalid request body: %w", err)
	}
	return nil
}

// errModelsControlBaseHashRequired is returned when a typed mutation request
// is missing the expected base hash.
var errModelsControlBaseHashRequired = errors.New("expectedBaseHash is required")

// errModelsControlConflict is returned when Gateway reports a base-hash
// conflict during a typed Models write.
var errModelsControlConflict = errors.New("config base hash conflict; reload and try again")

// errModelsControlImpactStale signals the supplied impactToken is missing,
// expired, or no longer matches the current reference index.
var errModelsControlImpactStale = errors.New("impact preview is stale; please re-run the preview")

func validateBaseHash(hash string) error {
	if strings.TrimSpace(hash) == "" {
		return errModelsControlBaseHashRequired
	}
	return nil
}

// buildModelsConfigDetail loads the current config and runtime read summaries,
// projects them into the typed Models config detail DTO, and returns the
// response wrapped envelope.
func buildModelsConfigDetail(ctx context.Context, adapter modelsControlSurface) (deckapi.DeckGoModelsConfigDetailResponse, error) {
	configPayload, err := adapter.ConfigGet(ctx)
	if err != nil {
		return deckapi.DeckGoModelsConfigDetailResponse{}, fmt.Errorf("config.get failed: %w", err)
	}
	configMap, hash, configPresent := extractConfigMap(configPayload)

	catalog, catalogErr := adapter.ModelsCatalogProviders(ctx)
	auth, authErr := adapter.DeckAuthOverview(ctx)

	refIndex := buildModelReferenceIndex(configMap)
	detail := projectModelsConfigDetail(configMap, hash, configPresent, refIndex)
	detail.Runtime = projectRuntimeSummary(catalog, catalogErr, auth, authErr)

	return deckapi.DeckGoModelsConfigDetailResponse{Detail: detail}, nil
}

func extractConfigMap(payload any) (map[string]any, string, bool) {
	if result, ok := payload.(generated.ConfigGetResult); ok {
		for _, candidate := range []any{result.Config, result.Parsed, result.Resolved, result.SourceConfig} {
			if record := coerce.Map(candidate); record != nil {
				return record, result.Hash, result.Exists
			}
		}
		return map[string]any{}, result.Hash, result.Exists
	}
	record := coerce.Map(payload)
	hash := coerce.String(record["hash"], "")
	for _, key := range []string{"config", "parsed", "resolved", "sourceConfig"} {
		if nested := coerce.Map(record[key]); nested != nil {
			return nested, hash, true
		}
	}
	return map[string]any{}, hash, false
}

// projectRuntimeSummary classifies the Gateway runtime read calls into the
// catalog/auth/probe summary that the typed config detail surfaces. The probe
// status is reported as available whenever the runtime is reachable; the BFF
// does not invoke deck.auth.probe here because probes can touch external
// providers.
func projectRuntimeSummary(catalog any, catalogErr error, auth any, authErr error) deckapi.DeckGoModelsConfigDetailRuntime {
	summary := deckapi.DeckGoModelsConfigDetailRuntime{
		CatalogStatus: "unavailable",
		AuthStatus:    "unavailable",
		ProbeStatus:   "unavailable",
	}
	if catalogErr == nil {
		providers := extractCatalogProviderCount(catalog)
		summary.CatalogStatus = "available"
		summary.CatalogProviderCount = float64(providers)
	}
	if authErr == nil {
		summary.AuthStatus = "available"
		summary.AuthProviderCount = float64(extractAuthProviderCount(auth))
		summary.ProbeStatus = "available"
	}
	return summary
}

func extractCatalogProviderCount(payload any) int {
	if payload == nil {
		return 0
	}
	if result, ok := payload.(generated.ModelsCatalogProvidersResult); ok {
		return len(result.Providers)
	}
	record := coerce.Map(payload)
	if providers, ok := record["providers"].([]any); ok {
		return len(providers)
	}
	if nested := coerce.Map(record["payload"]); nested != nil {
		if providers, ok := nested["providers"].([]any); ok {
			return len(providers)
		}
	}
	return 0
}

func extractAuthProviderCount(payload any) int {
	if payload == nil {
		return 0
	}
	if result, ok := payload.(generated.DeckAuthOverviewResult); ok {
		return len(result.Providers)
	}
	record := coerce.Map(payload)
	if providers, ok := record["providers"].([]any); ok {
		return len(providers)
	}
	if nested := coerce.Map(record["payload"]); nested != nil {
		if providers, ok := nested["providers"].([]any); ok {
			return len(providers)
		}
	}
	return 0
}

// sortedKeys returns the keys of a map[string]any in deterministic order.
func sortedKeys(m map[string]any) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}
