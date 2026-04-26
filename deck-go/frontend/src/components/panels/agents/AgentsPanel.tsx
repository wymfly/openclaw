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
  fetchSessions,
  fetchSubagentRuns,
  fetchToolsCatalog,
  removeRoutingBinding,
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
import { computeConfigDiff } from "../../../lib/config-diff";
import { JsonDetails, ShellStat } from "../../shared/ShellComponents";
import { buildAgentBatchExportText, summarizeAgents } from "./agent-batch-actions";
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
type RuntimeModelOption = {
  ref: string;
  label: string;
  provider: string;
};
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

function normalizeAgentSkillMode(mode: string | undefined): AgentSkillMode {
  return mode === "whitelist" ? "whitelist" : "all";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
  const [navigationTarget] = useState(readAgentNavigationTarget);
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
  >("idle");
  const [error, setError] = useState("");
  const [eventStreamsError, setEventStreamsError] = useState("");
  const [agentConfigError, setAgentConfigError] = useState("");
  const [skillsConfigError, setSkillsConfigError] = useState("");
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
  const agentBatchSummary = summarizeAgents(agents);
  const agentBatchExportText = buildAgentBatchExportText(agents);

  const selectAgent = async (agentId: string) => {
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
    if (!window.confirm(`Delete agent ${selectedAgent.id}?`)) {
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
      <div className="deckgo-column deck-ui-agents-column">
        <article className="deckgo-card is-float deck-ui-agents-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Agents</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Agent inventory uses list, create, rename, delete, and detail routes.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-agents-body">
            <div className="deckgo-pill-row deck-ui-agents-pill-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Agents {loadState}
              </span>
              <span className="deckgo-pill">{agents.length} loaded</span>
              <span className="deckgo-pill">default {defaultAgentId || "n/a"}</span>
            </div>
            <div className="deckgo-grid deckgo-grid-3 deck-ui-agents-grid">
              <ShellStat label="agents" value={agents.length} />
              <ShellStat label="default" value={defaultAgentId || "n/a"} />
              <ShellStat label="selected" value={selectedAgent?.id || "n/a"} />
            </div>
            <div className="deckgo-surface-tile deck-ui-agents-surface">
              <p className="deckgo-surface-label">Agent batch summary</p>
              <div className="deckgo-grid deckgo-grid-3 deck-ui-agents-grid">
                <ShellStat label="total" value={agentBatchSummary.total} />
                <ShellStat
                  label="statuses"
                  value={Object.keys(agentBatchSummary.byStatus).length}
                />
                <ShellStat label="models" value={Object.keys(agentBatchSummary.byModel).length} />
              </div>
              <pre className="deckgo-code" aria-label="Agent batch export">
                {agentBatchExportText}
              </pre>
            </div>
            <div className="deckgo-surface-tile deck-ui-agents-surface">
              <p className="deckgo-surface-label">Create agent</p>
              <div className="deckgo-grid deckgo-grid-2 deck-ui-agents-grid">
                <input
                  className="deckgo-input deck-ui-agents-input"
                  value={createDraft.name}
                  onChange={(event) =>
                    setCreateDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="agent name"
                />
                <input
                  className="deckgo-input deck-ui-agents-input"
                  value={createDraft.workspace}
                  onChange={(event) =>
                    setCreateDraft((current) => ({ ...current, workspace: event.target.value }))
                  }
                  placeholder="workspace (optional)"
                />
                <input
                  className="deckgo-input deck-ui-agents-input"
                  value={createDraft.emoji}
                  onChange={(event) =>
                    setCreateDraft((current) => ({ ...current, emoji: event.target.value }))
                  }
                  placeholder="emoji (optional)"
                />
              </div>
              <div className="deckgo-actions deck-ui-agents-actions deck-ui-agents-spaced">
                <button
                  className="deckgo-button deck-ui-agents-button is-primary"
                  type="button"
                  onClick={() => void createAction()}
                  disabled={actionState !== "idle"}
                >
                  {actionState === "creating" ? "Creating" : "Create agent"}
                </button>
                <button
                  className="deckgo-button deck-ui-agents-button"
                  type="button"
                  onClick={() => void refresh(selectedAgentId)}
                >
                  Refresh agents
                </button>
              </div>
            </div>
            {error ? <p className="deckgo-note">{error}</p> : null}
            {agents.length === 0 ? (
              <p className="deckgo-note">No agents loaded.</p>
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
                        id: {agent.id} | workspace:{" "}
                        {typeof agent.workspace === "string" ? agent.workspace : "n/a"}
                      </div>
                      <div className="deckgo-meta">
                        {agent.id === defaultAgentId ? "default agent" : "standard agent"}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-panel-main deck-ui-agents-column">
        <article className="deckgo-card is-float deck-ui-agents-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Agent detail</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Agent details center on inventory truth, runtime status, recent sessions, tools, skills,
            and supported config overrides.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-agents-body">
            {detail ? (
              <>
                <div className="deckgo-panel-hero-strip deck-ui-agents-hero">
                  <div>
                    <p className="deckgo-kicker">Selected agent</p>
                    <strong>{detail.name || detail.id}</strong>
                    <p className="deckgo-note">{detail.workspace}</p>
                  </div>
                  <div className="deckgo-pill-row deck-ui-agents-pill-row">
                    <span className="deckgo-pill">{detail.model || "default model"}</span>
                    <span className="deckgo-pill">{detail.skillMode}</span>
                  </div>
                </div>
                <div className="deckgo-grid deckgo-grid-3 deck-ui-agents-grid">
                  <ShellStat label="bindings" value={detail.bindingCount} />
                  <ShellStat label="sessions" value={detail.sessionCount} />
                  <ShellStat label="subagents" value={detail.activeSubagentCount} />
                </div>
                <div className="deckgo-surface-tile deck-ui-agents-surface">
                  <p className="deckgo-surface-label">Agent runtime profile</p>
                  <div className="deckgo-grid deckgo-grid-3 deck-ui-agents-grid">
                    <ShellStat
                      label="sandbox"
                      value={`sandbox ${formatSandboxMode(detail.sandbox)}`}
                    />
                    <ShellStat label="fallbacks" value={detail.fallbackModels?.length ?? 0} />
                    <ShellStat
                      label="fast mode"
                      value={detail.fastModeDefault ? "enabled" : "disabled"}
                    />
                  </div>
                  <div className="deckgo-grid deckgo-grid-3 deck-ui-agents-grid deck-ui-agents-spaced">
                    <ShellStat label="active runs" value={agentMetrics.activeRuns} />
                    <ShellStat label="messages" value={agentMetrics.messageCount} />
                    <ShellStat
                      label="metrics"
                      value={agentMetrics.lastUpdated > 0 ? "live" : "pending"}
                    />
                  </div>
                  <div className="deckgo-pill-row deck-ui-agents-pill-row deck-ui-agents-spaced">
                    {readSandboxField(detail.sandbox, "backend") ? (
                      <span className="deckgo-pill">
                        backend {readSandboxField(detail.sandbox, "backend")}
                      </span>
                    ) : null}
                    {readSandboxField(detail.sandbox, "filesystem") ? (
                      <span className="deckgo-pill">
                        filesystem {readSandboxField(detail.sandbox, "filesystem")}
                      </span>
                    ) : null}
                    {(detail.fallbackModels ?? []).slice(0, 4).map((fallback) => (
                      <span key={fallback} className="deckgo-pill">
                        fallback {fallback}
                      </span>
                    ))}
                    {detail.reasoningDefault ? (
                      <span className="deckgo-pill">reasoning {detail.reasoningDefault}</span>
                    ) : null}
                  </div>
                </div>
                <div className="deckgo-surface-tile deck-ui-agents-surface">
                  <p className="deckgo-surface-label">Agent routing bindings</p>
                  <p className="deckgo-note">
                    Agent-scoped routing rules loaded from Gateway `deck.routing.list` with this
                    agent id as the filter.
                  </p>
                  <div className="deckgo-grid deckgo-grid-2 deck-ui-agents-grid">
                    <ShellStat label="bindings" value={agentRoutingBindings.length} />
                    <ShellStat label="config hash" value={agentRoutingConfigHash || "n/a"} />
                  </div>
                  <div className="deckgo-actions deck-ui-agents-actions deck-ui-agents-spaced">
                    <button
                      className="deckgo-button deck-ui-agents-button"
                      type="button"
                      onClick={() => navigateToRouting(ui, detail.id)}
                    >
                      Open agent routing
                    </button>
                    <button
                      className="deckgo-button deck-ui-agents-button"
                      type="button"
                      disabled={actionState !== "idle"}
                      onClick={() => void loadAgentRoutingBindings(detail.id)}
                    >
                      Refresh routing bindings
                    </button>
                  </div>
                  {agentRoutingBindings.length > 0 ? (
                    <ul className="deckgo-shell-list deck-ui-agents-list deck-ui-agents-spaced">
                      {agentRoutingBindings.slice(0, 8).map((binding) => (
                        <li key={binding.id}>
                          <div className="deckgo-selectable-card deck-ui-agents-row">
                            <strong>{binding.tier}</strong>
                            <div className="deckgo-meta">binding id: {binding.id}</div>
                            <div className="deckgo-meta">{summarizeAgentRoutingMatch(binding)}</div>
                            <div className="deckgo-actions deck-ui-agents-actions deck-ui-agents-spaced-tight">
                              <button
                                className="deckgo-button deck-ui-agents-button is-danger"
                                type="button"
                                disabled={actionState !== "idle"}
                                onClick={() => void removeAgentRoutingBinding(binding.id)}
                              >
                                {actionState === "agent-routing"
                                  ? "Removing binding"
                                  : "Remove routing binding"}
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="deckgo-note">No routing bindings are assigned to this agent.</p>
                  )}
                  {agentRoutingError ? <p className="deckgo-note">{agentRoutingError}</p> : null}
                </div>
                <div className="deckgo-surface-tile deck-ui-agents-surface">
                  <p className="deckgo-surface-label">Agent identity</p>
                  <div className="deckgo-panel-hero-strip deck-ui-agents-hero">
                    <div>
                      <p className="deckgo-kicker">
                        {detail.identityExists ? "IDENTITY.md" : "fallback"}
                      </p>
                      <strong>{agentIdentity?.name || detail.name || detail.id}</strong>
                      <p className="deckgo-note">
                        {agentIdentity?.emoji
                          ? `emoji ${agentIdentity.emoji}`
                          : "No custom emoji reported."}
                      </p>
                    </div>
                    <div className="deckgo-pill-row deck-ui-agents-pill-row">
                      <span className="deckgo-pill">
                        {agentIdentity?.avatar ? "avatar configured" : "no avatar"}
                      </span>
                      <span className="deckgo-pill">{agentIdentity?.agentId || detail.id}</span>
                    </div>
                  </div>
                  {agentIdentity?.avatar ? (
                    <p className="deckgo-note">avatar: {agentIdentity.avatar}</p>
                  ) : null}
                  {agentIdentityError ? <p className="deckgo-note">{agentIdentityError}</p> : null}
                </div>
                <div className="deckgo-surface-tile deck-ui-agents-surface">
                  <p className="deckgo-surface-label">Clone selected agent config</p>
                  <p className="deckgo-note">
                    Create a new agent, then copy supported raw config overrides from this agent
                    using the current config hash.
                  </p>
                  <div className="deckgo-actions deck-ui-agents-actions">
                    <input
                      className="deckgo-input deck-ui-agents-input"
                      value={cloneName}
                      disabled={actionState !== "idle"}
                      onChange={(event) => setCloneName(event.target.value)}
                      placeholder="clone name"
                    />
                    <button
                      className="deckgo-button deck-ui-agents-button"
                      type="button"
                      disabled={actionState !== "idle" || !cloneName.trim()}
                      onClick={() => void cloneSelectedAgent()}
                    >
                      {actionState === "cloning" ? "Cloning" : "Clone selected"}
                    </button>
                  </div>
                </div>
                <div className="deckgo-surface-tile deck-ui-agents-surface">
                  <p className="deckgo-surface-label">Agent templates</p>
                  <p className="deckgo-note">
                    Save a local template snapshot for this agent's model and identity metadata.
                  </p>
                  <div className="deckgo-actions deck-ui-agents-actions">
                    <input
                      className="deckgo-input deck-ui-agents-input"
                      value={templateName}
                      disabled={actionState !== "idle"}
                      onChange={(event) => setTemplateName(event.target.value)}
                      placeholder="template name"
                    />
                    <button
                      className="deckgo-button deck-ui-agents-button"
                      type="button"
                      disabled={actionState !== "idle" || !templateName.trim()}
                      onClick={saveSelectedAgentTemplate}
                    >
                      {actionState === "template" ? "Saving template" : "Save template"}
                    </button>
                  </div>
                  {agentTemplates.length > 0 ? (
                    <ul className="deckgo-shell-list deck-ui-agents-list deck-ui-agents-spaced">
                      {agentTemplates.map((template, index) => (
                        <li key={`${template.name}:${template.createdAt}`}>
                          <div className="deckgo-selectable-card deck-ui-agents-row">
                            <strong>{template.name}</strong>
                            <div className="deckgo-meta">
                              created: {new Date(template.createdAt).toLocaleString()}
                            </div>
                            <div className="deckgo-meta">
                              config: {formatDiffValue(template.config)}
                            </div>
                            <div className="deckgo-actions deck-ui-agents-actions deck-ui-agents-spaced-tight">
                              <button
                                className="deckgo-button deck-ui-agents-button"
                                type="button"
                                disabled={actionState !== "idle"}
                                onClick={() => void createAgentFromTemplate(template)}
                              >
                                {actionState === "template-create"
                                  ? "Creating from template"
                                  : "Create from template"}
                              </button>
                              <button
                                className="deckgo-button deck-ui-agents-button is-danger"
                                type="button"
                                disabled={actionState !== "idle"}
                                onClick={() => deleteAgentTemplate(index)}
                              >
                                Delete template
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="deckgo-note">No local agent templates saved.</p>
                  )}
                </div>
                <div className="deckgo-surface-tile deck-ui-agents-surface">
                  <p className="deckgo-surface-label">Agent compare</p>
                  <p className="deckgo-note">
                    Compare two Gateway `deck.agents.detail` payloads with the field-level diff
                    helper.
                  </p>
                  <div className="deckgo-actions deck-ui-agents-actions">
                    <select
                      aria-label="Compare agent"
                      className="deckgo-input deck-ui-agents-input"
                      value={compareAgentId}
                      disabled={actionState !== "idle"}
                      onChange={(event) => setCompareAgentId(event.target.value)}
                    >
                      <option value="">choose agent</option>
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
                      {actionState === "compare" ? "Comparing" : "Compare agents"}
                    </button>
                  </div>
                  {compareDetail ? (
                    <>
                      <div className="deckgo-grid deckgo-grid-3 deck-ui-agents-grid deck-ui-agents-spaced">
                        <ShellStat label="left" value={detail.id} />
                        <ShellStat label="right" value={compareDetail.id} />
                        <ShellStat label="diffs" value={compareDiffs.length} />
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
                                  old: {formatDiffValue(diff.oldValue)} | new:{" "}
                                  {formatDiffValue(diff.newValue)}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="deckgo-note">Selected agent detail payloads match.</p>
                      )}
                    </>
                  ) : null}
                  {compareError ? <p className="deckgo-note">{compareError}</p> : null}
                </div>
                <div className="deckgo-surface-tile deck-ui-agents-surface">
                  <p className="deckgo-surface-label">Agent config overrides</p>
                  <p className="deckgo-note">
                    Edits are persisted through the Gateway config patch path as a selected
                    agents.list entry merge.
                  </p>
                  {agentRawConfig ? (
                    <>
                      <div className="deckgo-grid deckgo-grid-3 deck-ui-agents-grid">
                        <ShellStat
                          label="source"
                          value={agentRawConfig.entry ? "agent" : "defaults"}
                        />
                        <ShellStat
                          label="overrides"
                          value={countAgentConfigOverrides(agentRawConfig)}
                        />
                        <ShellStat label="hash" value={agentRawConfig.baseHash ?? "n/a"} />
                      </div>
                      <div className="deckgo-grid deckgo-grid-2 deck-ui-agents-grid deck-ui-agents-spaced">
                        <label>
                          <span className="deckgo-surface-label">Model</span>
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
                            placeholder="inherit configured model"
                          />
                          {runtimeModelOptions.length > 0 ? (
                            <select
                              aria-label="Primary model preset"
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
                              <option value="">select runtime model</option>
                              {runtimeModelOptions.map((option) => (
                                <option key={option.ref} value={option.ref}>
                                  {option.label} ({option.provider})
                                </option>
                              ))}
                            </select>
                          ) : null}
                        </label>
                        <label>
                          <span className="deckgo-surface-label">Fallback models</span>
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
                            placeholder="comma-separated fallback model ids"
                          />
                          {runtimeModelOptions.length > 0 ? (
                            <select
                              aria-label="Add fallback model"
                              className="deckgo-input deck-ui-agents-input deck-ui-agents-spaced-tight"
                              value=""
                              disabled={actionState !== "idle"}
                              onChange={(event) => addFallbackModel(event.target.value)}
                            >
                              <option value="">add runtime fallback</option>
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
                                        Move up
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
                                        Move down
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
                                        Remove fallback
                                      </button>
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="deckgo-note">No fallback models configured.</p>
                          )}
                        </label>
                        <label>
                          <span className="deckgo-surface-label">Reasoning default</span>
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
                            <option value="stream">stream</option>
                            <option value="on">on</option>
                            <option value="off">off</option>
                          </select>
                        </label>
                        <label>
                          <span className="deckgo-surface-label">Thinking default</span>
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
                            <option value="">inherit thinking default</option>
                            {THINKING_LEVELS.map((level) => (
                              <option key={level} value={level}>
                                {level}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span className="deckgo-surface-label">Temperature</span>
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
                            placeholder="inherit temperature"
                          />
                        </label>
                        <label>
                          <span className="deckgo-surface-label">Tools profile</span>
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
                            placeholder="inherit tools profile"
                          />
                          {(toolsCatalog?.profiles?.length ?? 0) > 0 ? (
                            <div
                              className="deckgo-actions deck-ui-agents-actions deck-ui-agents-spaced-tight"
                              role="radiogroup"
                              aria-label="Tool profile presets"
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
                          <span className="deckgo-surface-label">Allowed tools</span>
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
                            placeholder="comma-separated allow overrides"
                          />
                        </label>
                        <label>
                          <span className="deckgo-surface-label">Denied tools</span>
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
                            placeholder="comma-separated deny overrides"
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
                          <span>Fast mode default</span>
                        </label>
                      </div>
                      <div className="deckgo-actions deck-ui-agents-actions deck-ui-agents-spaced">
                        <button
                          className="deckgo-button deck-ui-agents-button"
                          type="button"
                          disabled={actionState !== "idle"}
                          onClick={() => void saveAgentRawConfig()}
                        >
                          {actionState === "agent-config" ? "Saving config" : "Save agent config"}
                        </button>
                        <button
                          className="deckgo-button deck-ui-agents-button"
                          type="button"
                          disabled={
                            actionState !== "idle" || resettableAgentConfigOverrideCount === 0
                          }
                          onClick={() => void resetAgentRawConfigOverrides()}
                        >
                          Reset editable overrides
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="deckgo-note">Loading raw agent config...</p>
                  )}
                  {agentConfigError ? <p className="deckgo-note">{agentConfigError}</p> : null}
                </div>
                <div className="deckgo-surface-tile deck-ui-agents-surface">
                  <p className="deckgo-surface-label">Channel event streams</p>
                  <p className="deckgo-note">
                    Chat is always enabled; lifecycle, assistant, tool, and thinking streams can be
                    configured through the Gateway-backed agent event stream API.
                  </p>
                  {eventStreams?.isDefault ? (
                    <p className="deckgo-note">Using default event stream policy.</p>
                  ) : null}
                  <div className="deckgo-pill-row deck-ui-agents-pill-row">
                    <span className="deckgo-pill is-positive">chat locked on</span>
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
                          <span>{stream}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="deckgo-note">Loading event stream policy...</p>
                  )}
                  {eventStreamsError ? <p className="deckgo-note">{eventStreamsError}</p> : null}
                </div>
                <div className="deckgo-surface-tile deck-ui-agents-surface">
                  <p className="deckgo-surface-label">Agent skills</p>
                  <p className="deckgo-note">
                    Configure whether this agent can use all skills or only a Gateway-backed
                    whitelist.
                  </p>
                  {skillsConfig ? (
                    <>
                      <div className="deckgo-grid deckgo-grid-3 deck-ui-agents-grid">
                        <ShellStat label="mode" value={agentSkillMode} />
                        <ShellStat label="assigned" value={agentSkillKeys.length} />
                        <ShellStat label="available" value={skillsConfig.available.length} />
                      </div>
                      <div className="deckgo-grid deckgo-grid-2 deck-ui-agents-grid deck-ui-agents-spaced">
                        <label>
                          <span className="deckgo-surface-label">Skill mode</span>
                          <select
                            className="deckgo-input deck-ui-agents-input"
                            value={agentSkillMode}
                            disabled={actionState !== "idle"}
                            onChange={(event) =>
                              setAgentSkillMode(event.target.value as AgentSkillMode)
                            }
                          >
                            <option value="all">all skills</option>
                            <option value="whitelist">selected skills</option>
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
                              {skill.eligible ? "" : " (not eligible)"}
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
                          {actionState === "skills" ? "Saving skills" : "Save agent skills"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="deckgo-note">Loading agent skill policy...</p>
                  )}
                  {skillsConfigError ? <p className="deckgo-note">{skillsConfigError}</p> : null}
                </div>
                <div className="deckgo-surface-tile deck-ui-agents-surface">
                  <p className="deckgo-surface-label">Subagent spawning</p>
                  <p className="deckgo-note">
                    Configure which agents this agent may spawn and whether spawned runs should use
                    a model override.
                  </p>
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
                          <span className="deckgo-surface-label">Spawn permission</span>
                          <select
                            className="deckgo-input deck-ui-agents-input"
                            value={subagentAllowMode}
                            disabled={actionState !== "idle"}
                            onChange={(event) =>
                              setSubagentAllowMode(event.target.value as SubagentAllowMode)
                            }
                          >
                            <option value="none">none</option>
                            <option value="list">selected agents</option>
                            <option value="any">any agent</option>
                          </select>
                        </label>
                        <label>
                          <span className="deckgo-surface-label">Model override</span>
                          <input
                            className="deckgo-input deck-ui-agents-input"
                            value={subagentModel}
                            disabled={actionState !== "idle"}
                            onChange={(event) => setSubagentModel(event.target.value)}
                            placeholder="inherit default model"
                          />
                          {runtimeModelOptions.length > 0 ? (
                            <select
                              aria-label="Subagent model preset"
                              className="deckgo-input deck-ui-agents-input deck-ui-agents-spaced-tight"
                              value={
                                runtimeModelOptions.some((option) => option.ref === subagentModel)
                                  ? subagentModel
                                  : ""
                              }
                              disabled={actionState !== "idle"}
                              onChange={(event) => setSubagentModel(event.target.value)}
                            >
                              <option value="">select runtime model</option>
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
                          {actionState === "subagents" ? "Saving subagents" : "Save subagents"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="deckgo-note">Loading subagent policy...</p>
                  )}
                  {subagentConfigError ? (
                    <p className="deckgo-note">{subagentConfigError}</p>
                  ) : null}
                </div>
                <div className="deckgo-surface-tile deck-ui-agents-surface">
                  <p className="deckgo-surface-label">Agent subagent runs</p>
                  <p className="deckgo-note">
                    Active subagent runs requested by this agent, loaded with the same requester
                    filter as the old Deck detail tab.
                  </p>
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
                      Open subagents panel
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
                                Open child agent
                              </button>
                              <button
                                className="deckgo-button deck-ui-agents-button"
                                type="button"
                                disabled={!run.childSessionKey}
                                onClick={() => navigateToSession(ui, run.childSessionKey ?? "")}
                              >
                                Open child session
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="deckgo-note">No active subagent runs for this agent.</p>
                  )}
                  {agentSubagentRunsError ? (
                    <p className="deckgo-note">{agentSubagentRunsError}</p>
                  ) : null}
                </div>
                <div className="deckgo-surface-tile deck-ui-agents-surface">
                  <p className="deckgo-surface-label">Effective previews</p>
                  <p className="deckgo-note">
                    Gateway-derived tool policy and system prompt summaries for the selected agent.
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
                        <div className="deckgo-surface-tile deck-ui-agents-surface deck-ui-agents-spaced">
                          <p className="deckgo-surface-label">Tools catalog</p>
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
                            Catalog overrides update the editable allow/deny lists below; use Save
                            agent config to persist them through the config patch path.
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
                                      <option value="default">default</option>
                                      <option value="allow">allow</option>
                                      <option value="deny">deny</option>
                                    </select>
                                  </div>
                                </li>
                              ))}
                          </ul>
                        </div>
                      ) : null}
                      <div className="deckgo-surface-tile deck-ui-agents-surface deck-ui-agents-spaced">
                        <p className="deckgo-surface-label">Session effective tools</p>
                        {effectiveToolSessions.length > 0 ? (
                          <>
                            <div className="deckgo-grid deckgo-grid-3 deck-ui-agents-grid">
                              <ShellStat label="sessions" value={effectiveToolSessions.length} />
                              <ShellStat label="profile" value={effectiveTools?.profile ?? "n/a"} />
                              <ShellStat label="tools" value={effectiveToolCount} />
                            </div>
                            <label className="deck-ui-agents-label deck-ui-agents-spaced">
                              <span className="deckgo-surface-label">Session</span>
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
                              <p className="deckgo-note">No effective tools for this session.</p>
                            )}
                          </>
                        ) : (
                          <p className="deckgo-note">
                            No sessions are available for effective tool inspection.
                          </p>
                        )}
                        {effectiveToolsError ? (
                          <p className="deckgo-note">{effectiveToolsError}</p>
                        ) : null}
                      </div>
                      <div className="deckgo-surface-tile deck-ui-agents-surface deck-ui-agents-spaced">
                        <p className="deckgo-surface-label">Recent agent sessions</p>
                        {effectiveToolSessions.length > 0 ? (
                          <>
                            <div className="deckgo-grid deckgo-grid-2 deck-ui-agents-grid">
                              <label>
                                <span className="deckgo-surface-label">Session type</span>
                                <select
                                  aria-label="Agent session filter"
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
                                            Open session
                                          </button>
                                        </div>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              <p className="deckgo-note">
                                No recent sessions match the selected type.
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="deckgo-note">No recent sessions reported for this agent.</p>
                        )}
                      </div>
                      {(toolPolicyPreview?.layers?.length ?? 0) > 0 ? (
                        <div className="deckgo-pill-row deck-ui-agents-pill-row deck-ui-agents-spaced">
                          {toolPolicyPreview?.layers?.slice(0, 6).map((layer) => (
                            <span key={layer.label} className="deckgo-pill">
                              {layer.label}: {layer.effect}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {toolPolicyPreview ? (
                        <div className="deckgo-surface-tile deck-ui-agents-surface deck-ui-agents-spaced">
                          <p className="deckgo-surface-label">Tool policy trace</p>
                          <input
                            className="deckgo-input deck-ui-agents-input"
                            value={toolPolicySearch}
                            onChange={(event) => setToolPolicySearch(event.target.value)}
                            placeholder="search tools"
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
                                        : "No trace entries."}
                                    </div>
                                  ) : null}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {(systemPromptPreview?.bootstrapFiles?.length ?? 0) > 0 ? (
                        <ul className="deckgo-shell-list deck-ui-agents-list deck-ui-agents-spaced">
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
                                  {file.exists ? "Edit bootstrap file" : "Create bootstrap file"}
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {bootstrapFileName ? (
                        <div className="deckgo-surface-tile deck-ui-agents-surface deck-ui-agents-spaced">
                          <p className="deckgo-surface-label">
                            Bootstrap file: {bootstrapFileName}
                          </p>
                          <p className="deckgo-note">
                            {bootstrapFile?.missing
                              ? "This file does not exist yet."
                              : `${bootstrapFile?.size ?? bootstrapFileDraft.length} bytes loaded.`}
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
                            placeholder="bootstrap prompt content"
                          />
                          <div className="deckgo-actions deck-ui-agents-actions deck-ui-agents-spaced">
                            <button
                              className="deckgo-button deck-ui-agents-button is-primary"
                              type="button"
                              disabled={actionState !== "idle"}
                              onClick={() => void saveBootstrapFile()}
                            >
                              {actionState === "bootstrap-file"
                                ? "Saving bootstrap file"
                                : "Save bootstrap file"}
                            </button>
                            <button
                              className="deckgo-button deck-ui-agents-button"
                              type="button"
                              disabled={actionState !== "idle"}
                              onClick={closeBootstrapFile}
                            >
                              Close file
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="deckgo-note">Loading effective previews...</p>
                  )}
                  {previewError ? <p className="deckgo-note">{previewError}</p> : null}
                  {toolsCatalogError ? <p className="deckgo-note">{toolsCatalogError}</p> : null}
                  {bootstrapFileError ? <p className="deckgo-note">{bootstrapFileError}</p> : null}
                </div>
                <div className="deckgo-surface-tile deck-ui-agents-surface">
                  <p className="deckgo-surface-label">Agent files</p>
                  <p className="deckgo-note">
                    Browse Gateway-listed workspace files and open them in the same inline editor.
                  </p>
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
                    <p className="deckgo-note">No agent files reported.</p>
                  )}
                  {agentFilesError ? <p className="deckgo-note">{agentFilesError}</p> : null}
                </div>
                <div className="deckgo-surface-tile deck-ui-agents-surface">
                  <p className="deckgo-surface-label">Rename or remove</p>
                  <div className="deckgo-actions deck-ui-agents-actions">
                    <input
                      className="deckgo-input deck-ui-agents-input"
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      placeholder="agent name"
                    />
                    <button
                      className="deckgo-button deck-ui-agents-button"
                      type="button"
                      onClick={() => void renameAction()}
                      disabled={actionState !== "idle"}
                    >
                      {actionState === "renaming" ? "Renaming" : "Rename"}
                    </button>
                    <button
                      className="deckgo-button deck-ui-agents-button is-danger"
                      type="button"
                      onClick={() => void deleteAction()}
                      disabled={actionState !== "idle" || detail.isDefault}
                    >
                      {actionState === "deleting" ? "Deleting" : "Delete"}
                    </button>
                  </div>
                </div>
                <JsonDetails title="Agent detail payload" payload={detail} />
              </>
            ) : (
              <p className="deckgo-note">Choose an agent to inspect it.</p>
            )}
            {runtimeModelsError ? <p className="deckgo-note">{runtimeModelsError}</p> : null}
            {actionResult ? <JsonDetails title="Last agent action" payload={actionResult} /> : null}
          </div>
        </article>
      </div>
    </section>
  );
}
