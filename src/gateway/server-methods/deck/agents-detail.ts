import { stat } from "node:fs/promises";
import { join } from "node:path";
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
  resolveAgentSkillsFilter,
  resolveAgentWorkspaceDir,
  resolveDefaultAgentId,
  buildWorkspaceSkillStatus,
} = agentsService;
const { loadConfig } = configService;

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

    const bindings = cfg.bindings ?? [];
    const bindingCount = bindings.filter((binding) => binding.agentId === agentId).length;

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
    const reasoningDefault = agentConfig.reasoningDefault ?? cfg.agents?.defaults?.reasoningDefault;
    const fastModeDefault = agentConfig.fastModeDefault ?? cfg.agents?.defaults?.fastModeDefault;

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

    respond(true, {
      id: agentId,
      name: agentConfig.name,
      workspace: workspaceDir,
      model: effectiveModel,
      reasoningDefault,
      fastModeDefault,
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
