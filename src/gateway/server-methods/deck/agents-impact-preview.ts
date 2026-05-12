import { readdir } from "node:fs/promises";
import type { MethodMetadata } from "../../method-registry.js";
import {
  ErrorCodes,
  errorShape,
  validateDeckAgentsImpactPreviewParams,
} from "../../protocol/index.js";
import {
  DeckAgentsImpactPreviewParamsSchema,
  DeckAgentsImpactPreviewResultSchema,
} from "../../protocol/schema/deck.js";
import { agentsService } from "../../services/agents.service.js";
import { configService } from "../../services/config.service.js";
import type { GatewayRequestHandlers } from "../types.js";
import { assertValidParams } from "../validation.js";
import { resolveDeckAgentReadConfig } from "./agent-read-config.js";

const { resolveAgentWorkspaceDir } = agentsService;
const { readConfigFileSnapshotForWrite, resolveConfigSnapshotHash } = configService;

type ImpactOperation =
  | "edit-model"
  | "edit-workspace"
  | "edit-skills"
  | "edit-subagents"
  | "edit-tools"
  | "edit-delivery"
  | "edit-conversation"
  | "reset-field"
  | "delete-agent";

function riskSpecificsForOperation(operation: ImpactOperation): string[] {
  switch (operation) {
    case "edit-model":
      return ["Model changes can alter cost, latency, and response behavior for future runs."];
    case "edit-workspace":
      return ["Workspace changes alter file, bootstrap, and identity context for future runs."];
    case "edit-skills":
      return ["Skill changes alter tool and context injection behavior."];
    case "edit-subagents":
      return ["Subagent policy changes alter spawn permissions and child-agent model selection."];
    case "edit-tools":
      return ["Tool overrides can allow or block capabilities visible to the agent."];
    case "edit-delivery":
      return ["Delivery changes alter event-stream and heartbeat behavior."];
    case "edit-conversation":
      return ["Conversation settings change prompt and reply timing behavior."];
    case "reset-field":
      return [
        "Resetting fields restores inheritance from agent defaults or derived Gateway behavior.",
      ];
    case "delete-agent":
      return [
        "Deleting an agent removes its configuration and may orphan references in routing or sessions.",
      ];
  }
  return [];
}

function summarizeBinding(binding: {
  type?: string;
  match?: {
    channel?: string;
    accountId?: string;
    guildId?: string;
    teamId?: string;
    roles?: string[];
  };
}) {
  const match = binding.match ?? {};
  const account = match.accountId ? `/${match.accountId}` : "";
  const scope = match.guildId ?? match.teamId ?? match.roles?.join(",") ?? "default";
  return `${match.channel ?? "unknown"}${account} (${scope})`;
}

async function summarizeWorkspaceFiles(workspaceDir: string) {
  try {
    const entries = await readdir(workspaceDir, { withFileTypes: true });
    return {
      total: entries.filter((entry) => entry.isFile()).length,
      bootstrapPresent: entries.some((entry) => entry.isFile() && entry.name === "BOOTSTRAP.md"),
    };
  } catch {
    return { total: 0, bootstrapPresent: false, truncated: true };
  }
}

export const deckAgentsImpactPreviewHandlers: GatewayRequestHandlers = {
  "deck.agents.impactPreview.get": async ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateDeckAgentsImpactPreviewParams,
        "deck.agents.impactPreview.get",
        respond,
      )
    ) {
      return;
    }

    const { agentId, operation } = params as { agentId: string; operation: ImpactOperation };
    const { snapshot } = await readConfigFileSnapshotForWrite();
    const cfg = snapshot.config;
    const agentConfig = resolveDeckAgentReadConfig(cfg, agentId);
    if (!agentConfig) {
      respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, `Agent "${agentId}" not found`));
      return;
    }

    const bindings = (cfg.bindings ?? []).filter((binding) => binding.agentId === agentId);
    const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
    const files = await summarizeWorkspaceFiles(workspaceDir);
    const baseHash = resolveConfigSnapshotHash(snapshot) ?? "";

    respond(true, {
      agentId,
      operation,
      impact: {
        bindingCount: bindings.length,
        sessionCount: 0,
        activeSubagentCount: 0,
        workspaceFileCount: files.total,
        deleteRemovesFiles: operation === "delete-agent",
        bindings: {
          count: bindings.length,
          samples: bindings.slice(0, 5).map((binding, bindingIndex) => ({
            bindingIndex,
            type: binding.type,
            channel: binding.match?.channel,
            accountId: binding.match?.accountId,
            peer: binding.match?.peer,
            guildId: binding.match?.guildId,
            teamId: binding.match?.teamId,
            roles: binding.match?.roles,
            summary: summarizeBinding(binding),
          })),
          truncated: bindings.length > 5,
        },
        sessions: {
          total: 0,
          active: 0,
        },
        files,
        capturedAt: new Date().toISOString(),
        available: true,
      },
      riskSpecifics: riskSpecificsForOperation(operation),
      canProceedWithoutImpact: false,
      baseHash,
    });
  },
};

export const deckAgentsImpactPreviewMethodDefs: Record<string, MethodMetadata> = {
  "deck.agents.impactPreview.get": {
    params: DeckAgentsImpactPreviewParamsSchema,
    result: DeckAgentsImpactPreviewResultSchema,
    scope: "operator.read",
    forkClass: "C1",
    bffEligible: false,
  },
};
