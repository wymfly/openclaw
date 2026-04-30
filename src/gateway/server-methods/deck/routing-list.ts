import type { MethodMetadata } from "../../method-registry.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateDeckRoutingListParams,
} from "../../protocol/index.js";
import {
  DeckRoutingListParamsSchema,
  DeckRoutingListResultSchema,
} from "../../protocol/schema/deck.js";
import { agentsService } from "../../services/agents.service.js";
import { configService, type AgentBinding } from "../../services/config.service.js";
import type { GatewayRequestHandlers } from "../types.js";
import { computeConfigHash, enrichBinding, TIER_ORDER } from "./routing-shared.js";

const { resolveDefaultAgentId } = agentsService;
const { loadConfig } = configService;

export const deckRoutingListHandlers: GatewayRequestHandlers = {
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

    let enriched = bindings.map(enrichBinding);
    if (params.agentId) {
      enriched = enriched.filter((binding) => binding.agentId === params.agentId);
    }
    if (params.channel) {
      enriched = enriched.filter((binding) => binding.match.channel === params.channel);
    }
    if (params.accountId) {
      enriched = enriched.filter((binding) => binding.match.accountId === params.accountId);
    }

    enriched.sort((left, right) => TIER_ORDER.indexOf(left.tier) - TIER_ORDER.indexOf(right.tier));

    respond(true, {
      bindings: enriched,
      defaultAgentId,
      dmScope,
      configHash: computeConfigHash(bindings),
    });
  },
};

export const deckRoutingListMethodDefs: Record<string, MethodMetadata> = {
  "deck.routing.list": {
    params: DeckRoutingListParamsSchema,
    result: DeckRoutingListResultSchema,
    scope: "operator.read",
    forkClass: "C3",
    bffEligible: true,
  },
};
