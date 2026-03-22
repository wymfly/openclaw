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
  DEFAULT_AGENTS_FILENAME,
  DEFAULT_BOOTSTRAP_FILENAME,
  DEFAULT_HEARTBEAT_FILENAME,
  DEFAULT_IDENTITY_FILENAME,
  DEFAULT_SOUL_FILENAME,
  DEFAULT_TOOLS_FILENAME,
  DEFAULT_USER_FILENAME,
  loadWorkspaceBootstrapFiles,
} from "../../../agents/workspace.js";
import {
  loadConfig,
  readConfigFileSnapshotForWrite,
  resolveConfigSnapshotHash,
} from "../../../config/config.js";
import {
  ErrorCodes,
  errorShape,
  validateDeckAgentsSystemPromptPreviewParams,
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

    // For each step, compute layer summary matching frontend ToolPolicyLayer shape
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

    const tools = toolIds.map((toolId) => {
      const perLayer = steps.map((step: ToolPolicyPipelineStep) => {
        const sandboxPolicy = step.policy ? pickSandboxToolPolicy(step.policy) : undefined;
        return isToolAllowedByPolicyName(toolId, sandboxPolicy);
      });
      // Final verdict: tool is allowed only if all layers allow it
      const allowed = perLayer.every(Boolean);

      // Build trace with per-layer decisions
      const trace = steps.map((step, i) => ({
        layer: step.label,
        decision: !step.policy ? "no-opinion" : perLayer[i] ? "allow" : "deny",
      }));

      // Find the last layer that made a decision (not "no-opinion")
      let decisiveLayer = "default";
      for (let i = trace.length - 1; i >= 0; i--) {
        if (trace[i].decision !== "no-opinion") {
          decisiveLayer = trace[i].layer;
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

  "deck.agents.systemPrompt.preview": async ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateDeckAgentsSystemPromptPreviewParams,
        "deck.agents.systemPrompt.preview",
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

    const workspaceDir = agentConfig.workspace ?? "/tmp";

    // Load bootstrap files from the workspace
    const bootstrapFiles = await loadWorkspaceBootstrapFiles(workspaceDir);

    // Well-known file list to surface in the response
    const WELL_KNOWN_FILES = [
      DEFAULT_AGENTS_FILENAME,
      DEFAULT_SOUL_FILENAME,
      DEFAULT_TOOLS_FILENAME,
      DEFAULT_IDENTITY_FILENAME,
      DEFAULT_USER_FILENAME,
      DEFAULT_HEARTBEAT_FILENAME,
      DEFAULT_BOOTSTRAP_FILENAME,
    ] as const;

    const fileStats = WELL_KNOWN_FILES.map((name) => {
      const found = bootstrapFiles.find((f) => f.name === name);
      if (!found || found.missing) {
        return { name, exists: false, charCount: 0 };
      }
      return { name, exists: true, charCount: found.content?.length ?? 0 };
    });

    // Compute aggregate char counts for each layer
    const bootstrapChars = fileStats.reduce((sum, f) => sum + f.charCount, 0);
    const identityFile = fileStats.find((f) => f.name === DEFAULT_IDENTITY_FILENAME);
    const identityChars = identityFile?.charCount ?? 0;

    // Extra instructions from agent config systemPrompt field
    const extraInstructions =
      typeof (agentConfig as { systemPrompt?: unknown }).systemPrompt === "string"
        ? ((agentConfig as { systemPrompt: string }).systemPrompt ?? "")
        : "";

    const layers = [
      {
        label: "Bootstrap Files",
        source: workspaceDir,
        charCount: bootstrapChars,
        fileCount: fileStats.filter((f) => f.exists).length,
      },
      {
        label: "Identity",
        source: DEFAULT_IDENTITY_FILENAME,
        charCount: identityChars,
        fileCount: identityChars > 0 ? 1 : 0,
      },
      {
        label: "Skills Prompt",
        source: "skills injection",
        // Cannot estimate without a live session (skills loaded at runtime)
        charCount: 0,
        fileCount: 0,
      },
      {
        label: "Extra Instructions",
        source: "agents.systemPrompt",
        charCount: extraInstructions.length,
        fileCount: extraInstructions.length > 0 ? 1 : 0,
      },
    ];

    const totalChars = bootstrapChars + extraInstructions.length;

    const { snapshot } = await readConfigFileSnapshotForWrite();
    const configHash = resolveConfigSnapshotHash(snapshot) ?? "";

    respond(true, {
      layers,
      bootstrapFiles: fileStats,
      totalChars,
      configHash,
    });
  },
};
