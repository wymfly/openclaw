import * as fs from "node:fs";
import * as path from "node:path";
import { resolveOpenClawAgentDir } from "../../agents/agent-paths.js";
import { buildAuthOverview } from "../../agents/auth-diagnostics.js";
import { ensureAuthProfileStore } from "../../agents/auth-profiles.js";
import { DEFAULT_PROVIDER } from "../../agents/defaults.js";
import { resolveEnvApiKey } from "../../agents/model-auth.js";
import type { ModelCatalogEntry, ModelInputType } from "../../agents/model-catalog.js";
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

/** Read agent-level models.json (best-effort, returns empty on failure). */
function readModelsJsonSync(agentDir: string): Record<string, unknown> {
  try {
    const raw = fs.readFileSync(path.join(agentDir, "models.json"), "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return (parsed?.providers as Record<string, unknown>) ?? {};
  } catch {
    return {};
  }
}

/** Build model catalog entries from agent-level models.json providers. */
function buildModelsJsonCatalog(agentDir: string): ModelCatalogEntry[] {
  const providers = readModelsJsonSync(agentDir);
  const catalog: ModelCatalogEntry[] = [];
  for (const [providerRaw, providerData] of Object.entries(providers)) {
    const providerId = normalizeProviderId(providerRaw);
    if (!providerId) {
      continue;
    }
    const p = providerData as Record<string, unknown> | undefined;
    if (!p || !Array.isArray(p.models)) {
      continue;
    }
    for (const model of p.models as Array<Record<string, unknown>>) {
      const id = typeof model?.id === "string" ? model.id.trim() : "";
      if (!id) {
        continue;
      }
      catalog.push({
        provider: providerId,
        id,
        name: typeof model?.name === "string" && model.name.trim() ? model.name.trim() : id,
        contextWindow:
          typeof model?.contextWindow === "number" && model.contextWindow > 0
            ? model.contextWindow
            : undefined,
        reasoning: typeof model?.reasoning === "boolean" ? model.reasoning : undefined,
        input: Array.isArray(model?.input)
          ? (model.input as unknown[]).filter(
              (i): i is ModelInputType => i === "text" || i === "image" || i === "document",
            )
          : undefined,
      });
    }
  }
  return catalog;
}

/**
 * Resolve visible providers from config + auth profiles + env vars + models.json.
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

  // Also discover providers from agent-level models.json
  // (custom providers added via UI or manually, not yet in openclaw.json)
  const fromModelsJson = new Set(
    Object.keys(readModelsJsonSync(agentDir))
      .map((p) => normalizeProviderId(p))
      .filter(Boolean),
  );

  return Array.from(
    new Set([...fromStore, ...fromConfig, ...fromModels, ...fromEnv, ...fromModelsJson]),
  )
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
      // fallback to full catalog models, then to models.json entries
      const configuredProviderIds = new Set(configuredModels.map((m) => m.provider));
      const modelsJsonCatalog = buildModelsJsonCatalog(agentDir);
      for (const [provider, status] of authMap) {
        if (configuredProviderIds.has(provider)) {
          continue;
        }
        if (status !== "ready" && status !== "warning") {
          continue;
        }
        // Try full catalog first (Pi SDK built-in models)
        const catalogModels = fullCatalog.filter((c) => c.provider === provider);
        if (catalogModels.length > 0) {
          for (const c of catalogModels) {
            models.push({
              ...c,
              cost: c.cost ?? undefined,
              maxTokens: c.maxTokens ?? undefined,
              authStatus: status,
            });
          }
        } else {
          // Fallback to agent-level models.json (custom providers not in Pi SDK)
          const mjModels = modelsJsonCatalog.filter((c) => c.provider === provider);
          for (const c of mjModels) {
            models.push({
              ...c,
              cost: c.cost ?? undefined,
              maxTokens: c.maxTokens ?? undefined,
              authStatus: status,
            });
          }
        }
      }

      // Also include models.json providers that have models but no auth yet
      // (so they appear in UI for the user to configure auth)
      const modelProviderIds = new Set(models.map((m) => m.provider));
      for (const entry of modelsJsonCatalog) {
        if (modelProviderIds.has(entry.provider)) {
          continue;
        }
        // Include with "missing" auth status so UI shows them greyed out
        models.push({
          ...entry,
          cost: entry.cost ?? undefined,
          maxTokens: entry.maxTokens ?? undefined,
          authStatus: authMap.get(entry.provider) ?? "missing",
        });
      }
      // Deduplicate by provider+id (models.json may overlap with config)
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
