import { createHash } from "node:crypto";
import { resolveDefaultAgentId } from "../../../agents/agent-scope.js";
import { loadConfig, writeConfigFile } from "../../../config/config.js";
import type { AgentBinding, AgentRouteBinding } from "../../../config/types.agents.js";
import { type RoutePeer, resolveAgentRoute } from "../../../routing/resolve-route.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateDeckRoutingAddParams,
  validateDeckRoutingListParams,
  validateDeckRoutingRemoveParams,
  validateDeckRoutingSimulateParams,
  validateDeckRoutingValidateParams,
} from "../../protocol/index.js";
import type { GatewayRequestHandlers } from "../types.js";
import { computeBindingId, validateBaseHash } from "./utils.js";

// --- tier helpers ---

const TIER_ORDER = [
  "peer",
  "peer.parent",
  "guild+roles",
  "guild",
  "team",
  "account",
  "channel",
] as const;

type TierLabel = (typeof TIER_ORDER)[number];

function classifyBindingTier(match: AgentBinding["match"]): TierLabel {
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

function computeConfigHash(bindings: AgentBinding[]): string {
  return createHash("sha256").update(JSON.stringify(bindings)).digest("hex").slice(0, 16);
}

function enrichBinding(binding: AgentBinding) {
  const tier = classifyBindingTier(binding.match);
  const id = computeBindingId(binding.match as unknown as Record<string, unknown>);
  return { id, agentId: binding.agentId, tier, match: binding.match, comment: binding.comment };
}

// --- simulate tier labels (includes "default") ---

const SIMULATE_TIERS = [...TIER_ORDER, "default"] as const;

type MatchedByType =
  | "binding.peer"
  | "binding.peer.parent"
  | "binding.guild+roles"
  | "binding.guild"
  | "binding.team"
  | "binding.account"
  | "binding.channel"
  | "default";

function matchedByToTier(matchedBy: MatchedByType): string {
  if (matchedBy === "default") {
    return "default";
  }
  return matchedBy.replace("binding.", "");
}

// --- conflict detection ---

function detectConflicts(
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

  for (const b of existing) {
    const existingId = computeBindingId(b.match as unknown as Record<string, unknown>);

    // Exact duplicate: same match hash
    if (existingId === proposedId) {
      if (b.agentId === proposed.agentId) {
        conflicts.push({
          type: "duplicate",
          bindingId: existingId,
          agentId: b.agentId,
          detail: `exact duplicate of existing binding for agent "${b.agentId}"`,
        });
      } else {
        conflicts.push({
          type: "overlap",
          bindingId: existingId,
          agentId: b.agentId,
          detail: `same match pattern already routes to agent "${b.agentId}"`,
        });
      }
      continue;
    }

    // Overlap: same channel + one subsumes the other
    if (b.match.channel === proposed.match.channel) {
      const existingTier = classifyBindingTier(b.match);
      const proposedTier = classifyBindingTier(proposed.match);
      if (existingTier === proposedTier && b.agentId !== proposed.agentId) {
        // Same tier, different agent — potential shadow
        conflicts.push({
          type: "shadow",
          bindingId: existingId,
          agentId: b.agentId,
          detail: `same tier "${existingTier}" on channel "${b.match.channel}" routes to different agent "${b.agentId}"`,
        });
      }
    }
  }
  return conflicts;
}

export const deckRoutingHandlers: GatewayRequestHandlers = {
  "deck.routing.list": ({ params, respond }) => {
    if (!validateDeckRoutingListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid deck.routing.list params: ${formatValidationErrors(validateDeckRoutingListParams.errors)}`,
        ),
      );
      return;
    }

    const cfg = loadConfig();
    const bindings: AgentBinding[] = Array.isArray(cfg.bindings) ? cfg.bindings : [];
    const defaultAgentId = resolveDefaultAgentId(cfg);
    const dmScope = cfg.session?.dmScope ?? "main";

    // Enrich all bindings
    let enriched = bindings.map(enrichBinding);

    // Apply filters
    if (params.agentId) {
      enriched = enriched.filter((b) => b.agentId === params.agentId);
    }
    if (params.channel) {
      enriched = enriched.filter((b) => b.match.channel === params.channel);
    }
    if (params.accountId) {
      enriched = enriched.filter((b) => b.match.accountId === params.accountId);
    }

    // Sort by tier priority
    enriched.sort((a, b) => {
      const ai = TIER_ORDER.indexOf(a.tier);
      const bi = TIER_ORDER.indexOf(b.tier);
      return ai - bi;
    });

    respond(true, {
      bindings: enriched,
      defaultAgentId,
      dmScope,
      configHash: computeConfigHash(bindings),
    });
  },

  "deck.routing.add": async ({ params, respond }) => {
    if (!validateDeckRoutingAddParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid deck.routing.add params: ${formatValidationErrors(validateDeckRoutingAddParams.errors)}`,
        ),
      );
      return;
    }

    const cfg = loadConfig();
    const bindings: AgentBinding[] = Array.isArray(cfg.bindings) ? [...cfg.bindings] : [];
    const currentHash = computeConfigHash(bindings);

    const hashError = validateBaseHash(params.baseHash, currentHash);
    if (hashError) {
      respond(false, undefined, errorShape(hashError.code, hashError.message));
      return;
    }

    // Detect conflicts before adding
    const warnings = detectConflicts({ agentId: params.agentId, match: params.match }, bindings);

    // Build new binding
    const newBinding: AgentRouteBinding = {
      agentId: params.agentId,
      match: params.match,
      ...(typeof params.comment === "string" && params.comment ? { comment: params.comment } : {}),
    };

    const position =
      typeof params.position === "number"
        ? Math.max(0, Math.min(params.position, bindings.length))
        : bindings.length;
    bindings.splice(position, 0, newBinding);
    cfg.bindings = bindings;
    await writeConfigFile(cfg, {});

    const enriched = enrichBinding(newBinding);
    respond(true, {
      ok: true,
      binding: enriched,
      configHash: computeConfigHash(bindings),
      warnings,
    });
  },

  "deck.routing.remove": async ({ params, respond }) => {
    if (!validateDeckRoutingRemoveParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid deck.routing.remove params: ${formatValidationErrors(validateDeckRoutingRemoveParams.errors)}`,
        ),
      );
      return;
    }

    const cfg = loadConfig();
    const bindings: AgentBinding[] = Array.isArray(cfg.bindings) ? [...cfg.bindings] : [];
    const currentHash = computeConfigHash(bindings);

    const hashError = validateBaseHash(params.baseHash, currentHash);
    if (hashError) {
      respond(false, undefined, errorShape(hashError.code, hashError.message));
      return;
    }

    // Find binding by content-hash ID
    const targetIndex = bindings.findIndex(
      (b) => computeBindingId(b.match as unknown as Record<string, unknown>) === params.id,
    );

    if (targetIndex === -1) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.NOT_FOUND, `binding with id "${params.id}" not found`),
      );
      return;
    }

    const removed = bindings.splice(targetIndex, 1)[0];
    cfg.bindings = bindings;
    await writeConfigFile(cfg, {});

    const defaultAgentId = resolveDefaultAgentId(cfg);
    const impact = `messages previously routed to "${removed.agentId}" via this binding will now fall through to the next matching rule or default agent "${defaultAgentId}"`;

    respond(true, {
      ok: true,
      removed: enrichBinding(removed),
      configHash: computeConfigHash(bindings),
      impact,
    });
  },

  "deck.routing.validate": ({ params, respond }) => {
    if (!validateDeckRoutingValidateParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid deck.routing.validate params: ${formatValidationErrors(validateDeckRoutingValidateParams.errors)}`,
        ),
      );
      return;
    }

    const cfg = loadConfig();
    const bindings: AgentBinding[] = Array.isArray(cfg.bindings) ? cfg.bindings : [];

    const tier = classifyBindingTier(params.match);
    const conflicts = detectConflicts({ agentId: params.agentId, match: params.match }, bindings);
    const hasDuplicate = conflicts.some((c) => c.type === "duplicate");

    respond(true, {
      ok: !hasDuplicate && conflicts.filter((c) => c.type === "overlap").length === 0,
      tier,
      conflicts,
    });
  },

  "deck.routing.simulate": ({ params, respond }) => {
    if (!validateDeckRoutingSimulateParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid deck.routing.simulate params: ${formatValidationErrors(validateDeckRoutingSimulateParams.errors)}`,
        ),
      );
      return;
    }

    const cfg = loadConfig();
    const result = resolveAgentRoute({
      cfg,
      channel: params.channel,
      accountId: params.accountId as string | null | undefined,
      peer: params.peer as RoutePeer | null | undefined,
      guildId: params.guildId as string | null | undefined,
      teamId: params.teamId as string | null | undefined,
      memberRoleIds: params.memberRoleIds as string[] | undefined,
    });

    const matchedTier = matchedByToTier(result.matchedBy as MatchedByType);
    let foundMatch = false;

    const tiers = SIMULATE_TIERS.map((tier) => {
      if (foundMatch) {
        return { tier, matched: false, checked: false };
      }
      const isMatch = tier === matchedTier;
      if (isMatch) {
        foundMatch = true;
        return { tier, matched: true, checked: true };
      }
      return { tier, matched: false, checked: true };
    });

    respond(true, {
      agentId: result.agentId,
      matchedBy: result.matchedBy,
      sessionKey: result.sessionKey,
      tiers,
    });
  },
};
