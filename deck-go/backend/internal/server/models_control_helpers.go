package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strings"

	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/coerce"
)

// providerOrModelIDPattern enforces the OpenClaw zod identifier shape for
// provider and model ids: must start with alphanumeric and may contain
// underscores, dots, or hyphens. Bound length keeps config keys legible.
var providerOrModelIDPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$`)

// modelAPIs mirrors src/config/types.models.ts MODEL_APIS exactly. Used to
// reject provider/model api values that would be rejected by zod.
var modelAPIs = map[string]struct{}{
	"openai-completions":      {},
	"openai-responses":        {},
	"openai-codex-responses":  {},
	"anthropic-messages":      {},
	"google-generative-ai":    {},
	"github-copilot":          {},
	"bedrock-converse-stream": {},
	"ollama":                  {},
	"azure-openai-responses":  {},
}

// providerAuthModes mirrors ModelProviderAuthMode in src/config/types.models.ts.
var providerAuthModes = map[string]struct{}{
	"api-key": {},
	"aws-sdk": {},
	"oauth":   {},
	"token":   {},
}

// knownInputModalities tracks the modality strings the typed control plane
// accepts; unknown modalities returned from runtime config are dropped from
// projections to keep the contract stable.
var knownInputModalities = map[string]struct{}{
	"text":  {},
	"image": {},
}

// compatFlagKeys map source-of-truth compat keys (kebab-case or camelCase) to
// the kebab-case flag string surfaced by the contract.
var compatFlagKeys = []struct {
	flag string
	keys []string
}{
	{flag: "tools", keys: []string{"tools", "supportsTools"}},
	{flag: "vision", keys: []string{"vision"}},
	{flag: "json-mode", keys: []string{"jsonMode", "json-mode"}},
	{flag: "structured-output", keys: []string{"structuredOutput", "structured-output", "supportsStrictMode"}},
	{flag: "system-prompt", keys: []string{"systemPrompt", "system-prompt"}},
	{flag: "stream", keys: []string{"stream"}},
	{flag: "logprobs", keys: []string{"logprobs"}},
	{flag: "reasoning", keys: []string{"reasoning"}},
	{flag: "fim", keys: []string{"fim"}},
	{flag: "embedding", keys: []string{"embedding"}},
	{flag: "rerank", keys: []string{"rerank"}},
	{flag: "audio", keys: []string{"audio"}},
	{flag: "video", keys: []string{"video"}},
}

// projectModelsConfigDetail walks the OpenClaw config map and produces the
// typed Models config detail DTO. Missing branches default to safe values
// (mode=merge from default, empty providers slice).
func projectModelsConfigDetail(configMap map[string]any, hash string, configPresent bool, refIndex *modelReferenceIndex) deckapi.DeckGoModelsConfigDetail {
	detail := deckapi.DeckGoModelsConfigDetail{
		Hash:          hash,
		ConfigPresent: configPresent,
		Mode:          deckapi.DeckGoModelCatalogMode("merge"),
		ModeSource:    "default",
		Providers:     []deckapi.DeckGoModelProviderEntry{},
	}

	defaults := projectDefaults(configMap)
	if len(defaults) > 0 {
		detail.Defaults = defaults
	}

	models := coerce.Map(configMap["models"])
	if models != nil {
		if mode := strings.TrimSpace(coerce.String(models["mode"], "")); mode != "" {
			detail.Mode = deckapi.DeckGoModelCatalogMode(mode)
			detail.ModeSource = "config"
		}
		providers := coerce.Map(models["providers"])
		if providers != nil {
			ids := sortedKeys(providers)
			detail.Providers = make([]deckapi.DeckGoModelProviderEntry, 0, len(ids))
			for _, id := range ids {
				providerMap := coerce.Map(providers[id])
				if providerMap == nil {
					continue
				}
				detail.Providers = append(detail.Providers, projectProviderEntry(id, providerMap, refIndex))
			}
		}
	}

	return detail
}

// projectDefaults pulls explicit agents.defaults.* model assignments. When no
// explicit text default exists it also exposes the first agent model as a
// derived compatibility display so the UI can distinguish authored policy from
// runtime fallback behavior.
func projectDefaults(configMap map[string]any) map[string]any {
	out := map[string]any{}
	agents := coerce.Map(configMap["agents"])
	if agents != nil {
		defaults := coerce.Map(agents["defaults"])
		if defaults != nil {
			if entry, ok := defaultEntry(defaults["model"], "explicit"); ok {
				out["text"] = entry
			}
			if entry, ok := defaultEntry(defaults["imageModel"], "explicit"); ok {
				out["image"] = entry
			}
			if entry, ok := defaultEntry(defaults["imageGenerationModel"], "explicit"); ok {
				out["imageGeneration"] = entry
			}
			if entry, ok := defaultEntry(defaults["videoGenerationModel"], "explicit"); ok {
				out["videoGeneration"] = entry
			}
			if entry, ok := defaultEntry(defaults["musicGenerationModel"], "explicit"); ok {
				out["musicGeneration"] = entry
			}
			if entry, ok := defaultEntry(defaults["pdfModel"], "explicit"); ok {
				out["pdf"] = entry
			}
			if entry, ok := defaultEntry(defaults["summaryModel"], "explicit"); ok {
				out["summary"] = entry
			}
			if compaction := coerce.Map(defaults["compaction"]); compaction != nil {
				if entry, ok := defaultEntry(compaction["model"], "explicit"); ok {
					out["compaction"] = entry
				}
			}
			if memSearch := coerce.Map(defaults["memorySearch"]); memSearch != nil {
				if entry, ok := defaultEntry(memSearch["model"], "explicit"); ok {
					out["memorySearch"] = entry
				}
			}
			if subagents := coerce.Map(defaults["subagents"]); subagents != nil {
				if entry, ok := defaultEntry(subagents["model"], "explicit"); ok {
					out["subagents"] = entry
				}
			}
		}
		if _, hasText := out["text"]; !hasText {
			// text default compatibility display = first agent's model when present
			if list, ok := agents["list"].([]any); ok && len(list) > 0 {
				if first := coerce.Map(list[0]); first != nil {
					if entry, ok := defaultEntry(first["model"], "derived"); ok {
						out["text"] = entry
					}
				}
			}
		}
	}
	return out
}

func defaultEntry(value any, source string) (map[string]any, bool) {
	ref := primaryModelRef(value)
	if ref.provider == "" || ref.model == "" {
		return nil, false
	}
	out := map[string]any{"provider": ref.provider, "model": ref.model}
	if source != "" {
		out["source"] = source
	}
	var fallbacks []any
	for _, candidate := range modelSelectionReferences(value, "default", modelReferenceDefault, "") {
		if candidate.relation != modelReferenceFallback {
			continue
		}
		fallbacks = append(fallbacks, map[string]any{
			"provider": candidate.key.provider,
			"model":    candidate.key.model,
		})
	}
	if len(fallbacks) > 0 {
		out["fallbacks"] = fallbacks
	}
	return out, true
}

// projectProviderEntry projects a single provider's authored config into the
// list-view DTO. It does not include header values — only `hasHeaders`. The
// drawer/detail surface can request a deeper projection later.
func projectProviderEntry(providerID string, providerMap map[string]any, refIndex *modelReferenceIndex) deckapi.DeckGoModelProviderEntry {
	api := strings.TrimSpace(coerce.String(providerMap["api"], ""))
	auth := strings.TrimSpace(coerce.String(providerMap["auth"], ""))
	authHeader := coerce.Bool(providerMap["authHeader"])
	injectNumCtx := coerce.Bool(providerMap["injectNumCtxForOpenAICompat"])

	headers := coerce.Map(providerMap["headers"])
	hasHeaders := len(headers) > 0

	models := projectProviderModels(providerID, providerMap, refIndex, api)

	entry := deckapi.DeckGoModelProviderEntry{
		Id:                          providerID,
		Api:                         api,
		BaseUrl:                     strings.TrimSpace(coerce.String(providerMap["baseUrl"], "")),
		Auth:                        deckapi.DeckGoModelProviderAuthMode(auth),
		AuthHeader:                  authHeader,
		InjectNumCtxForOpenAICompat: injectNumCtx,
		HasHeaders:                  hasHeaders,
		ApiKeyStatus:                secretInputStatus(providerMap["apiKey"]),
		Request:                     requestSummary(providerMap["request"]),
		IsReferenced:                refIndex != nil && refIndex.IsProviderReferenced(providerID),
		ModelCount:                  float64(len(models)),
		Models:                      models,
	}

	return entry
}

func projectProviderModels(providerID string, providerMap map[string]any, refIndex *modelReferenceIndex, providerAPI string) []deckapi.DeckGoModelEntry {
	entries := modelConfigEntries(providerMap["models"])
	if len(entries) == 0 {
		return []deckapi.DeckGoModelEntry{}
	}
	out := make([]deckapi.DeckGoModelEntry, 0, len(entries))
	for _, entry := range entries {
		out = append(out, projectModelEntry(providerID, entry.id, entry.value, providerAPI, refIndex))
	}
	return out
}

type modelConfigEntry struct {
	id    string
	value map[string]any
}

func modelConfigEntries(raw any) []modelConfigEntry {
	switch value := raw.(type) {
	case []any:
		out := make([]modelConfigEntry, 0, len(value))
		for _, item := range value {
			entry := coerce.Map(item)
			if entry == nil {
				continue
			}
			id := strings.TrimSpace(coerce.String(entry["id"], ""))
			if id == "" {
				continue
			}
			out = append(out, modelConfigEntry{id: id, value: cloneShallowMapWithID(entry, id)})
		}
		return out
	case map[string]any:
		ids := sortedKeys(value)
		out := make([]modelConfigEntry, 0, len(ids))
		for _, id := range ids {
			entry := coerce.Map(value[id])
			if entry == nil {
				continue
			}
			out = append(out, modelConfigEntry{id: id, value: cloneShallowMapWithID(entry, id)})
		}
		return out
	default:
		return nil
	}
}

func cloneShallowMapWithID(input map[string]any, id string) map[string]any {
	out := make(map[string]any, len(input)+1)
	for k, v := range input {
		out[k] = v
	}
	out["id"] = id
	return out
}

func modelConfigByID(raw any) map[string]map[string]any {
	out := map[string]map[string]any{}
	for _, entry := range modelConfigEntries(raw) {
		out[entry.id] = entry.value
	}
	return out
}

func modelConfigValues(entries []modelConfigEntry) []any {
	out := make([]any, 0, len(entries))
	for _, entry := range entries {
		value := cloneShallowMapWithID(entry.value, entry.id)
		out = append(out, value)
	}
	return out
}

func projectModelEntry(providerID string, modelID string, modelMap map[string]any, providerAPI string, refIndex *modelReferenceIndex) deckapi.DeckGoModelEntry {
	api := strings.TrimSpace(coerce.String(modelMap["api"], ""))
	inheritsAPI := api == ""
	headers := coerce.Map(modelMap["headers"])

	entry := deckapi.DeckGoModelEntry{
		Id:            modelID,
		Name:          strings.TrimSpace(coerce.String(modelMap["name"], "")),
		Api:           api,
		InheritsApi:   inheritsAPI,
		Reasoning:     coerce.Bool(modelMap["reasoning"]),
		Inputs:        projectInputModalities(modelMap["input"]),
		ContextWindow: coerce.Number(modelMap["contextWindow"]),
		ContextTokens: coerce.Number(modelMap["contextTokens"]),
		MaxTokens:     coerce.Number(modelMap["maxTokens"]),
		Cost:          costSummary(modelMap["cost"]),
		HasHeaders:    len(headers) > 0,
		Compat:        compatSummary(modelMap["compat"]),
	}

	if refIndex != nil {
		entry.IsReferenced = refIndex.IsModelReferenced(providerID, modelID)
		entry.UsageRelations = refIndex.RelationsForModel(providerID, modelID)
		entry.UsageRoles = refIndex.RolesForModel(providerID, modelID)
		roles := refIndex.DefaultRolesForModel(providerID, modelID)
		if len(roles) > 0 {
			entry.DefaultRoles = roles
			entry.IsDefault = true
		}
	}

	return entry
}

func projectInputModalities(value any) []deckapi.DeckGoModelInputModality {
	list, ok := value.([]any)
	if !ok {
		return nil
	}
	seen := map[string]struct{}{}
	out := make([]deckapi.DeckGoModelInputModality, 0, len(list))
	for _, raw := range list {
		s := strings.TrimSpace(coerce.String(raw, ""))
		if s == "" {
			continue
		}
		if _, ok := knownInputModalities[s]; !ok {
			continue
		}
		if _, dup := seen[s]; dup {
			continue
		}
		seen[s] = struct{}{}
		out = append(out, deckapi.DeckGoModelInputModality(s))
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

// secretInputStatus inspects an OpenClaw SecretInput value and returns the
// redacted status DTO. Literal string values are reported as
// "literal-redacted" so the contract never echoes the secret back to the UI.
func secretInputStatus(value any) deckapi.DeckGoModelSecretInputStatus {
	switch v := value.(type) {
	case nil:
		return deckapi.DeckGoModelSecretInputStatus{"state": "missing"}
	case string:
		if v == "" {
			return deckapi.DeckGoModelSecretInputStatus{"state": "empty"}
		}
		return deckapi.DeckGoModelSecretInputStatus{"state": "literal-redacted"}
	case map[string]any:
		source := strings.TrimSpace(coerce.String(v["source"], ""))
		provider := strings.TrimSpace(coerce.String(v["provider"], ""))
		id := strings.TrimSpace(coerce.String(v["id"], ""))
		if source != "" && id != "" {
			return deckapi.DeckGoModelSecretInputStatus{
				"state":      "ref",
				"ref":        deckapi.DeckGoModelSecretRef{Source: source, Provider: provider, Id: id},
				"displayRef": secretRefDisplayLabel(source, provider, id),
			}
		}
		// Prior deck-go builds temporarily wrote {ref, refTemplate}. Treat the
		// legacy value as an env SecretRef for display so operators can replace
		// it without seeing literal secret material.
		if ref := strings.TrimSpace(coerce.String(v["ref"], "")); ref != "" {
			return deckapi.DeckGoModelSecretInputStatus{
				"state":      "ref",
				"ref":        deckapi.DeckGoModelSecretRef{Source: "env", Provider: "default", Id: ref},
				"displayRef": ref,
			}
		}
		return deckapi.DeckGoModelSecretInputStatus{"state": "missing"}
	default:
		return deckapi.DeckGoModelSecretInputStatus{"state": "missing"}
	}
}

func secretRefDisplayLabel(source string, provider string, id string) string {
	if provider == "" || provider == "default" {
		return source + ":" + id
	}
	return source + ":" + provider + "/" + id
}

func compatSummary(compatRaw any) deckapi.DeckGoModelCompatSummary {
	out := deckapi.DeckGoModelCompatSummary{}
	compatMap := coerce.Map(compatRaw)
	if len(compatMap) == 0 {
		return out
	}
	out.HasCompat = true
	out.RawKeys = sortedKeys(compatMap)
	for _, spec := range compatFlagKeys {
		for _, key := range spec.keys {
			if val, ok := compatMap[key]; ok && coerce.Bool(val) {
				out.Flags = append(out.Flags, deckapi.DeckGoModelCompatFlag(spec.flag))
				break
			}
		}
	}
	if len(out.Flags) > 0 {
		flagStrings := make([]string, len(out.Flags))
		for i, f := range out.Flags {
			flagStrings[i] = string(f)
		}
		sort.Strings(flagStrings)
		out.Flags = make([]deckapi.DeckGoModelCompatFlag, len(flagStrings))
		for i, s := range flagStrings {
			out.Flags[i] = deckapi.DeckGoModelCompatFlag(s)
		}
	}
	return out
}

func requestSummary(requestRaw any) deckapi.DeckGoModelProviderRequestSummary {
	out := deckapi.DeckGoModelProviderRequestSummary{}
	reqMap := coerce.Map(requestRaw)
	if len(reqMap) == 0 {
		return out
	}
	out.HasRequest = true
	out.RawKeys = sortedKeys(reqMap)
	if v, ok := reqMap["auth"]; ok && hasMeaningfulValue(v) {
		out.HasAuth = true
	}
	if v, ok := reqMap["proxy"]; ok && hasMeaningfulValue(v) {
		out.HasProxy = true
	}
	if v, ok := reqMap["tls"]; ok && hasMeaningfulValue(v) {
		out.HasTls = true
	}
	return out
}

func hasMeaningfulValue(value any) bool {
	switch v := value.(type) {
	case nil:
		return false
	case string:
		return strings.TrimSpace(v) != ""
	case map[string]any:
		return len(v) > 0
	case []any:
		return len(v) > 0
	default:
		return true
	}
}

func costSummary(costRaw any) deckapi.DeckGoModelCost {
	out := deckapi.DeckGoModelCost{}
	costMap := coerce.Map(costRaw)
	if len(costMap) == 0 {
		return out
	}
	out.Input = coerce.Number(costMap["input"])
	out.Output = coerce.Number(costMap["output"])
	out.CacheRead = coerce.Number(costMap["cacheRead"])
	out.CacheWrite = coerce.Number(costMap["cacheWrite"])
	return out
}

// cloneConfigMap returns a deep copy of the supplied config map using a JSON
// round-trip. Returns an empty map when input is nil so callers can always
// safely write into the result without a nil check.
func cloneConfigMap(configMap map[string]any) map[string]any {
	if configMap == nil {
		return map[string]any{}
	}
	raw, err := json.Marshal(configMap)
	if err != nil {
		return map[string]any{}
	}
	var clone map[string]any
	if err := json.Unmarshal(raw, &clone); err != nil {
		return map[string]any{}
	}
	if clone == nil {
		return map[string]any{}
	}
	return clone
}

func marshalConfig(configMap map[string]any) (string, error) {
	raw, err := json.Marshal(configMap)
	if err != nil {
		return "", fmt.Errorf("marshal config: %w", err)
	}
	return string(raw), nil
}

func ensureMap(parent map[string]any, key string) map[string]any {
	if existing := coerce.Map(parent[key]); existing != nil {
		parent[key] = existing
		return existing
	}
	created := map[string]any{}
	parent[key] = created
	return created
}

// applyProviderUpsert clones the supplied config map and writes the requested
// provider entry into models.providers[providerId]. Existing zod-optional
// fields that the request leaves unset are preserved when the provider already
// exists.
func applyProviderUpsert(configMap map[string]any, req deckapi.DeckGoModelProviderUpsertRequest) (map[string]any, error) {
	if !providerOrModelIDPattern.MatchString(strings.TrimSpace(req.ProviderId)) {
		return nil, errors.New("providerId must match ^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$")
	}
	if api := strings.TrimSpace(req.Api); api != "" {
		if _, ok := modelAPIs[api]; !ok {
			return nil, fmt.Errorf("api %q is not a supported MODEL_APIS value", api)
		}
	}
	if auth := strings.TrimSpace(string(req.Auth)); auth != "" {
		if _, ok := providerAuthModes[auth]; !ok {
			return nil, fmt.Errorf("auth %q is not a supported provider auth mode", auth)
		}
	}

	clone := cloneConfigMap(configMap)
	models := ensureMap(clone, "models")
	providers := ensureMap(models, "providers")
	existing := coerce.Map(providers[req.ProviderId])
	if req.IsCreate && existing != nil {
		return nil, fmt.Errorf("provider %q already exists", req.ProviderId)
	}
	if !req.IsCreate && existing == nil {
		return nil, fmt.Errorf("provider %q not found", req.ProviderId)
	}

	target := map[string]any{}
	if existing != nil {
		// Start from existing map so we preserve unedited fields (zod-optional).
		for k, v := range existing {
			target[k] = v
		}
	}

	// Scalar field handling: when the request provides a non-empty value, write
	// it. When empty and on update, preserve existing. When empty and creating,
	// only set if explicitly provided.
	if api := strings.TrimSpace(req.Api); api != "" {
		target["api"] = api
	} else if req.IsCreate {
		delete(target, "api")
	}
	if baseURL := strings.TrimSpace(req.BaseUrl); baseURL != "" {
		target["baseUrl"] = baseURL
	} else if req.IsCreate {
		delete(target, "baseUrl")
	}
	if auth := strings.TrimSpace(string(req.Auth)); auth != "" {
		target["auth"] = auth
	} else if req.IsCreate {
		delete(target, "auth")
	}
	if err := applyBooleanToggleAction(target, "authHeader", req.AuthHeader, req.IsCreate); err != nil {
		return nil, err
	}
	if err := applyBooleanToggleAction(target, "injectNumCtxForOpenAICompat", req.InjectNumCtxForOpenAICompat, req.IsCreate); err != nil {
		return nil, err
	}

	// apiKey action union
	if err := applyApiKeyAction(target, req.ApiKey); err != nil {
		return nil, err
	}

	// headers per-key actions
	if err := applyHeadersActions(target, req.Headers, req.IsCreate); err != nil {
		return nil, err
	}

	// models replacement
	if req.Models != nil {
		var existingModels map[string]map[string]any
		if existing != nil {
			existingModels = modelConfigByID(existing["models"])
		}
		modelEntries := make([]modelConfigEntry, 0, len(req.Models))
		for _, modelInput := range req.Models {
			id := strings.TrimSpace(modelInput.Id)
			if !providerOrModelIDPattern.MatchString(id) {
				return nil, fmt.Errorf("model id %q is invalid", modelInput.Id)
			}
			if api := strings.TrimSpace(modelInput.Api); api != "" {
				if _, ok := modelAPIs[api]; !ok {
					return nil, fmt.Errorf("model %q api %q is not a supported MODEL_APIS value", id, api)
				}
			}
			modelMap, err := buildModelConfigMap(modelInput, existingModels[id])
			if err != nil {
				return nil, err
			}
			modelEntries = append(modelEntries, modelConfigEntry{id: id, value: modelMap})
		}
		target["models"] = modelConfigValues(modelEntries)
	} else {
		target["models"] = modelConfigValues(modelConfigEntries(target["models"]))
	}

	// request preservation: typed routes never accept request edits — preserve
	// or drop based on PreserveRequest.
	if !req.PreserveRequest && req.IsCreate {
		delete(target, "request")
	}

	providers[req.ProviderId] = target
	return clone, nil
}

func applyApiKeyAction(target map[string]any, action map[string]any) error {
	if action == nil {
		return nil
	}
	state := strings.TrimSpace(coerce.String(action["action"], ""))
	switch state {
	case "", "preserve":
		return nil
	case "clear":
		delete(target, "apiKey")
		return nil
	case "set-ref":
		ref, err := secretRefFromAction(action, "apiKey")
		if err != nil {
			return err
		}
		target["apiKey"] = ref
		return nil
	default:
		return fmt.Errorf("apiKey action %q is not supported", state)
	}
}

func applyHeadersActions(target map[string]any, headers map[string]map[string]any, isCreate bool) error {
	if headers == nil {
		return nil
	}
	existing := coerce.Map(target["headers"])
	if existing == nil {
		existing = map[string]any{}
	}
	out := map[string]any{}
	for k, v := range existing {
		out[k] = v
	}
	for key, action := range headers {
		state := strings.TrimSpace(coerce.String(action["action"], ""))
		switch state {
		case "preserve", "":
			continue
		case "remove":
			delete(out, key)
		case "set-ref":
			value, err := secretRefFromAction(action, "headers["+key+"]")
			if err != nil {
				return err
			}
			out[key] = value
		default:
			return fmt.Errorf("headers[%s] action %q is not supported", key, state)
		}
	}
	if len(out) > 0 {
		target["headers"] = out
	} else if isCreate {
		delete(target, "headers")
	} else {
		// On update, drop the key when it becomes empty so the JSON stays clean.
		if _, hadExisting := existing["__placeholder__"]; !hadExisting && len(existing) == 0 {
			delete(target, "headers")
		} else {
			target["headers"] = out
		}
	}
	return nil
}

func secretRefFromAction(action map[string]any, field string) (map[string]any, error) {
	raw := action["ref"]
	var source, provider, id string
	switch value := raw.(type) {
	case deckapi.DeckGoModelSecretRef:
		source = strings.TrimSpace(value.Source)
		provider = strings.TrimSpace(value.Provider)
		id = strings.TrimSpace(value.Id)
	case map[string]any:
		source = strings.TrimSpace(coerce.String(value["source"], ""))
		provider = strings.TrimSpace(coerce.String(value["provider"], ""))
		id = strings.TrimSpace(coerce.String(value["id"], ""))
	case nil:
		return nil, fmt.Errorf("%s set-ref requires ref", field)
	default:
		legacy := strings.TrimSpace(coerce.String(value, ""))
		if legacy != "" {
			source = "env"
			provider = "default"
			id = legacy
		}
	}
	if source != "env" && source != "file" && source != "exec" {
		return nil, fmt.Errorf("%s ref.source must be env, file, or exec", field)
	}
	if provider == "" {
		return nil, fmt.Errorf("%s ref.provider is required", field)
	}
	if id == "" {
		return nil, fmt.Errorf("%s ref.id is required", field)
	}
	return map[string]any{"source": source, "provider": provider, "id": id}, nil
}

func applyBooleanToggleAction(target map[string]any, key string, action deckapi.DeckGoModelBooleanToggleAction, isCreate bool) error {
	switch strings.TrimSpace(string(action)) {
	case "", "preserve":
		if isCreate {
			delete(target, key)
		}
	case "enable":
		target[key] = true
	case "disable":
		delete(target, key)
	default:
		return fmt.Errorf("%s action %q is not supported", key, action)
	}
	return nil
}

func validateInputModalities(values []deckapi.DeckGoModelInputModality) error {
	for _, value := range values {
		if _, ok := knownInputModalities[string(value)]; !ok {
			return fmt.Errorf("input modality %q is not supported", value)
		}
	}
	return nil
}

func buildModelConfigMap(input deckapi.DeckGoModelProviderUpsertModelInput, existing map[string]any) (map[string]any, error) {
	out := map[string]any{
		"id": strings.TrimSpace(input.Id),
	}
	// Preserve everything from existing first when PreserveCompat is true.
	if input.PreserveCompat && existing != nil {
		if compat, ok := existing["compat"]; ok {
			out["compat"] = compat
		}
	}
	// Carry forward unedited optional fields when an existing model is present
	// and the operator did not supply a new value.
	if existing != nil {
		for _, key := range []string{"name", "api", "reasoning", "input", "cost", "contextWindow", "contextTokens", "maxTokens", "headers"} {
			if _, ok := out[key]; !ok {
				if v, present := existing[key]; present {
					out[key] = v
				}
			}
		}
	}
	if name := strings.TrimSpace(input.Name); name != "" {
		out["name"] = name
	}
	if api := strings.TrimSpace(input.Api); api != "" {
		out["api"] = api
	} else if input.InheritsApi {
		delete(out, "api")
	}
	if err := applyBooleanToggleAction(out, "reasoning", input.Reasoning, existing == nil); err != nil {
		return nil, err
	}
	if input.Inputs != nil {
		if err := validateInputModalities(input.Inputs); err != nil {
			return nil, err
		}
		modalities := make([]string, 0, len(input.Inputs))
		for _, m := range input.Inputs {
			modalities = append(modalities, string(m))
		}
		out["input"] = stringSliceToAnySlice(modalities)
	}
	if input.ContextWindow > 0 {
		out["contextWindow"] = input.ContextWindow
	}
	if input.ContextTokens > 0 {
		out["contextTokens"] = input.ContextTokens
	}
	if input.MaxTokens > 0 {
		out["maxTokens"] = input.MaxTokens
	}
	if isNonZeroCost(input.Cost) {
		out["cost"] = costMapFromInput(input.Cost)
	}
	if len(input.Headers) > 0 {
		hdrMap := map[string]any{}
		for k, v := range input.Headers {
			hdrMap[k] = v
		}
		out["headers"] = hdrMap
	}
	return out, nil
}

func stringSliceToAnySlice(values []string) []any {
	out := make([]any, len(values))
	for i, v := range values {
		out[i] = v
	}
	return out
}

func isNonZeroCost(c deckapi.DeckGoModelCost) bool {
	return c.Input != 0 || c.Output != 0 || c.CacheRead != 0 || c.CacheWrite != 0
}

func costMapFromInput(c deckapi.DeckGoModelCost) map[string]any {
	out := map[string]any{}
	if c.Input != 0 {
		out["input"] = c.Input
	}
	if c.Output != 0 {
		out["output"] = c.Output
	}
	if c.CacheRead != 0 {
		out["cacheRead"] = c.CacheRead
	}
	if c.CacheWrite != 0 {
		out["cacheWrite"] = c.CacheWrite
	}
	return out
}

func applyProviderDelete(configMap map[string]any, providerID string) (map[string]any, error) {
	clone := cloneConfigMap(configMap)
	models := coerce.Map(clone["models"])
	if models == nil {
		return nil, fmt.Errorf("provider %q not found", providerID)
	}
	providers := coerce.Map(models["providers"])
	if providers == nil {
		return nil, fmt.Errorf("provider %q not found", providerID)
	}
	if _, ok := providers[providerID]; !ok {
		return nil, fmt.Errorf("provider %q not found", providerID)
	}
	delete(providers, providerID)
	models["providers"] = providers
	clone["models"] = models
	return clone, nil
}

func applyModelUpsert(configMap map[string]any, req deckapi.DeckGoModelUpsertRequest) (map[string]any, error) {
	if !providerOrModelIDPattern.MatchString(strings.TrimSpace(req.ProviderId)) {
		return nil, errors.New("providerId must match ^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$")
	}
	if !providerOrModelIDPattern.MatchString(strings.TrimSpace(req.ModelId)) {
		return nil, errors.New("modelId must match ^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$")
	}
	if api := strings.TrimSpace(req.Api); api != "" {
		if _, ok := modelAPIs[api]; !ok {
			return nil, fmt.Errorf("api %q is not a supported MODEL_APIS value", api)
		}
	}
	clone := cloneConfigMap(configMap)
	models := ensureMap(clone, "models")
	providers := ensureMap(models, "providers")
	provider := coerce.Map(providers[req.ProviderId])
	if provider == nil {
		return nil, fmt.Errorf("provider %q not found", req.ProviderId)
	}
	modelEntries := modelConfigEntries(provider["models"])
	providerModels := modelConfigByID(provider["models"])
	existing := providerModels[req.ModelId]
	if req.IsCreate && existing != nil {
		return nil, fmt.Errorf("model %q already exists", req.ModelId)
	}
	if !req.IsCreate && existing == nil {
		return nil, fmt.Errorf("model %q not found", req.ModelId)
	}

	target := map[string]any{}
	if existing != nil {
		for k, v := range existing {
			target[k] = v
		}
	}
	target["id"] = req.ModelId
	if name := strings.TrimSpace(req.Name); name != "" {
		target["name"] = name
	} else if req.IsCreate {
		target["name"] = req.ModelId
	}
	if api := strings.TrimSpace(req.Api); api != "" {
		target["api"] = api
	} else if req.InheritsApi || req.IsCreate {
		delete(target, "api")
	}
	if err := applyBooleanToggleAction(target, "reasoning", req.Reasoning, req.IsCreate); err != nil {
		return nil, err
	}
	if req.Inputs != nil {
		if err := validateInputModalities(req.Inputs); err != nil {
			return nil, err
		}
		modalities := make([]string, 0, len(req.Inputs))
		for _, m := range req.Inputs {
			modalities = append(modalities, string(m))
		}
		target["input"] = stringSliceToAnySlice(modalities)
	}
	if req.ContextWindow > 0 {
		target["contextWindow"] = req.ContextWindow
	} else if req.IsCreate {
		delete(target, "contextWindow")
	}
	if req.ContextTokens > 0 {
		target["contextTokens"] = req.ContextTokens
	} else if req.IsCreate {
		delete(target, "contextTokens")
	}
	if req.MaxTokens > 0 {
		target["maxTokens"] = req.MaxTokens
	} else if req.IsCreate {
		delete(target, "maxTokens")
	}
	if isNonZeroCost(req.Cost) {
		target["cost"] = costMapFromInput(req.Cost)
	} else if req.IsCreate {
		delete(target, "cost")
	}
	if len(req.Headers) > 0 {
		hdrMap := map[string]any{}
		for k, v := range req.Headers {
			hdrMap[k] = v
		}
		target["headers"] = hdrMap
	} else if req.IsCreate {
		delete(target, "headers")
	}

	if !req.PreserveCompat {
		delete(target, "compat")
	}

	replaced := false
	for i, entry := range modelEntries {
		if entry.id == req.ModelId {
			modelEntries[i] = modelConfigEntry{id: req.ModelId, value: target}
			replaced = true
			break
		}
	}
	if !replaced {
		modelEntries = append(modelEntries, modelConfigEntry{id: req.ModelId, value: target})
	}
	provider["models"] = modelConfigValues(modelEntries)
	providers[req.ProviderId] = provider
	return clone, nil
}

func applyModelDelete(configMap map[string]any, providerID string, modelID string) (map[string]any, error) {
	clone := cloneConfigMap(configMap)
	models := coerce.Map(clone["models"])
	if models == nil {
		return nil, fmt.Errorf("model %q not found", modelID)
	}
	providers := coerce.Map(models["providers"])
	if providers == nil {
		return nil, fmt.Errorf("provider %q not found", providerID)
	}
	provider := coerce.Map(providers[providerID])
	if provider == nil {
		return nil, fmt.Errorf("provider %q not found", providerID)
	}
	modelEntries := modelConfigEntries(provider["models"])
	if len(modelEntries) == 0 {
		return nil, fmt.Errorf("model %q not found", modelID)
	}
	next := make([]modelConfigEntry, 0, len(modelEntries))
	found := false
	for _, entry := range modelEntries {
		if entry.id == modelID {
			found = true
			continue
		}
		next = append(next, entry)
	}
	if !found {
		return nil, fmt.Errorf("model %q not found", modelID)
	}
	provider["models"] = modelConfigValues(next)
	providers[providerID] = provider
	models["providers"] = providers
	clone["models"] = models
	return clone, nil
}

func applyModeSet(configMap map[string]any, mode deckapi.DeckGoModelCatalogMode) (map[string]any, error) {
	value := strings.TrimSpace(string(mode))
	if value != "merge" && value != "replace" {
		return nil, fmt.Errorf("mode %q is not supported", value)
	}
	clone := cloneConfigMap(configMap)
	models := ensureMap(clone, "models")
	models["mode"] = value
	return clone, nil
}
