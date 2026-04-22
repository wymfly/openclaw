import { cache } from "react";
import type { Locale } from "@/i18n/config";
import type { DeckPluginsListResult } from "@/types/gateway-protocol.generated";

type PluginLocaleInventoryEntry = Pick<DeckPluginsListResult["plugins"][number], "id" | "locales">;
const DEFAULT_RUNTIME_ID = "rt_local";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getDeckGoApiBase(): string {
  const raw =
    process.env.DECK_GO_API_BASE?.trim() ?? process.env.NEXT_PUBLIC_DECK_GO_API_BASE?.trim() ?? "";
  return raw.replace(/\/+$/, "");
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
    const apiBase = getDeckGoApiBase();
    if (!apiBase) {
      return [];
    }

    const response = await fetch(
      `${apiBase}/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/deck/plugins?capability=all`,
      {
        method: "GET",
      },
    );
    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as { payload?: DeckPluginsListResult };
    const plugins = payload.payload?.plugins ?? [];
    return plugins.map((plugin) => ({
      id: plugin.id,
      locales: plugin.locales,
    }));
  } catch {
    return [];
  }
});
