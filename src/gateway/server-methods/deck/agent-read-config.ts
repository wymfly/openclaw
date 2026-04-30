import { agentsService, type ResolvedAgentConfig } from "../../services/agents.service.js";
import type { OpenClawConfig } from "../../services/config.service.js";
import { routingService } from "../../services/routing.service.js";

const { listAgentIds, resolveAgentConfig, resolveDefaultAgentId } = agentsService;
const { normalizeAgentId } = routingService;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

export function resolveDeckAgentReadConfig(
  cfg: OpenClawConfig,
  agentId: string,
): ResolvedAgentConfig | undefined {
  const explicit = resolveAgentConfig(cfg, agentId);
  if (explicit) {
    return explicit;
  }

  const normalizedAgentId = normalizeAgentId(agentId);
  if (
    normalizedAgentId !== resolveDefaultAgentId(cfg) ||
    !listAgentIds(cfg).includes(normalizedAgentId)
  ) {
    return undefined;
  }

  const defaults = cfg.agents?.defaults;
  return {
    name: normalizedAgentId,
    workspace: defaults?.workspace,
    systemPromptOverride: defaults?.systemPromptOverride,
    model: defaults?.model,
    thinkingDefault: defaults?.thinkingDefault,
    verboseDefault: defaults?.verboseDefault,
    reasoningDefault: defaults?.reasoningDefault,
    fastModeDefault: defaults?.fastModeDefault,
    skills: Array.isArray(defaults?.skills) ? defaults.skills : undefined,
    memorySearch: defaults?.memorySearch,
    humanDelay: defaults?.humanDelay,
    heartbeat: defaults?.heartbeat,
    embeddedPi: defaults?.embeddedPi as ResolvedAgentConfig["embeddedPi"],
    sandbox: defaults?.sandbox,
    channels: defaults?.channels,
    subagents: isRecord(defaults?.subagents)
      ? (defaults.subagents as ResolvedAgentConfig["subagents"])
      : undefined,
  };
}
