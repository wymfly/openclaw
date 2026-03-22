import { resolveAgentConfig } from "../../../agents/agent-scope.js";
import { isToolAllowedByPolicyName } from "../../../agents/pi-tools.policy.js";
import { pickSandboxToolPolicy } from "../../../agents/sandbox-tool-policy.js";
import { listCoreToolSections } from "../../../agents/tool-catalog.js";
import {
  buildDefaultToolPolicyPipelineSteps,
  type ToolPolicyPipelineStep,
} from "../../../agents/tool-policy-pipeline.js";
import { resolveToolProfilePolicy } from "../../../agents/tool-policy.js";
import {
  loadConfig,
  readConfigFileSnapshotForWrite,
  resolveConfigSnapshotHash,
} from "../../../config/config.js";
import {
  ErrorCodes,
  errorShape,
  validateDeckAgentsToolPolicyPreviewParams,
} from "../../protocol/index.js";
import type { GatewayRequestHandlers } from "../types.js";
import { assertValidParams } from "../validation.js";

/** Collect all known core tool ids in stable order. */
function listAllCoreToolIds(): string[] {
  return listCoreToolSections().flatMap((section) => section.tools.map((t) => t.id));
}

export const deckAgentsPreviewHandlers: GatewayRequestHandlers = {
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
    const agentConfig = resolveAgentConfig(cfg, agentId);
    if (!agentConfig) {
      respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, `Agent "${agentId}" not found`));
      return;
    }

    // Resolve effective tool policy from config (same as pi-tools.ts runtime path)
    const agentTools = agentConfig.tools;
    const globalTools = cfg.tools;

    const profile = agentTools?.profile ?? globalTools?.profile;
    const profilePolicy = resolveToolProfilePolicy(profile);

    // For the preview, we don't have a model provider context, so provider policies
    // are resolved without model-specific matching (global byProvider is empty here).
    const globalPolicy = pickSandboxToolPolicy(globalTools);
    const agentPolicy = pickSandboxToolPolicy(agentTools);

    // Build the 7 pipeline steps
    const steps = buildDefaultToolPolicyPipelineSteps({
      profilePolicy,
      profile,
      globalPolicy,
      agentPolicy,
      agentId,
    });

    // Build list of all core tool ids
    const toolIds = listAllCoreToolIds();

    // For each step, resolve its SandboxToolPolicy and compute per-tool verdict
    const layers = steps.map((step: ToolPolicyPipelineStep) => {
      const sandboxPolicy = step.policy ? pickSandboxToolPolicy(step.policy) : undefined;
      return {
        label: step.label,
        active: sandboxPolicy !== undefined,
        allow: step.policy?.allow ?? null,
        deny: step.policy?.deny ?? null,
      };
    });

    const tools = toolIds.map((toolId) => {
      const perLayer = steps.map((step: ToolPolicyPipelineStep) => {
        const sandboxPolicy = step.policy ? pickSandboxToolPolicy(step.policy) : undefined;
        return isToolAllowedByPolicyName(toolId, sandboxPolicy);
      });
      // Final verdict: tool is allowed only if all layers allow it
      const allowed = perLayer.every(Boolean);
      return {
        id: toolId,
        allowed,
        perLayer,
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
