import { useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  DeckGoCatalogProvider,
  DeckGoConfigLookupResponse,
  DeckGoModelAuthOverviewResponse,
  DeckGoModelCatalogProvidersResponse,
  DeckGoModelsConfigResponse,
  DeckGoModelProbeResponse,
  DeckGoRuntimeConfiguredModel,
  DeckGoRuntimeConfiguredModelsResponse,
  DeckGoUsageCostEntry,
  DeckGoUsageCostResponse,
  DeckGoUsageProviderStatus,
  DeckGoUsageProvidersResponse,
} from "../../../api";
import {
  fetchModelUsageCost,
  fetchModelUsageProviders,
  fetchModelsConfig,
  fetchRuntimeConfiguredModels,
  fetchRuntimeModelAuthOverview,
  fetchRuntimeModelCatalogProviders,
  lookupConfigPath,
  probeRuntimeModelAuth,
  saveModelsConfig,
} from "../../../api";
import {
  IconAlert,
  IconArrowL,
  IconArrowR,
  IconCheck,
  IconInfo,
  IconPlus,
  IconRefresh,
  IconSave,
  IconSearch,
  IconX,
} from "../../../design-system/icons";
import { useTranslations } from "../../../i18n/provider";
import { JsonDetails } from "../../shared/ShellComponents";
import "./models-panel.css";

type JsonRecord = Record<string, unknown>;
type PanelState = "idle" | "loading" | "ready";
type ModelsView = "list" | "detail";
type ModelFilter = "all" | "default" | "fallback" | "reasoning" | "local";
type ModelDetailTab = "overview" | "limits" | "pricing" | "usage" | "auth" | "audit";
type ActiveDialog = "catalog" | "auth" | "probe" | null;
type AuthDraftType = "apiKey" | "oauth" | "profile" | "none";

type ModelChain = {
  fallbacks: string[];
  primary: string;
};

type ModelPrice = {
  cacheRead?: number;
  cacheWrite?: number;
  input?: number;
  output?: number;
  source: "runtime-cost" | "unavailable";
};

type ModelEntry = {
  authStatus?: string;
  contextWindow?: number;
  displayName: string;
  editable?: boolean;
  fallback: boolean;
  family?: string;
  id: string;
  inputModes: string[];
  isDefault: boolean;
  local: boolean;
  maxTokens?: number;
  metadata?: JsonRecord;
  price?: ModelPrice;
  provider: string;
  reasoning: boolean;
  ref: string;
  source: "runtime" | "config";
};

type CatalogDraft = {
  modelId: string;
  providerId: string;
};

type AuthDraft = {
  authType: AuthDraftType;
  apiKey: string;
  apiKeyEnv: string;
  profileId: string;
};

const FILTERS: ModelFilter[] = ["all", "default", "fallback", "reasoning", "local"];
const DETAIL_TABS: ModelDetailTab[] = ["overview", "limits", "pricing", "usage", "auth", "audit"];

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseJsonRecord(raw: string) {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
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

function isWholeConfig(root: JsonRecord) {
  return (
    isRecord(root.models) ||
    isRecord(root.agents) ||
    isRecord(root.channels) ||
    isRecord(root.plugins) ||
    Array.isArray(root.bindings)
  );
}

function getModelsSection(root: JsonRecord) {
  if (isRecord(root.models)) {
    return root.models;
  }
  if (isRecord(root.providers) || root.mode !== undefined || isRecord(root.bedrockDiscovery)) {
    return root;
  }
  return {};
}

function getAgentsDefaults(root: JsonRecord) {
  return readRecord(readRecord(root.agents).defaults);
}

function stringifyConfig(root: JsonRecord) {
  return JSON.stringify(root, null, 2);
}

function modelsConfigRaw(config: DeckGoModelsConfigResponse) {
  if (typeof config.raw === "string" && config.raw.trim()) {
    return config.raw;
  }
  const extended = config as DeckGoModelsConfigResponse & {
    config?: unknown;
    parsed?: unknown;
    sourceConfig?: unknown;
  };
  for (const candidate of [extended.config, extended.parsed, extended.sourceConfig]) {
    if (isRecord(candidate)) {
      return stringifyConfig(candidate);
    }
  }
  return typeof config.raw === "string" ? config.raw : "";
}

function updateModelsSection(
  raw: string,
  update: (models: JsonRecord, root: JsonRecord) => JsonRecord,
) {
  const root = parseJsonRecord(raw) ?? {};
  if (isWholeConfig(root)) {
    const nextModels = update(getModelsSection(root), root);
    return stringifyConfig({ ...root, models: nextModels });
  }
  return stringifyConfig(update(getModelsSection(root), root));
}

function updateAgentDefaults(
  raw: string,
  update: (defaults: JsonRecord, root: JsonRecord) => JsonRecord,
) {
  const root = parseJsonRecord(raw) ?? {};
  const agents = readRecord(root.agents);
  const defaults = readRecord(agents.defaults);
  return stringifyConfig({
    ...root,
    agents: {
      ...agents,
      defaults: update(defaults, root),
    },
  });
}

function readModelChain(value: unknown): ModelChain {
  if (typeof value === "string") {
    return { primary: value, fallbacks: [] };
  }
  const record = readRecord(value);
  return {
    primary: readString(record.primary),
    fallbacks: readStringArray(record.fallbacks),
  };
}

function modelRefsEqual(left: string, right: string) {
  if (!left || !right) {
    return false;
  }
  return left === right || left.endsWith(`/${right}`) || right.endsWith(`/${left}`);
}

function normalizeModelRef(provider: string, explicit: string) {
  if (!explicit) {
    return provider ? `${provider}/unknown` : "unknown";
  }
  return provider && !explicit.includes("/") && !explicit.includes(":")
    ? `${provider}/${explicit}`
    : explicit;
}

function runtimeModelRef(model: DeckGoRuntimeConfiguredModel) {
  const provider = readString(model.provider) || providerFromRef(readString(model.modelIdentifier));
  const explicit =
    readString(model.modelIdentifier) || readString(model.model) || readString(model.id);
  return normalizeModelRef(provider, explicit);
}

function providerFromRef(ref: string) {
  if (ref.includes("/")) {
    return ref.split("/")[0] || "runtime";
  }
  if (ref.includes(":")) {
    return ref.split(":")[0] || "runtime";
  }
  return "";
}

function modelIdFromRef(ref: string) {
  if (ref.includes("/")) {
    return ref.split("/").pop() || ref;
  }
  return ref;
}

function deriveFamily(id: string) {
  if (id.includes("-")) {
    return id.split("-").slice(0, 2).join("-");
  }
  if (id.includes(":")) {
    return id.split(":")[0];
  }
  return "";
}

function normalizePrice(cost: unknown): ModelPrice | undefined {
  const record = readRecord(cost);
  const input = readNumber(record.input);
  const output = readNumber(record.output);
  const cacheRead = readNumber(record.cacheRead);
  const cacheWrite = readNumber(record.cacheWrite);
  if (
    input === undefined &&
    output === undefined &&
    cacheRead === undefined &&
    cacheWrite === undefined
  ) {
    return undefined;
  }
  return { cacheRead, cacheWrite, input, output, source: "runtime-cost" };
}

function normalizeRuntimeModel(
  model: DeckGoRuntimeConfiguredModel,
  chains: { image: ModelChain; text: ModelChain },
): ModelEntry {
  const ref = runtimeModelRef(model);
  const provider = readString(model.provider) || providerFromRef(ref) || "runtime";
  const id = readString(model.id) || modelIdFromRef(ref);
  const inputModes = Array.isArray(model.input)
    ? model.input.filter((entry): entry is string => typeof entry === "string")
    : [];
  const isDefault =
    modelRefsEqual(ref, chains.text.primary) ||
    modelRefsEqual(ref, chains.image.primary) ||
    model.metadata?.isDefault === true;
  const fallback =
    chains.text.fallbacks.some((entry) => modelRefsEqual(ref, entry)) ||
    chains.image.fallbacks.some((entry) => modelRefsEqual(ref, entry));
  return {
    authStatus: model.authStatus,
    contextWindow: model.contextWindow,
    displayName: readString(model.name) || readString(model.model) || id,
    editable: model.editable,
    fallback: Boolean(model.metadata?.fallback) || fallback,
    family: readString(model.metadata?.family) || deriveFamily(id),
    id,
    inputModes,
    isDefault: Boolean(model.metadata?.isDefault) || isDefault,
    local: model.metadata?.local === true || provider === "ollama" || ref.startsWith("ollama"),
    maxTokens: model.maxTokens,
    metadata: model.metadata,
    price: normalizePrice(model.cost),
    provider,
    reasoning: model.reasoning === true,
    ref,
    source: "runtime",
  };
}

function normalizeConfigModel(
  provider: string,
  value: unknown,
  chains: { image: ModelChain; text: ModelChain },
): ModelEntry | null {
  const record = readRecord(value);
  const id =
    typeof value === "string"
      ? value
      : readString(record.id) || readString(record.model) || readString(record.name);
  if (!id) {
    return null;
  }
  const ref = normalizeModelRef(provider, id);
  return {
    contextWindow: readNumber(record.contextWindow),
    displayName: readString(record.name) || id,
    fallback:
      chains.text.fallbacks.some((entry) => modelRefsEqual(ref, entry)) ||
      chains.image.fallbacks.some((entry) => modelRefsEqual(ref, entry)),
    family: readString(record.family) || deriveFamily(id),
    id,
    inputModes: readStringArray(record.input),
    isDefault:
      modelRefsEqual(ref, chains.text.primary) || modelRefsEqual(ref, chains.image.primary),
    local: provider === "ollama" || id.startsWith("ollama"),
    maxTokens: readNumber(record.maxTokens),
    metadata: { configOnly: true },
    provider,
    reasoning: record.reasoning === true,
    ref,
    source: "config",
  };
}

function configModelsFromRaw(root: JsonRecord, chains: { image: ModelChain; text: ModelChain }) {
  const providers = readRecord(getModelsSection(root).providers);
  const entries: ModelEntry[] = [];
  for (const [provider, value] of Object.entries(providers)) {
    const providerRecord = readRecord(value);
    const models = Array.isArray(providerRecord.models) ? providerRecord.models : [];
    for (const model of models) {
      const normalized = normalizeConfigModel(provider, model, chains);
      if (normalized) {
        entries.push(normalized);
      }
    }
  }
  return entries;
}

function mergeModels(runtimeModels: ModelEntry[], configModels: ModelEntry[]) {
  const merged = new Map<string, ModelEntry>();
  for (const model of configModels) {
    merged.set(model.ref, model);
  }
  for (const model of runtimeModels) {
    const existing = merged.get(model.ref);
    merged.set(model.ref, existing ? { ...existing, ...model } : model);
  }
  return [...merged.values()].toSorted((left, right) =>
    `${left.provider}/${left.displayName}`.localeCompare(`${right.provider}/${right.displayName}`),
  );
}

function groupByProvider(models: ModelEntry[]) {
  const groups = new Map<string, ModelEntry[]>();
  for (const model of models) {
    groups.set(model.provider, [...(groups.get(model.provider) ?? []), model]);
  }
  return [...groups.entries()].toSorted(([left], [right]) => left.localeCompare(right));
}

function usageCostValue(entry: DeckGoUsageCostEntry | undefined) {
  if (!entry) {
    return 0;
  }
  return entry.totalCost ?? entry.cost ?? 0;
}

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`;
}

function formatTokenWindow(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "n/a";
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}k`;
  }
  return String(value);
}

function formatPrice(value: number | undefined) {
  if (value === undefined) {
    return "n/a";
  }
  if (value === 0) {
    return "$0.00";
  }
  return `$${value.toFixed(2)}/M`;
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

function statusTone(status: string | undefined) {
  const normalized = (status ?? "unknown").toLowerCase();
  if (["ready", "ok", "active"].includes(normalized)) {
    return "ok";
  }
  if (["cooldown", "warning", "warn"].includes(normalized)) {
    return "warn";
  }
  if (["missing", "error", "failed"].includes(normalized)) {
    return "err";
  }
  return "muted";
}

function providerLabel(provider: string) {
  const known: Record<string, string> = {
    anthropic: "Anthropic",
    google: "Google AI",
    ollama: "Ollama",
    openai: "OpenAI",
    openrouter: "OpenRouter",
  };
  return known[provider] ?? provider;
}

function ProviderGlyph({ id }: { id: string }) {
  return (
    <span className="models-glyph" aria-hidden="true">
      {(providerLabel(id)[0] ?? "?").toUpperCase()}
    </span>
  );
}

function Pill({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "err" | "info" | "muted" | "ok" | "warn";
}) {
  return <span className={`models-pill models-pill--${tone}`}>{children}</span>;
}

function pickFirstModel(providers: DeckGoCatalogProvider[], providerId: string) {
  return providers.find((provider) => provider.id === providerId)?.models?.[0]?.id ?? "";
}

function buildConfigWithCatalogModel(
  raw: string,
  provider: DeckGoCatalogProvider,
  modelId: string,
) {
  return updateModelsSection(raw, (models) => {
    const providers = readRecord(models.providers);
    const currentProvider = readRecord(providers[provider.id]);
    const currentModels = Array.isArray(currentProvider.models) ? currentProvider.models : [];
    const catalogModel = provider.models?.find((model) => model.id === modelId);
    const nextModel = {
      id: modelId,
      ...(catalogModel?.name ? { name: catalogModel.name } : {}),
      ...(typeof catalogModel?.contextWindow === "number"
        ? { contextWindow: catalogModel.contextWindow }
        : {}),
      ...(typeof catalogModel?.maxTokens === "number" ? { maxTokens: catalogModel.maxTokens } : {}),
      ...(typeof catalogModel?.reasoning === "boolean"
        ? { reasoning: catalogModel.reasoning }
        : {}),
    };
    const existingIds = new Set(
      currentModels.map((entry) =>
        typeof entry === "string" ? entry : readString(readRecord(entry).id),
      ),
    );
    return {
      ...models,
      providers: {
        ...providers,
        [provider.id]: {
          ...currentProvider,
          ...(provider.api && !currentProvider.api ? { api: provider.api } : {}),
          ...(provider.authType && !currentProvider.auth ? { auth: provider.authType } : {}),
          ...(provider.defaultBaseUrl && !currentProvider.baseUrl
            ? { baseUrl: provider.defaultBaseUrl }
            : {}),
          models: existingIds.has(modelId) ? currentModels : [...currentModels, nextModel],
        },
      },
    };
  });
}

function buildConfigWithDefault(raw: string, target: "imageModel" | "model", ref: string) {
  return updateAgentDefaults(raw, (defaults) => {
    const current = readModelChain(defaults[target]);
    return {
      ...defaults,
      [target]: {
        ...readRecord(defaults[target]),
        primary: ref,
        fallbacks: current.fallbacks.filter((entry) => !modelRefsEqual(entry, ref)),
      },
    };
  });
}

function buildConfigWithAuth(raw: string, provider: string, draft: AuthDraft) {
  return updateModelsSection(raw, (models) => {
    const providers = readRecord(models.providers);
    const current = readRecord(providers[provider]);
    const next = { ...current };
    if (draft.authType === "none") {
      delete next.auth;
      delete next.apiKey;
      delete next.apiKeyEnv;
      delete next.profileId;
    } else if (draft.authType === "profile") {
      next.auth = "profile";
      next.profileId = draft.profileId || undefined;
      delete next.apiKey;
      delete next.apiKeyEnv;
    } else if (draft.authType === "oauth") {
      next.auth = "oauth";
      delete next.apiKey;
      delete next.apiKeyEnv;
      delete next.profileId;
    } else {
      next.auth = "api-key";
      if (draft.apiKey) {
        next.apiKey = draft.apiKey;
      } else if (draft.apiKeyEnv) {
        next.apiKey = { id: draft.apiKeyEnv, provider: "default", source: "env" };
      }
      delete next.apiKeyEnv;
      delete next.profileId;
    }
    return {
      ...models,
      providers: {
        ...providers,
        [provider]: next,
      },
    };
  });
}

export function ModelsPanel() {
  const t = useTranslations("models");
  const [view, setView] = useState<ModelsView>("list");
  const [activeTab, setActiveTab] = useState<ModelDetailTab>("overview");
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
  const [selectedRef, setSelectedRef] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ModelFilter>("all");
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
  const [lookupResult, setLookupResult] = useState<DeckGoConfigLookupResponse | null>(null);
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<"idle" | "lookup" | "probe" | "saving">("idle");
  const [error, setError] = useState("");
  const [actionResult, setActionResult] = useState<unknown>(null);
  const [probeResult, setProbeResult] = useState<DeckGoModelProbeResponse | null>(null);
  const [catalogDraft, setCatalogDraft] = useState({ modelId: "", providerId: "" });
  const [authDraft, setAuthDraft] = useState<AuthDraft>({
    apiKey: "",
    apiKeyEnv: "",
    authType: "apiKey",
    profileId: "",
  });

  const parsedConfig = useMemo(() => parseJsonRecord(rawConfig), [rawConfig]);
  const modelsSection = useMemo(() => getModelsSection(parsedConfig ?? {}), [parsedConfig]);
  const providerEntries = useMemo(
    () =>
      Object.entries(readRecord(modelsSection.providers)).toSorted(([left], [right]) =>
        left.localeCompare(right),
      ),
    [modelsSection],
  );
  const agentsDefaults = useMemo(() => getAgentsDefaults(parsedConfig ?? {}), [parsedConfig]);
  const textChain = useMemo(() => readModelChain(agentsDefaults.model), [agentsDefaults]);
  const imageChain = useMemo(() => readModelChain(agentsDefaults.imageModel), [agentsDefaults]);
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
  const allModels = useMemo(() => {
    const chains = { image: imageChain, text: textChain };
    return mergeModels(
      configuredModelsFromResponse(runtimeModels).map((model) =>
        normalizeRuntimeModel(model, chains),
      ),
      configModelsFromRaw(parsedConfig ?? {}, chains),
    );
  }, [imageChain, parsedConfig, runtimeModels, textChain]);
  const filteredModels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return allModels.filter((model) => {
      if (filter === "default" && !model.isDefault) {
        return false;
      }
      if (filter === "fallback" && !model.fallback) {
        return false;
      }
      if (filter === "reasoning" && !model.reasoning) {
        return false;
      }
      if (filter === "local" && !model.local) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      return [model.ref, model.id, model.displayName, model.provider, model.family]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
  }, [allModels, filter, query]);
  const selectedModel = useMemo(
    () => allModels.find((model) => model.ref === selectedRef) ?? allModels[0] ?? null,
    [allModels, selectedRef],
  );
  const providerGroups = useMemo(() => groupByProvider(filteredModels), [filteredModels]);
  const latestUsageCost = usageCostValue(usageCostEntries.at(-1));
  const usageWindowCost = usageCostEntries.reduce((sum, entry) => sum + usageCostValue(entry), 0);
  const usagePressureWindows = usageProviderEntries.flatMap((provider) =>
    provider.windows.map((window) => ({ provider, window })),
  );
  const highestUsagePressure = usagePressureWindows.reduce(
    (max, entry) => Math.max(max, entry.window.usedPercent),
    0,
  );
  const totals = useMemo(
    () => ({
      defaults: allModels.filter((model) => model.isDefault).length,
      fallbacks: allModels.filter((model) => model.fallback).length,
      local: allModels.filter((model) => model.local).length,
      models: allModels.length,
      providers: new Set(allModels.map((model) => model.provider)).size,
      reasoning: allModels.filter((model) => model.reasoning).length,
    }),
    [allModels],
  );

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!selectedRef && allModels[0]) {
      setSelectedRef(allModels[0].ref);
    }
  }, [allModels, selectedRef]);

  useEffect(() => {
    if (activeDialog !== "catalog") {
      return;
    }
    const firstProvider = catalogProviderEntries[0];
    if (!catalogDraft.providerId && firstProvider) {
      setCatalogDraft({
        modelId: pickFirstModel(catalogProviderEntries, firstProvider.id),
        providerId: firstProvider.id,
      });
    }
  }, [activeDialog, catalogDraft.providerId, catalogProviderEntries]);

  const refresh = async () => {
    setLoadState("loading");
    try {
      const [
        config,
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
      setRawConfig(modelsConfigRaw(config));
      setBaseHash(config.hash ?? "");
      setRuntimeModels(nextRuntimeModels);
      setModelAuth(nextModelAuth);
      setCatalogProviders(nextCatalogProviders);
      setUsageCost(nextUsageCost);
      setUsageProviders(nextUsageProviders);
      setLoadState("ready");
      setError("");
      void lookupAction("models.providers");
    } catch (loadError) {
      setLoadState("idle");
      setError(loadError instanceof Error ? loadError.message : t("errors.failedLoad"));
    }
  };

  const lookupAction = async (path = "models.providers") => {
    setActionState("lookup");
    try {
      const result = await lookupConfigPath(path);
      setLookupResult(result);
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : t("errors.schemaLookupFailed"));
    } finally {
      setActionState("idle");
    }
  };

  const saveRaw = async (nextRaw = rawConfig, noteResult = true) => {
    setActionState("saving");
    try {
      const result = await saveModelsConfig(nextRaw, baseHash);
      setActionResult(result);
      setBaseHash(result.baseHash ?? result.hash ?? baseHash);
      setError("");
      const config = await fetchModelsConfig();
      setRawConfig(modelsConfigRaw(config) || nextRaw);
      setBaseHash(config.hash ?? result.baseHash ?? result.hash ?? baseHash);
      if (noteResult) {
        setActionResult(result);
      }
      await Promise.all([
        fetchRuntimeConfiguredModels().then(setRuntimeModels),
        fetchRuntimeModelAuthOverview().then(setModelAuth),
        fetchRuntimeModelCatalogProviders().then(setCatalogProviders),
        fetchModelUsageCost(14).then(setUsageCost),
        fetchModelUsageProviders().then(setUsageProviders),
      ]);
      setLoadState("ready");
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("errors.saveFailed"));
      return false;
    } finally {
      setActionState("idle");
    }
  };

  const openDetail = (model: ModelEntry) => {
    setSelectedRef(model.ref);
    setActiveTab("overview");
    setView("detail");
  };

  const setDefaultAction = async (model: ModelEntry, target: "imageModel" | "model" = "model") => {
    const nextRaw = buildConfigWithDefault(rawConfig, target, model.ref);
    setRawConfig(nextRaw);
    await saveRaw(nextRaw);
  };

  const openAuthDialog = (provider: string) => {
    const authProvider = authProviders.find((entry) => entry.provider === provider);
    setAuthDraft({
      apiKey: "",
      apiKeyEnv: "",
      authType: authProvider?.auth?.type === "oauth" ? "oauth" : "apiKey",
      profileId: authProvider?.auth?.profileId ?? "",
    });
    setActiveDialog("auth");
  };

  const saveAuthAction = async () => {
    if (!selectedModel) {
      return;
    }
    const nextRaw = buildConfigWithAuth(rawConfig, selectedModel.provider, authDraft);
    setRawConfig(nextRaw);
    const ok = await saveRaw(nextRaw);
    if (ok) {
      setActiveDialog(null);
    }
  };

  const probeAction = async (provider: string) => {
    setActionState("probe");
    try {
      const result = await probeRuntimeModelAuth(provider);
      setProbeResult(result);
      setError("");
      setModelAuth(await fetchRuntimeModelAuthOverview());
      setActiveDialog("probe");
    } catch (probeError) {
      setError(probeError instanceof Error ? probeError.message : t("errors.modelAuthProbeFailed"));
    } finally {
      setActionState("idle");
    }
  };

  const applyCatalogAction = async () => {
    const provider = catalogProviderEntries.find((entry) => entry.id === catalogDraft.providerId);
    if (!provider) {
      setError(t("errors.catalogProviderIdRequired"));
      return;
    }
    const modelId = catalogDraft.modelId || pickFirstModel(catalogProviderEntries, provider.id);
    if (!modelId) {
      setError(t("errors.selectCatalogModel"));
      return;
    }
    const nextRaw = buildConfigWithCatalogModel(rawConfig, provider, modelId);
    setRawConfig(nextRaw);
    const ok = await saveRaw(nextRaw);
    if (ok) {
      setActiveDialog(null);
      setQuery(modelId);
    }
  };

  return (
    <section className="models-panel" data-testid="models-panel">
      {error ? (
        <div className="models-error" role="alert">
          <IconAlert size={16} />
          <span>{error}</span>
        </div>
      ) : null}

      {view === "list" ? (
        <ModelsListView
          actionState={actionState}
          baseHash={baseHash}
          filter={filter}
          groups={providerGroups}
          highestUsagePressure={highestUsagePressure}
          latestUsageCost={latestUsageCost}
          loadState={loadState}
          models={allModels}
          providerEntries={providerEntries}
          query={query}
          totals={totals}
          usageWindowCost={usageWindowCost}
          onCatalog={() => setActiveDialog("catalog")}
          onFilter={setFilter}
          onQuery={setQuery}
          onRefresh={() => void refresh()}
          onSelect={openDetail}
          onSetDefault={(model) => void setDefaultAction(model)}
        />
      ) : selectedModel ? (
        <ModelsDetailView
          actionResult={actionResult}
          actionState={actionState}
          activeTab={activeTab}
          authProvider={authProviders.find((entry) => entry.provider === selectedModel.provider)}
          baseHash={baseHash}
          catalogProviders={catalogProviderEntries}
          lookupResult={lookupResult}
          model={selectedModel}
          providerEntries={providerEntries}
          rawConfig={rawConfig}
          usageCost={usageCost}
          usageProviders={usageProviderEntries}
          onAuthConfig={() => openAuthDialog(selectedModel.provider)}
          onBack={() => setView("list")}
          onProbe={() => void probeAction(selectedModel.provider)}
          onRawConfigChange={setRawConfig}
          onRefresh={() => void refresh()}
          onSaveRaw={() => void saveRaw()}
          onSetDefault={() => void setDefaultAction(selectedModel)}
          onTab={setActiveTab}
        />
      ) : (
        <ModelsEmptyState
          title={t("v2.empty.noModels")}
          body={t("v2.empty.noModelsHint")}
          action={t("v2.actions.addCatalog")}
          onAction={() => setActiveDialog("catalog")}
        />
      )}

      <CatalogDialog
        actionState={actionState}
        draft={catalogDraft}
        open={activeDialog === "catalog"}
        providers={catalogProviderEntries}
        onChange={setCatalogDraft}
        onClose={() => setActiveDialog(null)}
        onSubmit={() => void applyCatalogAction()}
      />
      <AuthConfigDialog
        actionState={actionState}
        draft={authDraft}
        open={activeDialog === "auth"}
        provider={selectedModel?.provider ?? ""}
        onChange={setAuthDraft}
        onClose={() => setActiveDialog(null)}
        onSubmit={() => void saveAuthAction()}
      />
      <ProbeResultDialog
        actionState={actionState}
        model={selectedModel}
        open={activeDialog === "probe"}
        result={probeResult}
        onClose={() => setActiveDialog(null)}
        onRerun={(provider) => void probeAction(provider)}
      />
    </section>
  );
}

function ModelsListView({
  actionState,
  baseHash,
  filter,
  groups,
  highestUsagePressure,
  latestUsageCost,
  loadState,
  models,
  providerEntries,
  query,
  totals,
  usageWindowCost,
  onCatalog,
  onFilter,
  onQuery,
  onRefresh,
  onSelect,
  onSetDefault,
}: {
  actionState: "idle" | "lookup" | "probe" | "saving";
  baseHash: string;
  filter: ModelFilter;
  groups: Array<[string, ModelEntry[]]>;
  highestUsagePressure: number;
  latestUsageCost: number;
  loadState: PanelState;
  models: ModelEntry[];
  providerEntries: Array<[string, unknown]>;
  query: string;
  totals: {
    defaults: number;
    fallbacks: number;
    local: number;
    models: number;
    providers: number;
    reasoning: number;
  };
  usageWindowCost: number;
  onCatalog: () => void;
  onFilter: (filter: ModelFilter) => void;
  onQuery: (query: string) => void;
  onRefresh: () => void;
  onSelect: (model: ModelEntry) => void;
  onSetDefault: (model: ModelEntry) => void;
}) {
  const t = useTranslations("models");
  return (
    <main className="models-view models-view--list">
      <header className="models-list-head">
        <div>
          <h1>{t("v2.title")}</h1>
          <p>{t("v2.subtitle")}</p>
        </div>
        <div className="models-actions">
          <button className="models-btn" type="button" onClick={onRefresh}>
            <IconRefresh size={15} />
            {t("v2.actions.refresh")}
          </button>
          <button className="models-btn models-btn--primary" type="button" onClick={onCatalog}>
            <IconPlus size={15} />
            {t("v2.actions.addCatalog")}
          </button>
        </div>
      </header>

      <section className="models-kpis" aria-label={t("v2.kpi.group")}>
        <ModelsKpi
          label={t("v2.kpi.models")}
          value={totals.models}
          hint={t("v2.kpi.providersHint", { count: totals.providers })}
        />
        <ModelsKpi
          label={t("v2.kpi.defaults")}
          value={totals.defaults}
          hint={t("v2.kpi.defaultsHint")}
        />
        <ModelsKpi
          label={t("v2.kpi.fallbacks")}
          value={totals.fallbacks}
          hint={t("v2.kpi.fallbacksHint")}
        />
        <ModelsKpi
          label={t("v2.kpi.local")}
          value={totals.local}
          hint={t("v2.kpi.reasoningHint", { count: totals.reasoning })}
        />
        <ModelsKpi
          label={t("v2.kpi.spend")}
          value={formatCurrency(latestUsageCost)}
          hint={t("v2.kpi.spendHint", {
            total: formatCurrency(usageWindowCost),
            pressure: `${highestUsagePressure.toFixed(0)}%`,
          })}
        />
      </section>

      <section className="models-toolbar" aria-label={t("v2.toolbar")}>
        <label className="models-search">
          <IconSearch size={16} />
          <input
            aria-label={t("v2.search")}
            placeholder={t("v2.searchPlaceholder")}
            value={query}
            onChange={(event) => onQuery(event.target.value)}
          />
          <span className="models-kbd">⌘K</span>
        </label>
        <div className="models-filter" role="tablist" aria-label={t("v2.filter.group")}>
          {FILTERS.map((item) => (
            <button
              aria-selected={filter === item}
              className={filter === item ? "is-active" : ""}
              key={item}
              role="tab"
              type="button"
              onClick={() => onFilter(item)}
            >
              {t(`v2.filter.${item}`)}
            </button>
          ))}
        </div>
      </section>

      {loadState === "loading" && models.length === 0 ? (
        <ModelsEmptyState title={t("v2.empty.loading")} body={t("v2.empty.loadingHint")} />
      ) : groups.length === 0 ? (
        <ModelsEmptyState
          title={query || filter !== "all" ? t("v2.empty.noMatches") : t("v2.empty.noModels")}
          body={
            query || filter !== "all" ? t("v2.empty.noMatchesHint") : t("v2.empty.noModelsHint")
          }
          action={t("v2.actions.addCatalog")}
          onAction={onCatalog}
        />
      ) : (
        <section className="models-registry" aria-label={t("v2.registry")}>
          <div className="models-row-head" role="row">
            <span />
            <span>{t("v2.table.model")}</span>
            <span>{t("v2.table.context")}</span>
            <span>{t("v2.table.maxOutput")}</span>
            <span>{t("v2.table.probe")}</span>
            <span>{t("v2.table.spend")}</span>
            <span>{t("v2.table.status")}</span>
          </div>
          {groups.map(([provider, providerModels]) => (
            <section className="models-provider-section" key={provider}>
              <header className="models-provider-head">
                <ProviderGlyph id={provider} />
                <strong>{providerLabel(provider)}</strong>
                <Pill tone="muted">
                  {t("status.modelsCount", { count: providerModels.length })}
                </Pill>
                <Pill tone={providerEntries.some(([entry]) => entry === provider) ? "ok" : "info"}>
                  {providerEntries.some(([entry]) => entry === provider)
                    ? t("v2.pills.configured")
                    : t("v2.pills.runtimeOnly")}
                </Pill>
              </header>
              {providerModels.map((model) => (
                <ModelRow
                  key={model.ref}
                  model={model}
                  onSelect={() => onSelect(model)}
                  onSetDefault={() => onSetDefault(model)}
                />
              ))}
            </section>
          ))}
        </section>
      )}

      <footer className="models-footer">
        <span>
          {t("v2.footer.showing", {
            count: groups.reduce((sum, [, list]) => sum + list.length, 0),
            total: models.length,
          })}
        </span>
        <span>{t("status.hash", { hash: baseHash || t("common.notAvailable") })}</span>
        <span>
          {actionState === "idle"
            ? t("states.ready")
            : t(`states.${actionState === "saving" ? "loading" : "idle"}`)}
        </span>
      </footer>
    </main>
  );
}

function ModelsKpi({
  hint,
  label,
  value,
}: {
  hint: string;
  label: string;
  value: number | string;
}) {
  return (
    <div className="models-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </div>
  );
}

function ModelRow({
  model,
  onSelect,
  onSetDefault,
}: {
  model: ModelEntry;
  onSelect: () => void;
  onSetDefault: () => void;
}) {
  const t = useTranslations("models");
  const price = model.price?.input !== undefined || model.price?.output !== undefined;
  return (
    <div
      className={`models-row ${model.isDefault ? "is-default" : ""}`}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <ProviderGlyph id={model.provider} />
      <div className="models-row-name">
        <span>
          {model.displayName}
          {model.isDefault ? <Pill tone="ok">{t("v2.pills.default")}</Pill> : null}
          {model.fallback ? <Pill tone="info">{t("v2.pills.fallback")}</Pill> : null}
          {model.reasoning ? <Pill tone="info">{t("v2.pills.reasoning")}</Pill> : null}
          {model.local ? <Pill tone="info">{t("v2.pills.local")}</Pill> : null}
        </span>
        <small>
          {model.ref}
          {model.family ? ` | ${model.family}` : ""}
        </small>
      </div>
      <div className="models-row-number">
        {formatTokenWindow(model.contextWindow)}
        <small>tokens</small>
      </div>
      <div className="models-row-number">
        {formatTokenWindow(model.maxTokens)}
        <small>tokens</small>
      </div>
      <div>
        <Pill tone={statusTone(model.authStatus)}>{model.authStatus ?? t("common.unknown")}</Pill>
      </div>
      <div className="models-row-number">{price ? formatPrice(model.price?.input) : "n/a"}</div>
      <div className="models-row-actions">
        <Pill tone={model.source === "runtime" ? "ok" : "info"}>{model.source}</Pill>
        <button
          aria-label={t("catalog.setDefaultRef", { ref: model.ref })}
          className="models-icon-btn"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSetDefault();
          }}
        >
          <IconCheck size={14} />
        </button>
      </div>
    </div>
  );
}

function ModelsDetailView({
  actionResult,
  actionState,
  activeTab,
  authProvider,
  baseHash,
  catalogProviders,
  lookupResult,
  model,
  providerEntries,
  rawConfig,
  usageCost,
  usageProviders,
  onAuthConfig,
  onBack,
  onProbe,
  onRawConfigChange,
  onRefresh,
  onSaveRaw,
  onSetDefault,
  onTab,
}: {
  actionResult: unknown;
  actionState: "idle" | "lookup" | "probe" | "saving";
  activeTab: ModelDetailTab;
  authProvider?: ReturnType<typeof authProvidersFromResponse>[number];
  baseHash: string;
  catalogProviders: DeckGoCatalogProvider[];
  lookupResult: DeckGoConfigLookupResponse | null;
  model: ModelEntry;
  providerEntries: Array<[string, unknown]>;
  rawConfig: string;
  usageCost: DeckGoUsageCostResponse | null;
  usageProviders: DeckGoUsageProviderStatus[];
  onAuthConfig: () => void;
  onBack: () => void;
  onProbe: () => void;
  onRawConfigChange: (raw: string) => void;
  onRefresh: () => void;
  onSaveRaw: () => void;
  onSetDefault: () => void;
  onTab: (tab: ModelDetailTab) => void;
}) {
  const t = useTranslations("models");
  const providerUsage = usageProviders.find((entry) => entry.provider === model.provider);
  return (
    <main className="models-view models-view--detail" aria-label={t("detailTitle")}>
      <div className="models-detail-trail">
        <button className="models-btn models-btn--ghost" type="button" onClick={onBack}>
          <IconArrowL size={15} />
          {t("v2.detail.back")}
        </button>
        <span>
          / {providerLabel(model.provider)} / {model.displayName}
        </span>
      </div>

      <header className="models-hero">
        <ProviderGlyph id={model.provider} />
        <div>
          <h1>
            {model.displayName}
            <small>{model.ref}</small>
          </h1>
          <p>
            {providerLabel(model.provider)} | {model.family || "n/a"} | context{" "}
            {formatTokenWindow(model.contextWindow)} / {formatTokenWindow(model.maxTokens)}
          </p>
          <div className="models-pill-row">
            {model.isDefault ? <Pill tone="ok">{t("v2.pills.default")}</Pill> : null}
            {model.fallback ? <Pill tone="info">{t("v2.pills.fallback")}</Pill> : null}
            {model.reasoning ? <Pill tone="info">{t("v2.pills.reasoning")}</Pill> : null}
            {model.local ? <Pill tone="info">{t("v2.pills.local")}</Pill> : null}
            <Pill tone={statusTone(authProvider?.status)}>
              {authProvider?.status ?? t("common.unknown")}
            </Pill>
          </div>
        </div>
        <div className="models-actions">
          <button className="models-btn" type="button" onClick={onProbe}>
            {actionState === "probe" ? t("auth.probing") : t("v2.detail.runProbe")}
          </button>
          <button className="models-btn models-btn--primary" type="button" onClick={onSetDefault}>
            <IconCheck size={15} />
            {t("v2.detail.setDefault")}
          </button>
        </div>
      </header>

      <nav className="models-tabs" role="tablist">
        {DETAIL_TABS.map((tab) => (
          <button
            aria-selected={activeTab === tab}
            className={activeTab === tab ? "is-active" : ""}
            key={tab}
            role="tab"
            type="button"
            onClick={() => onTab(tab)}
          >
            {t(`v2.tabs.${tab}`)}
          </button>
        ))}
      </nav>

      <section className="models-detail-body" role="tabpanel">
        {activeTab === "overview" ? (
          <OverviewTab authProvider={authProvider} model={model} usageCost={usageCost} />
        ) : null}
        {activeTab === "limits" ? <LimitsTab model={model} /> : null}
        {activeTab === "pricing" ? <PricingTab model={model} /> : null}
        {activeTab === "usage" ? (
          <UsageTab model={model} providerUsage={providerUsage} usageCost={usageCost} />
        ) : null}
        {activeTab === "auth" ? (
          <AuthTab
            authProvider={authProvider}
            model={model}
            onAuthConfig={onAuthConfig}
            onProbe={onProbe}
          />
        ) : null}
        {activeTab === "audit" ? <AuditTab actionResult={actionResult} model={model} /> : null}
      </section>

      <AdvancedConfig
        actionState={actionState}
        baseHash={baseHash}
        catalogProviders={catalogProviders}
        lookupResult={lookupResult}
        model={model}
        providerEntries={providerEntries}
        rawConfig={rawConfig}
        onRawConfigChange={onRawConfigChange}
        onRefresh={onRefresh}
        onSaveRaw={onSaveRaw}
      />
    </main>
  );
}

function OverviewTab({
  authProvider,
  model,
  usageCost,
}: {
  authProvider?: ReturnType<typeof authProvidersFromResponse>[number];
  model: ModelEntry;
  usageCost: DeckGoUsageCostResponse | null;
}) {
  const t = useTranslations("models");
  const latest = usageCostValue(usageCost?.daily?.at(-1));
  return (
    <>
      <section className="models-section">
        <header>
          <h2>{t("v2.detail.runtimeSnapshot")}</h2>
          <p>{t("v2.detail.runtimeSnapshotHint")}</p>
        </header>
        <div className="models-tiles">
          <ModelsTile
            label={t("contextWindow")}
            value={formatTokenWindow(model.contextWindow)}
            hint="tokens"
          />
          <ModelsTile
            label={t("catalog.maxOutput")}
            value={formatTokenWindow(model.maxTokens)}
            hint="tokens"
          />
          <ModelsTile
            label={t("v2.kpi.spend")}
            value={formatCurrency(latest)}
            hint={t("v2.detail.globalUsageHint")}
          />
          <ModelsTile
            label={t("common.source", { source: model.source })}
            value={model.provider}
            hint={model.ref}
          />
        </div>
      </section>
      <section className="models-section">
        <header>
          <h2>{t("v2.detail.providerAuth")}</h2>
          <p>{t("v2.detail.providerAuthHint")}</p>
        </header>
        {authProvider ? (
          <AuthProviderRow provider={authProvider} />
        ) : (
          <ModelsEmptyState title={t("v2.empty.noAuth")} body={t("v2.empty.noAuthHint")} />
        )}
      </section>
      <section className="models-section">
        <header>
          <h2>{t("v2.detail.quickPricing")}</h2>
          <p>{t("v2.detail.pricingProjectionHint")}</p>
        </header>
        <PricingCells model={model} />
      </section>
    </>
  );
}

function LimitsTab({ model }: { model: ModelEntry }) {
  const t = useTranslations("models");
  return (
    <section className="models-section">
      <header>
        <h2>{t("v2.detail.limitsTitle")}</h2>
        <p>{t("v2.detail.limitsHint")}</p>
      </header>
      <div className="models-tiles">
        <ModelsTile
          label={t("contextWindow")}
          value={formatTokenWindow(model.contextWindow)}
          hint="tokens"
        />
        <ModelsTile
          label={t("catalog.maxOutput")}
          value={formatTokenWindow(model.maxTokens)}
          hint="tokens"
        />
        <ModelsTile
          label={t("catalog.reasoning")}
          value={model.reasoning ? t("states.on") : t("states.off")}
          hint={t("v2.detail.reasoningHint")}
        />
        <ModelsTile
          label={t("v2.pills.local")}
          value={model.local ? t("states.on") : t("states.off")}
          hint={model.local ? "local" : "remote api"}
        />
      </div>
      <div className="models-banner">
        <IconInfo size={16} />
        <span>{t("v2.detail.limitsBanner")}</span>
      </div>
    </section>
  );
}

function PricingTab({ model }: { model: ModelEntry }) {
  const t = useTranslations("models");
  return (
    <section className="models-section">
      <header>
        <h2>{t("v2.detail.pricingTitle")}</h2>
        <p>{t("v2.detail.pricingProjectionHint")}</p>
      </header>
      <PricingCells model={model} />
      <div className="models-banner models-banner--warn">
        <IconAlert size={16} />
        <span>{t("v2.detail.pricingBanner")}</span>
      </div>
    </section>
  );
}

function PricingCells({ model }: { model: ModelEntry }) {
  const t = useTranslations("models");
  if (!model.price) {
    return <ModelsEmptyState title={t("v2.empty.noPricing")} body={t("v2.empty.noPricingHint")} />;
  }
  return (
    <div className="models-pricing">
      <ModelsTile
        label={t("catalog.inputPrice")}
        value={formatPrice(model.price.input)}
        hint={model.price.source}
      />
      <ModelsTile
        label={t("catalog.outputPrice")}
        value={formatPrice(model.price.output)}
        hint={model.price.source}
      />
      <ModelsTile
        label={t("catalog.cacheRead")}
        value={formatPrice(model.price.cacheRead)}
        hint={t("v2.detail.optional")}
      />
    </div>
  );
}

function UsageTab({
  model,
  providerUsage,
  usageCost,
}: {
  model: ModelEntry;
  providerUsage?: DeckGoUsageProviderStatus;
  usageCost: DeckGoUsageCostResponse | null;
}) {
  const t = useTranslations("models");
  return (
    <section className="models-section">
      <header>
        <h2>{t("v2.detail.usageTitle")}</h2>
        <p>{t("usage.windowCost", { days: usageCost?.days ?? 14 })}</p>
      </header>
      {providerUsage ? (
        <div className="models-quota-grid">
          {providerUsage.windows.map((window) => (
            <div className="models-quota" key={`${model.ref}-${window.label}`}>
              <div>
                <strong>{window.label}</strong>
                <span>{window.usedPercent.toFixed(0)}%</span>
              </div>
              <progress
                aria-label={`${providerUsage.provider} ${window.label} quota`}
                max={100}
                value={window.usedPercent}
              />
              <small>
                {providerUsage.plan
                  ? t("usage.plan", { plan: providerUsage.plan })
                  : t("common.notAvailable")}
              </small>
            </div>
          ))}
        </div>
      ) : (
        <ModelsEmptyState title={t("usage.noQuotaData")} body={t("usage.noProviderPressure")} />
      )}
    </section>
  );
}

function AuthTab({
  authProvider,
  model,
  onAuthConfig,
  onProbe,
}: {
  authProvider?: ReturnType<typeof authProvidersFromResponse>[number];
  model: ModelEntry;
  onAuthConfig: () => void;
  onProbe: () => void;
}) {
  const t = useTranslations("models");
  return (
    <section className="models-section">
      <header>
        <h2>{t("v2.detail.authTitle")}</h2>
        <p>{model.provider}</p>
      </header>
      {authProvider ? (
        <AuthProviderRow provider={authProvider} />
      ) : (
        <ModelsEmptyState title={t("v2.empty.noAuth")} body={t("v2.empty.noAuthHint")} />
      )}
      <div className="models-actions">
        <button className="models-btn" type="button" onClick={onAuthConfig}>
          {t("v2.detail.configureAuth")}
        </button>
        <button className="models-btn models-btn--primary" type="button" onClick={onProbe}>
          {t("v2.detail.runProbe")}
        </button>
      </div>
    </section>
  );
}

function AuditTab({ actionResult, model }: { actionResult: unknown; model: ModelEntry }) {
  const t = useTranslations("models");
  return (
    <section className="models-section">
      <header>
        <h2>{t("v2.detail.auditTitle")}</h2>
        <p>{t("v2.detail.auditProjectionHint")}</p>
      </header>
      <ModelsEmptyState title={t("v2.empty.noAudit")} body={t("v2.empty.noAuditHint")} />
      <JsonDetails title={t("v2.detail.lastAction")} payload={{ actionResult, model: model.ref }} />
    </section>
  );
}

function ModelsTile({ hint, label, value }: { hint: string; label: string; value: string }) {
  return (
    <div className="models-tile">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </div>
  );
}

function AuthProviderRow({
  provider,
}: {
  provider: ReturnType<typeof authProvidersFromResponse>[number];
}) {
  const t = useTranslations("models");
  return (
    <div className="models-auth-row">
      <ProviderGlyph id={provider.provider} />
      <div>
        <strong>{providerLabel(provider.provider)}</strong>
        <span>
          {t("auth.providerMeta", {
            scope: provider.scope ?? "global",
            source: provider.source ?? t("common.unknown"),
            status: provider.status ?? t("common.unknown"),
          })}
        </span>
      </div>
      <Pill tone={provider.authPresent ? "ok" : "err"}>
        {provider.authPresent ? t("auth.authPresent") : t("auth.authMissing")}
      </Pill>
      <Pill tone={statusTone(provider.status)}>{provider.status ?? t("common.unknown")}</Pill>
      {provider.cooldown?.remainingMs ? (
        <Pill tone="warn">
          {t("auth.cooldownStatus", {
            reason: provider.cooldown.reason ?? t("common.unknown"),
            remaining: formatCountdown(provider.cooldown.remainingMs),
          })}
        </Pill>
      ) : null}
    </div>
  );
}

function AdvancedConfig({
  actionState,
  baseHash,
  catalogProviders,
  lookupResult,
  model,
  providerEntries,
  rawConfig,
  onRawConfigChange,
  onRefresh,
  onSaveRaw,
}: {
  actionState: "idle" | "lookup" | "probe" | "saving";
  baseHash: string;
  catalogProviders: DeckGoCatalogProvider[];
  lookupResult: DeckGoConfigLookupResponse | null;
  model: ModelEntry;
  providerEntries: Array<[string, unknown]>;
  rawConfig: string;
  onRawConfigChange: (raw: string) => void;
  onRefresh: () => void;
  onSaveRaw: () => void;
}) {
  const t = useTranslations("models");
  return (
    <details className="models-advanced">
      <summary>{t("v2.advanced.title")}</summary>
      <div className="models-advanced-grid">
        <section>
          <h2>{t("v2.advanced.rawConfig")}</h2>
          <p>{t("panel.rawConfigHint")}</p>
          <textarea
            aria-label={t("panel.modelsConfig")}
            className="models-raw"
            value={rawConfig}
            onChange={(event) => onRawConfigChange(event.target.value)}
          />
          <div className="models-actions">
            <button className="models-btn" type="button" onClick={onRefresh}>
              <IconRefresh size={15} />
              {t("v2.actions.refresh")}
            </button>
            <button
              className="models-btn models-btn--primary"
              disabled={actionState !== "idle"}
              type="button"
              onClick={onSaveRaw}
            >
              <IconSave size={15} />
              {actionState === "saving" ? t("panel.saving") : t("panel.saveConfig")}
            </button>
          </div>
        </section>
        <section>
          <h2>{t("config.providerInventory")}</h2>
          <p>{t("status.hash", { hash: baseHash || t("common.notAvailable") })}</p>
          <ul className="models-compact-list">
            {providerEntries.map(([provider, value]) => (
              <li key={provider}>
                <strong>{provider}</strong>
                <span>
                  {t("config.keys", {
                    keys: Object.keys(readRecord(value)).join(", ") || t("common.notAvailable"),
                  })}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>{t("catalog.catalogProviders")}</h2>
          <ul className="models-compact-list">
            {catalogProviders.slice(0, 6).map((provider) => (
              <li key={provider.id}>
                <strong>{provider.displayName ?? provider.id}</strong>
                <span>
                  {t("catalog.providerMeta", {
                    api: provider.api ?? t("common.unknown"),
                    auth: provider.authType ?? t("common.unknown"),
                    count: provider.models?.length ?? provider.modelCount ?? 0,
                    provider: provider.id,
                  })}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>{t("panel.schemaLookupResult")}</h2>
          <JsonDetails
            title={t("panel.schemaLookupResult")}
            payload={lookupResult ?? { path: "models.providers" }}
          />
          <JsonDetails title={t("catalog.modelDetail")} payload={model} />
        </section>
      </div>
    </details>
  );
}

function CatalogDialog({
  actionState,
  draft,
  open,
  providers,
  onChange,
  onClose,
  onSubmit,
}: {
  actionState: "idle" | "lookup" | "probe" | "saving";
  draft: CatalogDraft;
  open: boolean;
  providers: DeckGoCatalogProvider[];
  onChange: (draft: CatalogDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const t = useTranslations("models");
  if (!open) {
    return null;
  }
  const provider = providers.find((entry) => entry.id === draft.providerId) ?? providers[0];
  const selectedModel = provider?.models?.find((model) => model.id === draft.modelId);
  return (
    <ModalShell title={t("v2.dialogs.catalogTitle")} wide onClose={onClose}>
      <div className="models-dialog-grid">
        <div className="models-dialog-list">
          {providers.map((entry) => (
            <button
              className={entry.id === provider?.id ? "is-selected" : ""}
              key={entry.id}
              type="button"
              onClick={() =>
                onChange({ modelId: pickFirstModel(providers, entry.id), providerId: entry.id })
              }
            >
              <ProviderGlyph id={entry.id} />
              <span>
                <strong>{entry.displayName ?? entry.id}</strong>
                <small>
                  {t("status.modelsCount", {
                    count: entry.models?.length ?? entry.modelCount ?? 0,
                  })}
                </small>
              </span>
            </button>
          ))}
        </div>
        <div className="models-dialog-list models-dialog-list--models">
          {provider?.models?.length ? (
            provider.models.map((model) => (
              <button
                className={model.id === draft.modelId ? "is-selected" : ""}
                key={model.id}
                type="button"
                onClick={() => onChange({ modelId: model.id, providerId: provider.id })}
              >
                <span>
                  <strong>{model.name ?? model.id}</strong>
                  <small>
                    {model.id} | {formatTokenWindow(model.contextWindow)} |{" "}
                    {formatTokenWindow(model.maxTokens)}
                  </small>
                </span>
                {model.id === draft.modelId ? <IconCheck size={15} /> : <IconArrowR size={15} />}
              </button>
            ))
          ) : (
            <ModelsEmptyState
              title={t("catalog.noCatalogProviders")}
              body={t("catalog.noCatalogProviderMatches")}
            />
          )}
        </div>
      </div>
      <footer className="models-modal-foot">
        <span>
          {selectedModel ? `${provider?.id}/${selectedModel.id}` : t("common.notAvailable")}
        </span>
        <button className="models-btn" type="button" onClick={onClose}>
          {t("v2.dialogs.cancel")}
        </button>
        <button
          className="models-btn models-btn--primary"
          disabled={!selectedModel || actionState !== "idle"}
          type="button"
          onClick={onSubmit}
        >
          <IconPlus size={15} />
          {t("v2.dialogs.addToRuntime")}
        </button>
      </footer>
    </ModalShell>
  );
}

function AuthConfigDialog({
  actionState,
  draft,
  open,
  provider,
  onChange,
  onClose,
  onSubmit,
}: {
  actionState: "idle" | "lookup" | "probe" | "saving";
  draft: AuthDraft;
  open: boolean;
  provider: string;
  onChange: (draft: AuthDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const t = useTranslations("models");
  if (!open || !provider) {
    return null;
  }
  return (
    <ModalShell
      title={t("v2.dialogs.authTitle", { provider: providerLabel(provider) })}
      onClose={onClose}
    >
      <div className="models-form">
        <label>
          <span>{t("v2.dialogs.authType")}</span>
          <select
            value={draft.authType}
            onChange={(event) =>
              onChange({ ...draft, authType: event.target.value as AuthDraftType })
            }
          >
            <option value="apiKey">apiKey</option>
            <option value="oauth">oauth</option>
            <option value="profile">profile</option>
            <option value="none">none</option>
          </select>
        </label>
        {draft.authType === "apiKey" ? (
          <>
            <label>
              <span>{t("v2.dialogs.keyEnv")}</span>
              <input
                value={draft.apiKeyEnv}
                onChange={(event) => onChange({ ...draft, apiKeyEnv: event.target.value })}
                placeholder="OPENAI_API_KEY"
              />
            </label>
            <label>
              <span>{t("v2.dialogs.apiKey")}</span>
              <input
                type="password"
                value={draft.apiKey}
                onChange={(event) => onChange({ ...draft, apiKey: event.target.value })}
                placeholder="sk-..."
              />
            </label>
          </>
        ) : null}
        {draft.authType === "profile" ? (
          <label>
            <span>{t("v2.dialogs.profileId")}</span>
            <input
              value={draft.profileId}
              onChange={(event) => onChange({ ...draft, profileId: event.target.value })}
              placeholder="ops"
            />
          </label>
        ) : null}
        {draft.authType === "oauth" ? (
          <div className="models-banner">{t("v2.dialogs.oauthHint")}</div>
        ) : null}
        {draft.authType === "none" ? (
          <div className="models-banner models-banner--warn">{t("v2.dialogs.noneHint")}</div>
        ) : null}
      </div>
      <footer className="models-modal-foot">
        <button className="models-btn" type="button" onClick={onClose}>
          {t("v2.dialogs.cancel")}
        </button>
        <button
          className="models-btn models-btn--primary"
          disabled={actionState !== "idle"}
          type="button"
          onClick={onSubmit}
        >
          <IconSave size={15} />
          {t("v2.dialogs.saveAuth")}
        </button>
      </footer>
    </ModalShell>
  );
}

function ProbeResultDialog({
  actionState,
  model,
  open,
  result,
  onClose,
  onRerun,
}: {
  actionState: "idle" | "lookup" | "probe" | "saving";
  model: ModelEntry | null;
  open: boolean;
  result: DeckGoModelProbeResponse | null;
  onClose: () => void;
  onRerun: (provider: string) => void;
}) {
  const t = useTranslations("models");
  if (!open || !model) {
    return null;
  }
  const payload = readRecord(result?.payload ?? result);
  const status = readString(payload.status) || t("common.unknown");
  return (
    <ModalShell title={t("v2.dialogs.probeTitle", { model: model.displayName })} onClose={onClose}>
      {result ? (
        <div className="models-tiles">
          <ModelsTile
            label="status"
            value={status}
            hint={readString(payload.reasonCode) || "deck.auth.probe"}
          />
          <ModelsTile
            label="latency"
            value={readNumber(payload.latencyMs) ? `${readNumber(payload.latencyMs)}ms` : "n/a"}
            hint="round trip"
          />
          <ModelsTile
            label="provider"
            value={readString(payload.provider) || model.provider}
            hint="runtime"
          />
        </div>
      ) : (
        <ModelsEmptyState title={t("v2.dialogs.noProbe")} body="deck.auth.probe" />
      )}
      <JsonDetails
        title={t("panel.lastModelProbe")}
        payload={result ?? { provider: model.provider }}
      />
      <footer className="models-modal-foot">
        <button className="models-btn" type="button" onClick={onClose}>
          {t("v2.dialogs.done")}
        </button>
        <button
          className="models-btn models-btn--primary"
          disabled={actionState !== "idle"}
          type="button"
          onClick={() => onRerun(model.provider)}
        >
          {t("v2.dialogs.rerun")}
        </button>
      </footer>
    </ModalShell>
  );
}

function ModalShell({
  children,
  title,
  wide = false,
  onClose,
}: {
  children: ReactNode;
  title: string;
  wide?: boolean;
  onClose: () => void;
}) {
  return (
    <div className="models-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        aria-label={title}
        aria-modal="true"
        className={`models-modal ${wide ? "models-modal--wide" : ""}`}
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="models-modal-head">
          <h2>{title}</h2>
          <button aria-label="Close" className="models-icon-btn" type="button" onClick={onClose}>
            <IconX size={16} />
          </button>
        </header>
        <div className="models-modal-body">{children}</div>
      </div>
    </div>
  );
}

function ModelsEmptyState({
  action,
  body,
  title,
  onAction,
}: {
  action?: string;
  body: string;
  title: string;
  onAction?: () => void;
}) {
  return (
    <div className="models-empty">
      <IconInfo size={18} />
      <strong>{title}</strong>
      <span>{body}</span>
      {action && onAction ? (
        <button className="models-btn models-btn--primary" type="button" onClick={onAction}>
          {action}
        </button>
      ) : null}
    </div>
  );
}
