import { useEffect, useMemo, useState } from "react";
import type {
  DeckGoCatalogProvider,
  DeckGoConfigLookupResponse,
  DeckGoModelAuthOverviewResponse,
  DeckGoModelCatalogProvidersResponse,
  DeckGoModelProbeResponse,
  DeckGoRuntimeConfiguredModel,
  DeckGoRuntimeConfiguredModelsResponse,
  DeckGoUsageCostEntry,
  DeckGoUsageCostResponse,
  DeckGoUsageProviderStatus,
  DeckGoUsageProvidersResponse,
} from "../../../api";
import {
  fetchModelsConfig,
  fetchModelUsageCost,
  fetchModelUsageProviders,
  fetchRuntimeConfiguredModels,
  fetchRuntimeModelAuthOverview,
  fetchRuntimeModelCatalogProviders,
  lookupConfigPath,
  probeRuntimeModelAuth,
  saveModelsConfig,
} from "../../../api";
import { JsonDetails, ShellStat } from "../../shared/ShellComponents";
import { ProviderModelsEditor } from "./ProviderModelsEditor";
import { StringRecordEditor } from "./StringRecordEditor";

type PanelState = "idle" | "loading" | "ready";
type ProviderStringField = "api" | "apiKey" | "apiKeyEnv" | "auth" | "baseUrl";
type ProviderBooleanField = "authHeader" | "injectNumCtxForOpenAICompat";
type RuntimeModelFilter = "reasoning" | "vision" | "text";
type ModelChainTarget = "model" | "imageModel";
type CatalogModelSelections = Record<string, string[]>;
type AllowlistEntry = {
  alias?: string;
  streaming?: boolean;
  params?: Record<string, unknown>;
};
type BedrockDiscoveryConfig = {
  enabled?: boolean;
  region?: string;
  providerFilter?: string[];
  refreshInterval?: number;
  defaultContextWindow?: number;
  defaultMaxTokens?: number;
};

const COMMON_BEDROCK_REGIONS = ["us-east-1", "us-west-2", "eu-west-1", "ap-northeast-1"];
const BEDROCK_PROVIDER_FILTERS = ["anthropic", "amazon", "meta", "cohere", "mistral"];
const RUNTIME_MODEL_FILTERS: Array<{ key: RuntimeModelFilter; label: string }> = [
  { key: "reasoning", label: "Reasoning" },
  { key: "vision", label: "Vision" },
  { key: "text", label: "Text" },
];

function parseJsonRecord(raw: string) {
  try {
    const value = JSON.parse(raw) as unknown;
    if (value && typeof value === "object") {
      return value as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readStringRecord(value: unknown) {
  const record = readRecord(value);
  const strings: Record<string, string> = {};
  for (const [key, entry] of Object.entries(record)) {
    if (typeof entry === "string") {
      strings[key] = entry;
    }
  }
  return Object.keys(strings).length > 0 ? strings : undefined;
}

function readModelChain(value: unknown) {
  if (typeof value === "string") {
    return { primary: value, fallbacks: [] };
  }
  const record = readRecord(value);
  return {
    primary: typeof record.primary === "string" ? record.primary : "",
    fallbacks: Array.isArray(record.fallbacks)
      ? record.fallbacks.filter((entry): entry is string => typeof entry === "string")
      : [],
  };
}

function parseFallbackList(value: string) {
  return uniqueModelRefs(value.split(","));
}

function uniqueModelRefs(refs: string[]) {
  const seen = new Set<string>();
  const nextRefs: string[] = [];
  for (const ref of refs) {
    const trimmed = ref.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    nextRefs.push(trimmed);
  }
  return nextRefs;
}

function moveListEntry(values: string[], index: number, offset: -1 | 1) {
  const targetIndex = index + offset;
  if (index < 0 || targetIndex < 0 || targetIndex >= values.length) {
    return values;
  }
  const nextValues = [...values];
  const [moved] = nextValues.splice(index, 1);
  if (moved === undefined) {
    return values;
  }
  nextValues.splice(targetIndex, 0, moved);
  return nextValues;
}

function moveModelRef(values: string[], ref: string, offset: -1 | 1) {
  return moveListEntry(values, values.indexOf(ref), offset);
}

function parseJsonObjectDraft(value: string) {
  if (!value.trim()) {
    return undefined;
  }
  const parsed = JSON.parse(value) as unknown;
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  throw new Error("params must be a JSON object");
}

function parseJsonArrayDraft(value: string) {
  if (!value.trim()) {
    return undefined;
  }
  const parsed = JSON.parse(value) as unknown;
  if (Array.isArray(parsed)) {
    return parsed;
  }
  throw new Error("models must be a JSON array");
}

function mergeModelChain(current: unknown, primary: string, fallbacks: string[]) {
  const currentRecord = readRecord(current);
  return {
    ...currentRecord,
    primary,
    fallbacks,
  };
}

function readAllowlistEntries(value: unknown) {
  const entries = readRecord(value);
  const normalized: Record<string, AllowlistEntry> = {};
  for (const [ref, entry] of Object.entries(entries)) {
    const record = readRecord(entry);
    const params = readRecord(record.params);
    normalized[ref] = {
      alias: typeof record.alias === "string" ? record.alias : undefined,
      streaming: typeof record.streaming === "boolean" ? record.streaming : undefined,
      params: Object.keys(params).length > 0 ? params : undefined,
    };
  }
  return normalized;
}

function allowlistRefsFromChains(
  modelChain: { primary: string; fallbacks: string[] },
  imageModelChain: { primary: string; fallbacks: string[] },
) {
  return [
    modelChain.primary,
    ...modelChain.fallbacks,
    imageModelChain.primary,
    ...imageModelChain.fallbacks,
  ].filter(Boolean);
}

function readBedrockDiscovery(value: unknown): BedrockDiscoveryConfig {
  const record = readRecord(value);
  return {
    enabled: typeof record.enabled === "boolean" ? record.enabled : undefined,
    region: typeof record.region === "string" ? record.region : undefined,
    providerFilter: Array.isArray(record.providerFilter)
      ? record.providerFilter.filter((entry): entry is string => typeof entry === "string")
      : undefined,
    refreshInterval:
      typeof record.refreshInterval === "number" && Number.isFinite(record.refreshInterval)
        ? record.refreshInterval
        : undefined,
    defaultContextWindow:
      typeof record.defaultContextWindow === "number" &&
      Number.isFinite(record.defaultContextWindow)
        ? record.defaultContextWindow
        : undefined,
    defaultMaxTokens:
      typeof record.defaultMaxTokens === "number" && Number.isFinite(record.defaultMaxTokens)
        ? record.defaultMaxTokens
        : undefined,
  };
}

function updateModelsConfig(
  raw: string,
  update: (models: Record<string, unknown>) => Record<string, unknown>,
) {
  const config = parseJsonRecord(raw) ?? {};
  const models = readRecord(config.models);
  return JSON.stringify(
    {
      ...config,
      models: update(models),
    },
    null,
    2,
  );
}

function updateAgentDefaults(
  raw: string,
  update: (defaults: Record<string, unknown>) => Record<string, unknown>,
) {
  const config = parseJsonRecord(raw) ?? {};
  const agents = readRecord(config.agents);
  const defaults = readRecord(agents.defaults);
  return JSON.stringify(
    {
      ...config,
      agents: {
        ...agents,
        defaults: update(defaults),
      },
    },
    null,
    2,
  );
}

function updateProviderConfigEntry(
  raw: string,
  providerId: string,
  update: (entry: Record<string, unknown>) => Record<string, unknown>,
) {
  const config = parseJsonRecord(raw) ?? {};
  const models = readRecord(config.models);
  const providers = readRecord(models.providers);
  const current = readRecord(providers[providerId]);
  return JSON.stringify(
    {
      ...config,
      models: {
        ...models,
        providers: {
          ...providers,
          [providerId]: update(current),
        },
      },
    },
    null,
    2,
  );
}

function catalogModelIds(provider: DeckGoCatalogProvider) {
  if (!Array.isArray(provider.models)) {
    return [];
  }
  return provider.models.map((model) => model.id).filter(Boolean);
}

function selectedCatalogModelIds(
  provider: DeckGoCatalogProvider,
  selections: CatalogModelSelections,
) {
  const modelIds = catalogModelIds(provider);
  const selected = selections[provider.id];
  if (!selected) {
    return modelIds;
  }
  const modelIdSet = new Set(modelIds);
  return selected.filter((modelId) => modelIdSet.has(modelId));
}

function providerModelEntries(provider: DeckGoCatalogProvider, selectedModelIds?: string[]) {
  if (!Array.isArray(provider.models)) {
    return undefined;
  }
  const selectedSet = selectedModelIds ? new Set(selectedModelIds) : null;
  return provider.models
    .filter((model) => !selectedSet || selectedSet.has(model.id))
    .map((model) => ({
      id: model.id,
      name: model.name ?? model.id,
      ...(typeof model.contextWindow === "number" ? { contextWindow: model.contextWindow } : {}),
      ...(typeof model.maxTokens === "number" ? { maxTokens: model.maxTokens } : {}),
      ...(typeof model.reasoning === "boolean" ? { reasoning: model.reasoning } : {}),
    }));
}

function firstCatalogModelRef(provider: DeckGoCatalogProvider, selectedModelIds?: string[]) {
  const selectedSet = selectedModelIds ? new Set(selectedModelIds) : null;
  const firstModel = Array.isArray(provider.models)
    ? provider.models.find((model) => !selectedSet || selectedSet.has(model.id))
    : undefined;
  return firstModel?.id ? `${provider.id}/${firstModel.id}` : "";
}

function configuredModelsFromResponse(response: DeckGoRuntimeConfiguredModelsResponse | null) {
  return response?.payload?.models ?? response?.payload?.items ?? [];
}

function authProvidersFromResponse(response: DeckGoModelAuthOverviewResponse | null) {
  return response?.payload?.providers ?? response?.providers ?? [];
}

function catalogProvidersFromResponse(response: DeckGoModelCatalogProvidersResponse | null) {
  return response?.payload?.providers ?? response?.providers ?? [];
}

function configuredModelRef(model: DeckGoRuntimeConfiguredModel) {
  const explicit = model.modelIdentifier || model.model || model.id;
  if (typeof explicit === "string" && explicit.trim()) {
    if (typeof model.provider === "string" && model.provider.trim() && !explicit.includes("/")) {
      return `${model.provider}/${explicit}`;
    }
    return explicit;
  }
  return "unknown";
}

function configuredModelProvider(model: DeckGoRuntimeConfiguredModel) {
  if (typeof model.provider === "string" && model.provider.trim()) {
    return model.provider;
  }
  const ref = configuredModelRef(model);
  if (ref.includes("/")) {
    return ref.split("/")[0] || "runtime";
  }
  return "runtime";
}

function configuredModelId(model: DeckGoRuntimeConfiguredModel) {
  if (typeof model.id === "string" && model.id.trim()) {
    return model.id;
  }
  const ref = configuredModelRef(model);
  return ref.includes("/") ? (ref.split("/").pop() ?? ref) : ref;
}

function modelInputModes(model: DeckGoRuntimeConfiguredModel) {
  return Array.isArray(model.input)
    ? model.input.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function runtimeModelMatchesFilters(
  model: DeckGoRuntimeConfiguredModel,
  filters: Set<RuntimeModelFilter>,
) {
  if (filters.size === 0) {
    return true;
  }
  const inputModes = modelInputModes(model);
  if (filters.has("reasoning") && model.reasoning !== true) {
    return false;
  }
  if (filters.has("vision") && !inputModes.includes("image")) {
    return false;
  }
  if (filters.has("text") && inputModes.length > 0 && !inputModes.includes("text")) {
    return false;
  }
  return true;
}

function formatTokenWindow(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "n/a";
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K`;
  }
  return String(value);
}

function formatModelPrice(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "n/a";
  }
  if (value === 0) {
    return "free";
  }
  return `$${value.toFixed(2)}/M`;
}

function usageCostValue(entry: DeckGoUsageCostEntry | undefined) {
  if (!entry) {
    return 0;
  }
  return entry.totalCost ?? entry.cost ?? 0;
}

function formatUsageCost(value: number) {
  return `$${value.toFixed(2)}`;
}

function formatCountdown(ms: unknown) {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) {
    return "expired";
  }
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function authTypeLabel(type: string | null | undefined) {
  switch (type) {
    case "api_key":
      return "API Key";
    case "oauth":
      return "OAuth";
    case "token":
      return "Token";
    case "aws-sdk":
      return "AWS SDK";
    default:
      return "unknown";
  }
}

function groupConfiguredModelsByProvider(models: DeckGoRuntimeConfiguredModel[]) {
  const groups = new Map<string, DeckGoRuntimeConfiguredModel[]>();
  for (const model of models) {
    const provider = configuredModelProvider(model);
    groups.set(provider, [...(groups.get(provider) ?? []), model]);
  }
  return [...groups.entries()].toSorted(([left], [right]) => left.localeCompare(right));
}

function ModelFallbackControls({
  label,
  primary,
  fallbacks,
  configuredModelRefs,
  onAdd,
  onRemove,
  onMove,
}: {
  label: "text" | "image";
  primary: string;
  fallbacks: string[];
  configuredModelRefs: string[];
  onAdd: (ref: string) => void;
  onRemove: (ref: string) => void;
  onMove: (ref: string, direction: -1 | 1) => void;
}) {
  const [draftRef, setDraftRef] = useState("");
  const selectedRefs = new Set([primary, ...fallbacks].filter(Boolean));
  const availableRefs = configuredModelRefs.filter((ref) => !selectedRefs.has(ref));

  useEffect(() => {
    if (draftRef && !availableRefs.includes(draftRef)) {
      setDraftRef("");
    }
  }, [availableRefs, draftRef]);

  const addDraftRef = () => {
    if (!draftRef) {
      return;
    }
    onAdd(draftRef);
    setDraftRef("");
  };

  return (
    <div className="deck-ui-models-spaced">
      <div className="deckgo-actions deck-ui-models-actions deck-ui-models-actions-center">
        <strong>{label === "text" ? "Text fallback order" : "Image fallback order"}</strong>
        <select
          aria-label={`Add ${label} fallback`}
          className="deckgo-input deck-ui-models-input"
          disabled={availableRefs.length === 0}
          value={draftRef}
          onChange={(event) => setDraftRef(event.currentTarget.value)}
        >
          <option value="">Add fallback model</option>
          {availableRefs.map((ref) => (
            <option key={ref} value={ref}>
              {ref}
            </option>
          ))}
        </select>
        <button
          className="deckgo-button deck-ui-models-button"
          disabled={!draftRef}
          type="button"
          onClick={addDraftRef}
        >
          Add {label} fallback
        </button>
      </div>
      {fallbacks.length === 0 ? (
        <p className="deckgo-note">No {label} fallback models configured.</p>
      ) : (
        <div className="deck-ui-models-fallback-list">
          {fallbacks.map((ref, index) => (
            <div
              className="deckgo-surface-tile deck-ui-models-surface"
              key={`${label}-${ref}-${index}`}
            >
              <div className="deck-ui-models-fallback-row">
                <span>{ref}</span>
                <div className="deckgo-actions deck-ui-models-actions">
                  <button
                    aria-label={`Move up ${label} fallback ${ref}`}
                    className="deckgo-button deckgo-button-compact deck-ui-models-button"
                    disabled={index === 0}
                    type="button"
                    onClick={() => onMove(ref, -1)}
                  >
                    Move up
                  </button>
                  <button
                    aria-label={`Move down ${label} fallback ${ref}`}
                    className="deckgo-button deckgo-button-compact deck-ui-models-button"
                    disabled={index === fallbacks.length - 1}
                    type="button"
                    onClick={() => onMove(ref, 1)}
                  >
                    Move down
                  </button>
                  <button
                    aria-label={`Remove ${label} fallback ${ref}`}
                    className="deckgo-button deckgo-button-compact deck-ui-models-button is-danger"
                    type="button"
                    onClick={() => onRemove(ref)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ModelsPanel() {
  const [rawConfig, setRawConfig] = useState("");
  const [baseHash, setBaseHash] = useState("");
  const [runtimeModels, setRuntimeModels] = useState<DeckGoRuntimeConfiguredModelsResponse | null>(
    null,
  );
  const [modelAuth, setModelAuth] = useState<DeckGoModelAuthOverviewResponse | null>(null);
  const [catalogProviders, setCatalogProviders] =
    useState<DeckGoModelCatalogProvidersResponse | null>(null);
  const [usageCost, setUsageCost] = useState<DeckGoUsageCostResponse | null>(null);
  const [usageProviders, setUsageProviders] = useState<DeckGoUsageProvidersResponse | null>(null);
  const [schemaPath, setSchemaPath] = useState("models.providers");
  const [lookupResult, setLookupResult] = useState<DeckGoConfigLookupResponse | null>(null);
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<"idle" | "saving" | "lookup" | "probe">("idle");
  const [error, setError] = useState("");
  const [actionResult, setActionResult] = useState<unknown>(null);
  const [probeResult, setProbeResult] = useState<DeckGoModelProbeResponse | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [newProviderId, setNewProviderId] = useState("");
  const [runtimeModelFilters, setRuntimeModelFilters] = useState<Set<RuntimeModelFilter>>(
    () => new Set(),
  );
  const [catalogModelSelections, setCatalogModelSelections] = useState<CatalogModelSelections>({});
  const [catalogProviderSearch, setCatalogProviderSearch] = useState("");

  const refresh = async () => {
    setLoadState("loading");
    try {
      const [
        next,
        nextRuntimeModels,
        nextModelAuth,
        nextCatalogProviders,
        nextUsageCost,
        nextUsageProviders,
      ] = await Promise.all([
        fetchModelsConfig(),
        fetchRuntimeConfiguredModels(),
        fetchRuntimeModelAuthOverview(),
        fetchRuntimeModelCatalogProviders(),
        fetchModelUsageCost(14),
        fetchModelUsageProviders(),
      ]);
      setRawConfig(next.raw ?? "");
      setBaseHash(next.hash ?? "");
      setRuntimeModels(nextRuntimeModels);
      setModelAuth(nextModelAuth);
      setCatalogProviders(nextCatalogProviders);
      setUsageCost(nextUsageCost);
      setUsageProviders(nextUsageProviders);
      setLoadState("ready");
      setError("");
    } catch (loadError) {
      setLoadState("idle");
      setError(loadError instanceof Error ? loadError.message : "failed to load models config");
    }
  };

  useEffect(() => {
    void refresh();
    void lookupAction("models.providers");
  }, []);

  const parsedConfig = useMemo(() => parseJsonRecord(rawConfig), [rawConfig]);
  const modelsSection = (parsedConfig?.models as Record<string, unknown> | undefined) ?? {};
  const modelsMode =
    modelsSection.mode === "merge" || modelsSection.mode === "replace" ? modelsSection.mode : "";
  const bedrockDiscovery = readBedrockDiscovery(modelsSection.bedrockDiscovery);
  const agentsSection = readRecord(parsedConfig?.agents);
  const agentDefaults = readRecord(agentsSection.defaults);
  const modelChain = readModelChain(agentDefaults.model);
  const imageModelChain = readModelChain(agentDefaults.imageModel);
  const allowlistEntries = readAllowlistEntries(agentDefaults.models);
  const allowlistActive = Object.keys(allowlistEntries).length > 0;
  const providers = (modelsSection.providers as Record<string, unknown> | undefined) ?? {};
  const providerEntries = Object.entries(providers).toSorted(([left], [right]) =>
    left.localeCompare(right),
  );
  const selectedProvider =
    selectedProviderId && providers[selectedProviderId]
      ? selectedProviderId
      : (providerEntries[0]?.[0] ?? "");
  const selectedProviderConfig = readRecord(providers[selectedProvider]);
  const selectedCatalogProvider = catalogProvidersFromResponse(catalogProviders).find(
    (provider) => provider.id === selectedProvider,
  );
  const configuredModels = useMemo(
    () => configuredModelsFromResponse(runtimeModels),
    [runtimeModels],
  );
  const authProviders = useMemo(
    () =>
      [...authProvidersFromResponse(modelAuth)].toSorted((left, right) =>
        left.provider.localeCompare(right.provider),
      ),
    [modelAuth],
  );
  const catalogProviderEntries = useMemo(
    () =>
      [...catalogProvidersFromResponse(catalogProviders)].toSorted((left, right) =>
        left.id.localeCompare(right.id),
      ),
    [catalogProviders],
  );
  const filteredCatalogProviderEntries = useMemo(() => {
    const query = catalogProviderSearch.trim().toLowerCase();
    if (!query) {
      return catalogProviderEntries;
    }
    return catalogProviderEntries.filter((provider) =>
      [provider.id, provider.displayName, provider.api, provider.authType].some(
        (value) => typeof value === "string" && value.toLowerCase().includes(query),
      ),
    );
  }, [catalogProviderEntries, catalogProviderSearch]);
  const usageCostEntries = useMemo(
    () =>
      [...(usageCost?.daily ?? [])].toSorted((left, right) => left.date.localeCompare(right.date)),
    [usageCost],
  );
  const usageProviderEntries = useMemo(
    () =>
      [...(usageProviders?.providers ?? [])].toSorted((left, right) =>
        left.provider.localeCompare(right.provider),
      ),
    [usageProviders],
  );
  const latestUsageCost = usageCostValue(usageCostEntries.at(-1));
  const usageWindowCost = usageCostEntries.reduce((sum, entry) => sum + usageCostValue(entry), 0);
  const usagePressureWindows = usageProviderEntries.flatMap((provider) =>
    provider.windows.map((window) => ({ provider: provider.provider, window })),
  );
  const highestUsagePressure = usagePressureWindows.reduce(
    (max, entry) => Math.max(max, entry.window.usedPercent),
    0,
  );
  const configuredModelRefs = useMemo(
    () => [...new Set(configuredModels.map(configuredModelRef).filter((ref) => ref !== "unknown"))],
    [configuredModels],
  );
  const filteredConfiguredModels = useMemo(
    () =>
      configuredModels.filter((model) => runtimeModelMatchesFilters(model, runtimeModelFilters)),
    [configuredModels, runtimeModelFilters],
  );
  const runtimeProviderGroups = useMemo(
    () => groupConfiguredModelsByProvider(filteredConfiguredModels),
    [filteredConfiguredModels],
  );
  const allowlistCandidateRefs = useMemo(
    () => [
      ...new Set([
        ...allowlistRefsFromChains(modelChain, imageModelChain),
        ...configuredModelRefs,
        ...Object.keys(allowlistEntries),
      ]),
    ],
    [allowlistEntries, configuredModelRefs, imageModelChain, modelChain],
  );

  const toggleRuntimeModelFilter = (filter: RuntimeModelFilter) => {
    setRuntimeModelFilters((current) => {
      const next = new Set(current);
      if (next.has(filter)) {
        next.delete(filter);
      } else {
        next.add(filter);
      }
      return next;
    });
  };

  const lookupAction = async (nextPath = schemaPath) => {
    if (!nextPath.trim()) {
      setError("schema path is required");
      return;
    }
    setActionState("lookup");
    try {
      const result = await lookupConfigPath(nextPath.trim());
      setLookupResult(result);
      setSchemaPath(nextPath.trim());
      setError("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "schema lookup failed");
    } finally {
      setActionState("idle");
    }
  };

  const transformDefaultModelChain = (
    target: ModelChainTarget,
    transform: (current: { primary: string; fallbacks: string[] }) => {
      primary?: string;
      fallbacks?: string[];
    },
  ) => {
    setRawConfig((currentRaw) => {
      const config = parseJsonRecord(currentRaw) ?? {};
      const nextAgents = readRecord(config.agents);
      const nextDefaults = readRecord(nextAgents.defaults);
      const currentChain = readModelChain(nextDefaults[target]);
      const next = transform(currentChain);
      const nextPrimary = (next.primary ?? currentChain.primary).trim();
      const nextFallbacks = uniqueModelRefs(next.fallbacks ?? currentChain.fallbacks).filter(
        (ref) => ref !== nextPrimary,
      );
      const mergedChain = mergeModelChain(nextDefaults[target], nextPrimary, nextFallbacks);
      const nextConfig = {
        ...config,
        agents: {
          ...nextAgents,
          defaults: {
            ...nextDefaults,
            [target]: mergedChain,
          },
        },
      };
      return JSON.stringify(nextConfig, null, 2);
    });
  };

  const updateDefaultModelChain = (
    target: ModelChainTarget,
    next: { primary?: string; fallbacks?: string[] },
  ) => {
    transformDefaultModelChain(target, () => next);
  };

  const addDefaultFallbackAction = (target: ModelChainTarget, ref: string) => {
    const trimmed = ref.trim();
    if (!trimmed) {
      setError("model ref is required");
      return;
    }
    transformDefaultModelChain(target, (currentChain) => ({
      fallbacks:
        currentChain.primary === trimmed
          ? currentChain.fallbacks
          : [...currentChain.fallbacks, trimmed],
    }));
    setError("");
  };

  const removeDefaultFallbackAction = (target: ModelChainTarget, ref: string) => {
    transformDefaultModelChain(target, (currentChain) => ({
      fallbacks: currentChain.fallbacks.filter((fallbackRef) => fallbackRef !== ref),
    }));
  };

  const moveDefaultFallbackAction = (target: ModelChainTarget, ref: string, direction: -1 | 1) => {
    transformDefaultModelChain(target, (currentChain) => ({
      fallbacks: moveModelRef(currentChain.fallbacks, ref, direction),
    }));
  };

  const addFallbackModelAction = (ref: string) => {
    addDefaultFallbackAction("model", ref);
  };

  const toggleAllowlistAction = (active: boolean) => {
    setRawConfig((currentRaw) =>
      updateAgentDefaults(currentRaw, (defaults) => {
        if (!active) {
          const { models: _models, ...restDefaults } = defaults;
          void _models;
          return restDefaults;
        }
        const currentModelChain = readModelChain(defaults.model);
        const currentImageModelChain = readModelChain(defaults.imageModel);
        const nextModels: Record<string, AllowlistEntry> = {};
        for (const ref of allowlistRefsFromChains(currentModelChain, currentImageModelChain)) {
          nextModels[ref] = {};
        }
        return { ...defaults, models: nextModels };
      }),
    );
  };

  const toggleAllowlistModelAction = (ref: string, enabled: boolean) => {
    const trimmed = ref.trim();
    if (!trimmed) {
      setError("model ref is required");
      return;
    }
    setRawConfig((currentRaw) =>
      updateAgentDefaults(currentRaw, (defaults) => {
        const nextModels = { ...readAllowlistEntries(defaults.models) };
        if (enabled) {
          nextModels[trimmed] = nextModels[trimmed] ?? {};
        } else {
          delete nextModels[trimmed];
        }
        const { models: _models, ...restDefaults } = defaults;
        void _models;
        return Object.keys(nextModels).length > 0
          ? { ...restDefaults, models: nextModels }
          : restDefaults;
      }),
    );
    setError("");
  };

  const updateAllowlistEntryAction = (
    ref: string,
    update: (entry: AllowlistEntry) => AllowlistEntry,
  ) => {
    setRawConfig((currentRaw) =>
      updateAgentDefaults(currentRaw, (defaults) => {
        const nextModels = { ...readAllowlistEntries(defaults.models) };
        nextModels[ref] = update(nextModels[ref] ?? {});
        return { ...defaults, models: nextModels };
      }),
    );
  };

  const updateAllowlistParamsAction = (ref: string, value: string) => {
    try {
      const params = parseJsonObjectDraft(value);
      updateAllowlistEntryAction(ref, (entry) => ({ ...entry, params }));
      setError("");
    } catch (paramsError) {
      setError(paramsError instanceof Error ? paramsError.message : "invalid params json");
    }
  };

  const updateBedrockDiscoveryAction = (patch: Partial<BedrockDiscoveryConfig>) => {
    setRawConfig((currentRaw) =>
      updateModelsConfig(currentRaw, (models) => {
        const current = readBedrockDiscovery(models.bedrockDiscovery);
        return {
          ...models,
          bedrockDiscovery: {
            ...current,
            ...patch,
          },
        };
      }),
    );
  };

  const updateModelsModeAction = (mode: "" | "merge" | "replace") => {
    setRawConfig((currentRaw) =>
      updateModelsConfig(currentRaw, (models) => {
        const next = { ...models };
        if (mode) {
          next.mode = mode;
        } else {
          delete next.mode;
        }
        return next;
      }),
    );
  };

  const updateBedrockNumberAction = (
    field: "defaultContextWindow" | "defaultMaxTokens" | "refreshInterval",
    value: string,
  ) => {
    const trimmed = value.trim();
    if (!trimmed) {
      updateBedrockDiscoveryAction({ [field]: undefined });
      return;
    }
    const next = Number(trimmed);
    if (!Number.isFinite(next) || next < 0) {
      setError(`${field} must be a non-negative number`);
      return;
    }
    updateBedrockDiscoveryAction({ [field]: next });
    setError("");
  };

  const toggleBedrockProviderFilter = (provider: string, checked: boolean) => {
    setRawConfig((currentRaw) =>
      updateModelsConfig(currentRaw, (models) => {
        const current = readBedrockDiscovery(models.bedrockDiscovery);
        const currentFilter = current.providerFilter ?? [];
        const nextFilter = checked
          ? [...new Set([...currentFilter, provider])]
          : currentFilter.filter((entry) => entry !== provider);
        return {
          ...models,
          bedrockDiscovery: {
            ...current,
            providerFilter: nextFilter,
          },
        };
      }),
    );
  };

  const updateProviderStringField = (
    providerId: string,
    field: ProviderStringField,
    value: string,
  ) => {
    setRawConfig((currentRaw) =>
      updateProviderConfigEntry(currentRaw, providerId, (entry) => {
        const next = { ...entry };
        const trimmed = value.trim();
        if (trimmed) {
          next[field] = trimmed;
        } else {
          delete next[field];
        }
        return next;
      }),
    );
  };

  const updateProviderBooleanField = (
    providerId: string,
    field: ProviderBooleanField,
    value: boolean,
  ) => {
    setRawConfig((currentRaw) =>
      updateProviderConfigEntry(currentRaw, providerId, (entry) => ({
        ...entry,
        [field]: value,
      })),
    );
  };

  const updateProviderJsonField = (
    providerId: string,
    field: "headers" | "models",
    value: string,
  ) => {
    try {
      const parsed = field === "headers" ? parseJsonObjectDraft(value) : parseJsonArrayDraft(value);
      setRawConfig((currentRaw) =>
        updateProviderConfigEntry(currentRaw, providerId, (entry) => {
          const next = { ...entry };
          if (parsed === undefined) {
            delete next[field];
          } else {
            next[field] = parsed;
          }
          return next;
        }),
      );
      setError("");
    } catch (jsonError) {
      setError(jsonError instanceof Error ? jsonError.message : `invalid ${field} json`);
    }
  };

  const updateProviderHeadersAction = (
    providerId: string,
    headers: Record<string, string> | undefined,
  ) => {
    setRawConfig((currentRaw) =>
      updateProviderConfigEntry(currentRaw, providerId, (entry) => {
        const next = { ...entry };
        if (headers) {
          next.headers = headers;
        } else {
          delete next.headers;
        }
        return next;
      }),
    );
    setError("");
  };

  const updateProviderModelsAction = (providerId: string, models: unknown[]) => {
    setRawConfig((currentRaw) =>
      updateProviderConfigEntry(currentRaw, providerId, (entry) => {
        const next = { ...entry };
        if (models.length === 0) {
          delete next.models;
        } else {
          next.models = models;
        }
        return next;
      }),
    );
    setError("");
  };

  const addProviderAction = () => {
    const providerId = newProviderId.trim();
    if (!providerId) {
      setError("provider id is required");
      return;
    }
    setRawConfig((currentRaw) =>
      updateProviderConfigEntry(currentRaw, providerId, (entry) => entry),
    );
    setSelectedProviderId(providerId);
    setNewProviderId("");
    setError("");
  };

  const applyCatalogProviderAction = (provider: DeckGoCatalogProvider) => {
    const providerId = provider.id.trim();
    if (!providerId) {
      setError("catalog provider id is required");
      return;
    }
    const selectedModelIds = selectedCatalogModelIds(provider, catalogModelSelections);
    if (Array.isArray(provider.models) && selectedModelIds.length === 0) {
      setError("select at least one catalog model");
      return;
    }
    setRawConfig((currentRaw) =>
      updateProviderConfigEntry(currentRaw, providerId, (entry) => {
        const next = { ...entry };
        if (provider.defaultBaseUrl && typeof next.baseUrl !== "string") {
          next.baseUrl = provider.defaultBaseUrl;
        }
        if (provider.api && typeof next.api !== "string") {
          next.api = provider.api;
        }
        if (provider.authType && typeof next.auth !== "string") {
          next.auth = provider.authType;
        }
        const models = providerModelEntries(provider, selectedModelIds);
        if (models && !Array.isArray(next.models)) {
          next.models = models;
        }
        return next;
      }),
    );
    setSelectedProviderId(providerId);
    setError("");
  };

  const toggleCatalogModelSelection = (
    provider: DeckGoCatalogProvider,
    modelId: string,
    selected: boolean,
  ) => {
    setCatalogModelSelections((current) => {
      const currentSelection = selectedCatalogModelIds(provider, current);
      const nextSelection = selected
        ? [...new Set([...currentSelection, modelId])]
        : currentSelection.filter((currentModelId) => currentModelId !== modelId);
      return { ...current, [provider.id]: nextSelection };
    });
  };

  const setAllCatalogModelsSelected = (provider: DeckGoCatalogProvider, selected: boolean) => {
    setCatalogModelSelections((current) => ({
      ...current,
      [provider.id]: selected ? catalogModelIds(provider) : [],
    }));
  };

  const probeAction = async (provider: string) => {
    const trimmed = provider.trim();
    if (!trimmed) {
      setError("provider is required");
      return;
    }
    setActionState("probe");
    try {
      const result = await probeRuntimeModelAuth(trimmed);
      setProbeResult(result);
      setError("");
      const nextModelAuth = await fetchRuntimeModelAuthOverview();
      setModelAuth(nextModelAuth);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "model auth probe failed");
    } finally {
      setActionState("idle");
    }
  };

  const saveAction = async () => {
    setActionState("saving");
    try {
      const result = await saveModelsConfig(rawConfig, baseHash);
      setActionResult(result);
      setBaseHash(result.baseHash ?? result.hash ?? baseHash);
      setError("");
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "models config save failed");
    } finally {
      setActionState("idle");
    }
  };

  return (
    <section className="deckgo-panel-workspace deck-ui-models">
      <div className="deckgo-column deck-ui-models-column">
        <article className="deckgo-card is-float deck-ui-models-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Models</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Models config uses provider inventory, schema lookup, catalog data, auth overview, and
            structured provider edits.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-models-body">
            <div className="deckgo-pill-row deck-ui-models-status-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Models {loadState}
              </span>
              <span className="deckgo-pill">{providerEntries.length} providers</span>
              <span className="deckgo-pill">{configuredModels.length} configured models</span>
              <span className="deckgo-pill">{authProviders.length} auth providers</span>
              <span className="deckgo-pill">{catalogProviderEntries.length} catalog providers</span>
              <span className="deckgo-pill">hash {baseHash || "n/a"}</span>
            </div>
            <div className="deckgo-grid deckgo-grid-3 deck-ui-models-stats">
              <ShellStat label="providers" value={providerEntries.length} />
              <ShellStat label="configured" value={configuredModels.length} />
              <ShellStat label="schema path" value={schemaPath} />
            </div>
            <div className="deckgo-actions deck-ui-models-actions">
              <button
                className="deckgo-button deck-ui-models-button"
                type="button"
                onClick={() => void refresh()}
              >
                Refresh models
              </button>
              <button
                className="deckgo-button deck-ui-models-button is-primary"
                type="button"
                onClick={() => void saveAction()}
                disabled={actionState !== "idle"}
              >
                {actionState === "saving" ? "Saving" : "Save models config"}
              </button>
            </div>
            {error ? <p className="deckgo-note deck-ui-models-error">{error}</p> : null}
            <label className="deckgo-label deck-ui-models-label">
              <span>Models config</span>
              <textarea
                className="deckgo-textarea deck-ui-models-textarea deck-ui-models-raw-textarea"
                rows={20}
                value={rawConfig}
                onChange={(event) => setRawConfig(event.target.value)}
              />
            </label>
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-panel-main deck-ui-models-column">
        <article className="deckgo-card is-float deck-ui-models-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Models detail</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Model management stays anchored on current config truth, provider catalog data, and
            supported default/fallback actions.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-models-body">
            <div className="deckgo-surface-tile deck-ui-models-surface">
              <p className="deckgo-surface-label">Lookup config path</p>
              <div className="deckgo-actions deck-ui-models-actions">
                <input
                  className="deckgo-input deck-ui-models-input"
                  value={schemaPath}
                  onChange={(event) => setSchemaPath(event.target.value)}
                  placeholder="config path"
                />
                <button
                  className="deckgo-button deck-ui-models-button"
                  type="button"
                  onClick={() => void lookupAction()}
                  disabled={actionState !== "idle"}
                >
                  {actionState === "lookup" ? "Looking up" : "Lookup schema"}
                </button>
              </div>
            </div>
            <div className="deckgo-surface-tile deck-ui-models-surface">
              <p className="deckgo-surface-label">Default model chain</p>
              <div className="deckgo-grid deckgo-grid-2 deck-ui-models-grid">
                <label className="deckgo-label deck-ui-models-label">
                  <span>Primary model</span>
                  <input
                    aria-label="Primary model"
                    className="deckgo-input deck-ui-models-input"
                    list="deckgo-configured-models"
                    value={modelChain.primary}
                    onChange={(event) =>
                      updateDefaultModelChain("model", { primary: event.target.value })
                    }
                  />
                </label>
                <label className="deckgo-label deck-ui-models-label">
                  <span>Fallback models</span>
                  <input
                    aria-label="Fallback models"
                    className="deckgo-input deck-ui-models-input"
                    value={modelChain.fallbacks.join(", ")}
                    onChange={(event) =>
                      updateDefaultModelChain("model", {
                        fallbacks: parseFallbackList(event.target.value),
                      })
                    }
                  />
                </label>
                <label className="deckgo-label deck-ui-models-label">
                  <span>Image primary</span>
                  <input
                    aria-label="Image primary model"
                    className="deckgo-input deck-ui-models-input"
                    list="deckgo-configured-models"
                    value={imageModelChain.primary}
                    onChange={(event) =>
                      updateDefaultModelChain("imageModel", { primary: event.target.value })
                    }
                  />
                </label>
                <label className="deckgo-label deck-ui-models-label">
                  <span>Image fallbacks</span>
                  <input
                    aria-label="Image fallback models"
                    className="deckgo-input deck-ui-models-input"
                    value={imageModelChain.fallbacks.join(", ")}
                    onChange={(event) =>
                      updateDefaultModelChain("imageModel", {
                        fallbacks: parseFallbackList(event.target.value),
                      })
                    }
                  />
                </label>
              </div>
              <ModelFallbackControls
                label="text"
                primary={modelChain.primary}
                fallbacks={modelChain.fallbacks}
                configuredModelRefs={configuredModelRefs}
                onAdd={(ref) => addDefaultFallbackAction("model", ref)}
                onRemove={(ref) => removeDefaultFallbackAction("model", ref)}
                onMove={(ref, direction) => moveDefaultFallbackAction("model", ref, direction)}
              />
              <ModelFallbackControls
                label="image"
                primary={imageModelChain.primary}
                fallbacks={imageModelChain.fallbacks}
                configuredModelRefs={configuredModelRefs}
                onAdd={(ref) => addDefaultFallbackAction("imageModel", ref)}
                onRemove={(ref) => removeDefaultFallbackAction("imageModel", ref)}
                onMove={(ref, direction) => moveDefaultFallbackAction("imageModel", ref, direction)}
              />
              <datalist id="deckgo-configured-models">
                {configuredModelRefs.map((ref) => (
                  <option key={ref} value={ref} />
                ))}
              </datalist>
              <p className="deckgo-note">
                Updates preserve existing model object fields and are saved with the raw config
                hash.
              </p>
            </div>
            <div className="deckgo-surface-tile deck-ui-models-surface">
              <p className="deckgo-surface-label">Model allowlist</p>
              <div className="deckgo-pill-row deck-ui-models-pill-row">
                <button
                  className={`deckgo-pill ${allowlistActive ? "is-selected" : ""}`}
                  type="button"
                  onClick={() => toggleAllowlistAction(!allowlistActive)}
                >
                  {allowlistActive ? "Allowlist on" : "Allowlist off"}
                </button>
                <span className="deckgo-pill">{Object.keys(allowlistEntries).length} entries</span>
              </div>
              <p className="deckgo-note">
                When enabled, agents.defaults.models restricts usable models. Turning it off removes
                the key to preserve Gateway allow-any semantics.
              </p>
              {allowlistCandidateRefs.length === 0 ? (
                <p className="deckgo-note">No configured model refs are available yet.</p>
              ) : (
                <ul className="deckgo-shell-list deck-ui-models-list">
                  {allowlistCandidateRefs.map((ref) => {
                    const entry = allowlistEntries[ref];
                    const paramsDraft = entry?.params ? JSON.stringify(entry.params, null, 2) : "";
                    return (
                      <li key={ref}>
                        <div className="deckgo-selectable-card deck-ui-models-row">
                          <div className="deckgo-panel-hero-strip deck-ui-models-hero">
                            <div>
                              <strong>{ref}</strong>
                              <p className="deckgo-note">
                                {entry ? "enabled in allowlist" : "not allowlisted"}
                              </p>
                            </div>
                            <button
                              className={`deckgo-pill ${entry ? "is-selected" : ""}`}
                              type="button"
                              onClick={() => toggleAllowlistModelAction(ref, !entry)}
                            >
                              {entry ? "Enabled" : "Disabled"}
                            </button>
                          </div>
                          {entry ? (
                            <div className="deckgo-grid deckgo-grid-2 deck-ui-models-grid deck-ui-models-spaced">
                              <label className="deckgo-label deck-ui-models-label">
                                <span>Alias</span>
                                <input
                                  aria-label={`Alias ${ref}`}
                                  className="deckgo-input deck-ui-models-input"
                                  value={entry.alias ?? ""}
                                  onChange={(event) =>
                                    updateAllowlistEntryAction(ref, (current) => ({
                                      ...current,
                                      alias: event.target.value.trim() || undefined,
                                    }))
                                  }
                                />
                              </label>
                              <label className="deckgo-pill deck-ui-models-check-end">
                                <input
                                  aria-label={`Streaming ${ref}`}
                                  checked={entry.streaming === true}
                                  onChange={(event) =>
                                    updateAllowlistEntryAction(ref, (current) => ({
                                      ...current,
                                      streaming: event.target.checked,
                                    }))
                                  }
                                  type="checkbox"
                                />{" "}
                                streaming
                              </label>
                              <label className="deckgo-label deck-ui-models-label">
                                <span>Params JSON</span>
                                <textarea
                                  aria-label={`Params ${ref}`}
                                  className="deckgo-textarea deck-ui-models-textarea"
                                  rows={4}
                                  value={paramsDraft}
                                  onChange={(event) =>
                                    updateAllowlistParamsAction(ref, event.target.value)
                                  }
                                />
                              </label>
                            </div>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="deckgo-surface-tile deck-ui-models-surface">
              <p className="deckgo-surface-label">Bedrock discovery</p>
              <div className="deckgo-pill-row deck-ui-models-pill-row">
                <label className="deckgo-pill">
                  <input
                    aria-label="Bedrock discovery enabled"
                    checked={bedrockDiscovery.enabled === true}
                    onChange={(event) =>
                      updateBedrockDiscoveryAction({ enabled: event.target.checked })
                    }
                    type="checkbox"
                  />{" "}
                  discovery {bedrockDiscovery.enabled ? "on" : "off"}
                </label>
                <span className="deckgo-pill">
                  {(bedrockDiscovery.providerFilter ?? []).length} providers
                </span>
              </div>
              <div className="deckgo-grid deckgo-grid-2 deck-ui-models-grid deck-ui-models-spaced">
                <label className="deckgo-label deck-ui-models-label">
                  <span>Region</span>
                  <input
                    aria-label="Bedrock region"
                    className="deckgo-input deck-ui-models-input"
                    list="deckgo-bedrock-regions"
                    value={bedrockDiscovery.region ?? ""}
                    onChange={(event) =>
                      updateBedrockDiscoveryAction({
                        region: event.target.value.trim() || undefined,
                      })
                    }
                  />
                </label>
                <label className="deckgo-label deck-ui-models-label">
                  <span>Refresh interval</span>
                  <input
                    aria-label="Bedrock refresh interval"
                    className="deckgo-input deck-ui-models-input"
                    min={0}
                    onChange={(event) =>
                      updateBedrockNumberAction("refreshInterval", event.target.value)
                    }
                    type="number"
                    value={bedrockDiscovery.refreshInterval ?? ""}
                  />
                </label>
                <label className="deckgo-label deck-ui-models-label">
                  <span>Default context window</span>
                  <input
                    aria-label="Bedrock default context"
                    className="deckgo-input deck-ui-models-input"
                    min={0}
                    onChange={(event) =>
                      updateBedrockNumberAction("defaultContextWindow", event.target.value)
                    }
                    type="number"
                    value={bedrockDiscovery.defaultContextWindow ?? ""}
                  />
                </label>
                <label className="deckgo-label deck-ui-models-label">
                  <span>Default max tokens</span>
                  <input
                    aria-label="Bedrock default max tokens"
                    className="deckgo-input deck-ui-models-input"
                    min={0}
                    onChange={(event) =>
                      updateBedrockNumberAction("defaultMaxTokens", event.target.value)
                    }
                    type="number"
                    value={bedrockDiscovery.defaultMaxTokens ?? ""}
                  />
                </label>
              </div>
              <datalist id="deckgo-bedrock-regions">
                {COMMON_BEDROCK_REGIONS.map((region) => (
                  <option key={region} value={region} />
                ))}
              </datalist>
              <div className="deckgo-pill-row deck-ui-models-pill-row deck-ui-models-spaced">
                {BEDROCK_PROVIDER_FILTERS.map((provider) => (
                  <label className="deckgo-pill" key={provider}>
                    <input
                      aria-label={`Bedrock provider ${provider}`}
                      checked={(bedrockDiscovery.providerFilter ?? []).includes(provider)}
                      onChange={(event) =>
                        toggleBedrockProviderFilter(provider, event.target.checked)
                      }
                      type="checkbox"
                    />{" "}
                    {provider}
                  </label>
                ))}
              </div>
            </div>
            <div className="deckgo-surface-tile deck-ui-models-surface">
              <p className="deckgo-surface-label">Model catalog mode</p>
              <div className="deckgo-grid deckgo-grid-2 deck-ui-models-grid">
                <label className="deckgo-label deck-ui-models-label">
                  <span>Provider catalog behavior</span>
                  <select
                    aria-label="Models catalog mode"
                    className="deckgo-input deck-ui-models-input"
                    value={modelsMode}
                    onChange={(event) =>
                      updateModelsModeAction(event.target.value as "" | "merge" | "replace")
                    }
                  >
                    <option value="">default</option>
                    <option value="merge">merge</option>
                    <option value="replace">replace</option>
                  </select>
                </label>
                <div className="deckgo-selectable-card deck-ui-models-row">
                  <strong>{modelsMode || "default"}</strong>
                  <p className="deckgo-note">
                    merge overlays configured providers on built-ins; replace uses configured
                    providers only.
                  </p>
                </div>
              </div>
            </div>
            <div className="deckgo-panel-hero-strip deck-ui-models-hero">
              <div>
                <p className="deckgo-kicker">Provider inventory</p>
                <strong>{providerEntries.length ? providerEntries[0][0] : "No providers"}</strong>
                <p className="deckgo-note">Current models.providers keys from raw config</p>
              </div>
              <div className="deckgo-pill-row deck-ui-models-pill-row">
                <span className="deckgo-pill">{providerEntries.length} configured</span>
                <span className="deckgo-pill">
                  {lookupResult?.children.length ?? 0} schema children
                </span>
              </div>
            </div>
            {providerEntries.length === 0 ? (
              <p className="deckgo-note">No model providers found in the current raw config.</p>
            ) : (
              <ul className="deckgo-shell-list deck-ui-models-list">
                {providerEntries.map(([provider, value]) => (
                  <li key={provider}>
                    <div className="deckgo-selectable-card deck-ui-models-row">
                      <strong>{provider}</strong>
                      <div className="deckgo-meta">
                        keys:{" "}
                        {Object.keys((value as Record<string, unknown>) ?? {}).join(", ") || "n/a"}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="deckgo-surface-tile deck-ui-models-surface">
              <p className="deckgo-surface-label">Provider config editor</p>
              <div className="deckgo-actions deck-ui-models-actions">
                <input
                  aria-label="New provider id"
                  className="deckgo-input deck-ui-models-input"
                  value={newProviderId}
                  onChange={(event) => setNewProviderId(event.target.value)}
                  placeholder="provider id"
                />
                <button
                  className="deckgo-button deck-ui-models-button"
                  type="button"
                  onClick={addProviderAction}
                >
                  Add provider
                </button>
              </div>
              {providerEntries.length > 0 ? (
                <div className="deckgo-pill-row deck-ui-models-pill-row deck-ui-models-spaced">
                  {providerEntries.map(([provider]) => (
                    <button
                      className={`deckgo-pill ${provider === selectedProvider ? "is-selected" : ""}`}
                      key={provider}
                      type="button"
                      onClick={() => setSelectedProviderId(provider)}
                    >
                      {provider}
                    </button>
                  ))}
                </div>
              ) : null}
              {selectedProvider ? (
                <>
                  <div className="deckgo-grid deckgo-grid-2 deck-ui-models-grid deck-ui-models-spaced">
                    <label className="deckgo-label deck-ui-models-label">
                      <span>API format</span>
                      <input
                        aria-label="Provider API"
                        className="deckgo-input deck-ui-models-input"
                        value={
                          typeof selectedProviderConfig.api === "string"
                            ? selectedProviderConfig.api
                            : ""
                        }
                        onChange={(event) =>
                          updateProviderStringField(selectedProvider, "api", event.target.value)
                        }
                      />
                    </label>
                    <label className="deckgo-label deck-ui-models-label">
                      <span>Auth type</span>
                      <input
                        aria-label="Provider auth type"
                        className="deckgo-input deck-ui-models-input"
                        value={
                          typeof selectedProviderConfig.auth === "string"
                            ? selectedProviderConfig.auth
                            : ""
                        }
                        onChange={(event) =>
                          updateProviderStringField(selectedProvider, "auth", event.target.value)
                        }
                      />
                    </label>
                    <label className="deckgo-label deck-ui-models-label">
                      <span>Base URL</span>
                      <input
                        aria-label="Provider base URL"
                        className="deckgo-input deck-ui-models-input"
                        value={
                          typeof selectedProviderConfig.baseUrl === "string"
                            ? selectedProviderConfig.baseUrl
                            : ""
                        }
                        onChange={(event) =>
                          updateProviderStringField(selectedProvider, "baseUrl", event.target.value)
                        }
                      />
                    </label>
                    <label className="deckgo-label deck-ui-models-label">
                      <span>API key env</span>
                      <input
                        aria-label="Provider API key env"
                        className="deckgo-input deck-ui-models-input"
                        value={
                          typeof selectedProviderConfig.apiKeyEnv === "string"
                            ? selectedProviderConfig.apiKeyEnv
                            : ""
                        }
                        onChange={(event) =>
                          updateProviderStringField(
                            selectedProvider,
                            "apiKeyEnv",
                            event.target.value,
                          )
                        }
                      />
                    </label>
                    <label className="deckgo-label deck-ui-models-label">
                      <span>API key</span>
                      <input
                        aria-label="Provider API key"
                        className="deckgo-input deck-ui-models-input"
                        value={
                          typeof selectedProviderConfig.apiKey === "string"
                            ? selectedProviderConfig.apiKey
                            : ""
                        }
                        onChange={(event) =>
                          updateProviderStringField(selectedProvider, "apiKey", event.target.value)
                        }
                      />
                    </label>
                  </div>
                  <div className="deckgo-pill-row deck-ui-models-pill-row deck-ui-models-spaced">
                    <label className="deckgo-pill">
                      <input
                        aria-label="Provider auth header"
                        checked={selectedProviderConfig.authHeader === true}
                        onChange={(event) =>
                          updateProviderBooleanField(
                            selectedProvider,
                            "authHeader",
                            event.target.checked,
                          )
                        }
                        type="checkbox"
                      />{" "}
                      auth header
                    </label>
                    <label className="deckgo-pill">
                      <input
                        aria-label="Provider inject num ctx"
                        checked={selectedProviderConfig.injectNumCtxForOpenAICompat === true}
                        onChange={(event) =>
                          updateProviderBooleanField(
                            selectedProvider,
                            "injectNumCtxForOpenAICompat",
                            event.target.checked,
                          )
                        }
                        type="checkbox"
                      />{" "}
                      inject num ctx
                    </label>
                    <span className="deckgo-pill">
                      models{" "}
                      {Array.isArray(selectedProviderConfig.models)
                        ? selectedProviderConfig.models.length
                        : 0}
                    </span>
                  </div>
                  <div className="deckgo-grid deckgo-grid-2 deck-ui-models-grid deck-ui-models-spaced">
                    <label className="deckgo-label deck-ui-models-label">
                      <span>Headers JSON</span>
                      <textarea
                        aria-label="Provider headers JSON"
                        className="deckgo-textarea deck-ui-models-textarea"
                        rows={5}
                        value={
                          selectedProviderConfig.headers
                            ? JSON.stringify(selectedProviderConfig.headers, null, 2)
                            : ""
                        }
                        onChange={(event) =>
                          updateProviderJsonField(selectedProvider, "headers", event.target.value)
                        }
                      />
                    </label>
                    <label className="deckgo-label deck-ui-models-label">
                      <span>Provider models JSON</span>
                      <textarea
                        aria-label="Provider models JSON"
                        className="deckgo-textarea deck-ui-models-textarea"
                        rows={5}
                        value={
                          Array.isArray(selectedProviderConfig.models)
                            ? JSON.stringify(selectedProviderConfig.models, null, 2)
                            : ""
                        }
                        onChange={(event) =>
                          updateProviderJsonField(selectedProvider, "models", event.target.value)
                        }
                      />
                    </label>
                  </div>
                  <StringRecordEditor
                    addLabel="Add provider header"
                    ariaPrefix="Provider header"
                    emptyText="No provider headers configured."
                    nameLabel="Header name"
                    removeLabel="Remove header"
                    title="Provider headers"
                    value={readStringRecord(selectedProviderConfig.headers)}
                    valueLabel="Header value"
                    onChange={(headers) => updateProviderHeadersAction(selectedProvider, headers)}
                  />
                  <ProviderModelsEditor
                    catalogProvider={selectedCatalogProvider}
                    modelsValue={selectedProviderConfig.models}
                    onChange={(models) => updateProviderModelsAction(selectedProvider, models)}
                  />
                </>
              ) : (
                <p className="deckgo-note">Add or select a provider to edit structured fields.</p>
              )}
            </div>
            <div className="deckgo-surface-tile deck-ui-models-surface">
              <p className="deckgo-surface-label">Model auth overview</p>
              <div className="deckgo-pill-row deck-ui-models-pill-row">
                <span className="deckgo-pill">{modelAuth?.runtimeId || "rt_local"}</span>
                <span className="deckgo-pill">{authProviders.length} providers</span>
              </div>
              {authProviders.length === 0 ? (
                <p className="deckgo-note">No model auth providers returned by Gateway.</p>
              ) : (
                <ul className="deckgo-shell-list deck-ui-models-list">
                  {authProviders.map((provider) => (
                    <li key={provider.provider}>
                      <div className="deckgo-selectable-card deck-ui-models-row">
                        <strong>{provider.provider}</strong>
                        <div className="deckgo-meta">
                          {provider.status || "unknown"} | source {provider.source || "unknown"} |
                          scope {provider.scope || "global"}
                        </div>
                        <div className="deckgo-pill-row deck-ui-models-pill-row">
                          <span
                            className={`deckgo-pill ${provider.authPresent ? "is-positive" : "is-muted"}`}
                          >
                            auth {provider.authPresent ? "present" : "missing"}
                          </span>
                          <span
                            className={`deckgo-pill ${provider.configPresent ? "is-positive" : "is-muted"}`}
                          >
                            config {provider.configPresent ? "present" : "missing"}
                          </span>
                          <span className="deckgo-pill">
                            {provider.editable ? "editable" : "runtime-only"}
                          </span>
                          {provider.auth?.type ? (
                            <span className="deckgo-pill">
                              auth {authTypeLabel(provider.auth.type)}
                            </span>
                          ) : null}
                          {provider.auth?.source ? (
                            <span className="deckgo-pill">auth source {provider.auth.source}</span>
                          ) : null}
                          {provider.oauth ? (
                            <span className="deckgo-pill">
                              oauth {provider.oauth.status || "unknown"} ·{" "}
                              {formatCountdown(provider.oauth.remainingMs)}
                            </span>
                          ) : null}
                          {provider.cooldown && Number(provider.cooldown.remainingMs ?? 0) > 0 ? (
                            <span className="deckgo-pill">
                              cooldown {provider.cooldown.reason || "unknown"} ·{" "}
                              {formatCountdown(provider.cooldown.remainingMs)}
                            </span>
                          ) : null}
                        </div>
                        <div className="deckgo-actions deck-ui-models-actions">
                          <button
                            className="deckgo-button deck-ui-models-button"
                            type="button"
                            onClick={() => void probeAction(provider.provider)}
                            disabled={actionState !== "idle"}
                          >
                            {actionState === "probe" ? "Probing" : `Probe ${provider.provider}`}
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="deckgo-surface-tile deck-ui-models-surface">
              <p className="deckgo-surface-label">Model usage summary</p>
              <div className="deckgo-grid deckgo-grid-3 deck-ui-models-stats">
                <ShellStat label="latest day cost" value={formatUsageCost(latestUsageCost)} />
                <ShellStat
                  label={`${usageCost?.days ?? 14}d cost`}
                  value={formatUsageCost(usageWindowCost)}
                />
                <ShellStat label="providers" value={usageProviderEntries.length} />
                <ShellStat label="quota windows" value={usagePressureWindows.length} />
                <ShellStat label="highest pressure" value={`${highestUsagePressure.toFixed(0)}%`} />
                <ShellStat label="usage updated" value={usageProviders?.updatedAt ?? "n/a"} />
              </div>
              {usageProviderEntries.length === 0 ? (
                <p className="deckgo-note">No model usage provider pressure returned by Gateway.</p>
              ) : (
                <ul className="deckgo-shell-list deck-ui-models-list deck-ui-models-spaced">
                  {usageProviderEntries.map((provider: DeckGoUsageProviderStatus) => (
                    <li key={provider.provider}>
                      <div className="deckgo-selectable-card deck-ui-models-row">
                        <div className="deckgo-panel-hero-strip deck-ui-models-hero">
                          <div>
                            <strong>{provider.displayName || provider.provider}</strong>
                            <p className="deckgo-note">
                              {provider.provider} {provider.plan ? `| plan ${provider.plan}` : ""}
                            </p>
                          </div>
                          <span
                            className={`deckgo-pill ${
                              provider.error
                                ? "is-danger"
                                : provider.windows.some((window) => window.usedPercent >= 80)
                                  ? "is-warning"
                                  : "is-positive"
                            }`}
                          >
                            {provider.error || `${provider.windows.length} quota windows`}
                          </span>
                        </div>
                        {provider.windows.length === 0 ? (
                          <p className="deckgo-note">No quota windows reported.</p>
                        ) : (
                          <div className="deckgo-pill-row deck-ui-models-pill-row deck-ui-models-spaced">
                            {provider.windows.map((window) => (
                              <span className="deckgo-pill" key={window.label}>
                                {window.label}: {window.usedPercent.toFixed(0)}%
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="deckgo-surface-tile deck-ui-models-surface">
              <p className="deckgo-surface-label">Catalog providers</p>
              <div className="deckgo-pill-row deck-ui-models-pill-row">
                <span className="deckgo-pill">{catalogProviders?.runtimeId || "rt_local"}</span>
                <span className="deckgo-pill">{catalogProviderEntries.length} providers</span>
                <span className="deckgo-pill">{filteredCatalogProviderEntries.length} visible</span>
              </div>
              <label className="deckgo-label deck-ui-models-label deck-ui-models-spaced">
                <span>Search catalog providers</span>
                <input
                  aria-label="Catalog provider search"
                  className="deckgo-input deck-ui-models-input"
                  placeholder="provider, api, or auth"
                  value={catalogProviderSearch}
                  onChange={(event) => setCatalogProviderSearch(event.target.value)}
                />
              </label>
              {catalogProviderEntries.length === 0 ? (
                <p className="deckgo-note">No catalog providers returned by Gateway.</p>
              ) : filteredCatalogProviderEntries.length === 0 ? (
                <p className="deckgo-note">No catalog providers match the current search.</p>
              ) : (
                <ul className="deckgo-shell-list deck-ui-models-list">
                  {filteredCatalogProviderEntries.map((provider: DeckGoCatalogProvider) => (
                    <li key={provider.id}>
                      <div className="deckgo-selectable-card deck-ui-models-row">
                        {(() => {
                          const selectedModelIds = selectedCatalogModelIds(
                            provider,
                            catalogModelSelections,
                          );
                          const firstSelectedRef = firstCatalogModelRef(provider, selectedModelIds);
                          const hasSelectableModels = Array.isArray(provider.models);
                          return (
                            <>
                              <strong>{provider.displayName || provider.id}</strong>
                              <div className="deckgo-meta">
                                {provider.id} | api {provider.api || "unknown"} | auth{" "}
                                {provider.authType || "unknown"} | models {provider.modelCount ?? 0}
                              </div>
                              {provider.defaultBaseUrl ? (
                                <div className="deckgo-meta">base: {provider.defaultBaseUrl}</div>
                              ) : null}
                              {provider.models?.length ? (
                                <div className="deckgo-surface-tile deck-ui-models-surface deck-ui-models-spaced">
                                  <div className="deckgo-panel-hero-strip deck-ui-models-hero">
                                    <div>
                                      <strong>Catalog model selection</strong>
                                      <p className="deckgo-note">
                                        {selectedModelIds.length} / {provider.models.length}{" "}
                                        selected
                                      </p>
                                    </div>
                                    <div className="deckgo-actions deck-ui-models-actions">
                                      <button
                                        className="deckgo-button deckgo-button-compact deck-ui-models-button"
                                        type="button"
                                        onClick={() => setAllCatalogModelsSelected(provider, true)}
                                      >
                                        Select all
                                      </button>
                                      <button
                                        className="deckgo-button deckgo-button-compact deck-ui-models-button"
                                        type="button"
                                        onClick={() => setAllCatalogModelsSelected(provider, false)}
                                      >
                                        Clear
                                      </button>
                                    </div>
                                  </div>
                                  <div className="deckgo-pill-row deck-ui-models-pill-row deck-ui-models-spaced">
                                    {provider.models.map((model) => (
                                      <label className="deckgo-pill" key={model.id}>
                                        <input
                                          aria-label={`Catalog model ${provider.id}/${model.id}`}
                                          checked={selectedModelIds.includes(model.id)}
                                          onChange={(event) =>
                                            toggleCatalogModelSelection(
                                              provider,
                                              model.id,
                                              event.target.checked,
                                            )
                                          }
                                          type="checkbox"
                                        />{" "}
                                        {model.name || model.id}
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                              <div className="deckgo-actions deck-ui-models-actions deck-ui-models-spaced-tight">
                                {firstSelectedRef ? (
                                  <>
                                    <button
                                      className="deckgo-button deck-ui-models-button"
                                      type="button"
                                      onClick={() => {
                                        applyCatalogProviderAction(provider);
                                        updateDefaultModelChain("model", {
                                          primary: firstSelectedRef,
                                        });
                                      }}
                                    >
                                      Set catalog default {provider.id}
                                    </button>
                                    <button
                                      className="deckgo-button deck-ui-models-button"
                                      type="button"
                                      onClick={() => {
                                        applyCatalogProviderAction(provider);
                                        addDefaultFallbackAction("model", firstSelectedRef);
                                      }}
                                    >
                                      Add catalog fallback {provider.id}
                                    </button>
                                  </>
                                ) : null}
                                <button
                                  className="deckgo-button deck-ui-models-button"
                                  type="button"
                                  disabled={hasSelectableModels && selectedModelIds.length === 0}
                                  onClick={() => applyCatalogProviderAction(provider)}
                                >
                                  Use catalog {provider.id}
                                </button>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="deckgo-surface-tile deck-ui-models-surface">
              <p className="deckgo-surface-label">Runtime model catalog</p>
              <div className="deckgo-pill-row deck-ui-models-pill-row">
                <span className="deckgo-pill">{runtimeModels?.runtimeId || "rt_local"}</span>
                <span className="deckgo-pill">{configuredModels.length} models</span>
                <span className="deckgo-pill">{filteredConfiguredModels.length} visible</span>
                {RUNTIME_MODEL_FILTERS.map((filter) => (
                  <button
                    className={`deckgo-pill ${runtimeModelFilters.has(filter.key) ? "is-selected" : ""}`}
                    key={filter.key}
                    type="button"
                    onClick={() => toggleRuntimeModelFilter(filter.key)}
                  >
                    Filter {filter.label}
                  </button>
                ))}
              </div>
              {filteredConfiguredModels.length === 0 ? (
                <p className="deckgo-note">No configured runtime models returned by Gateway.</p>
              ) : (
                <ul className="deckgo-shell-list deck-ui-models-list">
                  {runtimeProviderGroups.map(([provider, models]) => (
                    <li key={provider}>
                      <div className="deckgo-selectable-card deck-ui-models-row">
                        <div className="deckgo-panel-hero-strip deck-ui-models-hero">
                          <div>
                            <strong>{provider}</strong>
                            <p className="deckgo-note">{models.length} visible runtime models</p>
                          </div>
                          <span className="deckgo-pill">
                            auth{" "}
                            {authProviders.find((entry) => entry.provider === provider)?.status ??
                              "unknown"}
                          </span>
                        </div>
                        <ul className="deckgo-shell-list deck-ui-models-list deck-ui-models-spaced">
                          {models.map((model, index) => {
                            const ref = configuredModelRef(model);
                            const inputModes = modelInputModes(model);
                            const isTextDefault = modelChain.primary === ref;
                            const isImageDefault = imageModelChain.primary === ref;
                            const allowlistEntry = allowlistEntries[ref];
                            return (
                              <li key={`${ref}-${index}`}>
                                <div className="deckgo-selectable-card deck-ui-models-row">
                                  <div className="deckgo-panel-hero-strip deck-ui-models-hero">
                                    <div>
                                      <strong>{model.name || configuredModelId(model)}</strong>
                                      <div className="deckgo-meta">
                                        ref: {ref} | id: {configuredModelId(model)}
                                      </div>
                                    </div>
                                    <div className="deckgo-pill-row deck-ui-models-pill-row">
                                      {isTextDefault ? (
                                        <span className="deckgo-pill is-positive">default</span>
                                      ) : null}
                                      {isImageDefault ? (
                                        <span className="deckgo-pill is-positive">
                                          image default
                                        </span>
                                      ) : null}
                                      <span className="deckgo-pill">
                                        auth {model.authStatus || "unknown"}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="deckgo-grid deckgo-grid-3 deck-ui-models-stats deck-ui-models-spaced">
                                    <ShellStat
                                      label="context"
                                      value={formatTokenWindow(model.contextWindow)}
                                    />
                                    <ShellStat
                                      label="max output"
                                      value={formatTokenWindow(model.maxTokens)}
                                    />
                                    <ShellStat
                                      label="input"
                                      value={inputModes.length > 0 ? inputModes.join(", ") : "text"}
                                    />
                                  </div>
                                  <div className="deckgo-pill-row deck-ui-models-pill-row deck-ui-models-spaced">
                                    <span className="deckgo-pill">
                                      input {formatModelPrice(model.cost?.input)}
                                    </span>
                                    <span className="deckgo-pill">
                                      output {formatModelPrice(model.cost?.output)}
                                    </span>
                                    <span className="deckgo-pill">
                                      cache read {formatModelPrice(model.cost?.cacheRead)}
                                    </span>
                                    <span className="deckgo-pill">
                                      cache write {formatModelPrice(model.cost?.cacheWrite)}
                                    </span>
                                    {model.reasoning ? (
                                      <span className="deckgo-pill is-positive">reasoning</span>
                                    ) : null}
                                    {typeof model.source === "string" ? (
                                      <span className="deckgo-pill">source {model.source}</span>
                                    ) : null}
                                    {typeof model.scope === "string" ? (
                                      <span className="deckgo-pill">scope {model.scope}</span>
                                    ) : null}
                                    {typeof model.editable === "boolean" ? (
                                      <span className="deckgo-pill">
                                        {model.editable ? "editable" : "runtime-only"}
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="deckgo-actions deck-ui-models-actions deck-ui-models-spaced">
                                    <button
                                      className="deckgo-button deck-ui-models-button"
                                      type="button"
                                      onClick={() =>
                                        updateDefaultModelChain("model", { primary: ref })
                                      }
                                    >
                                      Set default {ref}
                                    </button>
                                    <button
                                      className="deckgo-button deck-ui-models-button"
                                      type="button"
                                      onClick={() => addFallbackModelAction(ref)}
                                    >
                                      Add fallback {ref}
                                    </button>
                                    {inputModes.includes("image") ? (
                                      <button
                                        className="deckgo-button deck-ui-models-button"
                                        type="button"
                                        onClick={() =>
                                          updateDefaultModelChain("imageModel", { primary: ref })
                                        }
                                      >
                                        Set image default {ref}
                                      </button>
                                    ) : null}
                                    {allowlistActive ? (
                                      <button
                                        className={`deckgo-button deck-ui-models-button ${allowlistEntry ? "is-primary" : ""}`}
                                        type="button"
                                        onClick={() =>
                                          toggleAllowlistModelAction(ref, allowlistEntry == null)
                                        }
                                      >
                                        {allowlistEntry ? "Disallow" : "Allow"} {ref}
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {lookupResult ? <JsonDetails title="Schema lookup" payload={lookupResult} /> : null}
            {actionResult ? <JsonDetails title="Last save result" payload={actionResult} /> : null}
            {probeResult ? <JsonDetails title="Last model probe" payload={probeResult} /> : null}
          </div>
        </article>
      </div>
    </section>
  );
}
