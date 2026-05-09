package server

import (
	"fmt"
	"sort"
	"strings"

	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/coerce"
)

// modelReferenceIndex is a service-side, deterministic snapshot of every
// authored config location that points at a specific provider/model. It is
// rebuilt from the OpenClaw config tree on every read to reflect the current
// state and avoid stale cached references.
//
// The reference sources mirror the OpenClaw config code paths enumerated in
// Task 1.4 of openspec/changes/deck-go-models-config-control-plane:
//
//   - agents.defaults.imageModel / agents.defaults.pdfModel /
//     agents.defaults.summaryModel / agents.defaults.compaction.model /
//     agents.defaults.memorySearch.model / agents.defaults.remote.* default
//     model fields.
//   - agents[].model (active agent identity).
//   - channels.modelByChannel keyed entries.
//   - hooks mappings (hooks.mappings[].model and hooks.gmail.model when
//     present).
//   - tools embedding model fields under tools.media / tools.links /
//     tools.search.embedding.* models.
//   - sessions.* model overrides retained on configured sessions.
//
// Each entry preserves the authored config path so impact previews can render
// the originating field unambiguously and tests can assert coverage.
type modelReferenceIndex struct {
	byProvider     map[string][]deckapi.DeckGoModelReferenceEntry
	byModel        map[modelKey][]deckapi.DeckGoModelReferenceEntry
	defaultRoles   map[modelKey][]string
	defaultByRole  map[string]modelKey
	all            []deckapi.DeckGoModelReferenceEntry
	hashSeed       string
}

type modelKey struct {
	provider string
	model    string
}

func newModelKey(provider, model string) modelKey {
	return modelKey{provider: strings.TrimSpace(provider), model: strings.TrimSpace(model)}
}

// buildModelReferenceIndex walks the supplied config map and produces a fully
// populated reference index. Missing config branches are treated as empty
// (zero references) rather than as errors so the BFF can render an explicit
// empty preview when the config itself is sparse.
func buildModelReferenceIndex(configMap map[string]any) *modelReferenceIndex {
	index := &modelReferenceIndex{
		byProvider:    map[string][]deckapi.DeckGoModelReferenceEntry{},
		byModel:       map[modelKey][]deckapi.DeckGoModelReferenceEntry{},
		defaultRoles:  map[modelKey][]string{},
		defaultByRole: map[string]modelKey{},
	}
	if configMap == nil {
		return index
	}

	scanAgentsDefaults(index, configMap)
	scanAgentsList(index, configMap)
	scanChannels(index, configMap)
	scanHooks(index, configMap)
	scanTools(index, configMap)
	scanSessions(index, configMap)

	index.finalize()
	return index
}

func (idx *modelReferenceIndex) finalize() {
	for _, entries := range idx.byProvider {
		sort.SliceStable(entries, func(i, j int) bool { return entries[i].Path < entries[j].Path })
	}
	for _, entries := range idx.byModel {
		sort.SliceStable(entries, func(i, j int) bool { return entries[i].Path < entries[j].Path })
	}
	sort.SliceStable(idx.all, func(i, j int) bool { return idx.all[i].Path < idx.all[j].Path })

	hash := strings.Builder{}
	for _, entry := range idx.all {
		hash.WriteString(string(entry.Kind))
		hash.WriteByte(':')
		hash.WriteString(entry.Path)
		hash.WriteByte('|')
		hash.WriteString(entry.ProviderId)
		hash.WriteByte(':')
		hash.WriteString(entry.ModelId)
		hash.WriteByte('\n')
	}
	idx.hashSeed = hash.String()
}

func (idx *modelReferenceIndex) ReferencesForProvider(providerID string) []deckapi.DeckGoModelReferenceEntry {
	if providerID == "" {
		return nil
	}
	out := append([]deckapi.DeckGoModelReferenceEntry(nil), idx.byProvider[providerID]...)
	return out
}

func (idx *modelReferenceIndex) ReferencesForModel(providerID, modelID string) []deckapi.DeckGoModelReferenceEntry {
	if providerID == "" || modelID == "" {
		return nil
	}
	out := append([]deckapi.DeckGoModelReferenceEntry(nil), idx.byModel[newModelKey(providerID, modelID)]...)
	return out
}

func (idx *modelReferenceIndex) DefaultRolesForModel(providerID, modelID string) []string {
	roles := idx.defaultRoles[newModelKey(providerID, modelID)]
	if len(roles) == 0 {
		return nil
	}
	out := append([]string(nil), roles...)
	sort.Strings(out)
	return out
}

func (idx *modelReferenceIndex) IsProviderReferenced(providerID string) bool {
	return len(idx.byProvider[providerID]) > 0
}

func (idx *modelReferenceIndex) IsModelReferenced(providerID, modelID string) bool {
	return len(idx.byModel[newModelKey(providerID, modelID)]) > 0
}

// HashSeed returns a deterministic fingerprint of the index contents. Delete
// commits compare the fingerprint captured at preview time against a fresh
// re-scan to refuse stale impact tokens.
func (idx *modelReferenceIndex) HashSeed() string {
	return idx.hashSeed
}

func (idx *modelReferenceIndex) record(entry deckapi.DeckGoModelReferenceEntry) {
	if entry.Path == "" {
		return
	}
	if entry.ProviderId != "" {
		idx.byProvider[entry.ProviderId] = append(idx.byProvider[entry.ProviderId], entry)
	}
	if entry.ProviderId != "" && entry.ModelId != "" {
		key := newModelKey(entry.ProviderId, entry.ModelId)
		idx.byModel[key] = append(idx.byModel[key], entry)
	}
	idx.all = append(idx.all, entry)
}

func (idx *modelReferenceIndex) recordDefault(role string, providerID, modelID string, path string) {
	role = strings.TrimSpace(role)
	if role == "" || providerID == "" || modelID == "" {
		return
	}
	key := newModelKey(providerID, modelID)
	idx.defaultRoles[key] = append(idx.defaultRoles[key], role)
	idx.defaultByRole[role] = key
	idx.record(deckapi.DeckGoModelReferenceEntry{
		Kind:       "agents.defaults",
		Path:       path,
		ProviderId: providerID,
		ModelId:    modelID,
		Label:      role,
	})
}

// modelRefSpec parses a model reference string of the form "provider/model".
// Trailing whitespace is tolerated, and unparseable values are returned as a
// zero-valued modelKey so callers can drop them without surfacing parse errors.
func parseModelRef(value any) modelKey {
	s := strings.TrimSpace(coerce.String(value, ""))
	if s == "" {
		return modelKey{}
	}
	idx := strings.Index(s, "/")
	if idx <= 0 || idx == len(s)-1 {
		return modelKey{}
	}
	return newModelKey(s[:idx], s[idx+1:])
}

// scanAgentsDefaults records default model assignments (image, pdf, summary,
// compaction, memorySearch, remote.*).
func scanAgentsDefaults(idx *modelReferenceIndex, configMap map[string]any) {
	agents := coerce.Map(configMap["agents"])
	if agents == nil {
		return
	}
	defaults := coerce.Map(agents["defaults"])
	if defaults == nil {
		return
	}

	roles := []struct {
		role string
		path string
		key  string
	}{
		{role: "imageModel", path: "agents.defaults.imageModel", key: "imageModel"},
		{role: "pdfModel", path: "agents.defaults.pdfModel", key: "pdfModel"},
		{role: "summaryModel", path: "agents.defaults.summaryModel", key: "summaryModel"},
	}
	for _, item := range roles {
		ref := parseModelRef(defaults[item.key])
		if ref.provider == "" {
			continue
		}
		idx.recordDefault(item.role, ref.provider, ref.model, item.path)
	}

	if compaction := coerce.Map(defaults["compaction"]); compaction != nil {
		ref := parseModelRef(compaction["model"])
		if ref.provider != "" {
			idx.recordDefault("compactionModel", ref.provider, ref.model, "agents.defaults.compaction.model")
		}
	}
	if memSearch := coerce.Map(defaults["memorySearch"]); memSearch != nil {
		ref := parseModelRef(memSearch["model"])
		if ref.provider != "" {
			idx.recordDefault("memorySearchModel", ref.provider, ref.model, "agents.defaults.memorySearch.model")
		}
	}
	if remote := coerce.Map(defaults["remote"]); remote != nil {
		for _, key := range sortedKeys(remote) {
			ref := parseModelRef(remote[key])
			if ref.provider == "" {
				continue
			}
			idx.recordDefault("remote."+key, ref.provider, ref.model, fmt.Sprintf("agents.defaults.remote.%s", key))
		}
	}
}

// scanAgentsList records the per-agent `model` field for each agent in the
// `agents.list` array.
func scanAgentsList(idx *modelReferenceIndex, configMap map[string]any) {
	agents := coerce.Map(configMap["agents"])
	if agents == nil {
		return
	}
	list, ok := agents["list"].([]any)
	if !ok {
		return
	}
	for i, raw := range list {
		entry := coerce.Map(raw)
		if entry == nil {
			continue
		}
		ref := parseModelRef(entry["model"])
		if ref.provider == "" {
			continue
		}
		agentID := coerce.FirstString(entry["id"], entry["name"])
		path := fmt.Sprintf("agents.list[%d].model", i)
		if agentID != "" {
			path = fmt.Sprintf("agents.list[%s].model", agentID)
		}
		idx.record(deckapi.DeckGoModelReferenceEntry{
			Kind:       "agents.list",
			Path:       path,
			ProviderId: ref.provider,
			ModelId:    ref.model,
			Label:      agentID,
		})
	}
}

// scanChannels records `channels.modelByChannel` entries that override the
// model used per-channel.
func scanChannels(idx *modelReferenceIndex, configMap map[string]any) {
	channels := coerce.Map(configMap["channels"])
	if channels == nil {
		return
	}
	mapping := coerce.Map(channels["modelByChannel"])
	if mapping == nil {
		return
	}
	for _, channelID := range sortedKeys(mapping) {
		ref := parseModelRef(mapping[channelID])
		if ref.provider == "" {
			continue
		}
		idx.record(deckapi.DeckGoModelReferenceEntry{
			Kind:       "channels",
			Path:       fmt.Sprintf("channels.modelByChannel.%s", channelID),
			ProviderId: ref.provider,
			ModelId:    ref.model,
			Label:      channelID,
		})
	}
}

// scanHooks records hooks.mappings[].model and hooks.gmail.model entries.
func scanHooks(idx *modelReferenceIndex, configMap map[string]any) {
	hooks := coerce.Map(configMap["hooks"])
	if hooks == nil {
		return
	}
	if mappings, ok := hooks["mappings"].([]any); ok {
		for i, raw := range mappings {
			entry := coerce.Map(raw)
			if entry == nil {
				continue
			}
			ref := parseModelRef(entry["model"])
			if ref.provider == "" {
				continue
			}
			label := coerce.FirstString(entry["id"], entry["name"], entry["match"])
			path := fmt.Sprintf("hooks.mappings[%d].model", i)
			if label != "" {
				path = fmt.Sprintf("hooks.mappings[%s].model", label)
			}
			idx.record(deckapi.DeckGoModelReferenceEntry{
				Kind:       "hooks",
				Path:       path,
				ProviderId: ref.provider,
				ModelId:    ref.model,
				Label:      label,
			})
		}
	}
	if gmail := coerce.Map(hooks["gmail"]); gmail != nil {
		ref := parseModelRef(gmail["model"])
		if ref.provider != "" {
			idx.record(deckapi.DeckGoModelReferenceEntry{
				Kind:       "hooks",
				Path:       "hooks.gmail.model",
				ProviderId: ref.provider,
				ModelId:    ref.model,
				Label:      "gmail",
			})
		}
	}
}

// scanTools records embedding model assignments under tools.media,
// tools.links, and tools.search.embedding.* configs.
func scanTools(idx *modelReferenceIndex, configMap map[string]any) {
	tools := coerce.Map(configMap["tools"])
	if tools == nil {
		return
	}
	scanToolGroup(idx, tools, "media", "tools.media")
	scanToolGroup(idx, tools, "links", "tools.links")
	if search := coerce.Map(tools["search"]); search != nil {
		if embedding := coerce.Map(search["embedding"]); embedding != nil {
			scanEmbeddingModels(idx, embedding, "tools.search.embedding")
		}
	}
}

func scanToolGroup(idx *modelReferenceIndex, tools map[string]any, key string, basePath string) {
	group := coerce.Map(tools[key])
	if group == nil {
		return
	}
	if embedding := coerce.Map(group["embedding"]); embedding != nil {
		scanEmbeddingModels(idx, embedding, basePath+".embedding")
	}
}

func scanEmbeddingModels(idx *modelReferenceIndex, embedding map[string]any, basePath string) {
	for _, key := range sortedKeys(embedding) {
		if !strings.HasPrefix(strings.ToLower(key), "model") {
			continue
		}
		ref := parseModelRef(embedding[key])
		if ref.provider == "" {
			continue
		}
		idx.record(deckapi.DeckGoModelReferenceEntry{
			Kind:       "tools",
			Path:       fmt.Sprintf("%s.%s", basePath, key),
			ProviderId: ref.provider,
			ModelId:    ref.model,
			Label:      key,
		})
	}
	if models, ok := embedding["models"].(map[string]any); ok {
		for _, name := range sortedKeys(models) {
			ref := parseModelRef(models[name])
			if ref.provider == "" {
				continue
			}
			idx.record(deckapi.DeckGoModelReferenceEntry{
				Kind:       "tools",
				Path:       fmt.Sprintf("%s.models.%s", basePath, name),
				ProviderId: ref.provider,
				ModelId:    ref.model,
				Label:      name,
			})
		}
	}
}

// scanSessions records sessions.* model overrides retained on configured
// sessions. The exact path layout depends on operator convention; both keyed
// maps and array structures are supported.
func scanSessions(idx *modelReferenceIndex, configMap map[string]any) {
	sessions := coerce.Map(configMap["sessions"])
	if sessions == nil {
		return
	}
	for _, key := range sortedKeys(sessions) {
		entry := coerce.Map(sessions[key])
		if entry == nil {
			continue
		}
		ref := parseModelRef(entry["model"])
		if ref.provider == "" {
			continue
		}
		idx.record(deckapi.DeckGoModelReferenceEntry{
			Kind:       "sessions",
			Path:       fmt.Sprintf("sessions.%s.model", key),
			ProviderId: ref.provider,
			ModelId:    ref.model,
			Label:      key,
		})
	}
	if list, ok := sessions["list"].([]any); ok {
		for i, raw := range list {
			entry := coerce.Map(raw)
			if entry == nil {
				continue
			}
			ref := parseModelRef(entry["model"])
			if ref.provider == "" {
				continue
			}
			label := coerce.FirstString(entry["id"], entry["sessionKey"], entry["name"])
			path := fmt.Sprintf("sessions.list[%d].model", i)
			if label != "" {
				path = fmt.Sprintf("sessions.list[%s].model", label)
			}
			idx.record(deckapi.DeckGoModelReferenceEntry{
				Kind:       "sessions",
				Path:       path,
				ProviderId: ref.provider,
				ModelId:    ref.model,
				Label:      label,
			})
		}
	}
}
