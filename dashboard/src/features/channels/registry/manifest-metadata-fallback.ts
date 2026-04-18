import type { InventoryPluginEntry } from "@/stores/plugins";
import type { ManifestMetadataFallback } from "./channel-ui-types";

export function createManifestMetadataFallback(
  plugin?: InventoryPluginEntry | null,
): ManifestMetadataFallback {
  const sources: ManifestMetadataFallback["sources"] = [];

  if (plugin?.deckActionCapabilities) {
    sources.push("deckActionCapabilities");
  }
  if (plugin?.setupWizardSpec) {
    sources.push("setupWizardSpec");
  }
  if (plugin?.locales) {
    sources.push("locales");
  }

  return {
    actionCapabilities: {
      login: plugin?.deckActionCapabilities?.login,
      probe: plugin?.deckActionCapabilities?.probe,
      testMessage: plugin?.deckActionCapabilities?.testMessage,
    },
    wizardSpec: plugin?.setupWizardSpec,
    locales: plugin?.locales,
    hasWizardSpec: Boolean(plugin?.setupWizardSpec),
    hasLocales: Boolean(plugin?.locales),
    sources,
  };
}
