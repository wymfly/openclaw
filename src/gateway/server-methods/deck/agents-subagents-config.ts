import type { MethodMetadata } from "../../method-registry.js";
import {
  ErrorCodes,
  errorShape,
  validateDeckAgentsSubagentsGetParams,
  validateDeckAgentsSubagentsSetParams,
} from "../../protocol/index.js";
import {
  DeckAgentsSubagentsGetParamsSchema,
  DeckAgentsSubagentsGetResultSchema,
  DeckAgentsSubagentsSetParamsSchema,
  DeckAgentsSubagentsSetResultSchema,
} from "../../protocol/schema/deck.js";
import { agentsService } from "../../services/agents.service.js";
import { configService } from "../../services/config.service.js";
import type { GatewayRequestHandlers } from "../types.js";
import { assertValidParams } from "../validation.js";
import { resolveDeckAgentReadConfig } from "./agent-read-config.js";
import { resolveModelString } from "./agents-shared.js";
import { validateBaseHash } from "./utils.js";

const { listAgentIds } = agentsService;
const { loadConfig, readConfigFileSnapshotForWrite, resolveConfigSnapshotHash, writeConfigFile } =
  configService;

export const deckAgentsSubagentsConfigHandlers: GatewayRequestHandlers = {
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
    const agentConfig = resolveDeckAgentReadConfig(cfg, agentId);
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

    const allIds = listAgentIds(cfg);
    const allAgentEntries = allIds.map((id) => {
      const agent = resolveDeckAgentReadConfig(cfg, id);
      return { id, name: agent?.name };
    });
    const allowedAgents = allowAny
      ? allAgentEntries
      : allowAgents
          .filter((id) => id !== "*")
          .map((id) => {
            const agent = resolveDeckAgentReadConfig(cfg, id);
            return { id, name: agent?.name };
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

    const subagents: { allowAgents: string[]; model?: string } = { allowAgents };
    if (model !== null && model !== undefined) {
      subagents.model = model;
    }
    (agentEntry as Record<string, unknown>).subagents = subagents;

    await writeConfigFile(cfg, writeOptions);

    const { snapshot: newSnapshot } = await readConfigFileSnapshotForWrite();
    const configHash = resolveConfigSnapshotHash(newSnapshot) ?? "";

    respond(true, {
      ok: true,
      agentId,
      allowAgents,
      model: model === null ? undefined : model,
      configHash,
    });
  },
};

export const deckAgentsSubagentsConfigMethodDefs: Record<string, MethodMetadata> = {
  "deck.agents.subagents.get": {
    params: DeckAgentsSubagentsGetParamsSchema,
    result: DeckAgentsSubagentsGetResultSchema,
    scope: "operator.read",
    forkClass: "C1",
    bffEligible: false,
  },
  "deck.agents.subagents.set": {
    params: DeckAgentsSubagentsSetParamsSchema,
    result: DeckAgentsSubagentsSetResultSchema,
    scope: "operator.admin",
    controlPlaneWrite: true,
    forkClass: "C2",
    bffEligible: false,
  },
};
