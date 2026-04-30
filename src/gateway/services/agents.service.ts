import { resolveOpenClawAgentDir } from "../../agents/agent-paths.js";
import {
  listAgentEntries,
  listAgentIds,
  resolveAgentConfig,
  resolveAgentSkillsFilter,
  resolveAgentWorkspaceDir,
  resolveDefaultAgentId,
} from "../../agents/agent-scope.js";
import type { ResolvedAgentConfig } from "../../agents/agent-scope.js";
import { buildConfiguredModelCatalog } from "../../agents/model-selection.js";
import { normalizeProviderId } from "../../agents/provider-id.js";
import { buildWorkspaceSkillStatus } from "../../agents/skills-status.js";
import {
  DEFAULT_AGENTS_FILENAME,
  DEFAULT_BOOTSTRAP_FILENAME,
  DEFAULT_HEARTBEAT_FILENAME,
  DEFAULT_IDENTITY_FILENAME,
  DEFAULT_SOUL_FILENAME,
  DEFAULT_TOOLS_FILENAME,
  DEFAULT_USER_FILENAME,
  loadWorkspaceBootstrapFiles,
} from "../../agents/workspace.js";

export type { ResolvedAgentConfig };

export interface AgentsService {
  readonly version: 1;
  readonly listAgentEntries: typeof listAgentEntries;
  readonly listAgentIds: typeof listAgentIds;
  readonly resolveAgentConfig: typeof resolveAgentConfig;
  readonly resolveAgentSkillsFilter: typeof resolveAgentSkillsFilter;
  readonly buildWorkspaceSkillStatus: typeof buildWorkspaceSkillStatus;
  readonly resolveAgentWorkspaceDir: typeof resolveAgentWorkspaceDir;
  readonly resolveDefaultAgentId: typeof resolveDefaultAgentId;
  readonly loadWorkspaceBootstrapFiles: typeof loadWorkspaceBootstrapFiles;
  readonly resolveOpenClawAgentDir: typeof resolveOpenClawAgentDir;
  readonly buildConfiguredModelCatalog: typeof buildConfiguredModelCatalog;
  readonly normalizeProviderId: typeof normalizeProviderId;
  readonly DEFAULT_AGENTS_FILENAME: typeof DEFAULT_AGENTS_FILENAME;
  readonly DEFAULT_BOOTSTRAP_FILENAME: typeof DEFAULT_BOOTSTRAP_FILENAME;
  readonly DEFAULT_HEARTBEAT_FILENAME: typeof DEFAULT_HEARTBEAT_FILENAME;
  readonly DEFAULT_IDENTITY_FILENAME: typeof DEFAULT_IDENTITY_FILENAME;
  readonly DEFAULT_SOUL_FILENAME: typeof DEFAULT_SOUL_FILENAME;
  readonly DEFAULT_TOOLS_FILENAME: typeof DEFAULT_TOOLS_FILENAME;
  readonly DEFAULT_USER_FILENAME: typeof DEFAULT_USER_FILENAME;
}

export function createAgentsService(): AgentsService {
  return {
    version: 1,
    listAgentEntries,
    listAgentIds,
    resolveAgentConfig,
    resolveAgentSkillsFilter,
    buildWorkspaceSkillStatus,
    resolveAgentWorkspaceDir,
    resolveDefaultAgentId,
    loadWorkspaceBootstrapFiles,
    resolveOpenClawAgentDir,
    buildConfiguredModelCatalog,
    normalizeProviderId,
    DEFAULT_AGENTS_FILENAME,
    DEFAULT_BOOTSTRAP_FILENAME,
    DEFAULT_HEARTBEAT_FILENAME,
    DEFAULT_IDENTITY_FILENAME,
    DEFAULT_SOUL_FILENAME,
    DEFAULT_TOOLS_FILENAME,
    DEFAULT_USER_FILENAME,
  };
}

export const agentsService = createAgentsService();
