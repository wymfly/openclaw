import { DEFAULT_EVENT_STREAMS } from "../../channel-event-filter.js";
import type { MethodMetadata } from "../../method-registry.js";
import {
  ErrorCodes,
  errorShape,
  validateDeckAgentsEventStreamsGetParams,
  validateDeckAgentsEventStreamsSetParams,
} from "../../protocol/index.js";
import {
  DeckAgentsEventStreamsGetParamsSchema,
  DeckAgentsEventStreamsGetResultSchema,
  DeckAgentsEventStreamsSetParamsSchema,
  DeckAgentsEventStreamsSetResultSchema,
} from "../../protocol/schema/deck.js";
import { configService } from "../../services/config.service.js";
import type { GatewayRequestHandlers } from "../types.js";
import { assertValidParams } from "../validation.js";
import { resolveDeckAgentReadConfig } from "./agent-read-config.js";
import { validateBaseHash } from "./utils.js";

const { loadConfig, readConfigFileSnapshotForWrite, resolveConfigSnapshotHash, writeConfigFile } =
  configService;

export const deckAgentsEventStreamsHandlers: GatewayRequestHandlers = {
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
    const agentConfig = resolveDeckAgentReadConfig(cfg, agentId);
    if (!agentConfig) {
      respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, `Agent "${agentId}" not found`));
      return;
    }

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

    const normalized = [
      ...new Set(eventStreams.map((stream) => stream.trim().toLowerCase()).filter(Boolean)),
    ];

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

export const deckAgentsEventStreamsMethodDefs: Record<string, MethodMetadata> = {
  "deck.agents.eventStreams.get": {
    params: DeckAgentsEventStreamsGetParamsSchema,
    result: DeckAgentsEventStreamsGetResultSchema,
    scope: "operator.read",
    forkClass: "C4",
    bffEligible: false,
  },
  "deck.agents.eventStreams.set": {
    params: DeckAgentsEventStreamsSetParamsSchema,
    result: DeckAgentsEventStreamsSetResultSchema,
    scope: "operator.admin",
    controlPlaneWrite: true,
    forkClass: "C2",
    bffEligible: false,
  },
};
