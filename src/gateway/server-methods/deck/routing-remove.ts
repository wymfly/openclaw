import type { MethodMetadata } from "../../method-registry.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateDeckRoutingRemoveParams,
} from "../../protocol/index.js";
import {
  DeckRoutingRemoveParamsSchema,
  DeckRoutingRemoveResultSchema,
} from "../../protocol/schema/deck.js";
import { agentsService } from "../../services/agents.service.js";
import { configService, type AgentBinding } from "../../services/config.service.js";
import type { GatewayRequestHandlers } from "../types.js";
import { computeConfigHash, enrichBinding } from "./routing-shared.js";
import { computeBindingId, validateBaseHash } from "./utils.js";

const { resolveDefaultAgentId } = agentsService;
const { loadConfig, writeConfigFile } = configService;

export const deckRoutingRemoveHandlers: GatewayRequestHandlers = {
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
      respond(
        false,
        undefined,
        errorShape(
          hashError.code,
          hashError.message,
          hashError.details ? { details: hashError.details } : undefined,
        ),
      );
      return;
    }

    const targetIndex = bindings.findIndex(
      (binding) =>
        computeBindingId(binding.match as unknown as Record<string, unknown>) === params.id,
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
};

export const deckRoutingRemoveMethodDefs: Record<string, MethodMetadata> = {
  "deck.routing.remove": {
    params: DeckRoutingRemoveParamsSchema,
    result: DeckRoutingRemoveResultSchema,
    scope: "operator.admin",
    controlPlaneWrite: true,
    forkClass: "C2",
    bffEligible: false,
  },
};
