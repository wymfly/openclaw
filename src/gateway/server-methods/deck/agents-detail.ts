import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { normalizeMainKey } from "../../../routing/session-key.js";
import { DEFAULT_EVENT_STREAMS } from "../../channel-event-filter.js";
import type { MethodMetadata } from "../../method-registry.js";
import { ErrorCodes, errorShape, validateDeckAgentsDetailParams } from "../../protocol/index.js";
import {
  DeckAgentsDetailParamsSchema,
  DeckAgentsDetailResultSchema,
} from "../../protocol/schema/deck.js";
import { agentsService } from "../../services/agents.service.js";
import { configService } from "../../services/config.service.js";
import type { GatewayRequestHandlers } from "../types.js";
import { assertValidParams } from "../validation.js";
import { resolveDeckAgentReadConfig } from "./agent-read-config.js";
import { resolveModelString } from "./agents-shared.js";

const {
  buildConfiguredModelCatalog,
  resolveAgentSkillsFilter,
  resolveAgentWorkspaceDir,
  resolveDefaultAgentId,
  buildWorkspaceSkillStatus,
  listAgentIds,
} = agentsService;
const { loadConfig } = configService;

type EffectiveSource = "agent" | "default" | "derived" | "gateway" | "unknown";
const SESSION_IMPACT_UNAVAILABLE_REASON = "session-truth-unavailable";
type EffectiveField = {
  source: EffectiveSource;
  hasOverride: boolean;
  canReset: boolean;
  effective?: unknown;
  fallback?: unknown;
  fallbackReason?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function agentEntryRecord(
  cfg: ReturnType<typeof loadConfig>,
  agentId: string,
): Record<string, unknown> {
  const list = cfg.agents?.list;
  if (!Array.isArray(list)) {
    return {};
  }
  const entry = list.find((agent) => agent?.id === agentId);
  return isRecord(entry) ? entry : {};
}

function defaultRecord(cfg: ReturnType<typeof loadConfig>): Record<string, unknown> {
  return isRecord(cfg.agents?.defaults) ? cfg.agents.defaults : {};
}

function getNested(record: unknown, path: string[]): unknown {
  let cursor = record;
  for (const key of path) {
    if (!isRecord(cursor) || !(key in cursor)) {
      return undefined;
    }
    cursor = cursor[key];
  }
  return cursor;
}

function effectiveField(params: {
  override: unknown;
  fallback: unknown;
  derived?: unknown;
  fallbackReason?: string;
}): EffectiveField {
  const hasOverride = params.override !== undefined;
  if (hasOverride) {
    return {
      source: "agent",
      hasOverride: true,
      canReset: true,
      effective: params.override,
      fallback: params.fallback ?? params.derived,
      fallbackReason: params.fallbackReason,
    };
  }
  if (params.fallback !== undefined) {
    return {
      source: "default",
      hasOverride: false,
      canReset: false,
      effective: params.fallback,
      fallback: params.fallback,
      fallbackReason: params.fallbackReason,
    };
  }
  if (params.derived !== undefined) {
    return {
      source: "derived",
      hasOverride: false,
      canReset: false,
      effective: params.derived,
      fallback: params.derived,
      fallbackReason: params.fallbackReason,
    };
  }
  return { source: "unknown", hasOverride: false, canReset: false };
}

function collectUnresolvedReferences(params: {
  cfg: ReturnType<typeof loadConfig>;
  agentId: string;
  effectiveSkills: string[];
  availableSkills: string[];
  eventStreams: string[];
  models: Array<string | undefined>;
}) {
  const availableSkills = new Set(params.availableSkills);
  const skills = params.effectiveSkills
    .filter((key) => key && !availableSkills.has(key))
    .map((key) => ({ key, reason: "not-installed" as const }));

  const agentIds = new Set(listAgentIds(params.cfg));
  const agentConfig = agentEntryRecord(params.cfg, params.agentId);
  const allowAgents = getNested(agentConfig, ["subagents", "allowAgents"]);
  const subagents = Array.isArray(allowAgents)
    ? allowAgents
        .filter((id): id is string => typeof id === "string" && id !== "*" && !agentIds.has(id))
        .map((agentId) => ({ agentId, reason: "agent-not-found" as const }))
    : [];

  const knownStreams = new Set(DEFAULT_EVENT_STREAMS);
  const eventStreams = params.eventStreams
    .filter((stream) => stream && !knownStreams.has(stream))
    .map((eventStream) => ({ eventStream, reason: "not-in-declared-options" as const }));

  const catalogRefs = new Set(
    buildConfiguredModelCatalog({ cfg: params.cfg }).flatMap((entry) => [
      `${entry.provider}/${entry.id}`,
      entry.alias,
    ]),
  );
  const models = params.models
    .filter((model): model is string => Boolean(model))
    .filter((model) => !catalogRefs.has(model))
    .map((model) => ({ model, reason: "not-in-catalog" as const }));

  return { skills, subagents, eventStreams, models };
}

async function summarizeWorkspaceFiles(workspaceDir: string) {
  try {
    const entries = await readdir(workspaceDir, { withFileTypes: true });
    return {
      total: entries.filter((entry) => entry.isFile()).length,
      bootstrapPresent: entries.some((entry) => entry.isFile() && entry.name === "BOOTSTRAP.md"),
    };
  } catch {
    return { total: 0, bootstrapPresent: false };
  }
}

export const deckAgentsDetailHandlers: GatewayRequestHandlers = {
  "deck.agents.detail": async ({ params, respond }) => {
    if (!assertValidParams(params, validateDeckAgentsDetailParams, "deck.agents.detail", respond)) {
      return;
    }
    const cfg = loadConfig();
    const agentId = (params as { agentId: string }).agentId;
    const agentConfig = resolveDeckAgentReadConfig(cfg, agentId);
    if (!agentConfig) {
      respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, `Agent "${agentId}" not found`));
      return;
    }

    const defaultAgentId = resolveDefaultAgentId(cfg);
    const isDefault = agentId === defaultAgentId;
    const mainKey = normalizeMainKey(cfg.session?.mainKey);
    const isMainProtected = agentId === "main";
    const agentEntry = agentEntryRecord(cfg, agentId);
    const defaults = defaultRecord(cfg);
    const protectedReasons = isMainProtected
      ? ["main is the protected system/fallback agent and cannot be deleted"]
      : undefined;

    const bindings = cfg.bindings ?? [];
    const agentBindings = bindings.filter((binding) => binding.agentId === agentId);
    const bindingCount = agentBindings.length;

    // Legacy top-level fields remain required by the current response schema.
    // The richer impact object marks session truth unavailable instead of
    // presenting these compatibility placeholders as a complete count.
    const sessionCount = 0;
    const activeSubagentCount = 0;

    const skillFilter = resolveAgentSkillsFilter(cfg, agentId);
    const skillMode = skillFilter === undefined ? "all" : "whitelist";
    const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
    const skillReport = buildWorkspaceSkillStatus(workspaceDir, { config: cfg });
    const allSkillKeys = skillReport.skills.map((skill) => skill.skillKey);
    const effectiveSkills = skillMode === "all" ? allSkillKeys : (skillFilter ?? []);
    const totalAvailableSkills = allSkillKeys.length;

    const sandbox = agentConfig.sandbox;

    let identityExists = false;
    try {
      await stat(join(workspaceDir, "IDENTITY.md"));
      identityExists = true;
    } catch {
      // Missing identity file is represented in the response.
    }

    const effectiveModel =
      resolveModelString(agentConfig.model) ?? resolveModelString(cfg.agents?.defaults?.model);
    const effectiveSources = {
      workspace: agentConfig.workspace?.trim()
        ? "agent"
        : cfg.agents?.defaults?.workspace
          ? "default"
          : "derived",
      model: agentConfig.model ? "agent" : cfg.agents?.defaults?.model ? "default" : "unknown",
      skills: agentConfig.skills ? "agent" : cfg.agents?.defaults?.skills ? "default" : "derived",
      subagents: agentConfig.subagents
        ? "agent"
        : cfg.agents?.defaults?.subagents
          ? "default"
          : "derived",
      eventStreams: agentConfig.channels?.eventStreams ? "agent" : "default",
    } as const;
    const reasoningDefault = agentConfig.reasoningDefault ?? cfg.agents?.defaults?.reasoningDefault;
    const thinkingDefault = agentConfig.thinkingDefault ?? cfg.agents?.defaults?.thinkingDefault;
    const verboseDefault = agentConfig.verboseDefault ?? cfg.agents?.defaults?.verboseDefault;
    const fastModeDefault = agentConfig.fastModeDefault ?? cfg.agents?.defaults?.fastModeDefault;
    const effectiveEventStreams =
      agentConfig.channels?.eventStreams ?? cfg.agents?.defaults?.channels?.eventStreams ?? [];

    const agentModelObj = agentConfig.model ?? cfg.agents?.defaults?.model;
    let fallbackModels: string[] | undefined;
    if (agentModelObj && typeof agentModelObj === "object" && "fallbacks" in agentModelObj) {
      const fallbacks = (agentModelObj as { fallbacks?: string[] }).fallbacks;
      if (Array.isArray(fallbacks)) {
        fallbackModels = fallbacks;
      }
    }

    const agentSubagents = agentConfig.subagents;
    const globalDefaults = cfg.agents?.defaults?.subagents;
    const allowAgents = agentSubagents?.allowAgents ?? [];
    const effectiveMaxSpawnDepth = globalDefaults?.maxSpawnDepth ?? 1;
    const effectiveMaxChildrenPerAgent = globalDefaults?.maxChildrenPerAgent ?? 5;
    const workspaceFiles = await summarizeWorkspaceFiles(workspaceDir);
    const impact = {
      bindingCount,
      workspaceFileCount: workspaceFiles.total,
      deleteRemovesFiles: false,
      bindings: {
        count: bindingCount,
        samples: agentBindings.slice(0, 5).map((binding, bindingIndex) => ({
          bindingIndex,
          type: binding.type,
          channel: binding.match?.channel,
          accountId: binding.match?.accountId,
          peer: binding.match?.peer,
          guildId: binding.match?.guildId,
          teamId: binding.match?.teamId,
          roles: binding.match?.roles,
          summary: `${binding.match?.channel ?? "unknown"}:${binding.match?.accountId ?? "default"}`,
        })),
        truncated: bindingCount > 5,
      },
      files: workspaceFiles,
      capturedAt: new Date().toISOString(),
      available: false,
      unavailableReason: SESSION_IMPACT_UNAVAILABLE_REASON,
    };
    const inherited = {
      workspace: effectiveField({
        override: agentEntry.workspace,
        fallback: defaults.workspace,
        derived: workspaceDir,
        fallbackReason: "Resolved by OpenClaw workspace fallback rules",
      }),
      sandbox: effectiveField({ override: agentEntry.sandbox, fallback: defaults.sandbox }),
      sandboxScope: effectiveField({
        override: getNested(agentEntry, ["sandbox", "scope"]),
        fallback: getNested(defaults, ["sandbox", "scope"]),
      }),
      sandboxDocker: effectiveField({
        override: getNested(agentEntry, ["sandbox", "docker"]),
        fallback: getNested(defaults, ["sandbox", "docker"]),
      }),
      embeddedHarness: effectiveField({
        override: agentEntry.embeddedHarness,
        fallback: defaults.embeddedHarness,
      }),
      embeddedHarnessRuntime: effectiveField({
        override: getNested(agentEntry, ["embeddedHarness", "runtime"]),
        fallback: getNested(defaults, ["embeddedHarness", "runtime"]),
      }),
      embeddedHarnessFallback: effectiveField({
        override: getNested(agentEntry, ["embeddedHarness", "fallback"]),
        fallback: getNested(defaults, ["embeddedHarness", "fallback"]),
      }),
      embeddedPi: effectiveField({
        override: agentEntry.embeddedPi,
        fallback: defaults.embeddedPi,
      }),
      embeddedPiExecutionContract: effectiveField({
        override: getNested(agentEntry, ["embeddedPi", "executionContract"]),
        fallback: getNested(defaults, ["embeddedPi", "executionContract"]),
      }),
      params: effectiveField({ override: agentEntry.params, fallback: defaults.params }),
      thinkingDefault: effectiveField({
        override: agentEntry.thinkingDefault,
        fallback: defaults.thinkingDefault,
      }),
      verboseDefault: effectiveField({
        override: agentEntry.verboseDefault,
        fallback: defaults.verboseDefault,
      }),
      reasoningDefault: effectiveField({
        override: agentEntry.reasoningDefault,
        fallback: defaults.reasoningDefault,
      }),
      fastModeDefault: effectiveField({
        override: agentEntry.fastModeDefault,
        fallback: defaults.fastModeDefault,
      }),
      memorySearch: effectiveField({
        override: agentEntry.memorySearch,
        fallback: defaults.memorySearch,
      }),
      memorySearchSync: effectiveField({
        override: getNested(agentEntry, ["memorySearch", "sync"]),
        fallback: getNested(defaults, ["memorySearch", "sync"]),
      }),
      heartbeat: effectiveField({ override: agentEntry.heartbeat, fallback: defaults.heartbeat }),
      heartbeatPrompt: effectiveField({
        override: getNested(agentEntry, ["heartbeat", "prompt"]),
        fallback: getNested(defaults, ["heartbeat", "prompt"]),
      }),
      humanDelay: effectiveField({
        override: agentEntry.humanDelay,
        fallback: defaults.humanDelay,
      }),
      humanDelayMode: effectiveField({
        override: getNested(agentEntry, ["humanDelay", "mode"]),
        fallback: getNested(defaults, ["humanDelay", "mode"]),
      }),
      groupChat: effectiveField({ override: agentEntry.groupChat, fallback: defaults.groupChat }),
      systemPromptOverride: effectiveField({
        override: agentEntry.systemPromptOverride,
        fallback: defaults.systemPromptOverride,
      }),
      subagents: effectiveField({ override: agentEntry.subagents, fallback: defaults.subagents }),
      subagentsAllowAgents: effectiveField({
        override: getNested(agentEntry, ["subagents", "allowAgents"]),
        fallback: getNested(defaults, ["subagents", "allowAgents"]),
      }),
      subagentsModel: effectiveField({
        override: getNested(agentEntry, ["subagents", "model"]),
        fallback: getNested(defaults, ["subagents", "model"]),
      }),
      subagentsRequireAgentId: effectiveField({
        override: getNested(agentEntry, ["subagents", "requireAgentId"]),
        fallback: getNested(defaults, ["subagents", "requireAgentId"]),
      }),
      subagentsLimits: effectiveField({
        override: undefined,
        fallback: {
          maxSpawnDepth: globalDefaults?.maxSpawnDepth,
          maxChildrenPerAgent: globalDefaults?.maxChildrenPerAgent,
        },
      }),
    };
    const unresolvedReferences = collectUnresolvedReferences({
      cfg,
      agentId,
      effectiveSkills,
      availableSkills: allSkillKeys,
      eventStreams: effectiveEventStreams,
      models: [effectiveModel, resolveModelString(agentSubagents?.model)],
    });

    respond(true, {
      id: agentId,
      name: agentConfig.name,
      workspace: workspaceDir,
      agentDir: agentConfig.agentDir,
      model: effectiveModel,
      thinkingDefault,
      verboseDefault,
      reasoningDefault,
      fastModeDefault,
      memorySearch: agentConfig.memorySearch,
      humanDelay: agentConfig.humanDelay,
      heartbeat: agentConfig.heartbeat,
      eventStreams: effectiveEventStreams,
      groupChat: agentConfig.groupChat,
      embeddedHarness: isRecord(agentEntry.embeddedHarness)
        ? agentEntry.embeddedHarness
        : isRecord(defaults.embeddedHarness)
          ? defaults.embeddedHarness
          : undefined,
      embeddedPi: isRecord(agentConfig.embeddedPi) ? agentConfig.embeddedPi : undefined,
      params: isRecord(agentEntry.params) ? agentEntry.params : undefined,
      runtime: isRecord(agentEntry.runtime) ? agentEntry.runtime : undefined,
      tools: isRecord(agentConfig.tools) ? agentConfig.tools : undefined,
      systemPromptOverride: agentConfig.systemPromptOverride,
      isDefault,
      isConfiguredDefault: isDefault,
      isMainProtected,
      mainKey,
      protectedReasons,
      availableActions: {
        canEditIdentity: true,
        canEditRuntime: true,
        canDelete: !isMainProtected,
        canChangeDefault: false,
        deleteDisabledReason: isMainProtected
          ? "main is the protected system/fallback agent"
          : undefined,
        guardedEditReasons: isMainProtected
          ? ["Runtime edits affect the protected system/fallback agent"]
          : ["Runtime edits can change live agent behavior"],
        unsupportedReasons: ["Default-agent switching is read-only in this pass"],
      },
      effectiveSources,
      inherited,
      unresolvedReferences,
      impact,
      guardedEdits: [
        {
          field: "workspace",
          risk: "high",
          reason: "Workspace changes alter file and bootstrap context for future runs",
          requiresConfirmation: true,
        },
        {
          field: "model",
          risk: "medium",
          reason: "Model changes alter runtime behavior and cost posture",
          requiresConfirmation: true,
        },
        {
          field: "skills",
          risk: "medium",
          reason: "Skills changes alter tool and context injection",
          requiresConfirmation: true,
        },
        {
          field: "subagents",
          risk: "medium",
          reason: "Subagent permission changes alter spawn behavior",
          requiresConfirmation: true,
        },
        {
          field: "eventStreams",
          risk: "medium",
          reason: "Event stream changes alter channel delivery behavior",
          requiresConfirmation: true,
        },
      ],
      bindingCount,
      sessionCount,
      activeSubagentCount,
      skillMode,
      effectiveSkills,
      totalAvailableSkills,
      subagents: {
        allowAgents,
        model: resolveModelString(agentSubagents?.model),
        requireAgentId: agentSubagents?.requireAgentId,
        effectiveMaxSpawnDepth,
        effectiveMaxChildrenPerAgent,
      },
      sandbox,
      identityExists,
      fallbackModels,
    });
  },
};

export const deckAgentsDetailMethodDefs: Record<string, MethodMetadata> = {
  "deck.agents.detail": {
    params: DeckAgentsDetailParamsSchema,
    result: DeckAgentsDetailResultSchema,
    scope: "operator.read",
    forkClass: "C1",
    bffEligible: false,
  },
};
