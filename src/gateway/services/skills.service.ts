import { isToolAllowedByPolicyName } from "../../agents/pi-tools.policy.js";
import { pickSandboxToolPolicy } from "../../agents/sandbox-tool-policy.js";
import { listCoreToolSections } from "../../agents/tool-catalog.js";
import { buildDefaultToolPolicyPipelineSteps } from "../../agents/tool-policy-pipeline.js";
import type { ToolPolicyPipelineStep } from "../../agents/tool-policy-pipeline.js";
import { resolveToolProfilePolicy } from "../../agents/tool-policy.js";
import { getChatCommands } from "../../auto-reply/commands-registry.data.js";
import type { ChatCommandDefinition } from "../../auto-reply/commands-registry.types.js";
import { listSkillCommandsForAgents } from "../../auto-reply/skill-commands.js";

export type { ChatCommandDefinition, ToolPolicyPipelineStep };

export interface SkillsService {
  readonly version: 1;
  readonly listSkillCommandsForAgents: typeof listSkillCommandsForAgents;
  readonly getChatCommands: typeof getChatCommands;
  readonly listCoreToolSections: typeof listCoreToolSections;
  readonly pickSandboxToolPolicy: typeof pickSandboxToolPolicy;
  readonly resolveToolProfilePolicy: typeof resolveToolProfilePolicy;
  readonly isToolAllowedByPolicyName: typeof isToolAllowedByPolicyName;
  readonly buildDefaultToolPolicyPipelineSteps: typeof buildDefaultToolPolicyPipelineSteps;
}

export function createSkillsService(): SkillsService {
  return {
    version: 1,
    listSkillCommandsForAgents,
    getChatCommands,
    listCoreToolSections,
    pickSandboxToolPolicy,
    resolveToolProfilePolicy,
    isToolAllowedByPolicyName,
    buildDefaultToolPolicyPipelineSteps,
  };
}

export const skillsService = createSkillsService();
