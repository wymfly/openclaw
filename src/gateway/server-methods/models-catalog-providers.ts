import { KNOWN_PROVIDER_DEFAULTS } from "../../agents/provider-defaults.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

export interface CatalogProviderModel {
  id: string;
  name: string;
  contextWindow: number;
  reasoning: boolean;
  maxTokens: number;
}

export interface CatalogProviderEntry {
  id: string;
  displayName: string;
  modelCount: number;
  defaultBaseUrl: string;
  authType: string;
  api: string;
  models: CatalogProviderModel[];
}

export const modelsCatalogProvidersHandlers: GatewayRequestHandlers = {
  "models.catalog.providers": async ({ respond, context }) => {
    try {
      const catalog = await context.loadGatewayModelCatalog();

      // Group by provider
      const grouped = new Map<string, CatalogProviderModel[]>();
      for (const entry of catalog) {
        const provider = entry.provider;
        if (!grouped.has(provider)) {
          grouped.set(provider, []);
        }
        grouped.get(provider)!.push({
          id: entry.id,
          name: entry.name ?? entry.id,
          contextWindow: entry.contextWindow ?? 128_000,
          reasoning: entry.reasoning ?? false,
          maxTokens: entry.maxTokens ?? 4096,
        });
      }

      // Build response with defaults merging
      const providers: CatalogProviderEntry[] = [];
      for (const [id, models] of grouped) {
        const defaults = KNOWN_PROVIDER_DEFAULTS[id];
        providers.push({
          id,
          displayName: defaults?.displayName ?? id,
          modelCount: models.length,
          defaultBaseUrl: defaults?.defaultBaseUrl ?? "",
          authType: defaults?.authType ?? "api-key",
          api: defaults?.api ?? "openai-completions",
          models,
        });
      }

      // Sort: known providers first (have defaultBaseUrl), then alphabetical
      providers.sort((a, b) => {
        const aKnown = a.defaultBaseUrl ? 0 : 1;
        const bKnown = b.defaultBaseUrl ? 0 : 1;
        if (aKnown !== bKnown) {
          return aKnown - bKnown;
        }
        return a.displayName.localeCompare(b.displayName);
      });

      respond(true, { providers }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },
};
