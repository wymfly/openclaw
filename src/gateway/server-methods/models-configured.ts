import type { MethodMetadata } from "../method-registry.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateModelsConfiguredParams,
} from "../protocol/index.js";
import {
  ModelsConfiguredParamsSchema,
  ModelsConfiguredResultSchema,
} from "../protocol/schema/agents-models-skills.js";
import { agentsService } from "../services/agents.service.js";
import { authService } from "../services/auth.service.js";
import { configService } from "../services/config.service.js";
import { buildModelsJsonCatalog, createProviderProvenance } from "../services/model-provenance.js";
import type { GatewayRequestHandlers } from "./types.js";

const { buildConfiguredModelCatalog, normalizeProviderId, resolveOpenClawAgentDir } = agentsService;
const { buildAuthOverview } = authService;
const { loadConfig } = configService;

export const modelsConfiguredHandlers: GatewayRequestHandlers = {
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
      const provenance = createProviderProvenance(cfg, agentDir);

      const allProviders = provenance.visibleProviders;
      const configuredModels = buildConfiguredModelCatalog({ cfg });
      const fullCatalog = await context.loadGatewayModelCatalog();
      const catalogMap = new Map(fullCatalog.map((c) => [`${c.provider}/${c.id}`, c]));

      const authResult = await buildAuthOverview({ providers: allProviders, cfg, agentDir });
      const authProviders = Array.isArray(authResult)
        ? authResult
        : Array.isArray(authResult?.providers)
          ? authResult.providers
          : [];
      const authMap = new Map<string, string>();
      for (const entry of authProviders) {
        if (entry.provider && entry.status) {
          authMap.set(normalizeProviderId(entry.provider), entry.status);
        }
      }

      const models = configuredModels.map((m) => {
        const catalogEntry = catalogMap.get(`${m.provider}/${m.id}`);
        const providerMeta = provenance.inspect(m.provider);
        return {
          ...m,
          cost: catalogEntry?.cost ?? m.cost,
          maxTokens: catalogEntry?.maxTokens ?? m.maxTokens,
          authStatus: authMap.get(m.provider) ?? "unknown",
          source: providerMeta.source,
          scope: providerMeta.scope,
          editable: providerMeta.editable,
        };
      });

      const configuredProviderIds = new Set(configuredModels.map((m) => m.provider));
      const modelsJsonCatalog = buildModelsJsonCatalog(agentDir);
      for (const [provider, status] of authMap) {
        if (configuredProviderIds.has(provider)) {
          continue;
        }
        if (status !== "ready" && status !== "warning") {
          continue;
        }
        const catalogModels = fullCatalog.filter((c) => c.provider === provider);
        if (catalogModels.length > 0) {
          for (const c of catalogModels) {
            const providerMeta = provenance.inspect(c.provider);
            models.push({
              ...c,
              cost: c.cost ?? undefined,
              maxTokens: c.maxTokens ?? undefined,
              authStatus: status,
              source: providerMeta.source,
              scope: providerMeta.scope,
              editable: providerMeta.editable,
            });
          }
        } else {
          const modelsJsonEntries = modelsJsonCatalog.filter((c) => c.provider === provider);
          for (const c of modelsJsonEntries) {
            const providerMeta = provenance.inspect(c.provider);
            models.push({
              ...c,
              cost: c.cost ?? undefined,
              maxTokens: c.maxTokens ?? undefined,
              authStatus: status,
              source: providerMeta.source,
              scope: providerMeta.scope,
              editable: providerMeta.editable,
            });
          }
        }
      }

      const modelProviderIds = new Set(models.map((m) => m.provider));
      for (const entry of modelsJsonCatalog) {
        if (modelProviderIds.has(entry.provider)) {
          continue;
        }
        const providerMeta = provenance.inspect(entry.provider);
        models.push({
          ...entry,
          cost: entry.cost ?? undefined,
          maxTokens: entry.maxTokens ?? undefined,
          authStatus: authMap.get(entry.provider) ?? "missing",
          source: providerMeta.source,
          scope: providerMeta.scope,
          editable: providerMeta.editable,
        });
      }

      const seen = new Set<string>();
      const dedupedModels = models.filter((m) => {
        const key = `${m.provider}/${m.id}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });

      respond(true, { models: dedupedModels }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },
};

export const modelsConfiguredMethodDefs: Record<string, MethodMetadata> = {
  "models.configured": {
    params: ModelsConfiguredParamsSchema,
    result: ModelsConfiguredResultSchema,
    scope: "operator.read",
    forkClass: "C1",
    bffEligible: false,
  },
};
