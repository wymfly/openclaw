import { cache } from "react";
import type { Locale } from "@/i18n/config";
import { gwCall } from "@/lib/api-helpers";
import type { DeckPluginsListResult } from "@/types/gateway-protocol.generated";

type PluginLocaleInventoryEntry = Pick<DeckPluginsListResult["plugins"][number], "id" | "locales">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function mergePluginLocales(
  baseMessages: Record<string, unknown>,
  plugins: readonly PluginLocaleInventoryEntry[],
  locale: Locale,
): Record<string, unknown> {
  const existingPluginNamespace = isRecord(baseMessages.plugin) ? { ...baseMessages.plugin } : {};

  for (const plugin of plugins) {
    if (!plugin.locales) {
      continue;
    }
    const bundle = plugin.locales[locale] ?? plugin.locales.en;
    if (isRecord(bundle)) {
      existingPluginNamespace[plugin.id] = bundle;
    }
  }

  return {
    ...baseMessages,
    plugin: existingPluginNamespace,
  };
}

export const getPluginLocaleInventory = cache(async (): Promise<PluginLocaleInventoryEntry[]> => {
  try {
    const result = await gwCall("deck.plugins.list", { capability: "all" });
    return result.plugins.map((plugin) => ({
      id: plugin.id,
      locales: plugin.locales,
    }));
  } catch {
    return [];
  }
});
