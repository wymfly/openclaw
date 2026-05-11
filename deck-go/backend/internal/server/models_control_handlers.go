package server

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway/generated"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/coerce"
)

// classifyConfigPatchError classifies Gateway/runtime config-patch errors. The
// upstream Gateway surfaces base-hash conflicts as plain error strings; we
// detect them by substring so the BFF can map them to a stable typed status.
func classifyConfigPatchError(err error) (status int, mapped error) {
	if err == nil {
		return http.StatusOK, nil
	}
	msg := strings.ToLower(err.Error())
	conflictTokens := []string{"base hash", "basehash", "conflict", "stale", "expectedbasehash"}
	for _, token := range conflictTokens {
		if strings.Contains(msg, token) {
			return http.StatusConflict, errModelsControlConflict
		}
	}
	return http.StatusBadGateway, err
}

func newImpactToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate impact token: %w", err)
	}
	return hex.EncodeToString(buf), nil
}

// fetchConfigState pulls the current Gateway config and returns the parsed
// config map plus base hash. Errors are wrapped so callers can return a 502.
func fetchConfigState(ctx context.Context, adapter modelsControlSurface) (map[string]any, string, error) {
	payload, err := adapter.ConfigGet(ctx)
	if err != nil {
		return nil, "", fmt.Errorf("config.get failed: %w", err)
	}
	configMap, hash, _ := extractConfigMap(payload)
	return configMap, hash, nil
}

func extractConfigPatchHash(payload any) string {
	if result, ok := payload.(generated.ConfigPatchResult); ok {
		// ConfigPatchResult carries a Config payload that holds the new hash on
		// the Sentinel field on some runtimes. Fall back to a fresh ConfigGet.
		if record := coerce.Map(result.Config); record != nil {
			if hash := coerce.String(record["hash"], ""); hash != "" {
				return hash
			}
		}
	}
	if record := coerce.Map(payload); record != nil {
		if hash := coerce.String(record["hash"], ""); hash != "" {
			return hash
		}
		if config := coerce.Map(record["config"]); config != nil {
			if hash := coerce.String(config["hash"], ""); hash != "" {
				return hash
			}
		}
	}
	return ""
}

// readPostPatchHash returns the freshest hash by re-running config.get; this
// matches the Gateway contract where config.patch may not echo the new hash.
func readPostPatchHash(ctx context.Context, adapter modelsControlSurface) string {
	payload, err := adapter.ConfigGet(ctx)
	if err != nil {
		return ""
	}
	_, hash, _ := extractConfigMap(payload)
	return hash
}

func handleProviderUpsert(ctx context.Context, adapter modelsControlSurface, req deckapi.DeckGoModelProviderUpsertRequest) (deckapi.DeckGoModelProviderUpsertResponse, int, error) {
	if err := validateBaseHash(req.ExpectedBaseHash); err != nil {
		return deckapi.DeckGoModelProviderUpsertResponse{}, http.StatusBadRequest, err
	}
	if strings.TrimSpace(req.ProviderId) == "" {
		return deckapi.DeckGoModelProviderUpsertResponse{}, http.StatusBadRequest, errors.New("providerId is required")
	}
	configMap, hash, err := fetchConfigState(ctx, adapter)
	if err != nil {
		return deckapi.DeckGoModelProviderUpsertResponse{}, http.StatusBadGateway, err
	}
	if hash != req.ExpectedBaseHash {
		return deckapi.DeckGoModelProviderUpsertResponse{}, http.StatusConflict, errModelsControlConflict
	}
	patched, err := applyProviderUpsert(configMap, req)
	if err != nil {
		return deckapi.DeckGoModelProviderUpsertResponse{}, http.StatusBadRequest, err
	}
	raw, err := marshalConfig(patched)
	if err != nil {
		return deckapi.DeckGoModelProviderUpsertResponse{}, http.StatusInternalServerError, err
	}
	if _, err := adapter.ConfigPatch(ctx, raw, req.ExpectedBaseHash, ""); err != nil {
		status, mapped := classifyConfigPatchError(err)
		return deckapi.DeckGoModelProviderUpsertResponse{}, status, mapped
	}
	newHash := readPostPatchHash(ctx, adapter)
	return deckapi.DeckGoModelProviderUpsertResponse{
		Ok:         true,
		BaseHash:   hash,
		Hash:       newHash,
		ProviderId: req.ProviderId,
	}, http.StatusOK, nil
}

func handleProviderDeletePreview(ctx context.Context, adapter modelsControlSurface, store *modelsControlImpactStore, req deckapi.DeckGoModelProviderDeletePreviewRequest) (deckapi.DeckGoModelImpactPreviewResponse, int, error) {
	if err := validateBaseHash(req.ExpectedBaseHash); err != nil {
		return deckapi.DeckGoModelImpactPreviewResponse{}, http.StatusBadRequest, err
	}
	if strings.TrimSpace(req.ProviderId) == "" {
		return deckapi.DeckGoModelImpactPreviewResponse{}, http.StatusBadRequest, errors.New("providerId is required")
	}
	configMap, hash, err := fetchConfigState(ctx, adapter)
	if err != nil {
		return deckapi.DeckGoModelImpactPreviewResponse{}, http.StatusBadGateway, err
	}
	if hash != req.ExpectedBaseHash {
		return deckapi.DeckGoModelImpactPreviewResponse{}, http.StatusConflict, errModelsControlConflict
	}
	models := coerce.Map(configMap["models"])
	providers := coerce.Map(models["providers"])
	if providers == nil || providers[req.ProviderId] == nil {
		return deckapi.DeckGoModelImpactPreviewResponse{}, http.StatusNotFound, fmt.Errorf("provider %q not found", req.ProviderId)
	}
	refIndex := buildModelReferenceIndex(configMap)
	references := refIndex.ReferencesForProvider(req.ProviderId)
	references = nonNilModelReferences(references)
	severity := deckapi.DeckGoModelImpactSeverity("info")
	if len(references) > 0 {
		severity = deckapi.DeckGoModelImpactSeverity("block")
	}

	defaultsAffected := defaultsAffectedFromReferences(references)

	token, err := newImpactToken()
	if err != nil {
		return deckapi.DeckGoModelImpactPreviewResponse{}, http.StatusInternalServerError, err
	}
	now := time.Now()
	preview := deckapi.DeckGoModelImpactPreview{
		Scope:            "provider.delete",
		Severity:         severity,
		References:       references,
		DefaultsAffected: defaultsAffected,
		ImpactToken:      token,
		GeneratedAt:      float64(now.UnixMilli()),
		BaseHash:         hash,
	}
	store.put(token, modelsControlImpactRecord{
		Scope:         "provider.delete",
		ProviderID:    req.ProviderId,
		BaseHash:      hash,
		ReferenceHash: refIndex.HashSeed(),
		IssuedAt:      now,
	})
	return deckapi.DeckGoModelImpactPreviewResponse{Preview: preview}, http.StatusOK, nil
}

func handleProviderDeleteCommit(ctx context.Context, adapter modelsControlSurface, store *modelsControlImpactStore, req deckapi.DeckGoModelProviderDeleteCommitRequest) (deckapi.DeckGoModelProviderDeleteCommitResponse, int, error) {
	if err := validateBaseHash(req.ExpectedBaseHash); err != nil {
		return deckapi.DeckGoModelProviderDeleteCommitResponse{}, http.StatusBadRequest, err
	}
	if strings.TrimSpace(req.ProviderId) == "" {
		return deckapi.DeckGoModelProviderDeleteCommitResponse{}, http.StatusBadRequest, errors.New("providerId is required")
	}
	if strings.TrimSpace(req.ImpactToken) == "" {
		return deckapi.DeckGoModelProviderDeleteCommitResponse{}, http.StatusBadRequest, errors.New("impactToken is required")
	}
	if req.ConfirmText != modelsControlConfirmDeleteText {
		return deckapi.DeckGoModelProviderDeleteCommitResponse{}, http.StatusBadRequest, errors.New("confirmText must be \"delete\"")
	}
	record, ok := store.consume(req.ImpactToken)
	if !ok || record.Scope != "provider.delete" || record.ProviderID != req.ProviderId {
		return deckapi.DeckGoModelProviderDeleteCommitResponse{}, http.StatusConflict, errModelsControlImpactStale
	}
	configMap, hash, err := fetchConfigState(ctx, adapter)
	if err != nil {
		return deckapi.DeckGoModelProviderDeleteCommitResponse{}, http.StatusBadGateway, err
	}
	if hash != req.ExpectedBaseHash {
		return deckapi.DeckGoModelProviderDeleteCommitResponse{}, http.StatusConflict, errModelsControlConflict
	}
	refIndex := buildModelReferenceIndex(configMap)
	if refIndex.HashSeed() != record.ReferenceHash {
		return deckapi.DeckGoModelProviderDeleteCommitResponse{}, http.StatusConflict, errModelsControlImpactStale
	}
	patched, err := applyProviderDelete(configMap, req.ProviderId)
	if err != nil {
		return deckapi.DeckGoModelProviderDeleteCommitResponse{}, http.StatusNotFound, err
	}
	raw, err := marshalConfig(patched)
	if err != nil {
		return deckapi.DeckGoModelProviderDeleteCommitResponse{}, http.StatusInternalServerError, err
	}
	if _, err := adapter.ConfigApply(ctx, raw, req.ExpectedBaseHash); err != nil {
		status, mapped := classifyConfigPatchError(err)
		return deckapi.DeckGoModelProviderDeleteCommitResponse{}, status, mapped
	}
	newHash := readPostPatchHash(ctx, adapter)
	return deckapi.DeckGoModelProviderDeleteCommitResponse{
		Ok:         true,
		BaseHash:   hash,
		Hash:       newHash,
		ProviderId: req.ProviderId,
	}, http.StatusOK, nil
}

func handleModelUpsert(ctx context.Context, adapter modelsControlSurface, req deckapi.DeckGoModelUpsertRequest) (deckapi.DeckGoModelUpsertResponse, int, error) {
	if err := validateBaseHash(req.ExpectedBaseHash); err != nil {
		return deckapi.DeckGoModelUpsertResponse{}, http.StatusBadRequest, err
	}
	if strings.TrimSpace(req.ProviderId) == "" || strings.TrimSpace(req.ModelId) == "" {
		return deckapi.DeckGoModelUpsertResponse{}, http.StatusBadRequest, errors.New("providerId and modelId are required")
	}
	configMap, hash, err := fetchConfigState(ctx, adapter)
	if err != nil {
		return deckapi.DeckGoModelUpsertResponse{}, http.StatusBadGateway, err
	}
	if hash != req.ExpectedBaseHash {
		return deckapi.DeckGoModelUpsertResponse{}, http.StatusConflict, errModelsControlConflict
	}
	patched, err := applyModelUpsert(configMap, req)
	if err != nil {
		// Distinguish "not found" from validation
		if strings.Contains(strings.ToLower(err.Error()), "not found") {
			return deckapi.DeckGoModelUpsertResponse{}, http.StatusNotFound, err
		}
		return deckapi.DeckGoModelUpsertResponse{}, http.StatusBadRequest, err
	}
	raw, err := marshalConfig(patched)
	if err != nil {
		return deckapi.DeckGoModelUpsertResponse{}, http.StatusInternalServerError, err
	}
	if _, err := adapter.ConfigPatch(ctx, raw, req.ExpectedBaseHash, ""); err != nil {
		status, mapped := classifyConfigPatchError(err)
		return deckapi.DeckGoModelUpsertResponse{}, status, mapped
	}
	newHash := readPostPatchHash(ctx, adapter)
	return deckapi.DeckGoModelUpsertResponse{
		Ok:         true,
		BaseHash:   hash,
		Hash:       newHash,
		ProviderId: req.ProviderId,
		ModelId:    req.ModelId,
	}, http.StatusOK, nil
}

func handleModelDeletePreview(ctx context.Context, adapter modelsControlSurface, store *modelsControlImpactStore, req deckapi.DeckGoModelDeletePreviewRequest) (deckapi.DeckGoModelImpactPreviewResponse, int, error) {
	if err := validateBaseHash(req.ExpectedBaseHash); err != nil {
		return deckapi.DeckGoModelImpactPreviewResponse{}, http.StatusBadRequest, err
	}
	if strings.TrimSpace(req.ProviderId) == "" || strings.TrimSpace(req.ModelId) == "" {
		return deckapi.DeckGoModelImpactPreviewResponse{}, http.StatusBadRequest, errors.New("providerId and modelId are required")
	}
	configMap, hash, err := fetchConfigState(ctx, adapter)
	if err != nil {
		return deckapi.DeckGoModelImpactPreviewResponse{}, http.StatusBadGateway, err
	}
	if hash != req.ExpectedBaseHash {
		return deckapi.DeckGoModelImpactPreviewResponse{}, http.StatusConflict, errModelsControlConflict
	}
	models := coerce.Map(configMap["models"])
	providers := coerce.Map(models["providers"])
	provider := coerce.Map(providers[req.ProviderId])
	if provider == nil {
		return deckapi.DeckGoModelImpactPreviewResponse{}, http.StatusNotFound, fmt.Errorf("provider %q not found", req.ProviderId)
	}
	providerModels := modelConfigByID(provider["models"])
	if providerModels[req.ModelId] == nil {
		return deckapi.DeckGoModelImpactPreviewResponse{}, http.StatusNotFound, fmt.Errorf("model %q not found", req.ModelId)
	}
	refIndex := buildModelReferenceIndex(configMap)
	references := refIndex.ReferencesForModel(req.ProviderId, req.ModelId)
	references = nonNilModelReferences(references)
	severity := deckapi.DeckGoModelImpactSeverity("info")
	if len(references) > 0 {
		severity = deckapi.DeckGoModelImpactSeverity("block")
	}
	token, err := newImpactToken()
	if err != nil {
		return deckapi.DeckGoModelImpactPreviewResponse{}, http.StatusInternalServerError, err
	}
	now := time.Now()
	defaultsAffected := defaultsAffectedFromReferences(references)
	preview := deckapi.DeckGoModelImpactPreview{
		Scope:            "model.delete",
		Severity:         severity,
		References:       references,
		DefaultsAffected: defaultsAffected,
		ImpactToken:      token,
		GeneratedAt:      float64(now.UnixMilli()),
		BaseHash:         hash,
	}
	store.put(token, modelsControlImpactRecord{
		Scope:         "model.delete",
		ProviderID:    req.ProviderId,
		ModelID:       req.ModelId,
		BaseHash:      hash,
		ReferenceHash: refIndex.HashSeed(),
		IssuedAt:      now,
	})
	return deckapi.DeckGoModelImpactPreviewResponse{Preview: preview}, http.StatusOK, nil
}

func handleModelDeleteCommit(ctx context.Context, adapter modelsControlSurface, store *modelsControlImpactStore, req deckapi.DeckGoModelDeleteCommitRequest) (deckapi.DeckGoModelDeleteCommitResponse, int, error) {
	if err := validateBaseHash(req.ExpectedBaseHash); err != nil {
		return deckapi.DeckGoModelDeleteCommitResponse{}, http.StatusBadRequest, err
	}
	if strings.TrimSpace(req.ProviderId) == "" || strings.TrimSpace(req.ModelId) == "" {
		return deckapi.DeckGoModelDeleteCommitResponse{}, http.StatusBadRequest, errors.New("providerId and modelId are required")
	}
	if strings.TrimSpace(req.ImpactToken) == "" {
		return deckapi.DeckGoModelDeleteCommitResponse{}, http.StatusBadRequest, errors.New("impactToken is required")
	}
	if req.ConfirmText != modelsControlConfirmDeleteText {
		return deckapi.DeckGoModelDeleteCommitResponse{}, http.StatusBadRequest, errors.New("confirmText must be \"delete\"")
	}
	record, ok := store.consume(req.ImpactToken)
	if !ok || record.Scope != "model.delete" || record.ProviderID != req.ProviderId || record.ModelID != req.ModelId {
		return deckapi.DeckGoModelDeleteCommitResponse{}, http.StatusConflict, errModelsControlImpactStale
	}
	configMap, hash, err := fetchConfigState(ctx, adapter)
	if err != nil {
		return deckapi.DeckGoModelDeleteCommitResponse{}, http.StatusBadGateway, err
	}
	if hash != req.ExpectedBaseHash {
		return deckapi.DeckGoModelDeleteCommitResponse{}, http.StatusConflict, errModelsControlConflict
	}
	refIndex := buildModelReferenceIndex(configMap)
	if refIndex.HashSeed() != record.ReferenceHash {
		return deckapi.DeckGoModelDeleteCommitResponse{}, http.StatusConflict, errModelsControlImpactStale
	}
	patched, err := applyModelDelete(configMap, req.ProviderId, req.ModelId)
	if err != nil {
		return deckapi.DeckGoModelDeleteCommitResponse{}, http.StatusNotFound, err
	}
	raw, err := marshalConfig(patched)
	if err != nil {
		return deckapi.DeckGoModelDeleteCommitResponse{}, http.StatusInternalServerError, err
	}
	if _, err := adapter.ConfigApply(ctx, raw, req.ExpectedBaseHash); err != nil {
		status, mapped := classifyConfigPatchError(err)
		return deckapi.DeckGoModelDeleteCommitResponse{}, status, mapped
	}
	newHash := readPostPatchHash(ctx, adapter)
	return deckapi.DeckGoModelDeleteCommitResponse{
		Ok:         true,
		BaseHash:   hash,
		Hash:       newHash,
		ProviderId: req.ProviderId,
		ModelId:    req.ModelId,
	}, http.StatusOK, nil
}

func handleModeSet(ctx context.Context, adapter modelsControlSurface, store *modelsControlImpactStore, req deckapi.DeckGoModelModeSetRequest) (any, int, error) {
	if err := validateBaseHash(req.ExpectedBaseHash); err != nil {
		return nil, http.StatusBadRequest, err
	}
	mode := strings.TrimSpace(string(req.Mode))
	if mode != "merge" && mode != "replace" {
		return nil, http.StatusBadRequest, fmt.Errorf("mode %q is not supported", mode)
	}
	configMap, hash, err := fetchConfigState(ctx, adapter)
	if err != nil {
		return nil, http.StatusBadGateway, err
	}
	if hash != req.ExpectedBaseHash {
		return nil, http.StatusConflict, errModelsControlConflict
	}
	refIndex := buildModelReferenceIndex(configMap)

	if req.DryRun {
		preview, token, err := buildModeSetPreview(ctx, adapter, configMap, refIndex, mode, hash)
		if err != nil {
			return nil, http.StatusBadGateway, err
		}
		store.put(token, modelsControlImpactRecord{
			Scope:         "mode.set",
			Mode:          mode,
			BaseHash:      hash,
			ReferenceHash: refIndex.HashSeed(),
			IssuedAt:      time.Now(),
		})
		return deckapi.DeckGoModelModeSetDryRunResponse{
			Ok:       true,
			BaseHash: hash,
			Preview:  preview,
		}, http.StatusOK, nil
	}

	// Commit path
	if strings.TrimSpace(req.ImpactToken) == "" {
		return nil, http.StatusBadRequest, errors.New("impactToken is required for mode commit")
	}
	if mode == "replace" && req.ConfirmText != modelsControlConfirmModeReplace {
		return nil, http.StatusBadRequest, errors.New("confirmText must be \"replace\" when switching to replace mode")
	}
	record, ok := store.consume(req.ImpactToken)
	if !ok || record.Scope != "mode.set" || record.Mode != mode {
		return nil, http.StatusConflict, errModelsControlImpactStale
	}
	if refIndex.HashSeed() != record.ReferenceHash {
		return nil, http.StatusConflict, errModelsControlImpactStale
	}
	patched, err := applyModeSet(configMap, req.Mode)
	if err != nil {
		return nil, http.StatusBadRequest, err
	}
	raw, err := marshalConfig(patched)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	if _, err := adapter.ConfigPatch(ctx, raw, req.ExpectedBaseHash, ""); err != nil {
		status, mapped := classifyConfigPatchError(err)
		return nil, status, mapped
	}
	newHash := readPostPatchHash(ctx, adapter)
	return deckapi.DeckGoModelModeSetCommitResponse{
		Ok:       true,
		BaseHash: hash,
		Hash:     newHash,
		Mode:     deckapi.DeckGoModelCatalogMode(mode),
	}, http.StatusOK, nil
}

func buildModeSetPreview(ctx context.Context, adapter modelsControlSurface, configMap map[string]any, refIndex *modelReferenceIndex, mode string, baseHash string) (deckapi.DeckGoModelImpactPreview, string, error) {
	token, err := newImpactToken()
	if err != nil {
		return deckapi.DeckGoModelImpactPreview{}, "", err
	}
	preview := deckapi.DeckGoModelImpactPreview{
		Scope:       "mode.set",
		Severity:    deckapi.DeckGoModelImpactSeverity("info"),
		References:  []deckapi.DeckGoModelReferenceEntry{},
		ImpactToken: token,
		GeneratedAt: float64(time.Now().UnixMilli()),
		BaseHash:    baseHash,
	}
	if mode != "replace" {
		return preview, token, nil
	}

	// Determine which built-in catalog providers will become unavailable when
	// mode flips to replace: configured providers shadow built-ins, so anything
	// in the runtime catalog without a matching configured provider is at risk.
	configured := map[string]struct{}{}
	if models := coerce.Map(configMap["models"]); models != nil {
		if providers := coerce.Map(models["providers"]); providers != nil {
			for id := range providers {
				configured[id] = struct{}{}
			}
		}
	}

	catalog, err := adapter.ModelsCatalogProviders(ctx)
	if err != nil {
		// Catalog unavailable: still return the preview without the unavailable
		// list. The UI surfaces this as info-only severity.
		return preview, token, nil
	}
	catalogIDs := extractCatalogProviderIDs(catalog)

	var unavailable []deckapi.DeckGoModelBuiltinProviderImpact
	for _, id := range catalogIDs {
		if _, ok := configured[id]; ok {
			continue
		}
		references := refIndex.ReferencesForProvider(id)
		entry := deckapi.DeckGoModelBuiltinProviderImpact{
			ProviderId:   id,
			IsReferenced: len(references) > 0,
			References:   nonNilModelReferences(references),
		}
		unavailable = append(unavailable, entry)
	}
	if len(unavailable) > 0 {
		preview.UnavailableProviders = unavailable
		hasReferenced := false
		for _, item := range unavailable {
			if item.IsReferenced {
				hasReferenced = true
				break
			}
		}
		if hasReferenced {
			preview.Severity = deckapi.DeckGoModelImpactSeverity("block")
		} else {
			preview.Severity = deckapi.DeckGoModelImpactSeverity("warn")
		}
	}
	return preview, token, nil
}

func nonNilModelReferences(references []deckapi.DeckGoModelReferenceEntry) []deckapi.DeckGoModelReferenceEntry {
	if references == nil {
		return []deckapi.DeckGoModelReferenceEntry{}
	}
	return references
}

func extractCatalogProviderIDs(payload any) []string {
	if result, ok := payload.(generated.ModelsCatalogProvidersResult); ok {
		out := make([]string, 0, len(result.Providers))
		for _, p := range result.Providers {
			id := strings.TrimSpace(p.Id)
			if id != "" {
				out = append(out, id)
			}
		}
		return out
	}
	record := coerce.Map(payload)
	if record == nil {
		return nil
	}
	for _, key := range []string{"providers", "payload"} {
		if key == "payload" {
			if nested := coerce.Map(record["payload"]); nested != nil {
				record = nested
			}
		}
	}
	providers, ok := record["providers"].([]any)
	if !ok {
		return nil
	}
	out := make([]string, 0, len(providers))
	for _, raw := range providers {
		entry := coerce.Map(raw)
		if entry == nil {
			continue
		}
		id := strings.TrimSpace(coerce.String(entry["id"], ""))
		if id != "" {
			out = append(out, id)
		}
	}
	return out
}

func defaultsAffectedFromReferences(references []deckapi.DeckGoModelReferenceEntry) []string {
	seen := map[string]struct{}{}
	var out []string
	for _, ref := range references {
		if string(ref.Kind) != "agents.defaults" {
			continue
		}
		name := strings.TrimSpace(ref.Role)
		if name == "" {
			name = strings.TrimSpace(ref.Label)
		}
		if _, dup := seen[name]; dup || name == "" {
			continue
		}
		seen[name] = struct{}{}
		out = append(out, name)
	}
	if len(out) == 0 {
		return nil
	}
	return out
}
