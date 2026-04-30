import type { MethodMetadata } from "../../method-registry.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateDeckRoutingSimulateParams,
} from "../../protocol/index.js";
import {
  DeckRoutingSimulateParamsSchema,
  DeckRoutingSimulateResultSchema,
} from "../../protocol/schema/deck.js";
import { configService } from "../../services/config.service.js";
import { routingService, type RoutePeer } from "../../services/routing.service.js";
import type { GatewayRequestHandlers } from "../types.js";
import { matchedByToTier, type MatchedByType, SIMULATE_TIERS } from "./routing-shared.js";

const { loadConfig } = configService;
const { resolveAgentRoute } = routingService;

export const deckRoutingSimulateHandlers: GatewayRequestHandlers = {
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
      channel: (params.channel as string | undefined) ?? "",
      accountId: params.accountId as string | undefined,
      peer: params.peer as RoutePeer | null | undefined,
      guildId: params.guildId as string | undefined,
      teamId: params.teamId as string | undefined,
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

export const deckRoutingSimulateMethodDefs: Record<string, MethodMetadata> = {
  "deck.routing.simulate": {
    params: DeckRoutingSimulateParamsSchema,
    result: DeckRoutingSimulateResultSchema,
    scope: "operator.read",
    forkClass: "C4",
    bffEligible: false,
  },
};
