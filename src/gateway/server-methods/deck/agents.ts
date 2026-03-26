import { stat } from "node:fs/promises";
import { join } from "node:path";
import {
  listAgentIds,
  resolveAgentConfig,
  resolveAgentSkillsFilter,
  resolveDefaultAgentId,
} from "../../../agents/agent-scope.js";
import { buildWorkspaceSkillStatus } from "../../../agents/skills-status.js";
import {
  loadConfig,
  readConfigFileSnapshotForWrite,
  resolveConfigSnapshotHash,
  writeConfigFile,
} from "../../../config/config.js";
import { DEFAULT_EVENT_STREAMS } from "../../channel-event-filter.js";
import {
  ErrorCodes,
  errorShape,
  validateDeckAgentsDetailParams,
  validateDeckAgentsEventStreamsGetParams,
  validateDeckAgentsEventStreamsSetParams,
  validateDeckAgentsSkillsGetParams,
  validateDeckAgentsSkillsSetParams,
  validateDeckAgentsSubagentsGetParams,
  validateDeckAgentsSubagentsSetParams,
} from "../../protocol/index.js";
import type { GatewayRequestHandlers } from "../types.js";
import { assertValidParams } from "../validation.js";
import { validateBaseHash } from "./utils.js";

function resolveModelString(model: unknown): string | undefined {
  if (typeof model === "string") {
    return model || undefined;
  }
  if (model && typeof model === "object" && "primary" in model) {
    const primary = (model as { primary?: unknown }).primary;
    return typeof primary === "string" ? primary || undefined : undefined;
  }
  return undefined;
}

export const deckAgentsHandlers: GatewayRequestHandlers = {
  "deck.agents.detail": async ({ params, respond }) => {
    if (!assertValidParams(params, validateDeckAgentsDetailParams, "deck.agents.detail", respond)) {
      return;
    }
    const cfg = loadConfig();
    const agentId = (params as { agentId: string }).agentId;
    const agentConfig = resolveAgentConfig(cfg, agentId);
    if (!agentConfig) {
      respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, `Agent "${agentId}" not found`));
      return;
    }

    const defaultAgentId = resolveDefaultAgentId(cfg);
    const isDefault = agentId === defaultAgentId;

    // Binding count
    const bindings = cfg.bindings ?? [];
    const bindingCount = bindings.filter((b) => b.agentId === agentId).length;

    // Session count + active subagent count — stubbed to 0 (no session store access in this handler)
    const sessionCount = 0;
    const activeSubagentCount = 0;

    // Skills
    const skillFilter = resolveAgentSkillsFilter(cfg, agentId);
    const skillMode = skillFilter === undefined ? "all" : "whitelist";
    const workspaceDir = agentConfig.workspace ?? "/tmp";
    const skillReport = buildWorkspaceSkillStatus(workspaceDir, { config: cfg });
    const allSkillKeys = skillReport.skills.map((s) => s.skillKey);
    const effectiveSkills = skillMode === "all" ? allSkillKeys : (skillFilter ?? []);
    const totalAvailableSkills = allSkillKeys.length;

    // Sandbox config
    const sandbox = agentConfig.sandbox;

    // Identity existence check
    let identityExists = false;
    try {
      const identityPath = join(workspaceDir, "IDENTITY.md");
      await stat(identityPath);
      identityExists = true;
    } catch {
      // File does not exist
    }

    // Effective model: per-agent → defaults fallback
    const effectiveModel =
      resolveModelString(agentConfig.model) ??
      resolveModelString(cfg.agents?.defaults?.model);

    // Fallback models: per-agent → defaults fallback
    const agentModelObj = agentConfig.model ?? cfg.agents?.defaults?.model;
    let fallbackModels: string[] | undefined;
    if (agentModelObj && typeof agentModelObj === "object" && "fallbacks" in agentModelObj) {
      const fb = (agentModelObj as { fallbacks?: string[] }).fallbacks;
      if (Array.isArray(fb)) {
        fallbackModels = fb;
      }
    }

    // Subagents
    const agentSubagents = agentConfig.subagents;
    const globalDefaults = cfg.agents?.defaults?.subagents;
    const allowAgents = agentSubagents?.allowAgents ?? [];
    const effectiveMaxSpawnDepth = globalDefaults?.maxSpawnDepth ?? 1;
    const effectiveMaxChildrenPerAgent = globalDefaults?.maxChildrenPerAgent ?? 5;

    respond(true, {
      id: agentId,
      name: agentConfig.name,
      workspace: agentConfig.workspace,
      model: effectiveModel,
      isDefault,
      bindingCount,
      sessionCount,
      activeSubagentCount,
      skillMode,
      effectiveSkills,
      totalAvailableSkills,
      subagents: {
        allowAgents,
        model: resolveModelString(agentSubagents?.model),
        effectiveMaxSpawnDepth,
        effectiveMaxChildrenPerAgent,
      },
      sandbox,
      identityExists,
      fallbackModels,
    });
  },

  "deck.agents.skills.get": async ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateDeckAgentsSkillsGetParams,
        "deck.agents.skills.get",
        respond,
      )
    ) {
      return;
    }
    const cfg = loadConfig();
    const agentId = (params as { agentId: string }).agentId;
    const agentConfig = resolveAgentConfig(cfg, agentId);
    if (!agentConfig) {
      respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, `Agent "${agentId}" not found`));
      return;
    }

    const skillFilter = resolveAgentSkillsFilter(cfg, agentId);
    const mode = skillFilter === undefined ? "all" : "whitelist";
    const skills = skillFilter ?? [];
    const assignedSet = new Set(skills);

    const workspaceDir = agentConfig.workspace ?? "/tmp";
    const skillReport = buildWorkspaceSkillStatus(workspaceDir, { config: cfg });
    const available = skillReport.skills.map((s) => ({
      key: s.skillKey,
      name: s.name,
      eligible: s.eligible,
      assigned: assignedSet.has(s.skillKey),
    }));

    const { snapshot } = await readConfigFileSnapshotForWrite();
    const configHash = resolveConfigSnapshotHash(snapshot) ?? "";

    respond(true, {
      agentId,
      mode,
      skills,
      available,
      configHash,
    });
  },

  "deck.agents.skills.set": async ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateDeckAgentsSkillsSetParams,
        "deck.agents.skills.set",
        respond,
      )
    ) {
      return;
    }
    const { agentId, mode, skills, baseHash } = params as {
      agentId: string;
      mode: "all" | "whitelist";
      skills: string[];
      baseHash: string;
    };

    const { snapshot, writeOptions } = await readConfigFileSnapshotForWrite();
    const currentHash = resolveConfigSnapshotHash(snapshot) ?? "";
    const hashError = validateBaseHash(baseHash, currentHash);
    if (hashError) {
      respond(false, undefined, errorShape(hashError.code, hashError.message));
      return;
    }

    const cfg = structuredClone(snapshot.config);
    const agentList = cfg.agents?.list;
    if (!Array.isArray(agentList)) {
      respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, `Agent "${agentId}" not found`));
      return;
    }
    const agentEntry = agentList.find((a) => a.id === agentId);
    if (!agentEntry) {
      respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, `Agent "${agentId}" not found`));
      return;
    }

    if (mode === "all") {
      delete (agentEntry as Record<string, unknown>).skills;
    } else {
      agentEntry.skills = skills;
    }

    await writeConfigFile(cfg, writeOptions);

    // Re-read hash after write
    const { snapshot: newSnapshot } = await readConfigFileSnapshotForWrite();
    const configHash = resolveConfigSnapshotHash(newSnapshot) ?? "";

    respond(true, {
      ok: true,
      agentId,
      mode,
      skills: mode === "all" ? [] : skills,
      configHash,
    });
  },

  "deck.agents.subagents.get": async ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateDeckAgentsSubagentsGetParams,
        "deck.agents.subagents.get",
        respond,
      )
    ) {
      return;
    }
    const cfg = loadConfig();
    const agentId = (params as { agentId: string }).agentId;
    const agentConfig = resolveAgentConfig(cfg, agentId);
    if (!agentConfig) {
      respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, `Agent "${agentId}" not found`));
      return;
    }

    const agentSubagents = agentConfig.subagents;
    const allowAgents = agentSubagents?.allowAgents ?? [];
    const allowAny = allowAgents.includes("*");
    const model = resolveModelString(agentSubagents?.model);

    const globalDefaults = cfg.agents?.defaults?.subagents;
    const effectiveMaxSpawnDepth = globalDefaults?.maxSpawnDepth ?? 1;
    const effectiveMaxChildrenPerAgent = globalDefaults?.maxChildrenPerAgent ?? 5;
    const effectiveThinking = globalDefaults?.thinking;

    // Build agent lists
    const allIds = listAgentIds(cfg);
    const allAgentEntries = allIds.map((id) => {
      const ac = resolveAgentConfig(cfg, id);
      return { id, name: ac?.name };
    });
    const allowedAgents = allowAny
      ? allAgentEntries
      : allowAgents
          .filter((id) => id !== "*")
          .map((id) => {
            const ac = resolveAgentConfig(cfg, id);
            return { id, name: ac?.name };
          });

    const { snapshot } = await readConfigFileSnapshotForWrite();
    const configHash = resolveConfigSnapshotHash(snapshot) ?? "";

    respond(true, {
      agentId,
      allowAgents,
      allowAny,
      model,
      effectiveMaxSpawnDepth,
      effectiveMaxChildrenPerAgent,
      effectiveThinking,
      allowedAgents,
      allAgents: allAgentEntries,
      configHash,
    });
  },

  "deck.agents.subagents.set": async ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateDeckAgentsSubagentsSetParams,
        "deck.agents.subagents.set",
        respond,
      )
    ) {
      return;
    }
    const { agentId, allowAgents, model, baseHash } = params as {
      agentId: string;
      allowAgents: string[];
      model?: string | null;
      baseHash: string;
    };

    const { snapshot, writeOptions } = await readConfigFileSnapshotForWrite();
    const currentHash = resolveConfigSnapshotHash(snapshot) ?? "";
    const hashError = validateBaseHash(baseHash, currentHash);
    if (hashError) {
      respond(false, undefined, errorShape(hashError.code, hashError.message));
      return;
    }

    const cfg = structuredClone(snapshot.config);
    const agentList = cfg.agents?.list;
    if (!Array.isArray(agentList)) {
      respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, `Agent "${agentId}" not found`));
      return;
    }
    const agentEntry = agentList.find((a) => a.id === agentId);
    if (!agentEntry) {
      respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, `Agent "${agentId}" not found`));
      return;
    }

    // Write ONLY allowAgents + model to per-agent subagents config
    // Never write maxSpawnDepth, maxChildrenPerAgent, or thinking
    const subagents: { allowAgents: string[]; model?: string } = { allowAgents };
    if (model !== null && model !== undefined) {
      subagents.model = model;
    }
    (agentEntry as Record<string, unknown>).subagents = subagents;

    await writeConfigFile(cfg, writeOptions);

    const { snapshot: newSnapshot } = await readConfigFileSnapshotForWrite();
    const configHash = resolveConfigSnapshotHash(newSnapshot) ?? "";

    const resolvedModel = model === null ? undefined : model;

    respond(true, {
      ok: true,
      agentId,
      allowAgents,
      model: resolvedModel,
      configHash,
    });
  },

  "deck.agents.eventStreams.get": async ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateDeckAgentsEventStreamsGetParams,
        "deck.agents.eventStreams.get",
        respond,
      )
    ) {
      return;
    }
    const cfg = loadConfig();
    const agentId = (params as { agentId: string }).agentId;
    const agentConfig = resolveAgentConfig(cfg, agentId);
    if (!agentConfig) {
      respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, `Agent "${agentId}" not found`));
      return;
    }

    // Resolve effective eventStreams with fallback chain
    // Semantic: undefined = not set (use fallback), [] = explicitly empty (filter all agent streams)
    const agentStreams = agentConfig.channels?.eventStreams;
    const defaultStreams = cfg.agents?.defaults?.channels?.eventStreams;
    const effectiveStreams =
      agentStreams !== undefined
        ? agentStreams
        : defaultStreams !== undefined
          ? defaultStreams
          : [...DEFAULT_EVENT_STREAMS];
    const isDefault = agentStreams === undefined;

    const { snapshot } = await readConfigFileSnapshotForWrite();
    const configHash = resolveConfigSnapshotHash(snapshot) ?? "";

    respond(true, {
      agentId,
      eventStreams: effectiveStreams,
      isDefault,
      configHash,
    });
  },

  "deck.agents.eventStreams.set": async ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateDeckAgentsEventStreamsSetParams,
        "deck.agents.eventStreams.set",
        respond,
      )
    ) {
      return;
    }
    const { agentId, eventStreams, baseHash } = params as {
      agentId: string;
      eventStreams: string[];
      baseHash: string;
    };

    // [enhanced] Normalize: lowercase, trim, dedupe — reject non-canonical values like "Assistant" or " lifecycle "
    const normalized = [
      ...new Set(eventStreams.map((s) => s.trim().toLowerCase()).filter(Boolean)),
    ];

    const { snapshot, writeOptions } = await readConfigFileSnapshotForWrite();
    const currentHash = resolveConfigSnapshotHash(snapshot) ?? "";
    const hashError = validateBaseHash(baseHash, currentHash);
    if (hashError) {
      respond(false, undefined, errorShape(hashError.code, hashError.message));
      return;
    }

    const cfg = structuredClone(snapshot.config);
    const agentList = cfg.agents?.list;
    if (!Array.isArray(agentList)) {
      respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, `Agent "${agentId}" not found`));
      return;
    }
    const agentEntry = agentList.find((a) => a.id === agentId);
    if (!agentEntry) {
      respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, `Agent "${agentId}" not found`));
      return;
    }

    if (!agentEntry.channels) {
      (agentEntry as Record<string, unknown>).channels = {};
    }
    (agentEntry.channels as Record<string, unknown>).eventStreams = normalized;

    await writeConfigFile(cfg, writeOptions);

    const { snapshot: newSnapshot } = await readConfigFileSnapshotForWrite();
    const configHash = resolveConfigSnapshotHash(newSnapshot) ?? "";

    respond(true, {
      ok: true,
      agentId,
      eventStreams: normalized,
      configHash,
    });
  },
};
