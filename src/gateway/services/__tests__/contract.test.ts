import { describe, expect, it } from "vitest";
import { resolveOpenClawAgentDir } from "../../../agents/agent-paths.js";
import {
  listAgentEntries,
  listAgentIds,
  resolveAgentConfig,
  resolveAgentSkillsFilter,
  resolveAgentWorkspaceDir,
  resolveDefaultAgentId,
} from "../../../agents/agent-scope.js";
import { buildAuthOverview } from "../../../agents/auth-diagnostics.js";
import { AGENT_LANE_SUBAGENT } from "../../../agents/lanes.js";
import { buildConfiguredModelCatalog } from "../../../agents/model-selection.js";
import { abortEmbeddedPiRun } from "../../../agents/pi-embedded.js";
import { isToolAllowedByPolicyName } from "../../../agents/pi-tools.policy.js";
import { normalizeProviderId } from "../../../agents/provider-id.js";
import { pickSandboxToolPolicy } from "../../../agents/sandbox-tool-policy.js";
import { buildWorkspaceSkillStatus } from "../../../agents/skills-status.js";
import { killSubagentRunAdmin } from "../../../agents/subagent-control.js";
import {
  clearSubagentRunSteerRestart,
  getSubagentRunsForDeck,
  markSubagentRunForSteerRestart,
  markSubagentRunTerminated,
  replaceSubagentRunAfterSteer,
} from "../../../agents/subagent-registry.js";
import { listCoreToolSections } from "../../../agents/tool-catalog.js";
import { buildDefaultToolPolicyPipelineSteps } from "../../../agents/tool-policy-pipeline.js";
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
import { getChatCommands } from "../../../auto-reply/commands-registry.data.js";
import { clearSessionQueues } from "../../../auto-reply/reply/queue.js";
import { listSkillCommandsForAgents } from "../../../auto-reply/skill-commands.js";
import { runAuthProbes } from "../../../commands/models/list.probe.js";
import {
  loadConfig,
  readConfigFileSnapshotForWrite,
  resolveConfigSnapshotHash,
  writeConfigFile,
} from "../../../config/config.js";
import { resolveStateDir } from "../../../config/paths.js";
import { loadSessionStore } from "../../../config/sessions.js";
import {
  resolveSessionTranscriptsDirForAgent,
  resolveStorePath,
} from "../../../config/sessions/paths.js";
import { callGateway } from "../../../gateway/call.js";
import { loadJsonFile } from "../../../infra/json-file.js";
import { buildPluginSnapshotReport } from "../../../plugins/status.js";
import { resolveAgentRoute } from "../../../routing/resolve-route.js";
import {
  getSubagentDepth,
  normalizeAgentId,
  parseAgentSessionKey,
  resolveAgentIdFromSessionKey,
} from "../../../routing/session-key.js";
import { INTERNAL_MESSAGE_CHANNEL } from "../../../utils/message-channel.js";
import { createAgentsService } from "../agents.service.js";
import { createAuthService } from "../auth.service.js";
import { createConfigService } from "../config.service.js";
import { createPluginsService } from "../plugins.service.js";
import { createRoutingService } from "../routing.service.js";
import { createSessionsService } from "../sessions.service.js";
import { createSkillsService } from "../skills.service.js";
import { createSubagentRegistryService } from "../subagent-registry.service.js";
import { createSubagentsService } from "../subagents.service.js";

describe("gateway services v1 contract", () => {
  it("exposes agent internals through the agents service", () => {
    const service = createAgentsService();
    expect(service.version).toBe(1);
    expect(service.listAgentEntries).toBe(listAgentEntries);
    expect(service.listAgentIds).toBe(listAgentIds);
    expect(service.resolveAgentConfig).toBe(resolveAgentConfig);
    expect(service.resolveAgentSkillsFilter).toBe(resolveAgentSkillsFilter);
    expect(service.buildWorkspaceSkillStatus).toBe(buildWorkspaceSkillStatus);
    expect(service.resolveAgentWorkspaceDir).toBe(resolveAgentWorkspaceDir);
    expect(service.resolveDefaultAgentId).toBe(resolveDefaultAgentId);
    expect(service.loadWorkspaceBootstrapFiles).toBe(loadWorkspaceBootstrapFiles);
    expect(service.resolveOpenClawAgentDir).toBe(resolveOpenClawAgentDir);
    expect(service.buildConfiguredModelCatalog).toBe(buildConfiguredModelCatalog);
    expect(service.normalizeProviderId).toBe(normalizeProviderId);
    expect(service.DEFAULT_AGENTS_FILENAME).toBe(DEFAULT_AGENTS_FILENAME);
    expect(service.DEFAULT_BOOTSTRAP_FILENAME).toBe(DEFAULT_BOOTSTRAP_FILENAME);
    expect(service.DEFAULT_HEARTBEAT_FILENAME).toBe(DEFAULT_HEARTBEAT_FILENAME);
    expect(service.DEFAULT_IDENTITY_FILENAME).toBe(DEFAULT_IDENTITY_FILENAME);
    expect(service.DEFAULT_SOUL_FILENAME).toBe(DEFAULT_SOUL_FILENAME);
    expect(service.DEFAULT_TOOLS_FILENAME).toBe(DEFAULT_TOOLS_FILENAME);
    expect(service.DEFAULT_USER_FILENAME).toBe(DEFAULT_USER_FILENAME);
  });

  it("exposes auth internals through the auth service", () => {
    const service = createAuthService();
    expect(service.version).toBe(1);
    expect(service.buildAuthOverview).toBe(buildAuthOverview);
    expect(service.runAuthProbes).toBe(runAuthProbes);
  });

  it("exposes config internals through the config service", () => {
    const service = createConfigService();
    expect(service.version).toBe(1);
    expect(service.loadConfig).toBe(loadConfig);
    expect(service.writeConfigFile).toBe(writeConfigFile);
    expect(service.readConfigFileSnapshotForWrite).toBe(readConfigFileSnapshotForWrite);
    expect(service.resolveConfigSnapshotHash).toBe(resolveConfigSnapshotHash);
  });

  it("exposes routing internals through the routing service", () => {
    const service = createRoutingService();
    expect(service.version).toBe(1);
    expect(service.resolveAgentRoute).toBe(resolveAgentRoute);
    expect(service.normalizeAgentId).toBe(normalizeAgentId);
    expect(service.parseAgentSessionKey).toBe(parseAgentSessionKey);
    expect(service.resolveAgentIdFromSessionKey).toBe(resolveAgentIdFromSessionKey);
    expect(service.getSubagentDepth).toBe(getSubagentDepth);
  });

  it("exposes skills internals through the skills service", () => {
    const service = createSkillsService();
    expect(service.version).toBe(1);
    expect(service.listSkillCommandsForAgents).toBe(listSkillCommandsForAgents);
    expect(service.getChatCommands).toBe(getChatCommands);
    expect(service.listCoreToolSections).toBe(listCoreToolSections);
    expect(service.pickSandboxToolPolicy).toBe(pickSandboxToolPolicy);
    expect(service.resolveToolProfilePolicy).toBe(resolveToolProfilePolicy);
    expect(service.isToolAllowedByPolicyName).toBe(isToolAllowedByPolicyName);
    expect(service.buildDefaultToolPolicyPipelineSteps).toBe(buildDefaultToolPolicyPipelineSteps);
  });

  it("exposes subagent runtime internals through the subagents service", () => {
    const service = createSubagentsService();
    expect(service.version).toBe(1);
    expect(service.abortEmbeddedPiRun).toBe(abortEmbeddedPiRun);
    expect(service.clearSessionQueues).toBe(clearSessionQueues);
    expect(service.callGateway).toBe(callGateway);
    expect(service.killSubagentRunAdmin).toBe(killSubagentRunAdmin);
    expect(service.AGENT_LANE_SUBAGENT).toBe(AGENT_LANE_SUBAGENT);
    expect(service.INTERNAL_MESSAGE_CHANNEL).toBe(INTERNAL_MESSAGE_CHANNEL);
  });

  it("exposes subagent registry internals through the subagent registry service", () => {
    const service = createSubagentRegistryService();
    expect(service.version).toBe(1);
    expect(service.getSubagentRunsForDeck).toBe(getSubagentRunsForDeck);
    expect(service.markSubagentRunTerminated).toBe(markSubagentRunTerminated);
    expect(service.clearSubagentRunSteerRestart).toBe(clearSubagentRunSteerRestart);
    expect(service.markSubagentRunForSteerRestart).toBe(markSubagentRunForSteerRestart);
    expect(service.replaceSubagentRunAfterSteer).toBe(replaceSubagentRunAfterSteer);
  });

  it("exposes plugin internals through the plugins service", () => {
    const service = createPluginsService();
    expect(service.version).toBe(1);
    expect(service.buildPluginSnapshotReport).toBe(buildPluginSnapshotReport);
  });

  it("exposes session internals through the sessions service", () => {
    const service = createSessionsService();
    expect(service.version).toBe(1);
    expect(service.loadSessionStore).toBe(loadSessionStore);
    expect(service.resolveStorePath).toBe(resolveStorePath);
    expect(service.resolveSessionTranscriptsDirForAgent).toBe(resolveSessionTranscriptsDirForAgent);
    expect(service.resolveStateDir).toBe(resolveStateDir);
    expect(service.loadJsonFile).toBe(loadJsonFile);
  });
});
