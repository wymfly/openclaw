import type { MethodMetadata } from "../../method-registry.js";
import {
  ErrorCodes,
  errorShape,
  validateDeckAgentsSkillsGetParams,
  validateDeckAgentsSkillsSetParams,
} from "../../protocol/index.js";
import {
  DeckAgentsSkillsGetParamsSchema,
  DeckAgentsSkillsGetResultSchema,
  DeckAgentsSkillsSetParamsSchema,
  DeckAgentsSkillsSetResultSchema,
} from "../../protocol/schema/deck.js";
import { agentsService } from "../../services/agents.service.js";
import { configService } from "../../services/config.service.js";
import type { GatewayRequestHandlers } from "../types.js";
import { assertValidParams } from "../validation.js";
import { resolveDeckAgentReadConfig } from "./agent-read-config.js";
import { validateBaseHash } from "./utils.js";

const { resolveAgentSkillsFilter, resolveAgentWorkspaceDir, buildWorkspaceSkillStatus } =
  agentsService;
const { loadConfig, readConfigFileSnapshotForWrite, resolveConfigSnapshotHash, writeConfigFile } =
  configService;

export const deckAgentsSkillsHandlers: GatewayRequestHandlers = {
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
    const agentConfig = resolveDeckAgentReadConfig(cfg, agentId);
    if (!agentConfig) {
      respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, `Agent "${agentId}" not found`));
      return;
    }

    const skillFilter = resolveAgentSkillsFilter(cfg, agentId);
    const mode = skillFilter === undefined ? "all" : "whitelist";
    const skills = skillFilter ?? [];
    const assignedSet = new Set(skills);

    const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
    const skillReport = buildWorkspaceSkillStatus(workspaceDir, { config: cfg });
    const available = skillReport.skills.map((skill) => ({
      key: skill.skillKey,
      name: skill.name,
      eligible: skill.eligible,
      assigned: assignedSet.has(skill.skillKey),
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
      respond(
        false,
        undefined,
        errorShape(
          hashError.code,
          hashError.message,
          hashError.details ? { details: hashError.details } : undefined,
        ),
      );
      return;
    }

    const cfg = structuredClone(snapshot.config);
    const agentList = cfg.agents?.list;
    if (!Array.isArray(agentList)) {
      respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, `Agent "${agentId}" not found`));
      return;
    }
    const agentEntry = agentList.find((agent) => agent.id === agentId);
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
};

export const deckAgentsSkillsMethodDefs: Record<string, MethodMetadata> = {
  "deck.agents.skills.get": {
    params: DeckAgentsSkillsGetParamsSchema,
    result: DeckAgentsSkillsGetResultSchema,
    scope: "operator.read",
    forkClass: "C1",
    bffEligible: false,
  },
  "deck.agents.skills.set": {
    params: DeckAgentsSkillsSetParamsSchema,
    result: DeckAgentsSkillsSetResultSchema,
    scope: "operator.admin",
    controlPlaneWrite: true,
    forkClass: "C2",
    bffEligible: false,
  },
};
