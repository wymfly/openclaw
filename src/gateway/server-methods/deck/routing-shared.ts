import { createHash } from "node:crypto";
import type { AgentBinding } from "../../services/config.service.js";
import { computeBindingId } from "./utils.js";

export const TIER_ORDER = [
  "peer",
  "peer.parent",
  "guild+roles",
  "guild",
  "team",
  "account",
  "channel",
] as const;

export type TierLabel = (typeof TIER_ORDER)[number];

export function classifyBindingTier(match: AgentBinding["match"]): TierLabel {
  if (match.peer?.id) {
    return "peer";
  }
  if (match.guildId && match.roles && match.roles.length > 0) {
    return "guild+roles";
  }
  if (match.guildId) {
    return "guild";
  }
  if (match.teamId) {
    return "team";
  }
  if (match.accountId && match.accountId !== "*") {
    return "account";
  }
  return "channel";
}

export function computeConfigHash(bindings: AgentBinding[]): string {
  return createHash("sha256").update(JSON.stringify(bindings)).digest("hex").slice(0, 16);
}

export function enrichBinding(binding: AgentBinding) {
  const tier = classifyBindingTier(binding.match);
  const id = computeBindingId(binding.match as unknown as Record<string, unknown>);
  return { id, agentId: binding.agentId, tier, match: binding.match, comment: binding.comment };
}

export function detectConflicts(
  proposed: { agentId: string; match: AgentBinding["match"] },
  existing: AgentBinding[],
): Array<{
  type: "duplicate" | "overlap" | "shadow";
  bindingId: string;
  agentId: string;
  detail: string;
}> {
  const conflicts: Array<{
    type: "duplicate" | "overlap" | "shadow";
    bindingId: string;
    agentId: string;
    detail: string;
  }> = [];
  const proposedId = computeBindingId(proposed.match as unknown as Record<string, unknown>);

  for (const binding of existing) {
    const existingId = computeBindingId(binding.match as unknown as Record<string, unknown>);

    if (existingId === proposedId) {
      if (binding.agentId === proposed.agentId) {
        conflicts.push({
          type: "duplicate",
          bindingId: existingId,
          agentId: binding.agentId,
          detail: `exact duplicate of existing binding for agent "${binding.agentId}"`,
        });
      } else {
        conflicts.push({
          type: "overlap",
          bindingId: existingId,
          agentId: binding.agentId,
          detail: `same match pattern already routes to agent "${binding.agentId}"`,
        });
      }
      continue;
    }

    if (binding.match.channel === proposed.match.channel) {
      const existingTier = classifyBindingTier(binding.match);
      const proposedTier = classifyBindingTier(proposed.match);
      if (existingTier === proposedTier && binding.agentId !== proposed.agentId) {
        conflicts.push({
          type: "shadow",
          bindingId: existingId,
          agentId: binding.agentId,
          detail: `same tier "${existingTier}" on channel "${binding.match.channel}" routes to different agent "${binding.agentId}"`,
        });
      }
    }
  }
  return conflicts;
}

export const SIMULATE_TIERS = [...TIER_ORDER, "default"] as const;

export type MatchedByType =
  | "binding.peer"
  | "binding.peer.parent"
  | "binding.guild+roles"
  | "binding.guild"
  | "binding.team"
  | "binding.account"
  | "binding.channel"
  | "default";

export function matchedByToTier(matchedBy: MatchedByType): string {
  if (matchedBy === "default") {
    return "default";
  }
  return matchedBy.replace("binding.", "");
}
