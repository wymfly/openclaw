import type { MethodMetadata } from "../../method-registry.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateDeckRoutingValidateParams,
} from "../../protocol/index.js";
import {
  DeckRoutingValidateParamsSchema,
  DeckRoutingValidateResultSchema,
} from "../../protocol/schema/deck.js";
import { configService, type AgentBinding } from "../../services/config.service.js";
import type { GatewayRequestHandlers } from "../types.js";
import { classifyBindingTier, detectConflicts } from "./routing-shared.js";

const { loadConfig } = configService;

export const deckRoutingValidateHandlers: GatewayRequestHandlers = {
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
    const hasDuplicate = conflicts.some((conflict) => conflict.type === "duplicate");

    respond(true, {
      ok: !hasDuplicate && conflicts.filter((conflict) => conflict.type === "overlap").length === 0,
      tier,
      conflicts,
    });
  },
};

export const deckRoutingValidateMethodDefs: Record<string, MethodMetadata> = {
  "deck.routing.validate": {
    params: DeckRoutingValidateParamsSchema,
    result: DeckRoutingValidateResultSchema,
    scope: "operator.read",
    forkClass: "C4",
    bffEligible: false,
  },
};
