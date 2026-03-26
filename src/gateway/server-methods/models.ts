import { resolveOpenClawAgentDir } from "../../agents/agent-paths.js";
import { ensureAuthProfileStore } from "../../agents/auth-profiles.js";
import { buildAuthOverview } from "../../agents/auth-diagnostics.js";
import { DEFAULT_PROVIDER } from "../../agents/defaults.js";
import { resolveEnvApiKey } from "../../agents/model-auth.js";
import {
  buildAllowedModelSet,
  buildConfiguredModelCatalog,
  parseModelRef,
} from "../../agents/model-selection.js";
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

/**
 * Resolve visible providers from config + auth profiles + env vars.
 * Mirrors deck-auth.ts resolveVisibleProviders logic.
 */
function resolveAllVisibleProviders(cfg: ReturnType<typeof loadConfig>): string[] {
  const agentDir = resolveOpenClawAgentDir();
  const store = ensureAuthProfileStore(agentDir);

  const fromStore = new Set(
    Object.values(store.profiles)
      .map((profile) => profile.provider)
      .filter((p): p is string => Boolean(p)),
  );

  const fromConfig = new Set(
    Object.keys(cfg.models?.providers ?? {})
      .map((p) => (typeof p === "string" ? p.trim() : ""))
      .filter(Boolean),
  );

  const fromModels = new Set<string>();
  const defaultModel = cfg.agents?.defaults?.model;
  const rawModel =
    typeof defaultModel === "string"
      ? defaultModel
      : typeof defaultModel === "object" && defaultModel !== null
        ? (((defaultModel as Record<string, unknown>).primary as string) ?? "")
        : "";
  if (rawModel) {
    const parsed = parseModelRef(String(rawModel), DEFAULT_PROVIDER);
    if (parsed?.provider) {
      fromModels.add(parsed.provider);
    }
  }

  const envProbeProviders = [
    "anthropic",
    "github-copilot",
    "google-vertex",
    "openai",
    "google",
    "groq",
    "cerebras",
    "xai",
    "openrouter",
    "zai",
    "mistral",
    "synthetic",
  ];
  const fromEnv = new Set<string>();
  for (const provider of envProbeProviders) {
    if (resolveEnvApiKey(provider)) {
      fromEnv.add(provider);
    }
  }

  return Array.from(new Set([...fromStore, ...fromConfig, ...fromModels, ...fromEnv]))
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean);
}

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

      // Use all visible providers (config + auth profiles + env vars)
      // so OAuth/token providers without explicit config are included
      const allProviders = resolveAllVisibleProviders(cfg);

      // Build catalog from config only (not Pi SDK full catalog)
      const configuredModels = buildConfiguredModelCatalog({ cfg });

      // Load full catalog to merge cost/maxTokens data + fallback for unconfigured providers
      const fullCatalog = await context.loadGatewayModelCatalog();
      const catalogMap = new Map(fullCatalog.map((c) => [`${c.provider}/${c.id}`, c]));

      // Get auth status for ALL visible providers (not just config ones)
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

      // Merge cost data from full catalog + auth status into each config model
      const models = configuredModels.map((m) => {
        const catalogEntry = catalogMap.get(`${m.provider}/${m.id}`);
        return {
          ...m,
          cost: catalogEntry?.cost ?? m.cost,
          maxTokens: catalogEntry?.maxTokens ?? m.maxTokens,
          authStatus: authMap.get(m.provider) ?? "unknown",
        };
      });

      // For providers with auth ready/warning but NO models in config,
      // fallback to full catalog models so OAuth/implicit providers show up
      const configuredProviderIds = new Set(configuredModels.map((m) => m.provider));
      for (const [provider, status] of authMap) {
        if (configuredProviderIds.has(provider)) continue;
        if (status !== "ready" && status !== "warning") continue;
        // Pull all catalog models for this provider
        const catalogModels = fullCatalog.filter((c) => c.provider === provider);
        for (const c of catalogModels) {
          models.push({
            ...c,
            cost: c.cost ?? undefined,
            maxTokens: c.maxTokens ?? undefined,
            authStatus: status,
          });
        }
      }

      respond(true, { models }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },
};
