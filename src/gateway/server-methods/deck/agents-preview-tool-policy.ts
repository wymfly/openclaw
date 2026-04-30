import type { MethodMetadata } from "../../method-registry.js";
import {
  ErrorCodes,
  errorShape,
  validateDeckAgentsToolPolicyPreviewParams,
} from "../../protocol/index.js";
import {
  DeckAgentsToolPolicyPreviewParamsSchema,
  DeckAgentsToolPolicyPreviewResultSchema,
} from "../../protocol/schema/deck.js";
import { configService } from "../../services/config.service.js";
import { skillsService } from "../../services/skills.service.js";
import type { ToolPolicyPipelineStep } from "../../services/skills.service.js";
import type { GatewayRequestHandlers } from "../types.js";
import { assertValidParams } from "../validation.js";
import { resolveDeckAgentReadConfig } from "./agent-read-config.js";

const {
  buildDefaultToolPolicyPipelineSteps,
  isToolAllowedByPolicyName,
  listCoreToolSections,
  pickSandboxToolPolicy,
  resolveToolProfilePolicy,
} = skillsService;
const { loadConfig, readConfigFileSnapshotForWrite, resolveConfigSnapshotHash } = configService;

function listAllCoreToolIds(): string[] {
  return listCoreToolSections().flatMap((section) => section.tools.map((tool) => tool.id));
}

export const deckAgentsToolPolicyPreviewHandlers: GatewayRequestHandlers = {
  "deck.agents.toolPolicy.preview": async ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateDeckAgentsToolPolicyPreviewParams,
        "deck.agents.toolPolicy.preview",
        respond,
      )
    ) {
      return;
    }
    const { agentId } = params as {
      agentId: string;
      context?: { channel?: string; chatType?: string };
    };

    const cfg = loadConfig();
    const agentConfig = resolveDeckAgentReadConfig(cfg, agentId);
    if (!agentConfig) {
      respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, `Agent "${agentId}" not found`));
      return;
    }

    const agentTools = agentConfig.tools;
    const globalTools = cfg.tools;

    const profile = agentTools?.profile ?? globalTools?.profile;
    const profilePolicy = resolveToolProfilePolicy(profile);
    const globalPolicy = pickSandboxToolPolicy(globalTools);
    const agentPolicy = pickSandboxToolPolicy(agentTools);

    const steps = buildDefaultToolPolicyPipelineSteps({
      profilePolicy,
      profile,
      globalPolicy,
      agentPolicy,
      agentId,
    });

    const layers = steps.map((step: ToolPolicyPipelineStep) => {
      const allowLen = step.policy?.allow?.length ?? 0;
      const denyLen = step.policy?.deny?.length ?? 0;
      return {
        label: step.label,
        ruleCount: allowLen + denyLen,
        effect: !step.policy
          ? "passthrough"
          : denyLen > 0
            ? "deny"
            : allowLen > 0
              ? "allow"
              : "passthrough",
      };
    });

    const tools = listAllCoreToolIds().map((toolId) => {
      const perLayer = steps.map((step: ToolPolicyPipelineStep) => {
        const sandboxPolicy = step.policy ? pickSandboxToolPolicy(step.policy) : undefined;
        return isToolAllowedByPolicyName(toolId, sandboxPolicy);
      });
      const allowed = perLayer.every(Boolean);

      const trace = steps.map((step, index) => ({
        layer: step.label,
        decision: !step.policy ? "no-opinion" : perLayer[index] ? "allow" : "deny",
      }));

      let decisiveLayer = "default";
      for (let index = trace.length - 1; index >= 0; index -= 1) {
        if (trace[index].decision !== "no-opinion") {
          decisiveLayer = trace[index].layer;
          break;
        }
      }

      return {
        name: toolId,
        allowed,
        decisiveLayer,
        trace,
      };
    });

    const { snapshot } = await readConfigFileSnapshotForWrite();
    const configHash = resolveConfigSnapshotHash(snapshot) ?? "";

    respond(true, {
      layers,
      tools,
      configHash,
    });
  },
};

export const deckAgentsToolPolicyPreviewMethodDefs: Record<string, MethodMetadata> = {
  "deck.agents.toolPolicy.preview": {
    params: DeckAgentsToolPolicyPreviewParamsSchema,
    result: DeckAgentsToolPolicyPreviewResultSchema,
    scope: "operator.read",
    forkClass: "C4",
    bffEligible: false,
  },
};
