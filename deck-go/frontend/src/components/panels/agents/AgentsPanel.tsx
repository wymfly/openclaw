import { useEffect, useRef, useState } from "react";
import type {
  DeckGoAgentDetailResponse,
  DeckGoAgentEventStreamsResponse,
  DeckGoAgentFile,
  DeckGoAgentIdentityResponse,
  DeckGoAgentRawConfig,
  DeckGoAgentSkillsResponse,
  DeckGoAgentSubagentConfigResponse,
  DeckGoAgentSummary,
  DeckGoAgentSystemPromptPreviewResponse,
  DeckGoAgentToolPolicyPreviewResponse,
  DeckGoEffectiveToolsResponse,
  DeckGoRoutingBinding,
  DeckGoRuntimeConfiguredModelsResponse,
  DeckGoSession,
  DeckGoSkillEntry,
  DeckGoSkillsResponse,
  DeckGoSubagentRun,
  DeckGoToolsCatalogResponse,
} from "../../../api";
import {
  createAgent,
  deleteAgent,
  fetchAgentEventStreams,
  fetchAgentFile,
  fetchAgentFiles,
  fetchAgentDetail,
  fetchAgentIdentity,
  fetchAgentRawConfig,
  fetchAgentsList,
  fetchAgentSkills,
  fetchAgentSubagentConfig,
  fetchAgentSystemPromptPreview,
  fetchAgentToolPolicyPreview,
  fetchEffectiveTools,
  fetchRoutingBindings,
  fetchRuntimeConfiguredModels,
  fetchSkills,
  fetchSessions,
  fetchSubagentRuns,
  fetchToolsCatalog,
  installSkill,
  removeRoutingBinding,
  updateSkill,
  updateAgent,
  updateAgentEventStreams,
  updateAgentRawConfig,
  updateAgentSkills,
  updateAgentSubagentConfig,
  saveAgentFile,
} from "../../../api";
import {
  navigateToAgent,
  navigateToPanel,
  navigateToRouting,
  navigateToSession,
} from "../../../deck-ui/panel-navigation";
import { useDeckUI } from "../../../deck-ui/ui-store";
import { useTranslations } from "../../../i18n/provider";
import { computeConfigDiff } from "../../../lib/config-diff";
import { JsonDetails, ShellStat } from "../../shared/ShellComponents";
import { buildAgentBatchExportText, summarizeAgents } from "./agent-batch-actions";
import {
  AgentCompareBoundary,
  AgentDetailBoundary,
  AgentEditorBoundary,
  AgentListBoundary,
} from "./agent-panel-boundaries";
import { useAgentMetricsSSE } from "./useAgentMetricsSSE";

type PanelState = "idle" | "loading" | "ready";

function readAgentNavigationTarget() {
  if (typeof window === "undefined") {
    return { agentId: "", tab: "" };
  }
  const params = new URL(window.location.href).searchParams;
  return {
    agentId: params.get("agentId")?.trim() ?? "",
    tab: params.get("agentTab")?.trim() ?? "",
  };
}

type CreateDraft = {
  name: string;
  workspace: string;
  emoji: string;
};

const DEFAULT_CREATE_DRAFT: CreateDraft = {
  name: "",
  workspace: "",
  emoji: "",
};

const AGENT_TEMPLATES_STORAGE_KEY = "openclaw-deck-agent-templates";
const EVENT_STREAMS = ["lifecycle", "assistant", "tool", "thinking"] as const;
const PROMPT_VARIABLE_KEYS = ["agentName", "agentId", "model", "timestamp", "channelId"] as const;
type AgentSkillMode = "all" | "whitelist";
type SubagentAllowMode = "none" | "list" | "any";
type AgentReasoningMode = "on" | "off" | "stream";
type AgentThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "adaptive";
type AgentSessionFilter = "all" | "direct" | "group" | "global" | "subagent";
type ToolOverrideState = "default" | "allow" | "deny";
type AgentDetailTab =
  | "overview"
  | "config"
  | "routing"
  | "skills"
  | "tools"
  | "context"
  | "subagent"
  | "sessions";
type RuntimeModelOption = {
  ref: string;
  label: string;
  provider: string;
};
type SkillEnvPair = { key: string; value: string };
const AGENT_DETAIL_TABS: Array<{ key: AgentDetailTab; labelKey: string }> = [
  { key: "overview", labelKey: "overview" },
  { key: "config", labelKey: "tabs.config" },
  { key: "routing", labelKey: "routing" },
  { key: "skills", labelKey: "skills" },
  { key: "tools", labelKey: "effectiveTools.tab" },
  { key: "context", labelKey: "context" },
  { key: "subagent", labelKey: "subagent" },
  { key: "sessions", labelKey: "sessions" },
];
const AGENT_SESSION_FILTERS: AgentSessionFilter[] = [
  "all",
  "direct",
  "group",
  "global",
  "subagent",
];
const THINKING_LEVELS: AgentThinkingLevel[] = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "adaptive",
];
const VALID_SKILL_SOURCES = new Set<DeckGoSkillEntry["source"]>(["bundled", "managed", "plugin"]);

type AgentTemplate = {
  name: string;
  createdAt: number;
  config: Record<string, unknown>;
};

type AgentConfigDraft = {
  model: string;
  modelFallbacks: string;
  toolsProfile: string;
  toolsAllow: string;
  toolsDeny: string;
  reasoningDefault: AgentReasoningMode;
  fastModeDefault: boolean;
  thinkingDefault: string;
  temperature: string;
};

const DEFAULT_AGENT_CONFIG_DRAFT: AgentConfigDraft = {
  model: "",
  modelFallbacks: "",
  toolsProfile: "",
  toolsAllow: "",
  toolsDeny: "",
  reasoningDefault: "stream",
  fastModeDefault: false,
  thinkingDefault: "",
  temperature: "",
};

function isAgentDetailTab(value: string): value is AgentDetailTab {
  return AGENT_DETAIL_TABS.some((tab) => tab.key === value);
}

function readInitialAgentDetailTab(value: string): AgentDetailTab {
  return isAgentDetailTab(value) ? value : "overview";
}

function normalizeAgentSkillMode(mode: string | undefined): AgentSkillMode {
  return mode === "whitelist" ? "whitelist" : "all";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSkillInventoryEntry(raw: Record<string, unknown>): DeckGoSkillEntry {
  const skillKey =
    typeof raw.skillKey === "string" ? raw.skillKey : typeof raw.name === "string" ? raw.name : "";
  const disabled = raw.disabled === true;
  const eligible = raw.eligible !== false;
  const hasMissing = Array.isArray(raw.missing) && raw.missing.length > 0;
  const source = typeof raw.source === "string" ? raw.source : "bundled";
  let status: DeckGoSkillEntry["status"] = "ready";
  if (disabled) {
    status = "disabled";
  } else if (hasMissing || !eligible) {
    status = "needs-setup";
  }

  return {
    key: typeof raw.key === "string" ? raw.key : skillKey,
    name: typeof raw.name === "string" ? raw.name : skillKey,
    status,
    source: VALID_SKILL_SOURCES.has(source as DeckGoSkillEntry["source"])
      ? (source as DeckGoSkillEntry["source"])
      : "bundled",
    enabled: !disabled,
    missingRequirements: Array.isArray(raw.missing) ? raw.missing.map(String) : undefined,
    config: isRecord(raw.config) ? raw.config : undefined,
    description: typeof raw.description === "string" ? raw.description : undefined,
    emoji: typeof raw.emoji === "string" ? raw.emoji : undefined,
    homepage: typeof raw.homepage === "string" ? raw.homepage : undefined,
    primaryEnv: typeof raw.primaryEnv === "string" ? raw.primaryEnv : undefined,
    installOptions:
      Array.isArray(raw.installOptions) && raw.installOptions.length > 0
        ? (raw.installOptions as DeckGoSkillEntry["installOptions"])
        : Array.isArray(raw.install)
          ? (raw.install as DeckGoSkillEntry["installOptions"])
          : undefined,
  };
}

function normalizeSkillInventory(payload: DeckGoSkillsResponse | null): DeckGoSkillEntry[] {
  return (payload?.skills ?? [])
    .filter(isRecord)
    .map(normalizeSkillInventoryEntry)
    .filter((skill) => skill.key);
}

function readSkillConfigApiKey(config: Record<string, unknown> | undefined) {
  return typeof config?.apiKey === "string" ? config.apiKey : "";
}

function readSkillConfigEnvPairs(config: Record<string, unknown> | undefined): SkillEnvPair[] {
  const env = config?.env;
  if (!isRecord(env)) {
    return [];
  }
  return Object.entries(env).map(([key, value]) => ({ key, value: String(value) }));
}

function buildSkillEnvPatch(pairs: SkillEnvPair[]) {
  const env: Record<string, string> = {};
  for (const pair of pairs) {
    const key = pair.key.trim();
    if (key) {
      env[key] = pair.value;
    }
  }
  return env;
}

function readStringConfigValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readModelConfigValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  if (isRecord(value)) {
    return readStringConfigValue(value.primary ?? value.model ?? value.id);
  }
  return "";
}

function readModelFallbacks(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.fallbacks)) {
    return [];
  }
  return value.fallbacks.filter((fallback): fallback is string => typeof fallback === "string");
}

function parseModelFallbacks(value: string) {
  return value
    .split(/[\n,]/)
    .map((fallback) => fallback.trim())
    .filter(Boolean);
}

function readStringArrayConfigValue(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function readNestedRecord(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return isRecord(value) ? value : {};
}

function parseCommaList(value: string) {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function formatCommaList(values: string[]) {
  return values.join(", ");
}

function buildRuntimeModelRef(model: Record<string, unknown>) {
  const explicit =
    readStringConfigValue(model.modelIdentifier) ||
    readStringConfigValue(model.model) ||
    readStringConfigValue(model.ref);
  if (explicit) {
    return explicit;
  }
  const id = readStringConfigValue(model.id);
  const provider = readStringConfigValue(model.provider);
  if (id && provider && !id.includes("/")) {
    return `${provider}/${id}`;
  }
  return id;
}

function normalizeRuntimeModelOptions(
  response: DeckGoRuntimeConfiguredModelsResponse | null,
): RuntimeModelOption[] {
  const rawModels = response?.payload?.models ?? response?.payload?.items ?? [];
  const byRef = new Map<string, RuntimeModelOption>();
  for (const model of rawModels) {
    if (!isRecord(model)) {
      continue;
    }
    const ref = buildRuntimeModelRef(model);
    if (!ref || byRef.has(ref)) {
      continue;
    }
    byRef.set(ref, {
      ref,
      label: readStringConfigValue(model.name) || ref,
      provider: readStringConfigValue(model.provider) || "runtime",
    });
  }
  return Array.from(byRef.values()).toSorted((left, right) => left.ref.localeCompare(right.ref));
}

function readToolOverrideState(
  toolId: string,
  allowValue: string,
  denyValue: string,
): ToolOverrideState {
  if (parseCommaList(denyValue).includes(toolId)) {
    return "deny";
  }
  if (parseCommaList(allowValue).includes(toolId)) {
    return "allow";
  }
  return "default";
}

function applyToolOverrideState(draft: AgentConfigDraft, toolId: string, state: ToolOverrideState) {
  let nextAllow = parseCommaList(draft.toolsAllow).filter((id) => id !== toolId);
  let nextDeny = parseCommaList(draft.toolsDeny).filter((id) => id !== toolId);
  if (state === "allow") {
    nextAllow = [...nextAllow, toolId];
  }
  if (state === "deny") {
    nextDeny = [...nextDeny, toolId];
  }
  return {
    ...draft,
    toolsAllow: formatCommaList(nextAllow),
    toolsDeny: formatCommaList(nextDeny),
  };
}

function readReasoningMode(value: unknown): AgentReasoningMode {
  return value === "on" || value === "off" || value === "stream" ? value : "stream";
}

function readThinkingLevel(value: unknown): AgentThinkingLevel | "" {
  return THINKING_LEVELS.includes(value as AgentThinkingLevel) ? (value as AgentThinkingLevel) : "";
}

function readBooleanConfigValue(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function buildAgentConfigDraft(rawConfig: DeckGoAgentRawConfig): AgentConfigDraft {
  const entry = rawConfig.entry ?? {};
  const defaults = rawConfig.defaults;
  const tools = readNestedRecord(entry, "tools");
  const defaultTools = readNestedRecord(defaults, "tools");
  const params = readNestedRecord(entry, "params");
  const defaultParams = readNestedRecord(defaults, "params");
  const temperature = params.temperature ?? defaultParams.temperature;
  return {
    model: readModelConfigValue(entry.model ?? defaults.model),
    modelFallbacks: readModelFallbacks(entry.model ?? defaults.model).join(", "),
    toolsProfile: readStringConfigValue(tools.profile ?? defaultTools.profile),
    toolsAllow: readStringArrayConfigValue(tools.allow ?? defaultTools.allow).join(", "),
    toolsDeny: readStringArrayConfigValue(tools.deny ?? defaultTools.deny).join(", "),
    reasoningDefault: readReasoningMode(entry.reasoningDefault ?? defaults.reasoningDefault),
    fastModeDefault: readBooleanConfigValue(entry.fastModeDefault ?? defaults.fastModeDefault),
    thinkingDefault: readThinkingLevel(entry.thinkingDefault ?? defaults.thinkingDefault),
    temperature:
      typeof temperature === "number" && Number.isFinite(temperature) ? String(temperature) : "",
  };
}

function countAgentConfigOverrides(rawConfig: DeckGoAgentRawConfig | null) {
  if (!rawConfig?.entry) {
    return 0;
  }
  return Object.keys(rawConfig.entry).filter((key) => key !== "id").length;
}

function hasOwnConfigKey(source: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(source, key);
}

function buildAgentConfigResetUpdates(rawConfig: DeckGoAgentRawConfig | null) {
  const entry = rawConfig?.entry;
  if (!entry) {
    return {};
  }
  const updates: Record<string, unknown> = {};
  for (const key of ["model", "thinkingDefault", "reasoningDefault", "fastModeDefault"]) {
    if (hasOwnConfigKey(entry, key)) {
      updates[key] = null;
    }
  }
  const params = readNestedRecord(entry, "params");
  if (hasOwnConfigKey(params, "temperature")) {
    updates.params = { temperature: null };
  }
  const tools = readNestedRecord(entry, "tools");
  const toolsUpdates: Record<string, unknown> = {};
  for (const key of ["profile", "allow", "deny"]) {
    if (hasOwnConfigKey(tools, key)) {
      toolsUpdates[key] = null;
    }
  }
  if (Object.keys(toolsUpdates).length > 0) {
    updates.tools = toolsUpdates;
  }
  return updates;
}

function cloneConfigValue(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(JSON.stringify(value)) as unknown;
  } catch {
    return value;
  }
}

function buildAgentCloneConfigUpdates(
  rawConfig: DeckGoAgentRawConfig | null,
  detail: DeckGoAgentDetailResponse | null,
) {
  const entry = rawConfig?.entry ?? {};
  const updates: Record<string, unknown> = {};
  for (const key of ["model", "reasoningDefault", "fastModeDefault", "thinkingDefault"]) {
    if (hasOwnConfigKey(entry, key)) {
      updates[key] = cloneConfigValue(entry[key]);
    }
  }
  for (const key of ["tools", "params"]) {
    const value = entry[key];
    if (isRecord(value)) {
      updates[key] = cloneConfigValue(value);
    }
  }
  if (!hasOwnConfigKey(updates, "model") && detail?.model) {
    updates.model = detail.model;
  }
  return updates;
}

function buildAgentTemplateConfigUpdates(template: AgentTemplate) {
  const updates: Record<string, unknown> = {};
  const { config } = template;
  if (typeof config.model === "string" && config.model.trim()) {
    updates.model = config.model.trim();
  } else if (isRecord(config.model)) {
    updates.model = cloneConfigValue(config.model);
  }
  if (config.reasoningDefault === "on" || config.reasoningDefault === "off") {
    updates.reasoningDefault = config.reasoningDefault;
  } else if (config.reasoningDefault === "stream") {
    updates.reasoningDefault = "stream";
  }
  if (typeof config.fastModeDefault === "boolean") {
    updates.fastModeDefault = config.fastModeDefault;
  }
  const thinkingDefault = readThinkingLevel(config.thinkingDefault);
  if (thinkingDefault) {
    updates.thinkingDefault = thinkingDefault;
  }
  for (const key of ["tools", "params"]) {
    const value = config[key];
    if (isRecord(value)) {
      updates[key] = cloneConfigValue(value);
    }
  }
  return updates;
}

function countResettableAgentConfigOverrides(rawConfig: DeckGoAgentRawConfig | null) {
  const updates = buildAgentConfigResetUpdates(rawConfig);
  return Object.values(updates).reduce((count, value) => {
    if (isRecord(value)) {
      return count + Object.keys(value).length;
    }
    return count + 1;
  }, 0);
}

function formatSessionUpdatedAt(updatedAt: number | undefined) {
  if (typeof updatedAt !== "number" || !Number.isFinite(updatedAt) || updatedAt <= 0) {
    return "unknown";
  }
  return new Date(updatedAt).toLocaleString();
}

function readSessionKind(session: DeckGoSession) {
  const kind = (session as DeckGoSession & { kind?: unknown }).kind;
  return typeof kind === "string" && kind ? kind : "unknown";
}

function isSubagentSession(session: DeckGoSession) {
  return session.key.includes(":subagent:") || session.key.includes(":spawn:");
}

function extractSubagentDepth(session: DeckGoSession) {
  const match = session.key.match(/:depth[=:](\d+)/);
  return match ? Number(match[1]) : null;
}

function extractParentAgent(session: DeckGoSession) {
  const match = session.key.match(/:parent[=:]([^:]+)/);
  return match?.[1] ?? null;
}

function formatSandboxMode(sandbox: unknown) {
  if (!isRecord(sandbox)) {
    return "default";
  }
  const mode = typeof sandbox.mode === "string" ? sandbox.mode : "";
  return mode && mode !== "off" ? "enabled" : "default";
}

function readSandboxField(sandbox: unknown, field: string) {
  if (!isRecord(sandbox)) {
    return "";
  }
  const value = sandbox[field];
  return typeof value === "string" ? value : "";
}

function formatDiffValue(value: unknown) {
  if (value === undefined) {
    return "undefined";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
}

function summarizeAgentRoutingMatch(binding: DeckGoRoutingBinding) {
  const parts = [`channel ${binding.match.channel}`];
  if (binding.match.accountId) {
    parts.push(`account ${binding.match.accountId}`);
  }
  if (binding.match.peer) {
    parts.push(`peer ${binding.match.peer.kind}:${binding.match.peer.id}`);
  }
  if (binding.match.guildId) {
    parts.push(`guild ${binding.match.guildId}`);
  }
  if (binding.match.teamId) {
    parts.push(`team ${binding.match.teamId}`);
  }
  if (binding.match.roles?.length) {
    parts.push(`roles ${binding.match.roles.join(", ")}`);
  }
  return parts.join(" | ");
}

function loadAgentTemplates(): AgentTemplate[] {
  if (typeof globalThis.localStorage === "undefined") {
    return [];
  }
  try {
    const rawTemplates = globalThis.localStorage.getItem(AGENT_TEMPLATES_STORAGE_KEY);
    if (!rawTemplates) {
      return [];
    }
    const parsed = JSON.parse(rawTemplates) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((entry): entry is AgentTemplate => {
      return (
        isRecord(entry) &&
        typeof entry.name === "string" &&
        typeof entry.createdAt === "number" &&
        isRecord(entry.config)
      );
    });
  } catch {
    return [];
  }
}

function saveAgentTemplates(templates: AgentTemplate[]) {
  if (typeof globalThis.localStorage === "undefined") {
    return;
  }
  globalThis.localStorage.setItem(AGENT_TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
}

export function AgentsPanel() {
  const ui = useDeckUI();
  const tAgents = useTranslations("agents");
  const tAgentDetail = useTranslations("agentDetail");
  const [navigationTarget] = useState(readAgentNavigationTarget);
  const [activeAgentTab, setActiveAgentTab] = useState<AgentDetailTab>(() =>
    readInitialAgentDetailTab(navigationTarget.tab),
  );
  const [agents, setAgents] = useState<DeckGoAgentSummary[]>([]);
  const bootstrapEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const [defaultAgentId, setDefaultAgentId] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [detail, setDetail] = useState<DeckGoAgentDetailResponse | null>(null);
  const [eventStreams, setEventStreams] = useState<DeckGoAgentEventStreamsResponse | null>(null);
  const [agentRawConfig, setAgentRawConfig] = useState<DeckGoAgentRawConfig | null>(null);
  const [skillsConfig, setSkillsConfig] = useState<DeckGoAgentSkillsResponse | null>(null);
  const [subagentConfig, setSubagentConfig] = useState<DeckGoAgentSubagentConfigResponse | null>(
    null,
  );
  const [agentSubagentRuns, setAgentSubagentRuns] = useState<DeckGoSubagentRun[]>([]);
  const [toolPolicyPreview, setToolPolicyPreview] =
    useState<DeckGoAgentToolPolicyPreviewResponse | null>(null);
  const [systemPromptPreview, setSystemPromptPreview] =
    useState<DeckGoAgentSystemPromptPreviewResponse | null>(null);
  const [toolsCatalog, setToolsCatalog] = useState<DeckGoToolsCatalogResponse | null>(null);
  const [runtimeModels, setRuntimeModels] = useState<DeckGoRuntimeConfiguredModelsResponse | null>(
    null,
  );
  const [agentRoutingBindings, setAgentRoutingBindings] = useState<DeckGoRoutingBinding[]>([]);
  const [agentRoutingConfigHash, setAgentRoutingConfigHash] = useState("");
  const [effectiveToolSessions, setEffectiveToolSessions] = useState<DeckGoSession[]>([]);
  const [effectiveTools, setEffectiveTools] = useState<DeckGoEffectiveToolsResponse | null>(null);
  const [effectiveToolsSessionKey, setEffectiveToolsSessionKey] = useState("");
  const [agentSessionFilter, setAgentSessionFilter] = useState<AgentSessionFilter>("all");
  const [agentFiles, setAgentFiles] = useState<DeckGoAgentFile[]>([]);
  const [agentIdentity, setAgentIdentity] = useState<DeckGoAgentIdentityResponse | null>(null);
  const [bootstrapFile, setBootstrapFile] = useState<DeckGoAgentFile | null>(null);
  const [bootstrapFileName, setBootstrapFileName] = useState("");
  const [bootstrapFileDraft, setBootstrapFileDraft] = useState("");
  const [toolPolicySearch, setToolPolicySearch] = useState("");
  const [expandedToolName, setExpandedToolName] = useState("");
  const [agentSkillMode, setAgentSkillMode] = useState<AgentSkillMode>("all");
  const [agentSkillKeys, setAgentSkillKeys] = useState<string[]>([]);
  const [skillInventory, setSkillInventory] = useState<DeckGoSkillEntry[]>([]);
  const [selectedSkillConfigKey, setSelectedSkillConfigKey] = useState("");
  const [skillApiKeyDraft, setSkillApiKeyDraft] = useState("");
  const [skillEnvPairs, setSkillEnvPairs] = useState<SkillEnvPair[]>([]);
  const [agentConfigDraft, setAgentConfigDraft] = useState(DEFAULT_AGENT_CONFIG_DRAFT);
  const [agentConfigBaseline, setAgentConfigBaseline] = useState(DEFAULT_AGENT_CONFIG_DRAFT);
  const [subagentAllowMode, setSubagentAllowMode] = useState<SubagentAllowMode>("none");
  const [subagentAllowAgents, setSubagentAllowAgents] = useState<string[]>([]);
  const [subagentModel, setSubagentModel] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [cloneName, setCloneName] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [agentTemplates, setAgentTemplates] = useState<AgentTemplate[]>([]);
  const [createDraft, setCreateDraft] = useState(DEFAULT_CREATE_DRAFT);
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<
    | "idle"
    | "detail"
    | "creating"
    | "renaming"
    | "deleting"
    | "event-streams"
    | "agent-config"
    | "skills"
    | "subagents"
    | "compare"
    | "bootstrap-file"
    | "cloning"
    | "agent-routing"
    | "template"
    | "template-create"
    | "skill-config"
    | "skill-install"
  >("idle");
  const [error, setError] = useState("");
  const [eventStreamsError, setEventStreamsError] = useState("");
  const [agentConfigError, setAgentConfigError] = useState("");
  const [skillsConfigError, setSkillsConfigError] = useState("");
  const [skillInventoryError, setSkillInventoryError] = useState("");
  const [subagentConfigError, setSubagentConfigError] = useState("");
  const [agentSubagentRunsError, setAgentSubagentRunsError] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [toolsCatalogError, setToolsCatalogError] = useState("");
  const [runtimeModelsError, setRuntimeModelsError] = useState("");
  const [agentRoutingError, setAgentRoutingError] = useState("");
  const [effectiveToolsError, setEffectiveToolsError] = useState("");
  const [agentFilesError, setAgentFilesError] = useState("");
  const [agentIdentityError, setAgentIdentityError] = useState("");
  const [bootstrapFileError, setBootstrapFileError] = useState("");
  const [compareAgentId, setCompareAgentId] = useState("");
  const [compareDetail, setCompareDetail] = useState<DeckGoAgentDetailResponse | null>(null);
  const [compareError, setCompareError] = useState("");
  const [actionResult, setActionResult] = useState<unknown>(null);

  const loadEventStreams = async (agentId: string) => {
    setEventStreams(null);
    setEventStreamsError("");
    try {
      const nextEventStreams = await fetchAgentEventStreams(agentId);
      setEventStreams(nextEventStreams);
    } catch (loadError) {
      setEventStreamsError(
        loadError instanceof Error ? loadError.message : "failed to load agent event streams",
      );
    }
  };

  const loadAgentRawConfig = async (agentId: string) => {
    setAgentRawConfig(null);
    setAgentConfigError("");
    try {
      const nextConfig = await fetchAgentRawConfig(agentId);
      const nextDraft = buildAgentConfigDraft(nextConfig);
      setAgentRawConfig(nextConfig);
      setAgentConfigDraft(nextDraft);
      setAgentConfigBaseline(nextDraft);
    } catch (loadError) {
      setAgentConfigError(
        loadError instanceof Error ? loadError.message : "failed to load agent config",
      );
    }
  };

  const loadSkillsConfig = async (agentId: string) => {
    setSkillsConfig(null);
    setSkillsConfigError("");
    try {
      const nextConfig = await fetchAgentSkills(agentId);
      const nextSkillKeys =
        nextConfig.skills.length > 0
          ? nextConfig.skills
          : nextConfig.available.filter((skill) => skill.assigned).map((skill) => skill.key);
      setSkillsConfig(nextConfig);
      setAgentSkillMode(normalizeAgentSkillMode(nextConfig.mode));
      setAgentSkillKeys(nextSkillKeys.slice().toSorted((left, right) => left.localeCompare(right)));
    } catch (loadError) {
      setSkillsConfigError(
        loadError instanceof Error ? loadError.message : "failed to load agent skills",
      );
    }
  };

  const loadSkillInventory = async (agentId: string, preferredSkillKey?: string) => {
    setSkillInventoryError("");
    try {
      const nextPayload = await fetchSkills(agentId);
      const nextSkills = normalizeSkillInventory(nextPayload);
      const preferredKey = preferredSkillKey?.trim();
      setSkillInventory(nextSkills);
      setSelectedSkillConfigKey((current) =>
        preferredKey && nextSkills.some((skill) => skill.key === preferredKey)
          ? preferredKey
          : current && nextSkills.some((skill) => skill.key === current)
            ? current
            : nextSkills[0]?.key || "",
      );
    } catch (loadError) {
      setSkillInventory([]);
      setSkillInventoryError(
        loadError instanceof Error ? loadError.message : "failed to load skill inventory",
      );
    }
  };

  const loadSubagentConfig = async (agentId: string) => {
    setSubagentConfig(null);
    setSubagentConfigError("");
    try {
      const nextConfig = await fetchAgentSubagentConfig(agentId);
      setSubagentConfig(nextConfig);
      setSubagentAllowMode(
        nextConfig.allowAny ? "any" : nextConfig.allowAgents.length > 0 ? "list" : "none",
      );
      setSubagentAllowAgents(nextConfig.allowAgents.filter((agent) => agent !== "*"));
      setSubagentModel(nextConfig.model ?? "");
    } catch (loadError) {
      setSubagentConfigError(
        loadError instanceof Error ? loadError.message : "failed to load agent subagent config",
      );
    }
  };

  const loadAgentSubagentRuns = async (agentId: string) => {
    setAgentSubagentRuns([]);
    setAgentSubagentRunsError("");
    try {
      const nextRuns = await fetchSubagentRuns({ requesterAgentId: agentId, status: "active" });
      setAgentSubagentRuns(nextRuns.runs ?? []);
    } catch (loadError) {
      setAgentSubagentRunsError(
        loadError instanceof Error ? loadError.message : "failed to load agent subagent runs",
      );
    }
  };

  const loadAgentRoutingBindings = async (agentId: string) => {
    setAgentRoutingBindings([]);
    setAgentRoutingConfigHash("");
    setAgentRoutingError("");
    try {
      const nextRouting = await fetchRoutingBindings({ agentId });
      setAgentRoutingBindings(nextRouting.bindings ?? []);
      setAgentRoutingConfigHash(nextRouting.configHash || "");
    } catch (loadError) {
      setAgentRoutingError(
        loadError instanceof Error ? loadError.message : "failed to load agent routing bindings",
      );
    }
  };

  const loadAgentIdentity = async (agentId: string) => {
    setAgentIdentity(null);
    setAgentIdentityError("");
    try {
      const nextIdentity = await fetchAgentIdentity(agentId);
      if (nextIdentity.agentId === agentId) {
        setAgentIdentity(nextIdentity);
      }
    } catch (loadError) {
      setAgentIdentityError(
        loadError instanceof Error ? loadError.message : "failed to load agent identity",
      );
    }
  };

  const loadAgentFiles = async (agentId: string) => {
    setAgentFiles([]);
    setAgentFilesError("");
    try {
      const nextFiles = await fetchAgentFiles(agentId);
      setAgentFiles(
        (nextFiles.files ?? [])
          .slice()
          .toSorted((left, right) => left.name.localeCompare(right.name)),
      );
    } catch (loadError) {
      setAgentFilesError(
        loadError instanceof Error ? loadError.message : "failed to load agent files",
      );
    }
  };

  const loadEffectiveToolsForSession = async (agentId: string, sessionKey: string) => {
    setEffectiveTools(null);
    setEffectiveToolsError("");
    try {
      const nextEffectiveTools = await fetchEffectiveTools({ agentId, sessionKey });
      setEffectiveTools(nextEffectiveTools);
    } catch (loadError) {
      setEffectiveToolsError(
        loadError instanceof Error ? loadError.message : "failed to load effective tools",
      );
    }
  };

  const loadEffectiveTools = async (agentId: string) => {
    setEffectiveToolSessions([]);
    setEffectiveTools(null);
    setEffectiveToolsSessionKey("");
    setAgentSessionFilter("all");
    setEffectiveToolsError("");
    try {
      const sessionsResult = await fetchSessions({ agentId, limit: 25 });
      const nextSessions = (sessionsResult.sessions ?? []).filter((session) =>
        session.agentId ? session.agentId === agentId : session.key.includes(agentId),
      );
      setEffectiveToolSessions(nextSessions);
      const nextSessionKey = nextSessions[0]?.key ?? "";
      setEffectiveToolsSessionKey(nextSessionKey);
      if (nextSessionKey) {
        await loadEffectiveToolsForSession(agentId, nextSessionKey);
      }
    } catch (loadError) {
      setEffectiveToolsError(
        loadError instanceof Error ? loadError.message : "failed to load effective tool sessions",
      );
    }
  };

  const loadPreviews = async (agentId: string) => {
    setToolPolicyPreview(null);
    setSystemPromptPreview(null);
    setToolsCatalog(null);
    setToolPolicySearch("");
    setExpandedToolName("");
    setBootstrapFile(null);
    setBootstrapFileName("");
    setBootstrapFileDraft("");
    setPreviewError("");
    setToolsCatalogError("");
    setBootstrapFileError("");
    try {
      const [nextToolPolicy, nextSystemPrompt] = await Promise.all([
        fetchAgentToolPolicyPreview(agentId),
        fetchAgentSystemPromptPreview(agentId),
      ]);
      setToolPolicyPreview(nextToolPolicy);
      setSystemPromptPreview(nextSystemPrompt);
    } catch (loadError) {
      setPreviewError(
        loadError instanceof Error ? loadError.message : "failed to load agent previews",
      );
    }
    try {
      const nextToolsCatalog = await fetchToolsCatalog(agentId);
      setToolsCatalog(nextToolsCatalog);
    } catch (loadError) {
      setToolsCatalogError(
        loadError instanceof Error ? loadError.message : "failed to load tools catalog",
      );
    }
  };

  const loadRuntimeModels = async () => {
    setRuntimeModelsError("");
    try {
      setRuntimeModels(await fetchRuntimeConfiguredModels());
    } catch (loadError) {
      setRuntimeModelsError(
        loadError instanceof Error ? loadError.message : "failed to load runtime models",
      );
    }
  };

  const loadDetail = async (agentId: string) => {
    setActionState("detail");
    setCompareDetail(null);
    setCompareAgentId("");
    setCompareError("");
    try {
      const nextDetail = await fetchAgentDetail(agentId);
      setDetail(nextDetail);
      setRenameValue(nextDetail.name || agentId);
      setCloneName(`${nextDetail.name || agentId} Copy`);
      setTemplateName(nextDetail.name || agentId);
      setError("");
      await loadEventStreams(agentId);
      await loadAgentRawConfig(agentId);
      await loadSkillsConfig(agentId);
      await loadSkillInventory(agentId);
      await loadSubagentConfig(agentId);
      await loadAgentSubagentRuns(agentId);
      await loadAgentRoutingBindings(agentId);
      await loadPreviews(agentId);
      await loadEffectiveTools(agentId);
      await loadAgentFiles(agentId);
      await loadAgentIdentity(agentId);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "failed to load agent detail");
    } finally {
      setActionState("idle");
    }
  };

  const refresh = async (preferredAgentId?: string) => {
    setLoadState("loading");
    try {
      const next = await fetchAgentsList();
      const nextAgents = (next.agents ?? [])
        .slice()
        .toSorted((left, right) => left.id.localeCompare(right.id));
      setAgents(nextAgents);
      setDefaultAgentId(next.defaultId ?? "");
      setLoadState("ready");
      setError("");
      const fallbackId = preferredAgentId?.trim() || next.defaultId || nextAgents[0]?.id || "";
      const nextSelectedAgentId = nextAgents.some((agent) => agent.id === fallbackId)
        ? fallbackId
        : nextAgents.some((agent) => agent.id === selectedAgentId)
          ? selectedAgentId
          : nextAgents[0]?.id || "";
      setSelectedAgentId(nextSelectedAgentId);
      if (nextSelectedAgentId) {
        await loadDetail(nextSelectedAgentId);
      } else {
        setDetail(null);
        setEventStreams(null);
        setAgentRawConfig(null);
        setAgentConfigDraft(DEFAULT_AGENT_CONFIG_DRAFT);
        setAgentConfigBaseline(DEFAULT_AGENT_CONFIG_DRAFT);
        setSkillsConfig(null);
        setSkillInventory([]);
        setSelectedSkillConfigKey("");
        setSkillApiKeyDraft("");
        setSkillEnvPairs([]);
        setSubagentConfig(null);
        setAgentSubagentRuns([]);
        setAgentRoutingBindings([]);
        setAgentRoutingConfigHash("");
        setToolPolicyPreview(null);
        setSystemPromptPreview(null);
        setToolsCatalog(null);
        setEffectiveToolSessions([]);
        setEffectiveTools(null);
        setEffectiveToolsSessionKey("");
        setAgentFiles([]);
        setAgentIdentity(null);
        setBootstrapFile(null);
        setBootstrapFileName("");
        setBootstrapFileDraft("");
        setRenameValue("");
        setCloneName("");
        setTemplateName("");
      }
    } catch (loadError) {
      setLoadState("idle");
      setError(loadError instanceof Error ? loadError.message : "failed to load agents");
    }
  };

  useEffect(() => {
    setAgentTemplates(loadAgentTemplates());
    void loadRuntimeModels();
    void refresh(navigationTarget.agentId);
  }, []);

  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? agents[0] ?? null;
  const agentMetrics = useAgentMetricsSSE(detail?.id ?? null);
  const selectedSkillConfig =
    skillInventory.find((skill) => skill.key === selectedSkillConfigKey) ??
    skillInventory[0] ??
    null;
  const agentBatchSummary = summarizeAgents(agents);
  const agentBatchExportText = buildAgentBatchExportText(agents);

  useEffect(() => {
    const config = selectedSkillConfig?.config;
    setSkillApiKeyDraft(readSkillConfigApiKey(config));
    setSkillEnvPairs(readSkillConfigEnvPairs(config));
  }, [selectedSkillConfig?.key, selectedSkillConfig?.config]);

  const selectAgent = async (agentId: string) => {
    setActiveAgentTab("overview");
    setSelectedAgentId(agentId);
    await loadDetail(agentId);
  };

  const createAction = async () => {
    if (!createDraft.name.trim()) {
      setError("agent name is required");
      return;
    }
    setActionState("creating");
    try {
      const result = await createAgent({
        name: createDraft.name.trim(),
        workspace: createDraft.workspace.trim() || undefined,
        emoji: createDraft.emoji.trim() || undefined,
      });
      setActionResult(result);
      setCreateDraft(DEFAULT_CREATE_DRAFT);
      setError("");
      await refresh(result.id || createDraft.name.trim().toLowerCase());
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "agent create failed");
    } finally {
      setActionState("idle");
    }
  };

  const renameAction = async () => {
    if (!selectedAgent || !renameValue.trim()) {
      return;
    }
    setActionState("renaming");
    try {
      const result = await updateAgent(selectedAgent.id, { name: renameValue.trim() });
      setActionResult(result);
      setError("");
      await refresh(selectedAgent.id);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "agent rename failed");
    } finally {
      setActionState("idle");
    }
  };

  const deleteAction = async () => {
    if (!selectedAgent) {
      return;
    }
    if (!window.confirm(tAgentDetail("panel.confirmDelete", { id: selectedAgent.id }))) {
      return;
    }
    setActionState("deleting");
    try {
      const result = await deleteAgent(selectedAgent.id);
      setActionResult(result);
      setError("");
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "agent delete failed");
    } finally {
      setActionState("idle");
    }
  };

  const cloneSelectedAgent = async () => {
    if (!selectedAgent || !detail || !cloneName.trim()) {
      setError("select an agent and provide a clone name");
      return;
    }
    const updates = buildAgentCloneConfigUpdates(agentRawConfig, detail);
    setActionState("cloning");
    try {
      const createResult = await createAgent({
        name: cloneName.trim(),
        workspace: detail.workspace || undefined,
      });
      const nextAgentId = createResult.id || cloneName.trim().toLowerCase();
      let configResult: unknown = null;
      if (Object.keys(updates).length > 0) {
        const nextRawConfig = await fetchAgentRawConfig(nextAgentId);
        configResult = await updateAgentRawConfig(nextAgentId, {
          entry: nextRawConfig.entry,
          updates,
          baseHash: nextRawConfig.baseHash,
        });
      }
      setActionResult({ create: createResult, config: configResult });
      setError("");
      await refresh(nextAgentId);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "agent clone failed");
    } finally {
      setActionState("idle");
    }
  };

  const saveSelectedAgentTemplate = () => {
    if (!detail || !templateName.trim()) {
      setError("select an agent and provide a template name");
      return;
    }
    setActionState("template");
    try {
      const nextTemplate: AgentTemplate = {
        name: templateName.trim(),
        createdAt: Date.now(),
        config: {
          model: detail.model,
          emoji: agentIdentity?.emoji,
        },
      };
      const nextTemplates = [...loadAgentTemplates(), nextTemplate];
      saveAgentTemplates(nextTemplates);
      setAgentTemplates(nextTemplates);
      setError("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "agent template save failed");
    } finally {
      setActionState("idle");
    }
  };

  const deleteAgentTemplate = (index: number) => {
    const nextTemplates = agentTemplates.filter((_, templateIndex) => templateIndex !== index);
    saveAgentTemplates(nextTemplates);
    setAgentTemplates(nextTemplates);
  };

  const createAgentFromTemplate = async (template: AgentTemplate) => {
    const templateNameValue = template.name.trim();
    if (!templateNameValue) {
      setError("template name is required");
      return;
    }
    const updates = buildAgentTemplateConfigUpdates(template);
    setActionState("template-create");
    try {
      const createResult = await createAgent({
        name: templateNameValue,
        emoji: typeof template.config.emoji === "string" ? template.config.emoji : undefined,
      });
      const nextAgentId = createResult.id || templateNameValue.toLowerCase();
      let configResult: unknown = null;
      if (Object.keys(updates).length > 0) {
        const nextRawConfig = await fetchAgentRawConfig(nextAgentId);
        configResult = await updateAgentRawConfig(nextAgentId, {
          entry: nextRawConfig.entry,
          updates,
          baseHash: nextRawConfig.baseHash,
        });
      }
      setActionResult({ create: createResult, config: configResult, template: template.name });
      setError("");
      await refresh(nextAgentId);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "agent template create failed");
    } finally {
      setActionState("idle");
    }
  };

  const removeAgentRoutingBinding = async (bindingId: string) => {
    if (!detail || !agentRoutingConfigHash) {
      setAgentRoutingError("routing config hash is required before removing a binding");
      return;
    }
    setActionState("agent-routing");
    try {
      const result = await removeRoutingBinding({
        id: bindingId,
        baseHash: agentRoutingConfigHash,
      });
      setActionResult(result);
      setAgentRoutingError("");
      await loadAgentRoutingBindings(detail.id);
    } catch (actionError) {
      setAgentRoutingError(
        actionError instanceof Error ? actionError.message : "agent routing remove failed",
      );
    } finally {
      setActionState("idle");
    }
  };

  const toggleEventStream = async (stream: string, checked: boolean) => {
    if (!selectedAgent || !eventStreams) {
      return;
    }
    const enabled = new Set(eventStreams.eventStreams);
    if (checked) {
      enabled.add(stream);
    } else {
      enabled.delete(stream);
    }
    const nextStreams = Array.from(enabled).toSorted((left, right) => left.localeCompare(right));
    setActionState("event-streams");
    try {
      const result = await updateAgentEventStreams(
        selectedAgent.id,
        nextStreams,
        eventStreams.configHash,
      );
      setEventStreams({
        agentId: result.agentId ?? selectedAgent.id,
        eventStreams: result.eventStreams ?? nextStreams,
        isDefault: false,
        configHash: result.configHash ?? eventStreams.configHash,
      });
      setActionResult(result);
      setEventStreamsError("");
    } catch (actionError) {
      setEventStreamsError(
        actionError instanceof Error ? actionError.message : "agent event streams update failed",
      );
    } finally {
      setActionState("idle");
    }
  };

  const selectEffectiveToolsSession = async (sessionKey: string) => {
    if (!selectedAgent || !sessionKey) {
      return;
    }
    setEffectiveToolsSessionKey(sessionKey);
    await loadEffectiveToolsForSession(selectedAgent.id, sessionKey);
  };

  const openBootstrapFile = async (name: string, exists: boolean) => {
    if (!selectedAgent) {
      return;
    }
    setActionState("bootstrap-file");
    setBootstrapFileName(name);
    setBootstrapFileError("");
    try {
      if (!exists) {
        setBootstrapFile({ name, missing: true, content: "" });
        setBootstrapFileDraft("");
        return;
      }
      const result = await fetchAgentFile(selectedAgent.id, name);
      setBootstrapFile(result.file);
      setBootstrapFileDraft(result.file.content ?? "");
    } catch (actionError) {
      setBootstrapFileError(
        actionError instanceof Error ? actionError.message : "agent file fetch failed",
      );
    } finally {
      setActionState("idle");
    }
  };

  const closeBootstrapFile = () => {
    setBootstrapFile(null);
    setBootstrapFileName("");
    setBootstrapFileDraft("");
    setBootstrapFileError("");
  };

  const insertBootstrapVariable = (key: (typeof PROMPT_VARIABLE_KEYS)[number]) => {
    const variable = `{{${key}}}`;
    const editor = bootstrapEditorRef.current;
    if (!editor) {
      setBootstrapFileDraft((current) => `${current}${variable}`);
      return;
    }
    const start = editor.selectionStart ?? bootstrapFileDraft.length;
    const end = editor.selectionEnd ?? start;
    const nextDraft = `${bootstrapFileDraft.slice(0, start)}${variable}${bootstrapFileDraft.slice(
      end,
    )}`;
    setBootstrapFileDraft(nextDraft);
    window.setTimeout(() => {
      const cursor = start + variable.length;
      editor.focus();
      editor.setSelectionRange(cursor, cursor);
    }, 0);
  };

  const saveBootstrapFile = async () => {
    if (!selectedAgent || !bootstrapFileName) {
      return;
    }
    setActionState("bootstrap-file");
    setBootstrapFileError("");
    try {
      const result = await saveAgentFile(selectedAgent.id, bootstrapFileName, bootstrapFileDraft);
      setBootstrapFile(result.file);
      setBootstrapFileDraft(result.file.content ?? bootstrapFileDraft);
      setActionResult(result);
      await loadPreviews(selectedAgent.id);
      await loadAgentFiles(selectedAgent.id);
    } catch (actionError) {
      setBootstrapFileError(
        actionError instanceof Error ? actionError.message : "agent file save failed",
      );
    } finally {
      setActionState("idle");
    }
  };

  const toggleAgentSkill = (skillKey: string, checked: boolean) => {
    setAgentSkillKeys((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(skillKey);
      } else {
        next.delete(skillKey);
      }
      return Array.from(next).toSorted((left, right) => left.localeCompare(right));
    });
  };

  const addSkillEnvPair = () => {
    setSkillEnvPairs((current) => [...current, { key: "", value: "" }]);
  };

  const updateSkillEnvPair = (index: number, field: keyof SkillEnvPair, value: string) => {
    setSkillEnvPairs((current) =>
      current.map((pair, pairIndex) => (pairIndex === index ? { ...pair, [field]: value } : pair)),
    );
  };

  const removeSkillEnvPair = (index: number) => {
    setSkillEnvPairs((current) => current.filter((_, pairIndex) => pairIndex !== index));
  };

  const saveSkillConfig = async () => {
    if (!selectedAgent || !selectedSkillConfig) {
      return;
    }
    setActionState("skill-config");
    try {
      const result = await updateSkill(selectedSkillConfig.key, {
        apiKey: skillApiKeyDraft,
        env: buildSkillEnvPatch(skillEnvPairs),
      });
      setActionResult(result);
      setSkillInventoryError("");
      await loadSkillInventory(selectedAgent.id, selectedSkillConfig.key);
    } catch (actionError) {
      setSkillInventoryError(
        actionError instanceof Error ? actionError.message : "skill config update failed",
      );
    } finally {
      setActionState("idle");
    }
  };

  const installSkillOption = async (skill: DeckGoSkillEntry, installId: string) => {
    if (!selectedAgent) {
      return;
    }
    setActionState("skill-install");
    try {
      const result = await installSkill(skill.name, installId);
      setActionResult(result);
      setSkillInventoryError("");
      await loadSkillInventory(selectedAgent.id, skill.key);
    } catch (actionError) {
      setSkillInventoryError(
        actionError instanceof Error ? actionError.message : "skill install failed",
      );
    } finally {
      setActionState("idle");
    }
  };

  const saveAgentRawConfig = async () => {
    if (!selectedAgent || !agentRawConfig) {
      return;
    }
    const updates: Record<string, unknown> = {};
    const nextModel = agentConfigDraft.model.trim();
    const nextFallbacks = parseModelFallbacks(agentConfigDraft.modelFallbacks);
    if (
      nextModel !== agentConfigBaseline.model.trim() ||
      agentConfigDraft.modelFallbacks.trim() !== agentConfigBaseline.modelFallbacks.trim()
    ) {
      updates.model =
        nextFallbacks.length > 0
          ? {
              ...(isRecord(agentRawConfig.entry?.model) ? agentRawConfig.entry.model : {}),
              primary: nextModel || undefined,
              fallbacks: nextFallbacks,
            }
          : nextModel || null;
    }
    if (agentConfigDraft.reasoningDefault !== agentConfigBaseline.reasoningDefault) {
      updates.reasoningDefault = agentConfigDraft.reasoningDefault;
    }
    if (agentConfigDraft.fastModeDefault !== agentConfigBaseline.fastModeDefault) {
      updates.fastModeDefault = agentConfigDraft.fastModeDefault;
    }
    const toolsUpdates: Record<string, unknown> = {};
    if (agentConfigDraft.toolsProfile.trim() !== agentConfigBaseline.toolsProfile.trim()) {
      const nextToolsProfile = agentConfigDraft.toolsProfile.trim();
      toolsUpdates.profile = nextToolsProfile || null;
    }
    if (agentConfigDraft.toolsAllow.trim() !== agentConfigBaseline.toolsAllow.trim()) {
      const nextToolsAllow = parseCommaList(agentConfigDraft.toolsAllow);
      toolsUpdates.allow = nextToolsAllow.length > 0 ? nextToolsAllow : null;
    }
    if (agentConfigDraft.toolsDeny.trim() !== agentConfigBaseline.toolsDeny.trim()) {
      const nextToolsDeny = parseCommaList(agentConfigDraft.toolsDeny);
      toolsUpdates.deny = nextToolsDeny.length > 0 ? nextToolsDeny : null;
    }
    if (Object.keys(toolsUpdates).length > 0) {
      updates.tools = toolsUpdates;
    }
    const paramsUpdates: Record<string, unknown> = {};
    const nextThinkingDefault = agentConfigDraft.thinkingDefault.trim();
    if (nextThinkingDefault !== agentConfigBaseline.thinkingDefault.trim()) {
      updates.thinkingDefault = nextThinkingDefault || null;
    }
    const nextTemperatureText = agentConfigDraft.temperature.trim();
    if (nextTemperatureText !== agentConfigBaseline.temperature.trim()) {
      if (nextTemperatureText) {
        const nextTemperature = Number(nextTemperatureText);
        if (!Number.isFinite(nextTemperature)) {
          setAgentConfigError("temperature must be a number");
          return;
        }
        if (nextTemperature < 0 || nextTemperature > 2) {
          setAgentConfigError("temperature must be between 0 and 2");
          return;
        }
        paramsUpdates.temperature = nextTemperature;
      } else {
        paramsUpdates.temperature = null;
      }
    }
    if (Object.keys(paramsUpdates).length > 0) {
      updates.params = paramsUpdates;
    }
    if (Object.keys(updates).length === 0) {
      setAgentConfigError("No agent config changes to save.");
      return;
    }
    setActionState("agent-config");
    try {
      const result = await updateAgentRawConfig(selectedAgent.id, {
        entry: agentRawConfig.entry,
        updates,
        baseHash: agentRawConfig.baseHash,
      });
      setActionResult(result);
      setAgentConfigError("");
      await loadAgentRawConfig(selectedAgent.id);
      const nextDetail = await fetchAgentDetail(selectedAgent.id);
      setDetail(nextDetail);
      setRenameValue(nextDetail.name || selectedAgent.id);
    } catch (actionError) {
      setAgentConfigError(
        actionError instanceof Error ? actionError.message : "agent config update failed",
      );
    } finally {
      setActionState("idle");
    }
  };

  const resetAgentRawConfigOverrides = async () => {
    if (!selectedAgent || !agentRawConfig) {
      return;
    }
    const updates = buildAgentConfigResetUpdates(agentRawConfig);
    if (Object.keys(updates).length === 0) {
      setAgentConfigError("No editable agent config overrides to reset.");
      return;
    }
    setActionState("agent-config");
    try {
      const result = await updateAgentRawConfig(selectedAgent.id, {
        entry: agentRawConfig.entry,
        updates,
        baseHash: agentRawConfig.baseHash,
      });
      setActionResult(result);
      setAgentConfigError("");
      await loadAgentRawConfig(selectedAgent.id);
      const nextDetail = await fetchAgentDetail(selectedAgent.id);
      setDetail(nextDetail);
      setRenameValue(nextDetail.name || selectedAgent.id);
    } catch (actionError) {
      setAgentConfigError(
        actionError instanceof Error ? actionError.message : "agent config reset failed",
      );
    } finally {
      setActionState("idle");
    }
  };

  const saveSkillsConfig = async () => {
    if (!selectedAgent || !skillsConfig) {
      return;
    }
    const nextSkillKeys = agentSkillKeys
      .slice()
      .toSorted((left, right) => left.localeCompare(right));
    setActionState("skills");
    try {
      const result = await updateAgentSkills(selectedAgent.id, {
        mode: agentSkillMode,
        skills: nextSkillKeys,
        baseHash: skillsConfig.configHash,
      });
      const savedSkillKeys = (result.skills ?? nextSkillKeys)
        .slice()
        .toSorted((left, right) => left.localeCompare(right));
      const assigned = new Set(savedSkillKeys);
      const savedMode = normalizeAgentSkillMode(result.mode ?? agentSkillMode);
      setSkillsConfig({
        ...skillsConfig,
        agentId: result.agentId ?? selectedAgent.id,
        mode: savedMode,
        skills: savedSkillKeys,
        available: skillsConfig.available.map((skill) => ({
          ...skill,
          assigned: assigned.has(skill.key),
        })),
        configHash: result.configHash ?? skillsConfig.configHash,
      });
      setAgentSkillMode(savedMode);
      setAgentSkillKeys(savedSkillKeys);
      setActionResult(result);
      setSkillsConfigError("");
    } catch (actionError) {
      setSkillsConfigError(
        actionError instanceof Error ? actionError.message : "agent skills update failed",
      );
    } finally {
      setActionState("idle");
    }
  };

  const toggleSubagentAgent = (agentId: string, checked: boolean) => {
    setSubagentAllowAgents((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(agentId);
      } else {
        next.delete(agentId);
      }
      return Array.from(next).toSorted((left, right) => left.localeCompare(right));
    });
  };

  const saveSubagentConfig = async () => {
    if (!selectedAgent || !subagentConfig) {
      return;
    }
    const allowAgents =
      subagentAllowMode === "any" ? ["*"] : subagentAllowMode === "list" ? subagentAllowAgents : [];
    setActionState("subagents");
    try {
      const result = await updateAgentSubagentConfig(selectedAgent.id, {
        allowAgents,
        model: subagentModel.trim() || undefined,
        baseHash: subagentConfig.configHash,
      });
      setSubagentConfig({
        ...subagentConfig,
        agentId: result.agentId ?? selectedAgent.id,
        allowAgents: result.allowAgents ?? allowAgents,
        allowAny: (result.allowAgents ?? allowAgents).includes("*"),
        model: result.model,
        configHash: result.configHash ?? subagentConfig.configHash,
      });
      setActionResult(result);
      setSubagentConfigError("");
    } catch (actionError) {
      setSubagentConfigError(
        actionError instanceof Error ? actionError.message : "agent subagent config update failed",
      );
    } finally {
      setActionState("idle");
    }
  };

  const compareAgentDetail = async () => {
    if (!detail || !compareAgentId || compareAgentId === detail.id) {
      return;
    }
    setActionState("compare");
    setCompareError("");
    setCompareDetail(null);
    try {
      const nextCompareDetail = await fetchAgentDetail(compareAgentId);
      setCompareDetail(nextCompareDetail);
    } catch (actionError) {
      setCompareError(actionError instanceof Error ? actionError.message : "agent compare failed");
    } finally {
      setActionState("idle");
    }
  };

  const allowedToolCount = (toolPolicyPreview?.tools ?? []).filter((tool) => tool.allowed).length;
  const catalogToolCount =
    toolsCatalog?.groups.reduce((sum, group) => sum + group.tools.length, 0) ?? 0;
  const effectiveToolCount =
    effectiveTools?.groups.reduce((sum, group) => sum + group.tools.length, 0) ?? 0;
  const resettableAgentConfigOverrideCount = countResettableAgentConfigOverrides(agentRawConfig);
  const compareDiffs =
    detail && compareDetail
      ? computeConfigDiff(
          detail as unknown as Record<string, unknown>,
          compareDetail as unknown as Record<string, unknown>,
        )
      : [];
  const filteredPolicyTools = (toolPolicyPreview?.tools ?? []).filter((tool) =>
    tool.name.toLowerCase().includes(toolPolicySearch.trim().toLowerCase()),
  );
  const runtimeModelOptions = normalizeRuntimeModelOptions(runtimeModels);
  const fallbackDraftList = parseModelFallbacks(agentConfigDraft.modelFallbacks);
  const skillInstallOptions = skillInventory.flatMap((skill) =>
    (skill.installOptions ?? []).map((option) => ({ skill, option })),
  );
  const filteredAgentSessions = effectiveToolSessions.filter((session) => {
    if (agentSessionFilter === "all") {
      return true;
    }
    if (agentSessionFilter === "subagent") {
      return isSubagentSession(session);
    }
    return readSessionKind(session) === agentSessionFilter;
  });
  const updateFallbackDraftList = (updater: (fallbacks: string[]) => string[]) => {
    setAgentConfigDraft((current) => ({
      ...current,
      modelFallbacks: formatCommaList(updater(parseModelFallbacks(current.modelFallbacks))),
    }));
  };
  const addFallbackModel = (modelRef: string) => {
    if (!modelRef) {
      return;
    }
    updateFallbackDraftList((fallbacks) =>
      fallbacks.includes(modelRef) ? fallbacks : [...fallbacks, modelRef],
    );
  };

  return (
    <section className="deckgo-panel-workspace deck-ui-agents">
      <AgentListBoundary>
        <article className="deckgo-card is-float deck-ui-agents-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">{tAgents("title")}</h2>
          </div>
          <p className="deckgo-card-subtitle">{tAgentDetail("panel.listSubtitle")}</p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-agents-body">
            <div className="deckgo-pill-row deck-ui-agents-pill-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                {tAgentDetail("panel.agentsState", { state: loadState })}
              </span>
              <span className="deckgo-pill">
                {tAgentDetail("panel.loadedCount", { count: agents.length })}
              </span>
              <span className="deckgo-pill">
                {tAgentDetail("panel.defaultAgent", { id: defaultAgentId || "n/a" })}
              </span>
            </div>
            <div className="deckgo-grid deckgo-grid-3 deck-ui-agents-grid">
              <ShellStat label={tAgentDetail("panel.agents")} value={agents.length} />
              <ShellStat label={tAgentDetail("defaultAgent")} value={defaultAgentId || "n/a"} />
              <ShellStat
                label={tAgentDetail("panel.selected")}
                value={selectedAgent?.id || "n/a"}
              />
            </div>
            <div className="deckgo-surface-tile deck-ui-agents-surface">
              <p className="deckgo-surface-label">{tAgentDetail("panel.batchSummary")}</p>
              <div className="deckgo-grid deckgo-grid-3 deck-ui-agents-grid">
                <ShellStat label={tAgentDetail("panel.total")} value={agentBatchSummary.total} />
                <ShellStat
                  label={tAgentDetail("panel.statuses")}
                  value={Object.keys(agentBatchSummary.byStatus).length}
                />
                <ShellStat
                  label={tAgentDetail("panel.models")}
                  value={Object.keys(agentBatchSummary.byModel).length}
                />
              </div>
              <pre className="deckgo-code" aria-label={tAgentDetail("panel.batchExport")}>
                {agentBatchExportText}
              </pre>
            </div>
            <div className="deckgo-surface-tile deck-ui-agents-surface">
              <p className="deckgo-surface-label">{tAgentDetail("panel.createAgent")}</p>
              <div className="deckgo-grid deckgo-grid-2 deck-ui-agents-grid">
                <input
                  className="deckgo-input deck-ui-agents-input"
                  value={createDraft.name}
                  onChange={(event) =>
                    setCreateDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder={tAgentDetail("panel.agentNamePlaceholder")}
                />
                <input
                  className="deckgo-input deck-ui-agents-input"
                  value={createDraft.workspace}
                  onChange={(event) =>
                    setCreateDraft((current) => ({ ...current, workspace: event.target.value }))
                  }
                  placeholder={tAgentDetail("panel.workspacePlaceholder")}
                />
                <input
                  className="deckgo-input deck-ui-agents-input"
                  value={createDraft.emoji}
                  onChange={(event) =>
                    setCreateDraft((current) => ({ ...current, emoji: event.target.value }))
                  }
                  placeholder={tAgentDetail("panel.emojiPlaceholder")}
                />
              </div>
              <div className="deckgo-actions deck-ui-agents-actions deck-ui-agents-spaced">
                <button
                  className="deckgo-button deck-ui-agents-button is-primary"
                  type="button"
                  onClick={() => void createAction()}
                  disabled={actionState !== "idle"}
                >
                  {actionState === "creating"
                    ? tAgentDetail("panel.creating")
                    : tAgentDetail("panel.createAgent")}
                </button>
                <button
                  className="deckgo-button deck-ui-agents-button"
                  type="button"
                  onClick={() => void refresh(selectedAgentId)}
                >
                  {tAgentDetail("panel.refreshAgents")}
                </button>
              </div>
            </div>
            {error ? <p className="deckgo-note">{error}</p> : null}
            {agents.length === 0 ? (
              <p className="deckgo-note">{tAgentDetail("panel.noAgents")}</p>
            ) : (
              <ul className="deckgo-shell-list deck-ui-agents-list">
                {agents.map((agent) => (
                  <li key={agent.id}>
                    <button
                      type="button"
                      className={`deckgo-selectable-card deck-ui-agents-row ${selectedAgent?.id === agent.id ? "is-selected" : ""}`}
                      onClick={() => void selectAgent(agent.id)}
                    >
                      <strong>{agent.name || agent.id}</strong>
                      <div className="deckgo-meta">
                        {tAgentDetail("id")}: {agent.id} | {tAgentDetail("panel.workspace")}:{" "}
                        {typeof agent.workspace === "string" ? agent.workspace : "n/a"}
                      </div>
                      <div className="deckgo-meta">
                        {agent.id === defaultAgentId
                          ? tAgentDetail("defaultAgent")
                          : tAgentDetail("panel.standardAgent")}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      </AgentListBoundary>

      <AgentDetailBoundary>
        <article className="deckgo-card is-float deck-ui-agents-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">{tAgentDetail("title")}</h2>
          </div>
          <p className="deckgo-card-subtitle">{tAgentDetail("panel.detailSubtitle")}</p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-agents-body">
            {detail ? (
              <>
                <div className="deck-ui-agents-tabs deck-ui-tab-strip" role="tablist">
                  {AGENT_DETAIL_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      className={activeAgentTab === tab.key ? "is-active" : ""}
                      aria-selected={activeAgentTab === tab.key}
                      onClick={() => setActiveAgentTab(tab.key)}
                    >
                      {tAgentDetail(tab.labelKey)}
                    </button>
                  ))}
                </div>
                <div
                  className="deckgo-panel-hero-strip deck-ui-agents-hero"
                  hidden={activeAgentTab !== "overview"}
                >
                  <div>
                    <p className="deckgo-kicker">{tAgentDetail("panel.selectedAgent")}</p>
                    <strong>{detail.name || detail.id}</strong>
                    <p className="deckgo-note">{detail.workspace}</p>
                  </div>
                  <div className="deckgo-pill-row deck-ui-agents-pill-row">
                    <span className="deckgo-pill">
                      {detail.model || tAgentDetail("panel.defaultModel")}
                    </span>
                    <span className="deckgo-pill">{detail.skillMode}</span>
                  </div>
                </div>
                <div
                  className="deckgo-grid deckgo-grid-3 deck-ui-agents-grid"
                  hidden={activeAgentTab !== "overview"}
                >
                  <ShellStat label={tAgentDetail("panel.bindings")} value={detail.bindingCount} />
                  <ShellStat label={tAgentDetail("statSessions")} value={detail.sessionCount} />
                  <ShellStat
                    label={tAgentDetail("statSubagents")}
                    value={detail.activeSubagentCount}
                  />
                </div>
                <div
                  className="deckgo-surface-tile deck-ui-agents-surface"
                  hidden={activeAgentTab !== "overview"}
                >
                  <p className="deckgo-surface-label">{tAgentDetail("panel.runtimeProfile")}</p>
                  <div className="deckgo-grid deckgo-grid-3 deck-ui-agents-grid">
                    <ShellStat
                      label={tAgentDetail("panel.sandbox")}
                      value={tAgentDetail("panel.sandboxValue", {
                        value: formatSandboxMode(detail.sandbox),
                      })}
                    />
                    <ShellStat
                      label={tAgentDetail("panel.fallbacks")}
                      value={detail.fallbackModels?.length ?? 0}
                    />
                    <ShellStat
                      label={tAgentDetail("panel.fastMode")}
                      value={
                        detail.fastModeDefault
                          ? tAgentDetail("panel.enabled")
                          : tAgentDetail("panel.disabled")
                      }
                    />
                  </div>
                  <div className="deckgo-grid deckgo-grid-3 deck-ui-agents-grid deck-ui-agents-spaced">
                    <ShellStat
                      label={tAgentDetail("panel.activeRuns")}
                      value={agentMetrics.activeRuns}
                    />
                    <ShellStat
                      label={tAgentDetail("panel.messages")}
                      value={agentMetrics.messageCount}
                    />
                    <ShellStat
                      label={tAgentDetail("panel.metrics")}
                      value={
                        agentMetrics.lastUpdated > 0
                          ? tAgentDetail("panel.live")
                          : tAgentDetail("panel.pending")
                      }
                    />
                  </div>
                  <div className="deckgo-pill-row deck-ui-agents-pill-row deck-ui-agents-spaced">
                    {readSandboxField(detail.sandbox, "backend") ? (
                      <span className="deckgo-pill">
                        {tAgentDetail("panel.backend", {
                          value: readSandboxField(detail.sandbox, "backend"),
                        })}
                      </span>
                    ) : null}
                    {readSandboxField(detail.sandbox, "filesystem") ? (
                      <span className="deckgo-pill">
                        {tAgentDetail("panel.filesystem", {
                          value: readSandboxField(detail.sandbox, "filesystem"),
                        })}
                      </span>
                    ) : null}
                    {(detail.fallbackModels ?? []).slice(0, 4).map((fallback) => (
                      <span key={fallback} className="deckgo-pill">
                        {tAgentDetail("panel.fallback", { value: fallback })}
                      </span>
                    ))}
                    {detail.reasoningDefault ? (
                      <span className="deckgo-pill">
                        {tAgentDetail("panel.reasoning", { value: detail.reasoningDefault })}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div
                  className="deckgo-surface-tile deck-ui-agents-surface"
                  hidden={activeAgentTab !== "routing"}
                >
                  <p className="deckgo-surface-label">{tAgentDetail("panel.routingBindings")}</p>
                  <p className="deckgo-note">{tAgentDetail("panel.routingDescription")}</p>
                  <div className="deckgo-grid deckgo-grid-2 deck-ui-agents-grid">
                    <ShellStat
                      label={tAgentDetail("panel.bindings")}
                      value={agentRoutingBindings.length}
                    />
                    <ShellStat
                      label={tAgentDetail("panel.configHash")}
                      value={agentRoutingConfigHash || "n/a"}
                    />
                  </div>
                  <div className="deckgo-actions deck-ui-agents-actions deck-ui-agents-spaced">
                    <button
                      className="deckgo-button deck-ui-agents-button"
                      type="button"
                      onClick={() => navigateToRouting(ui, detail.id)}
                    >
                      {tAgentDetail("panel.openRouting")}
                    </button>
                    <button
                      className="deckgo-button deck-ui-agents-button"
                      type="button"
                      disabled={actionState !== "idle"}
                      onClick={() => void loadAgentRoutingBindings(detail.id)}
                    >
                      {tAgentDetail("panel.refreshRouting")}
                    </button>
                  </div>
                  {agentRoutingBindings.length > 0 ? (
                    <ul className="deckgo-shell-list deck-ui-agents-list deck-ui-agents-spaced">
                      {agentRoutingBindings.slice(0, 8).map((binding) => (
                        <li key={binding.id}>
                          <div className="deckgo-selectable-card deck-ui-agents-row">
                            <strong>{binding.tier}</strong>
                            <div className="deckgo-meta">
                              {tAgentDetail("panel.bindingId", { id: binding.id })}
                            </div>
                            <div className="deckgo-meta">{summarizeAgentRoutingMatch(binding)}</div>
                            <div className="deckgo-actions deck-ui-agents-actions deck-ui-agents-spaced-tight">
                              <button
                                className="deckgo-button deck-ui-agents-button is-danger"
                                type="button"
                                disabled={actionState !== "idle"}
                                onClick={() => void removeAgentRoutingBinding(binding.id)}
                              >
                                {actionState === "agent-routing"
                                  ? tAgentDetail("panel.removingBinding")
                                  : tAgentDetail("panel.removeBinding")}
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="deckgo-note">{tAgentDetail("panel.noRouting")}</p>
                  )}
                  {agentRoutingError ? <p className="deckgo-note">{agentRoutingError}</p> : null}
                </div>
                <div
                  className="deckgo-surface-tile deck-ui-agents-surface"
                  hidden={activeAgentTab !== "overview"}
                >
                  <p className="deckgo-surface-label">{tAgentDetail("panel.identity")}</p>
                  <div className="deckgo-panel-hero-strip deck-ui-agents-hero">
                    <div>
                      <p className="deckgo-kicker">
                        {detail.identityExists ? "IDENTITY.md" : "fallback"}
                      </p>
                      <strong>{agentIdentity?.name || detail.name || detail.id}</strong>
                      <p className="deckgo-note">
                        {agentIdentity?.emoji
                          ? `emoji ${agentIdentity.emoji}`
                          : tAgentDetail("panel.noEmoji")}
                      </p>
                    </div>
                    <div className="deckgo-pill-row deck-ui-agents-pill-row">
                      <span className="deckgo-pill">
                        {agentIdentity?.avatar
                          ? tAgentDetail("panel.avatarConfigured")
                          : tAgentDetail("panel.noAvatar")}
                      </span>
                      <span className="deckgo-pill">{agentIdentity?.agentId || detail.id}</span>
                    </div>
                  </div>
                  {agentIdentity?.avatar ? (
                    <p className="deckgo-note">
                      {tAgentDetail("panel.avatar", { value: agentIdentity.avatar })}
                    </p>
                  ) : null}
                  {agentIdentityError ? <p className="deckgo-note">{agentIdentityError}</p> : null}
                </div>
                <div
                  className="deckgo-surface-tile deck-ui-agents-surface"
                  hidden={activeAgentTab !== "overview"}
                >
                  <p className="deckgo-surface-label">{tAgentDetail("panel.cloneConfig")}</p>
                  <p className="deckgo-note">{tAgentDetail("panel.cloneDescription")}</p>
                  <div className="deckgo-actions deck-ui-agents-actions">
                    <input
                      className="deckgo-input deck-ui-agents-input"
                      value={cloneName}
                      disabled={actionState !== "idle"}
                      onChange={(event) => setCloneName(event.target.value)}
                      placeholder={tAgentDetail("panel.cloneNamePlaceholder")}
                    />
                    <button
                      className="deckgo-button deck-ui-agents-button"
                      type="button"
                      disabled={actionState !== "idle" || !cloneName.trim()}
                      onClick={() => void cloneSelectedAgent()}
                    >
                      {actionState === "cloning"
                        ? tAgentDetail("panel.cloning")
                        : tAgentDetail("panel.cloneSelected")}
                    </button>
                  </div>
                </div>
                <AgentEditorBoundary kind="template-dialog">
                  <div
                    className="deckgo-surface-tile deck-ui-agents-surface"
                    hidden={activeAgentTab !== "overview"}
                  >
                    <p className="deckgo-surface-label">{tAgentDetail("panel.templates")}</p>
                    <p className="deckgo-note">{tAgentDetail("panel.templatesDescription")}</p>
                    <div className="deckgo-actions deck-ui-agents-actions">
                      <input
                        className="deckgo-input deck-ui-agents-input"
                        value={templateName}
                        disabled={actionState !== "idle"}
                        onChange={(event) => setTemplateName(event.target.value)}
                        placeholder={tAgentDetail("panel.templateNamePlaceholder")}
                      />
                      <button
                        className="deckgo-button deck-ui-agents-button"
                        type="button"
                        disabled={actionState !== "idle" || !templateName.trim()}
                        onClick={saveSelectedAgentTemplate}
                      >
                        {actionState === "template"
                          ? tAgentDetail("panel.savingTemplate")
                          : tAgentDetail("panel.saveTemplate")}
                      </button>
                    </div>
                    {agentTemplates.length > 0 ? (
                      <ul className="deckgo-shell-list deck-ui-agents-list deck-ui-agents-spaced">
                        {agentTemplates.map((template, index) => (
                          <li key={`${template.name}:${template.createdAt}`}>
                            <div className="deckgo-selectable-card deck-ui-agents-row">
                              <strong>{template.name}</strong>
                              <div className="deckgo-meta">
                                {tAgentDetail("panel.createdAt", {
                                  value: new Date(template.createdAt).toLocaleString(),
                                })}
                              </div>
                              <div className="deckgo-meta">
                                {tAgentDetail("panel.configValue", {
                                  value: formatDiffValue(template.config),
                                })}
                              </div>
                              <div className="deckgo-actions deck-ui-agents-actions deck-ui-agents-spaced-tight">
                                <button
                                  className="deckgo-button deck-ui-agents-button"
                                  type="button"
                                  disabled={actionState !== "idle"}
                                  onClick={() => void createAgentFromTemplate(template)}
                                >
                                  {actionState === "template-create"
                                    ? tAgentDetail("panel.creatingFromTemplate")
                                    : tAgentDetail("panel.createFromTemplate")}
                                </button>
                                <button
                                  className="deckgo-button deck-ui-agents-button is-danger"
                                  type="button"
                                  disabled={actionState !== "idle"}
                                  onClick={() => deleteAgentTemplate(index)}
                                >
                                  {tAgentDetail("panel.deleteTemplate")}
                                </button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="deckgo-note">{tAgentDetail("panel.noTemplates")}</p>
                    )}
                  </div>
                </AgentEditorBoundary>
                <AgentCompareBoundary>
                  <div
                    className="deckgo-surface-tile deck-ui-agents-surface"
                    hidden={activeAgentTab !== "overview"}
                  >
                    <p className="deckgo-surface-label">{tAgentDetail("panel.compareTitle")}</p>
                    <p className="deckgo-note">{tAgentDetail("panel.compareDescription")}</p>
                    <div className="deckgo-actions deck-ui-agents-actions">
                      <select
                        aria-label={tAgentDetail("panel.compareAgent")}
                        className="deckgo-input deck-ui-agents-input"
                        value={compareAgentId}
                        disabled={actionState !== "idle"}
                        onChange={(event) => setCompareAgentId(event.target.value)}
                      >
                        <option value="">{tAgentDetail("panel.chooseAgent")}</option>
                        {agents
                          .filter((agent) => agent.id !== detail.id)
                          .map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agent.name || agent.id}
                            </option>
                          ))}
                      </select>
                      <button
                        className="deckgo-button deck-ui-agents-button"
                        type="button"
                        disabled={actionState !== "idle" || !compareAgentId}
                        onClick={() => void compareAgentDetail()}
                      >
                        {actionState === "compare"
                          ? tAgentDetail("panel.comparing")
                          : tAgentDetail("panel.compareAgents")}
                      </button>
                    </div>
                    {compareDetail ? (
                      <>
                        <div className="deckgo-grid deckgo-grid-3 deck-ui-agents-grid deck-ui-agents-spaced">
                          <ShellStat label={tAgentDetail("panel.left")} value={detail.id} />
                          <ShellStat label={tAgentDetail("panel.right")} value={compareDetail.id} />
                          <ShellStat
                            label={tAgentDetail("panel.diffs")}
                            value={compareDiffs.length}
                          />
                        </div>
                        {compareDiffs.length > 0 ? (
                          <ul className="deckgo-shell-list deck-ui-agents-list deck-ui-agents-spaced">
                            {compareDiffs.slice(0, 10).map((diff) => (
                              <li key={diff.path}>
                                <div className="deckgo-selectable-card deck-ui-agents-row">
                                  <strong>
                                    {diff.type}: {diff.path}
                                  </strong>
                                  <div className="deckgo-meta">
                                    {tAgentDetail("panel.oldNew", {
                                      oldValue: formatDiffValue(diff.oldValue),
                                      newValue: formatDiffValue(diff.newValue),
                                    })}
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="deckgo-note">{tAgentDetail("panel.payloadsMatch")}</p>
                        )}
                      </>
                    ) : null}
                    {compareError ? <p className="deckgo-note">{compareError}</p> : null}
                  </div>
                </AgentCompareBoundary>
                <div
                  className="deckgo-surface-tile deck-ui-agents-surface"
                  data-agent-editor="config-editor"
                  hidden={activeAgentTab !== "config"}
                >
                  <p className="deckgo-surface-label">{tAgentDetail("panel.configOverrides")}</p>
                  <p className="deckgo-note">{tAgentDetail("panel.configDescription")}</p>
                  {agentRawConfig ? (
                    <>
                      <div className="deckgo-grid deckgo-grid-3 deck-ui-agents-grid">
                        <ShellStat
                          label={tAgentDetail("panel.source")}
                          value={agentRawConfig.entry ? "agent" : "defaults"}
                        />
                        <ShellStat
                          label={tAgentDetail("panel.overrides")}
                          value={countAgentConfigOverrides(agentRawConfig)}
                        />
                        <ShellStat
                          label={tAgentDetail("panel.hash")}
                          value={agentRawConfig.baseHash ?? "n/a"}
                        />
                      </div>
                      <div className="deckgo-grid deckgo-grid-2 deck-ui-agents-grid deck-ui-agents-spaced">
                        <label>
                          <span className="deckgo-surface-label">{tAgentDetail("model")}</span>
                          <input
                            className="deckgo-input deck-ui-agents-input"
                            value={agentConfigDraft.model}
                            disabled={actionState !== "idle"}
                            onChange={(event) =>
                              setAgentConfigDraft((current) => ({
                                ...current,
                                model: event.target.value,
                              }))
                            }
                            placeholder={tAgentDetail("panel.modelPlaceholder")}
                          />
                          {runtimeModelOptions.length > 0 ? (
                            <select
                              aria-label={tAgentDetail("panel.primaryModelPreset")}
                              className="deckgo-input deck-ui-agents-input deck-ui-agents-spaced-tight"
                              value={
                                runtimeModelOptions.some(
                                  (option) => option.ref === agentConfigDraft.model,
                                )
                                  ? agentConfigDraft.model
                                  : ""
                              }
                              disabled={actionState !== "idle"}
                              onChange={(event) => {
                                const modelRef = event.target.value;
                                if (modelRef) {
                                  setAgentConfigDraft((current) => ({
                                    ...current,
                                    model: modelRef,
                                  }));
                                }
                              }}
                            >
                              <option value="">{tAgentDetail("panel.selectRuntimeModel")}</option>
                              {runtimeModelOptions.map((option) => (
                                <option key={option.ref} value={option.ref}>
                                  {option.label} ({option.provider})
                                </option>
                              ))}
                            </select>
                          ) : null}
                        </label>
                        <label>
                          <span className="deckgo-surface-label">
                            {tAgentDetail("panel.fallbackModels")}
                          </span>
                          <input
                            className="deckgo-input deck-ui-agents-input"
                            value={agentConfigDraft.modelFallbacks}
                            disabled={actionState !== "idle"}
                            onChange={(event) =>
                              setAgentConfigDraft((current) => ({
                                ...current,
                                modelFallbacks: event.target.value,
                              }))
                            }
                            placeholder={tAgentDetail("panel.fallbackPlaceholder")}
                          />
                          {runtimeModelOptions.length > 0 ? (
                            <select
                              aria-label={tAgentDetail("panel.addFallbackModel")}
                              className="deckgo-input deck-ui-agents-input deck-ui-agents-spaced-tight"
                              value=""
                              disabled={actionState !== "idle"}
                              onChange={(event) => addFallbackModel(event.target.value)}
                            >
                              <option value="">{tAgentDetail("panel.addRuntimeFallback")}</option>
                              {runtimeModelOptions
                                .filter(
                                  (option) =>
                                    option.ref !== agentConfigDraft.model &&
                                    !fallbackDraftList.includes(option.ref),
                                )
                                .map((option) => (
                                  <option key={option.ref} value={option.ref}>
                                    {option.label} ({option.provider})
                                  </option>
                                ))}
                            </select>
                          ) : null}
                          {fallbackDraftList.length > 0 ? (
                            <ul className="deckgo-shell-list deck-ui-agents-list deck-ui-agents-spaced-tight">
                              {fallbackDraftList.map((fallback, index) => (
                                <li key={`${fallback}:${index}`}>
                                  <div className="deckgo-selectable-card deck-ui-agents-row">
                                    <strong>
                                      #{index + 1} {fallback}
                                    </strong>
                                    <div className="deckgo-actions deck-ui-agents-actions deck-ui-agents-spaced-tight">
                                      <button
                                        className="deckgo-button deck-ui-agents-button"
                                        type="button"
                                        disabled={actionState !== "idle" || index === 0}
                                        onClick={() =>
                                          updateFallbackDraftList((fallbacks) => {
                                            const nextFallbacks = fallbacks.slice();
                                            [nextFallbacks[index - 1], nextFallbacks[index]] = [
                                              nextFallbacks[index],
                                              nextFallbacks[index - 1],
                                            ];
                                            return nextFallbacks;
                                          })
                                        }
                                      >
                                        {tAgentDetail("config.moveFallbackUp")}
                                      </button>
                                      <button
                                        className="deckgo-button deck-ui-agents-button"
                                        type="button"
                                        disabled={
                                          actionState !== "idle" ||
                                          index === fallbackDraftList.length - 1
                                        }
                                        onClick={() =>
                                          updateFallbackDraftList((fallbacks) => {
                                            const nextFallbacks = fallbacks.slice();
                                            [nextFallbacks[index], nextFallbacks[index + 1]] = [
                                              nextFallbacks[index + 1],
                                              nextFallbacks[index],
                                            ];
                                            return nextFallbacks;
                                          })
                                        }
                                      >
                                        {tAgentDetail("config.moveFallbackDown")}
                                      </button>
                                      <button
                                        className="deckgo-button deck-ui-agents-button is-danger"
                                        type="button"
                                        disabled={actionState !== "idle"}
                                        onClick={() =>
                                          updateFallbackDraftList((fallbacks) =>
                                            fallbacks.filter(
                                              (_, fallbackIndex) => fallbackIndex !== index,
                                            ),
                                          )
                                        }
                                      >
                                        {tAgentDetail("panel.removeFallback")}
                                      </button>
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="deckgo-note">{tAgentDetail("panel.noFallbackModels")}</p>
                          )}
                        </label>
                        <label>
                          <span className="deckgo-surface-label">
                            {tAgentDetail("panel.reasoningDefault")}
                          </span>
                          <select
                            className="deckgo-input deck-ui-agents-input"
                            value={agentConfigDraft.reasoningDefault}
                            disabled={actionState !== "idle"}
                            onChange={(event) =>
                              setAgentConfigDraft((current) => ({
                                ...current,
                                reasoningDefault: event.target.value as AgentReasoningMode,
                              }))
                            }
                          >
                            <option value="stream">
                              {tAgentDetail("config.reasoning_stream")}
                            </option>
                            <option value="on">{tAgentDetail("config.reasoning_on")}</option>
                            <option value="off">{tAgentDetail("config.reasoning_off")}</option>
                          </select>
                        </label>
                        <label>
                          <span className="deckgo-surface-label">
                            {tAgentDetail("panel.thinkingDefault")}
                          </span>
                          <select
                            className="deckgo-input deck-ui-agents-input"
                            value={agentConfigDraft.thinkingDefault}
                            disabled={actionState !== "idle"}
                            onChange={(event) =>
                              setAgentConfigDraft((current) => ({
                                ...current,
                                thinkingDefault: event.target.value,
                              }))
                            }
                          >
                            <option value="">{tAgentDetail("panel.inheritThinkingDefault")}</option>
                            {THINKING_LEVELS.map((level) => (
                              <option key={level} value={level}>
                                {tAgentDetail(`config.thinking_${level}`)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span className="deckgo-surface-label">
                            {tAgentDetail("panel.temperature")}
                          </span>
                          <input
                            className="deckgo-input deck-ui-agents-input"
                            value={agentConfigDraft.temperature}
                            disabled={actionState !== "idle"}
                            inputMode="decimal"
                            onChange={(event) =>
                              setAgentConfigDraft((current) => ({
                                ...current,
                                temperature: event.target.value,
                              }))
                            }
                            placeholder={tAgentDetail("panel.temperaturePlaceholder")}
                          />
                        </label>
                        <label>
                          <span className="deckgo-surface-label">
                            {tAgentDetail("panel.toolsProfile")}
                          </span>
                          <input
                            className="deckgo-input deck-ui-agents-input"
                            value={agentConfigDraft.toolsProfile}
                            disabled={actionState !== "idle"}
                            onChange={(event) =>
                              setAgentConfigDraft((current) => ({
                                ...current,
                                toolsProfile: event.target.value,
                              }))
                            }
                            placeholder={tAgentDetail("panel.toolsProfilePlaceholder")}
                          />
                          {(toolsCatalog?.profiles?.length ?? 0) > 0 ? (
                            <div
                              className="deckgo-actions deck-ui-agents-actions deck-ui-agents-spaced-tight"
                              role="radiogroup"
                              aria-label={tAgentDetail("panel.toolProfilePresets")}
                            >
                              {toolsCatalog?.profiles?.map((profile) => (
                                <button
                                  key={profile.id}
                                  className={`deckgo-button deck-ui-agents-button ${
                                    agentConfigDraft.toolsProfile === profile.id ? "is-primary" : ""
                                  }`}
                                  type="button"
                                  role="radio"
                                  aria-checked={agentConfigDraft.toolsProfile === profile.id}
                                  disabled={actionState !== "idle"}
                                  onClick={() =>
                                    setAgentConfigDraft((current) => ({
                                      ...current,
                                      toolsProfile: profile.id,
                                    }))
                                  }
                                >
                                  {profile.label || profile.id}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </label>
                        <label>
                          <span className="deckgo-surface-label">
                            {tAgentDetail("panel.allowedTools")}
                          </span>
                          <input
                            className="deckgo-input deck-ui-agents-input"
                            value={agentConfigDraft.toolsAllow}
                            disabled={actionState !== "idle"}
                            onChange={(event) =>
                              setAgentConfigDraft((current) => ({
                                ...current,
                                toolsAllow: event.target.value,
                              }))
                            }
                            placeholder={tAgentDetail("panel.allowedToolsPlaceholder")}
                          />
                        </label>
                        <label>
                          <span className="deckgo-surface-label">
                            {tAgentDetail("panel.deniedTools")}
                          </span>
                          <input
                            className="deckgo-input deck-ui-agents-input"
                            value={agentConfigDraft.toolsDeny}
                            disabled={actionState !== "idle"}
                            onChange={(event) =>
                              setAgentConfigDraft((current) => ({
                                ...current,
                                toolsDeny: event.target.value,
                              }))
                            }
                            placeholder={tAgentDetail("panel.deniedToolsPlaceholder")}
                          />
                        </label>
                        <label className="deckgo-checkbox-row">
                          <input
                            type="checkbox"
                            checked={agentConfigDraft.fastModeDefault}
                            disabled={actionState !== "idle"}
                            onChange={(event) => {
                              const checked = event.currentTarget.checked;
                              setAgentConfigDraft((current) => ({
                                ...current,
                                fastModeDefault: checked,
                              }));
                            }}
                          />
                          <span>{tAgentDetail("panel.fastModeDefault")}</span>
                        </label>
                      </div>
                      <div className="deckgo-actions deck-ui-agents-actions deck-ui-agents-spaced">
                        <button
                          className="deckgo-button deck-ui-agents-button"
                          type="button"
                          disabled={actionState !== "idle"}
                          onClick={() => void saveAgentRawConfig()}
                        >
                          {actionState === "agent-config"
                            ? tAgentDetail("panel.savingConfig")
                            : tAgentDetail("panel.saveAgentConfig")}
                        </button>
                        <button
                          className="deckgo-button deck-ui-agents-button"
                          type="button"
                          disabled={
                            actionState !== "idle" || resettableAgentConfigOverrideCount === 0
                          }
                          onClick={() => void resetAgentRawConfigOverrides()}
                        >
                          {tAgentDetail("panel.resetEditableOverrides")}
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="deckgo-note">{tAgentDetail("panel.loadingRawConfig")}</p>
                  )}
                  {agentConfigError ? <p className="deckgo-note">{agentConfigError}</p> : null}
                </div>
                <div
                  className="deckgo-surface-tile deck-ui-agents-surface"
                  hidden={activeAgentTab !== "config"}
                >
                  <p className="deckgo-surface-label">{tAgentDetail("eventStreams.title")}</p>
                  <p className="deckgo-note">{tAgentDetail("eventStreams.description")}</p>
                  {eventStreams?.isDefault ? (
                    <p className="deckgo-note">{tAgentDetail("eventStreams.usingDefault")}</p>
                  ) : null}
                  <div className="deckgo-pill-row deck-ui-agents-pill-row">
                    <span className="deckgo-pill is-positive">
                      {tAgentDetail("eventStreams.locked")}
                    </span>
                    {(eventStreams?.eventStreams ?? []).map((stream) => (
                      <span key={stream} className="deckgo-pill">
                        {stream}
                      </span>
                    ))}
                  </div>
                  {eventStreams ? (
                    <div className="deckgo-grid deckgo-grid-2 deck-ui-agents-grid deck-ui-agents-spaced">
                      {EVENT_STREAMS.map((stream) => (
                        <label key={stream} className="deckgo-checkbox-row">
                          <input
                            type="checkbox"
                            checked={eventStreams.eventStreams.includes(stream)}
                            disabled={actionState !== "idle"}
                            onChange={(event) =>
                              void toggleEventStream(stream, event.currentTarget.checked)
                            }
                          />
                          <span>{tAgentDetail(`config.eventStream_${stream}`)}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="deckgo-note">{tAgentDetail("eventStreams.loading")}</p>
                  )}
                  {eventStreamsError ? <p className="deckgo-note">{eventStreamsError}</p> : null}
                </div>
                <div
                  className="deckgo-surface-tile deck-ui-agents-surface"
                  data-agent-editor="skill-config"
                  hidden={activeAgentTab !== "skills"}
                >
                  <p className="deckgo-surface-label">{tAgentDetail("skillsEditor.title")}</p>
                  <p className="deckgo-note">{tAgentDetail("skillsEditor.description")}</p>
                  {skillsConfig ? (
                    <>
                      <div className="deckgo-grid deckgo-grid-3 deck-ui-agents-grid">
                        <ShellStat
                          label={tAgentDetail("skillsEditor.mode")}
                          value={agentSkillMode}
                        />
                        <ShellStat
                          label={tAgentDetail("skillsEditor.assigned")}
                          value={agentSkillKeys.length}
                        />
                        <ShellStat
                          label={tAgentDetail("skillsEditor.available")}
                          value={skillsConfig.available.length}
                        />
                      </div>
                      <div className="deckgo-grid deckgo-grid-2 deck-ui-agents-grid deck-ui-agents-spaced">
                        <label>
                          <span className="deckgo-surface-label">
                            {tAgentDetail("skillsEditor.modeLabel")}
                          </span>
                          <select
                            className="deckgo-input deck-ui-agents-input"
                            value={agentSkillMode}
                            disabled={actionState !== "idle"}
                            onChange={(event) =>
                              setAgentSkillMode(event.target.value as AgentSkillMode)
                            }
                          >
                            <option value="all">{tAgentDetail("skillModeAll")}</option>
                            <option value="whitelist">{tAgentDetail("skillModeWhitelist")}</option>
                          </select>
                        </label>
                      </div>
                      <div className="deckgo-grid deckgo-grid-2 deck-ui-agents-grid deck-ui-agents-spaced">
                        {skillsConfig.available.map((skill) => (
                          <label key={skill.key} className="deckgo-checkbox-row">
                            <input
                              type="checkbox"
                              checked={agentSkillKeys.includes(skill.key)}
                              disabled={actionState !== "idle" || agentSkillMode !== "whitelist"}
                              onChange={(event) =>
                                toggleAgentSkill(skill.key, event.currentTarget.checked)
                              }
                            />
                            <span>
                              {skill.name || skill.key}
                              {skill.eligible
                                ? ""
                                : ` (${tAgentDetail("skillsEditor.notEligible")})`}
                            </span>
                          </label>
                        ))}
                      </div>
                      <div className="deckgo-actions deck-ui-agents-actions deck-ui-agents-spaced">
                        <button
                          className="deckgo-button deck-ui-agents-button"
                          type="button"
                          disabled={actionState !== "idle"}
                          onClick={() => void saveSkillsConfig()}
                        >
                          {actionState === "skills"
                            ? tAgentDetail("skillsEditor.savingAgentSkills")
                            : tAgentDetail("skillsEditor.saveAgentSkills")}
                        </button>
                      </div>
                      <div className="deckgo-grid deckgo-grid-2 deck-ui-agents-grid deck-ui-agents-spaced">
                        <div data-agent-editor="skill-install-dialog">
                          <p className="deckgo-surface-label">
                            {tAgentDetail("skillsEditor.installTitle")}
                          </p>
                          <p className="deckgo-note">
                            {tAgentDetail("skillsEditor.installDescription")}
                          </p>
                          {skillInstallOptions.length > 0 ? (
                            <div className="deckgo-actions deck-ui-agents-actions deck-ui-agents-spaced">
                              {skillInstallOptions.map(({ skill, option }) => (
                                <button
                                  className="deckgo-button deck-ui-agents-button"
                                  key={`${skill.key}-${option.id}`}
                                  type="button"
                                  disabled={actionState !== "idle"}
                                  onClick={() => void installSkillOption(skill, option.id)}
                                >
                                  {actionState === "skill-install"
                                    ? tAgentDetail("installing")
                                    : `${skill.name}: ${option.label}`}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="deckgo-note">
                              {skillInventory.length === 0
                                ? tAgentDetail("skillsEditor.loadingInventory")
                                : tAgentDetail("skillsEditor.noInstallOptions")}
                            </p>
                          )}
                        </div>
                        <div data-agent-editor="skill-config-editor">
                          <p className="deckgo-surface-label">
                            {tAgentDetail("skillsEditor.configTitle")}
                          </p>
                          <p className="deckgo-note">
                            {tAgentDetail("skillsEditor.configDescription")}
                          </p>
                          {selectedSkillConfig ? (
                            <>
                              <label>
                                <span className="deckgo-surface-label">
                                  {tAgentDetail("skillsEditor.selectSkill")}
                                </span>
                                <select
                                  className="deckgo-input deck-ui-agents-input"
                                  value={selectedSkillConfig.key}
                                  disabled={actionState !== "idle"}
                                  onChange={(event) =>
                                    setSelectedSkillConfigKey(event.target.value)
                                  }
                                >
                                  {skillInventory.map((skill) => (
                                    <option key={skill.key} value={skill.key}>
                                      {skill.name || skill.key}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <div className="deckgo-grid deckgo-grid-3 deck-ui-agents-grid deck-ui-agents-spaced">
                                <ShellStat
                                  label={tAgentDetail("skillsEditor.status")}
                                  value={selectedSkillConfig.status}
                                />
                                <ShellStat
                                  label={tAgentDetail("skillsEditor.source")}
                                  value={selectedSkillConfig.source}
                                />
                                <ShellStat
                                  label={tAgentDetail("skillsEditor.enabled")}
                                  value={
                                    selectedSkillConfig.enabled
                                      ? tAgentDetail("panel.enabled")
                                      : tAgentDetail("panel.disabled")
                                  }
                                />
                              </div>
                              <label>
                                <span className="deckgo-surface-label">
                                  {tAgentDetail("skillApiKey")}
                                </span>
                                <input
                                  className="deckgo-input deck-ui-agents-input"
                                  type="password"
                                  value={skillApiKeyDraft}
                                  disabled={actionState !== "idle"}
                                  placeholder={tAgentDetail("skillApiKeyPlaceholder")}
                                  onChange={(event) => setSkillApiKeyDraft(event.target.value)}
                                />
                              </label>
                              <div className="deck-ui-agents-spaced">
                                <div className="deckgo-actions deck-ui-agents-actions">
                                  <span className="deckgo-surface-label">
                                    {tAgentDetail("skillEnvVars")}
                                  </span>
                                  <button
                                    className="deckgo-button deck-ui-agents-button"
                                    type="button"
                                    disabled={actionState !== "idle"}
                                    onClick={addSkillEnvPair}
                                  >
                                    {tAgentDetail("addEnvVar")}
                                  </button>
                                </div>
                                {skillEnvPairs.length > 0 ? (
                                  <div className="deckgo-grid deckgo-grid-2 deck-ui-agents-grid">
                                    {skillEnvPairs.map((pair, index) => (
                                      <div
                                        className="deckgo-actions deck-ui-agents-actions"
                                        key={`${pair.key}-${index}`}
                                      >
                                        <input
                                          className="deckgo-input deck-ui-agents-input"
                                          value={pair.key}
                                          disabled={actionState !== "idle"}
                                          placeholder={tAgentDetail("skillEnvKey")}
                                          onChange={(event) =>
                                            updateSkillEnvPair(index, "key", event.target.value)
                                          }
                                        />
                                        <input
                                          className="deckgo-input deck-ui-agents-input"
                                          value={pair.value}
                                          disabled={actionState !== "idle"}
                                          placeholder={tAgentDetail("skillEnvValue")}
                                          onChange={(event) =>
                                            updateSkillEnvPair(index, "value", event.target.value)
                                          }
                                        />
                                        <button
                                          className="deckgo-button deck-ui-agents-button"
                                          type="button"
                                          disabled={actionState !== "idle"}
                                          onClick={() => removeSkillEnvPair(index)}
                                        >
                                          {tAgentDetail("config.removeFallback")}
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="deckgo-note">
                                    {tAgentDetail("skillsEditor.noEnvVars")}
                                  </p>
                                )}
                              </div>
                              <div className="deckgo-actions deck-ui-agents-actions deck-ui-agents-spaced">
                                <button
                                  className="deckgo-button is-primary deck-ui-agents-button"
                                  type="button"
                                  disabled={actionState !== "idle"}
                                  onClick={() => void saveSkillConfig()}
                                >
                                  {actionState === "skill-config"
                                    ? tAgentDetail("skillsEditor.savingConfig")
                                    : tAgentDetail("skillsEditor.saveConfig")}
                                </button>
                              </div>
                            </>
                          ) : (
                            <p className="deckgo-note">
                              {tAgentDetail("skillsEditor.loadingInventory")}
                            </p>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="deckgo-note">{tAgentDetail("skillsEditor.loadingPolicy")}</p>
                  )}
                  {skillsConfigError ? <p className="deckgo-note">{skillsConfigError}</p> : null}
                  {skillInventoryError ? (
                    <p className="deckgo-note">{skillInventoryError}</p>
                  ) : null}
                </div>
                <div
                  className="deckgo-surface-tile deck-ui-agents-surface"
                  hidden={activeAgentTab !== "subagent"}
                >
                  <p className="deckgo-surface-label">{tAgentDetail("panel.subagentSpawning")}</p>
                  <p className="deckgo-note">{tAgentDetail("panel.subagentDescription")}</p>
                  {subagentConfig ? (
                    <>
                      <div className="deckgo-grid deckgo-grid-3 deck-ui-agents-grid">
                        <ShellStat
                          label="max depth"
                          value={subagentConfig.effectiveMaxSpawnDepth ?? "n/a"}
                        />
                        <ShellStat
                          label="max children"
                          value={subagentConfig.effectiveMaxChildrenPerAgent ?? "n/a"}
                        />
                        <ShellStat
                          label="allowed"
                          value={subagentConfig.allowAny ? "any" : subagentAllowAgents.length}
                        />
                      </div>
                      <div className="deckgo-grid deckgo-grid-2 deck-ui-agents-grid deck-ui-agents-spaced">
                        <label>
                          <span className="deckgo-surface-label">
                            {tAgentDetail("spawnPermission")}
                          </span>
                          <select
                            className="deckgo-input deck-ui-agents-input"
                            value={subagentAllowMode}
                            disabled={actionState !== "idle"}
                            onChange={(event) =>
                              setSubagentAllowMode(event.target.value as SubagentAllowMode)
                            }
                          >
                            <option value="none">{tAgentDetail("spawnNone")}</option>
                            <option value="list">{tAgentDetail("spawnList")}</option>
                            <option value="any">{tAgentDetail("spawnAny")}</option>
                          </select>
                        </label>
                        <label>
                          <span className="deckgo-surface-label">
                            {tAgentDetail("modelOverride")}
                          </span>
                          <input
                            className="deckgo-input deck-ui-agents-input"
                            value={subagentModel}
                            disabled={actionState !== "idle"}
                            onChange={(event) => setSubagentModel(event.target.value)}
                            placeholder={tAgentDetail("panel.subagentModelPlaceholder")}
                          />
                          {runtimeModelOptions.length > 0 ? (
                            <select
                              aria-label={tAgentDetail("panel.subagentModelPreset")}
                              className="deckgo-input deck-ui-agents-input deck-ui-agents-spaced-tight"
                              value={
                                runtimeModelOptions.some((option) => option.ref === subagentModel)
                                  ? subagentModel
                                  : ""
                              }
                              disabled={actionState !== "idle"}
                              onChange={(event) => setSubagentModel(event.target.value)}
                            >
                              <option value="">{tAgentDetail("panel.selectRuntimeModel")}</option>
                              {runtimeModelOptions.map((option) => (
                                <option key={option.ref} value={option.ref}>
                                  {option.label} ({option.provider})
                                </option>
                              ))}
                            </select>
                          ) : null}
                        </label>
                      </div>
                      {subagentAllowMode === "list" ? (
                        <div className="deckgo-grid deckgo-grid-2 deck-ui-agents-grid deck-ui-agents-spaced">
                          {(subagentConfig.allAgents ?? [])
                            .filter((agent) => agent.id !== detail.id)
                            .map((agent) => (
                              <label key={agent.id} className="deckgo-checkbox-row">
                                <input
                                  type="checkbox"
                                  checked={subagentAllowAgents.includes(agent.id)}
                                  disabled={actionState !== "idle"}
                                  onChange={(event) =>
                                    toggleSubagentAgent(agent.id, event.currentTarget.checked)
                                  }
                                />
                                <span>{agent.name || agent.id}</span>
                              </label>
                            ))}
                        </div>
                      ) : null}
                      <div className="deckgo-actions deck-ui-agents-actions deck-ui-agents-spaced">
                        <button
                          className="deckgo-button deck-ui-agents-button"
                          type="button"
                          disabled={actionState !== "idle"}
                          onClick={() => void saveSubagentConfig()}
                        >
                          {actionState === "subagents"
                            ? tAgentDetail("panel.savingSubagents")
                            : tAgentDetail("panel.saveSubagents")}
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="deckgo-note">{tAgentDetail("panel.loadingSubagentPolicy")}</p>
                  )}
                  {subagentConfigError ? (
                    <p className="deckgo-note">{subagentConfigError}</p>
                  ) : null}
                </div>
                <div
                  className="deckgo-surface-tile deck-ui-agents-surface"
                  hidden={activeAgentTab !== "subagent"}
                >
                  <p className="deckgo-surface-label">{tAgentDetail("panel.subagentRuns")}</p>
                  <p className="deckgo-note">{tAgentDetail("panel.subagentRunsDescription")}</p>
                  <div className="deckgo-grid deckgo-grid-2 deck-ui-agents-grid">
                    <ShellStat label="active runs" value={agentSubagentRuns.length} />
                    <ShellStat
                      label="max depth"
                      value={subagentConfig?.effectiveMaxSpawnDepth ?? "n/a"}
                    />
                  </div>
                  <div className="deckgo-actions deck-ui-agents-actions deck-ui-agents-spaced">
                    <button
                      className="deckgo-button deck-ui-agents-button"
                      type="button"
                      onClick={() => navigateToPanel(ui, "subagents")}
                    >
                      {tAgentDetail("panel.openSubagentsPanel")}
                    </button>
                  </div>
                  {agentSubagentRuns.length > 0 ? (
                    <ul className="deckgo-shell-list deck-ui-agents-list deck-ui-agents-spaced">
                      {agentSubagentRuns.slice(0, 6).map((run) => (
                        <li key={run.runId}>
                          <div className="deckgo-selectable-card deck-ui-agents-row">
                            <strong>{run.childAgentName || run.childAgentId}</strong>
                            <div className="deckgo-meta">
                              run: {run.runId} | status: {run.status} | depth: {run.depth}
                            </div>
                            <div className="deckgo-meta">
                              session: {run.childSessionKey} | mode: {run.spawnMode}
                            </div>
                            {run.task ? <div className="deckgo-meta">{run.task}</div> : null}
                            <div className="deckgo-actions deck-ui-agents-actions deck-ui-agents-spaced-tight">
                              <button
                                className="deckgo-button deck-ui-agents-button"
                                type="button"
                                disabled={!run.childAgentId}
                                onClick={() => navigateToAgent(ui, run.childAgentId, "subagents")}
                              >
                                {tAgentDetail("panel.openChildAgent")}
                              </button>
                              <button
                                className="deckgo-button deck-ui-agents-button"
                                type="button"
                                disabled={!run.childSessionKey}
                                onClick={() => navigateToSession(ui, run.childSessionKey ?? "")}
                              >
                                {tAgentDetail("panel.openChildSession")}
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="deckgo-note">{tAgentDetail("panel.noActiveSubagentRuns")}</p>
                  )}
                  {agentSubagentRunsError ? (
                    <p className="deckgo-note">{agentSubagentRunsError}</p>
                  ) : null}
                </div>
                <div
                  className="deckgo-surface-tile deck-ui-agents-surface"
                  data-agent-editor="tools-editor"
                  hidden={
                    activeAgentTab !== "tools" &&
                    activeAgentTab !== "context" &&
                    activeAgentTab !== "sessions"
                  }
                >
                  <p className="deckgo-surface-label">{tAgentDetail("panel.effectivePreviews")}</p>
                  <p className="deckgo-note">
                    {tAgentDetail("panel.effectivePreviewsDescription")}
                  </p>
                  {toolPolicyPreview || systemPromptPreview ? (
                    <>
                      <div className="deckgo-grid deckgo-grid-3 deck-ui-agents-grid">
                        <ShellStat
                          label="policy layers"
                          value={toolPolicyPreview?.layers?.length ?? 0}
                        />
                        <ShellStat
                          label="allowed tools"
                          value={`${allowedToolCount}/${toolPolicyPreview?.tools?.length ?? 0}`}
                        />
                        <ShellStat
                          label="prompt chars"
                          value={systemPromptPreview?.totalChars ?? 0}
                        />
                      </div>
                      {toolsCatalog ? (
                        <div
                          className="deckgo-surface-tile deck-ui-agents-surface deck-ui-agents-spaced"
                          data-agent-editor="tool-policy-trace"
                          hidden={activeAgentTab !== "tools"}
                        >
                          <p className="deckgo-surface-label">
                            {tAgentDetail("panel.toolsCatalog")}
                          </p>
                          <div className="deckgo-grid deckgo-grid-3 deck-ui-agents-grid">
                            <ShellStat label="groups" value={toolsCatalog.groups.length} />
                            <ShellStat label="tools" value={catalogToolCount} />
                            <ShellStat
                              label="profiles"
                              value={toolsCatalog.profiles?.length ?? 0}
                            />
                          </div>
                          <div className="deckgo-pill-row deck-ui-agents-pill-row deck-ui-agents-spaced">
                            {toolsCatalog.groups.slice(0, 6).map((group) => (
                              <span key={group.id} className="deckgo-pill">
                                {group.label}: {group.tools.length}
                              </span>
                            ))}
                          </div>
                          <p className="deckgo-note deck-ui-agents-spaced">
                            {tAgentDetail("panel.toolsCatalogDescription")}
                          </p>
                          <ul className="deckgo-shell-list deck-ui-agents-list deck-ui-agents-spaced">
                            {toolsCatalog.groups
                              .flatMap((group) =>
                                group.tools.map((tool) => ({
                                  ...tool,
                                  groupLabel: group.label,
                                })),
                              )
                              .slice(0, 12)
                              .map((tool) => (
                                <li key={tool.id}>
                                  <div className="deckgo-selectable-card deck-ui-agents-row">
                                    <strong>{tool.label || tool.id}</strong>
                                    <div className="deckgo-meta">
                                      id: {tool.id} | group: {tool.groupLabel}
                                    </div>
                                    <select
                                      aria-label={`Tool override ${tool.id}`}
                                      className="deckgo-input deck-ui-agents-input deck-ui-agents-spaced-tight"
                                      value={readToolOverrideState(
                                        tool.id,
                                        agentConfigDraft.toolsAllow,
                                        agentConfigDraft.toolsDeny,
                                      )}
                                      disabled={actionState !== "idle"}
                                      onChange={(event) => {
                                        const nextState = event.target.value as ToolOverrideState;
                                        setAgentConfigDraft((current) =>
                                          applyToolOverrideState(current, tool.id, nextState),
                                        );
                                      }}
                                    >
                                      <option value="default">
                                        {tAgentDetail("config.toolDefault")}
                                      </option>
                                      <option value="allow">
                                        {tAgentDetail("config.toolAllow")}
                                      </option>
                                      <option value="deny">
                                        {tAgentDetail("config.toolDeny")}
                                      </option>
                                    </select>
                                  </div>
                                </li>
                              ))}
                          </ul>
                        </div>
                      ) : null}
                      <div
                        className="deckgo-surface-tile deck-ui-agents-surface deck-ui-agents-spaced"
                        hidden={activeAgentTab !== "tools"}
                      >
                        <p className="deckgo-surface-label">
                          {tAgentDetail("panel.sessionEffectiveTools")}
                        </p>
                        {effectiveToolSessions.length > 0 ? (
                          <>
                            <div className="deckgo-grid deckgo-grid-3 deck-ui-agents-grid">
                              <ShellStat label="sessions" value={effectiveToolSessions.length} />
                              <ShellStat label="profile" value={effectiveTools?.profile ?? "n/a"} />
                              <ShellStat label="tools" value={effectiveToolCount} />
                            </div>
                            <label className="deck-ui-agents-label deck-ui-agents-spaced">
                              <span className="deckgo-surface-label">
                                {tAgentDetail("panel.session")}
                              </span>
                              <select
                                className="deckgo-input deck-ui-agents-input"
                                value={effectiveToolsSessionKey}
                                onChange={(event) =>
                                  void selectEffectiveToolsSession(event.target.value)
                                }
                              >
                                {effectiveToolSessions.map((session) => (
                                  <option key={session.key} value={session.key}>
                                    {session.title || session.key}
                                  </option>
                                ))}
                              </select>
                            </label>
                            {(effectiveTools?.groups.length ?? 0) > 0 ? (
                              <div className="deckgo-pill-row deck-ui-agents-pill-row deck-ui-agents-spaced">
                                {effectiveTools?.groups.slice(0, 6).map((group, index) => (
                                  <span
                                    key={group.id || group.name || index}
                                    className="deckgo-pill"
                                  >
                                    {group.label || group.name || group.id || "tools"}:{" "}
                                    {group.tools.length}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="deckgo-note">
                                {tAgentDetail("panel.noEffectiveTools")}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="deckgo-note">
                            {tAgentDetail("panel.noEffectiveToolSessions")}
                          </p>
                        )}
                        {effectiveToolsError ? (
                          <p className="deckgo-note">{effectiveToolsError}</p>
                        ) : null}
                      </div>
                      <div
                        className="deckgo-surface-tile deck-ui-agents-surface deck-ui-agents-spaced"
                        hidden={activeAgentTab !== "sessions"}
                      >
                        <p className="deckgo-surface-label">
                          {tAgentDetail("panel.recentSessions")}
                        </p>
                        {effectiveToolSessions.length > 0 ? (
                          <>
                            <div className="deckgo-grid deckgo-grid-2 deck-ui-agents-grid">
                              <label>
                                <span className="deckgo-surface-label">
                                  {tAgentDetail("panel.sessionType")}
                                </span>
                                <select
                                  aria-label={tAgentDetail("panel.agentSessionFilter")}
                                  className="deckgo-input deck-ui-agents-input"
                                  value={agentSessionFilter}
                                  onChange={(event) =>
                                    setAgentSessionFilter(event.target.value as AgentSessionFilter)
                                  }
                                >
                                  {AGENT_SESSION_FILTERS.map((filter) => (
                                    <option key={filter} value={filter}>
                                      {filter}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <ShellStat
                                label="visible"
                                value={`${filteredAgentSessions.length}/${effectiveToolSessions.length}`}
                              />
                            </div>
                            {filteredAgentSessions.length > 0 ? (
                              <ul className="deckgo-shell-list deck-ui-agents-list deck-ui-agents-spaced">
                                {filteredAgentSessions.slice(0, 6).map((session) => {
                                  const subagent = isSubagentSession(session);
                                  const depth = subagent ? extractSubagentDepth(session) : null;
                                  const parentAgent = subagent ? extractParentAgent(session) : null;
                                  return (
                                    <li key={session.key}>
                                      <div className="deckgo-selectable-card deck-ui-agents-row">
                                        <strong>{session.title || session.key}</strong>
                                        <div className="deckgo-meta">
                                          key: {session.key} | kind: {readSessionKind(session)} |
                                          status: {session.status || "unknown"}
                                        </div>
                                        <div className="deckgo-meta">
                                          model: {session.model || "n/a"} | updated:{" "}
                                          {formatSessionUpdatedAt(session.updatedAt)}
                                        </div>
                                        {subagent ? (
                                          <div className="deckgo-meta">
                                            subagent
                                            {depth !== null ? ` | depth ${depth}` : ""}
                                            {parentAgent ? ` | parent ${parentAgent}` : ""}
                                          </div>
                                        ) : null}
                                        <div className="deckgo-actions deck-ui-agents-actions deck-ui-agents-spaced-tight">
                                          <button
                                            className="deckgo-button deck-ui-agents-button"
                                            type="button"
                                            onClick={() => navigateToSession(ui, session.key)}
                                          >
                                            {tAgentDetail("panel.openSession")}
                                          </button>
                                        </div>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              <p className="deckgo-note">
                                {tAgentDetail("panel.noRecentSessionsMatch")}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="deckgo-note">{tAgentDetail("panel.noRecentSessions")}</p>
                        )}
                      </div>
                      {(toolPolicyPreview?.layers?.length ?? 0) > 0 ? (
                        <div
                          className="deckgo-pill-row deck-ui-agents-pill-row deck-ui-agents-spaced"
                          hidden={activeAgentTab !== "tools"}
                        >
                          {toolPolicyPreview?.layers?.slice(0, 6).map((layer) => (
                            <span key={layer.label} className="deckgo-pill">
                              {layer.label}: {layer.effect}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {toolPolicyPreview ? (
                        <div
                          className="deckgo-surface-tile deck-ui-agents-surface deck-ui-agents-spaced"
                          hidden={activeAgentTab !== "tools"}
                        >
                          <p className="deckgo-surface-label">
                            {tAgentDetail("panel.toolPolicyTrace")}
                          </p>
                          <input
                            className="deckgo-input deck-ui-agents-input"
                            value={toolPolicySearch}
                            onChange={(event) => setToolPolicySearch(event.target.value)}
                            placeholder={tAgentDetail("panel.searchToolsPlaceholder")}
                          />
                          <ul className="deckgo-shell-list deck-ui-agents-list deck-ui-agents-spaced">
                            {filteredPolicyTools.slice(0, 12).map((tool) => (
                              <li key={tool.name}>
                                <button
                                  type="button"
                                  className="deckgo-selectable-card deck-ui-agents-row"
                                  onClick={() =>
                                    setExpandedToolName(
                                      expandedToolName === tool.name ? "" : tool.name,
                                    )
                                  }
                                >
                                  <strong>{tool.name}</strong>
                                  <div className="deckgo-meta">
                                    {tool.allowed ? "allowed" : "denied"} | decisive layer:{" "}
                                    {tool.decisiveLayer || "n/a"}
                                  </div>
                                  {expandedToolName === tool.name ? (
                                    <div className="deckgo-meta">
                                      {(tool.trace ?? []).length > 0
                                        ? tool.trace
                                            ?.map((entry) => `${entry.layer} -> ${entry.decision}`)
                                            .join(" | ")
                                        : tAgentDetail("panel.noTraceEntries")}
                                    </div>
                                  ) : null}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {(systemPromptPreview?.bootstrapFiles?.length ?? 0) > 0 ? (
                        <ul
                          className="deckgo-shell-list deck-ui-agents-list deck-ui-agents-spaced"
                          data-agent-editor="prompt-preview"
                          hidden={activeAgentTab !== "context"}
                        >
                          {systemPromptPreview?.bootstrapFiles?.slice(0, 4).map((file) => (
                            <li key={file.name}>
                              <button
                                type="button"
                                className="deckgo-selectable-card deck-ui-agents-row"
                                disabled={actionState !== "idle"}
                                onClick={() => void openBootstrapFile(file.name, file.exists)}
                              >
                                <strong>{file.name}</strong>
                                <div className="deckgo-meta">
                                  {file.exists ? "present" : "missing"} | {file.charCount} chars
                                </div>
                                <div className="deckgo-meta">
                                  {file.exists
                                    ? tAgentDetail("panel.editBootstrapFile")
                                    : tAgentDetail("panel.createBootstrapFile")}
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {bootstrapFileName ? (
                        <div
                          className="deckgo-surface-tile deck-ui-agents-surface deck-ui-agents-spaced"
                          data-agent-editor="bootstrap-file-editor"
                          hidden={activeAgentTab !== "context"}
                        >
                          <p className="deckgo-surface-label">
                            Bootstrap file: {bootstrapFileName}
                          </p>
                          <p className="deckgo-note">
                            {bootstrapFile?.missing
                              ? tAgentDetail("panel.bootstrapMissing")
                              : tAgentDetail("panel.bootstrapBytesLoaded", {
                                  bytes: bootstrapFile?.size ?? bootstrapFileDraft.length,
                                })}
                          </p>
                          <div className="deckgo-actions deck-ui-agents-actions deck-ui-agents-actions-bottom">
                            {PROMPT_VARIABLE_KEYS.map((key) => (
                              <button
                                key={key}
                                className="deckgo-button deck-ui-agents-button"
                                type="button"
                                disabled={actionState !== "idle"}
                                onClick={() => insertBootstrapVariable(key)}
                              >
                                {`{{${key}}}`}
                              </button>
                            ))}
                          </div>
                          <textarea
                            ref={bootstrapEditorRef}
                            className="deckgo-textarea deck-ui-agents-textarea"
                            rows={8}
                            value={bootstrapFileDraft}
                            disabled={actionState === "bootstrap-file"}
                            onChange={(event) => setBootstrapFileDraft(event.target.value)}
                            placeholder={tAgentDetail("panel.bootstrapPromptPlaceholder")}
                          />
                          <div className="deckgo-actions deck-ui-agents-actions deck-ui-agents-spaced">
                            <button
                              className="deckgo-button deck-ui-agents-button is-primary"
                              type="button"
                              disabled={actionState !== "idle"}
                              onClick={() => void saveBootstrapFile()}
                            >
                              {actionState === "bootstrap-file"
                                ? tAgentDetail("panel.savingBootstrapFile")
                                : tAgentDetail("panel.saveBootstrapFile")}
                            </button>
                            <button
                              className="deckgo-button deck-ui-agents-button"
                              type="button"
                              disabled={actionState !== "idle"}
                              onClick={closeBootstrapFile}
                            >
                              {tAgentDetail("panel.closeFile")}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="deckgo-note">{tAgentDetail("panel.loadingEffectivePreviews")}</p>
                  )}
                  {previewError ? <p className="deckgo-note">{previewError}</p> : null}
                  {toolsCatalogError ? <p className="deckgo-note">{toolsCatalogError}</p> : null}
                  {bootstrapFileError ? <p className="deckgo-note">{bootstrapFileError}</p> : null}
                </div>
                <div
                  className="deckgo-surface-tile deck-ui-agents-surface"
                  data-agent-editor="files-browser"
                  hidden={activeAgentTab !== "context"}
                >
                  <p className="deckgo-surface-label">{tAgentDetail("panel.agentFiles")}</p>
                  <p className="deckgo-note">{tAgentDetail("panel.agentFilesDescription")}</p>
                  <div className="deckgo-grid deckgo-grid-2 deck-ui-agents-grid">
                    <ShellStat label="files" value={agentFiles.length} />
                    <ShellStat
                      label="missing"
                      value={agentFiles.filter((file) => file.missing).length}
                    />
                  </div>
                  {agentFiles.length > 0 ? (
                    <ul className="deckgo-shell-list deck-ui-agents-list deck-ui-agents-spaced">
                      {agentFiles.slice(0, 8).map((file) => (
                        <li key={file.name}>
                          <button
                            type="button"
                            className="deckgo-selectable-card deck-ui-agents-row"
                            disabled={actionState !== "idle"}
                            onClick={() => void openBootstrapFile(file.name, !file.missing)}
                          >
                            <strong>{file.name}</strong>
                            <div className="deckgo-meta">
                              {file.missing ? "missing" : "present"} |{" "}
                              {file.size == null ? "unknown size" : `${file.size} bytes`}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="deckgo-note">{tAgentDetail("panel.noAgentFiles")}</p>
                  )}
                  {agentFilesError ? <p className="deckgo-note">{agentFilesError}</p> : null}
                </div>
                <div
                  className="deckgo-surface-tile deck-ui-agents-surface"
                  hidden={activeAgentTab !== "overview"}
                >
                  <p className="deckgo-surface-label">{tAgentDetail("panel.renameOrRemove")}</p>
                  <div className="deckgo-actions deck-ui-agents-actions">
                    <input
                      className="deckgo-input deck-ui-agents-input"
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      placeholder={tAgentDetail("panel.agentNamePlaceholder")}
                    />
                    <button
                      className="deckgo-button deck-ui-agents-button"
                      type="button"
                      onClick={() => void renameAction()}
                      disabled={actionState !== "idle"}
                    >
                      {actionState === "renaming"
                        ? tAgentDetail("panel.renaming")
                        : tAgentDetail("panel.rename")}
                    </button>
                    <button
                      className="deckgo-button deck-ui-agents-button is-danger"
                      type="button"
                      onClick={() => void deleteAction()}
                      disabled={actionState !== "idle" || detail.isDefault}
                    >
                      {actionState === "deleting"
                        ? tAgentDetail("panel.deleting")
                        : tAgentDetail("panel.delete")}
                    </button>
                  </div>
                </div>
                <JsonDetails title={tAgentDetail("panel.detailPayload")} payload={detail} />
              </>
            ) : (
              <p className="deckgo-note">{tAgentDetail("panel.chooseAgentToInspect")}</p>
            )}
            {runtimeModelsError ? <p className="deckgo-note">{runtimeModelsError}</p> : null}
            {actionResult ? <JsonDetails title="Last agent action" payload={actionResult} /> : null}
          </div>
        </article>
      </AgentDetailBoundary>
    </section>
  );
}
