import type { MethodMetadata } from "../../method-registry.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateDeckRoutingAddParams,
} from "../../protocol/index.js";
import {
  DeckRoutingAddParamsSchema,
  DeckRoutingAddResultSchema,
} from "../../protocol/schema/deck.js";
import { configService, type AgentBinding } from "../../services/config.service.js";
import type { GatewayRequestHandlers } from "../types.js";
import { computeConfigHash, detectConflicts, enrichBinding } from "./routing-shared.js";
import { validateBaseHash } from "./utils.js";

const { loadConfig, writeConfigFile } = configService;

export const deckRoutingAddHandlers: GatewayRequestHandlers = {
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

    const warnings = detectConflicts({ agentId: params.agentId, match: params.match }, bindings);
    const newBinding: AgentBinding = {
      agentId: params.agentId,
      match: params.match,
      ...(params.comment && typeof params.comment === "string" ? { comment: params.comment } : {}),
    };

    const position =
      typeof params.position === "number"
        ? Math.max(0, Math.min(params.position, bindings.length))
        : bindings.length;
    bindings.splice(position, 0, newBinding);
    cfg.bindings = bindings;
    await writeConfigFile(cfg, {});

    respond(true, {
      ok: true,
      binding: enrichBinding(newBinding),
      configHash: computeConfigHash(bindings),
      warnings,
    });
  },
};

export const deckRoutingAddMethodDefs: Record<string, MethodMetadata> = {
  "deck.routing.add": {
    params: DeckRoutingAddParamsSchema,
    result: DeckRoutingAddResultSchema,
    scope: "operator.admin",
    controlPlaneWrite: true,
    forkClass: "C2",
    bffEligible: false,
  },
};
