import {
  loadModelCatalog,
  type ModelCatalogEntry,
  resetModelCatalogCacheForTest,
} from "../agents/model-catalog.js";
import { type OpenClawConfig, loadConfig } from "../config/config.js";
import type { ModelDefinitionConfig, ModelProviderConfig } from "../config/types.models.js";

export type GatewayModelChoice = ModelCatalogEntry;

// Test-only escape hatch: model catalog is cached at module scope for the
// process lifetime, which is fine for the real gateway daemon, but makes
// isolated unit tests harder. Keep this intentionally obscure.
export function __resetModelCatalogCacheForTest() {
  resetModelCatalogCacheForTest();
}

/**
 * Build a lookup map from "provider::modelId" → ModelDefinitionConfig
 * so we can efficiently merge cost/maxTokens onto catalog entries.
 */
function buildModelDefinitionIndex(config: OpenClawConfig): Map<string, ModelDefinitionConfig> {
  const index = new Map<string, ModelDefinitionConfig>();
  const providers = config.models?.providers;
  if (!providers || typeof providers !== "object") {
    return index;
  }
  for (const [providerKey, providerValue] of Object.entries(providers)) {
    const provider = providerKey.toLowerCase().trim();
    const providerConfig = providerValue as ModelProviderConfig | undefined;
    if (!providerConfig?.models || !Array.isArray(providerConfig.models)) {
      continue;
    }
    for (const modelDef of providerConfig.models) {
      if (!modelDef?.id) {
        continue;
      }
      const key = `${provider}::${modelDef.id.toLowerCase().trim()}`;
      index.set(key, modelDef);
    }
  }
  return index;
}

/**
 * Merge cost and maxTokens from config ModelDefinitionConfig onto catalog entries.
 */
function mergeCostData(catalog: ModelCatalogEntry[], config: OpenClawConfig): void {
  const index = buildModelDefinitionIndex(config);
  if (index.size === 0) {
    return;
  }
  for (const entry of catalog) {
    const key = `${entry.provider.toLowerCase().trim()}::${entry.id.toLowerCase().trim()}`;
    const def = index.get(key);
    if (!def) {
      continue;
    }
    if (def.cost && !entry.cost) {
      entry.cost = { ...def.cost };
    }
    if (typeof def.maxTokens === "number" && def.maxTokens > 0 && entry.maxTokens == null) {
      entry.maxTokens = def.maxTokens;
    }
  }
}

export async function loadGatewayModelCatalog(): Promise<GatewayModelChoice[]> {
  const config = loadConfig();
  const catalog = await loadModelCatalog({ config });
  mergeCostData(catalog, config);
  return catalog;
}
