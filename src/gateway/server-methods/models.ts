import { resolveOpenClawAgentDir } from "../../agents/agent-paths.js";
import { buildAuthOverview } from "../../agents/auth-diagnostics.js";
import { DEFAULT_PROVIDER } from "../../agents/defaults.js";
import { buildAllowedModelSet, buildConfiguredModelCatalog } from "../../agents/model-selection.js";
import { normalizeProviderId } from "../../agents/provider-id.js";
import { loadConfig } from "../../config/config.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateModelsConfiguredParams,
  validateModelsListParams,
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

export const modelsHandlers: GatewayRequestHandlers = {
  "models.list": async ({ params, respond, context }) => {
    if (!validateModelsListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid models.list params: ${formatValidationErrors(validateModelsListParams.errors)}`,
        ),
      );
      return;
    }
    try {
      const catalog = await context.loadGatewayModelCatalog();
      const cfg = loadConfig();
      const { allowedCatalog } = buildAllowedModelSet({
        cfg,
        catalog,
        defaultProvider: DEFAULT_PROVIDER,
      });
      const models = allowedCatalog.length > 0 ? allowedCatalog : catalog;
      respond(true, { models }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "models.configured": async ({ params, respond, context }) => {
    if (!validateModelsConfiguredParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid models.configured params: ${formatValidationErrors(validateModelsConfiguredParams.errors)}`,
        ),
      );
      return;
    }
    try {
      const cfg = loadConfig();
      const agentDir = resolveOpenClawAgentDir();
      const providers = Object.keys(cfg.models?.providers ?? {}).filter(Boolean);

      // Build catalog from config only (not Pi SDK full catalog)
      const configuredModels = buildConfiguredModelCatalog({ cfg });

      // Load full catalog to merge cost/maxTokens data
      const fullCatalog = await context.loadGatewayModelCatalog();
      const catalogMap = new Map(fullCatalog.map((c) => [`${c.provider}/${c.id}`, c]));

      // Get auth status per provider
      const authResult = await buildAuthOverview({ providers, cfg, agentDir });
      const authProviders = Array.isArray(authResult)
        ? authResult
        : Array.isArray(authResult?.providers)
          ? authResult.providers
          : [];
      const authMap = new Map<string, string>();
      for (const entry of authProviders) {
        if (entry.provider && entry.status) {
          // Normalize provider key to match configuredModels (which uses normalizeProviderId)
          authMap.set(normalizeProviderId(entry.provider), entry.status);
        }
      }

      // Merge cost data from full catalog + auth status into each model
      const models = configuredModels.map((m) => {
        const catalogEntry = catalogMap.get(`${m.provider}/${m.id}`);
        return {
          ...m,
          cost: catalogEntry?.cost ?? m.cost,
          maxTokens: catalogEntry?.maxTokens ?? m.maxTokens,
          authStatus: authMap.get(m.provider) ?? "unknown",
        };
      });

      respond(true, { models }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },
};
