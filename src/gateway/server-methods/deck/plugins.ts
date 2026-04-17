import { loadConfig } from "../../../config/config.js";
import { buildPluginSnapshotReport } from "../../../plugins/status.js";
import type { MethodMetadata } from "../../method-registry.js";
import { ErrorCodes, errorShape, validateDeckPluginsListParams } from "../../protocol/index.js";
import {
  DeckPluginsListParamsSchema,
  DeckPluginsListResultSchema,
} from "../../protocol/schema/deck.js";
import type { GatewayRequestHandlers } from "../types.js";
import { assertValidParams } from "../validation.js";

type InventoryCapability = "channel" | "all";

type SnapshotPlugin = ReturnType<typeof buildPluginSnapshotReport>["plugins"][number];

function deriveCapabilityKinds(plugin: SnapshotPlugin): string[] {
  const kinds = new Set<string>();
  if (plugin.channelIds.length > 0) {
    kinds.add("channel");
  }
  if (plugin.providerIds.length > 0) {
    kinds.add("provider");
  }
  if (plugin.toolNames.length > 0) {
    kinds.add("tool");
  }
  return [...kinds].toSorted((a, b) => a.localeCompare(b));
}

export const deckPluginsHandlers: GatewayRequestHandlers = {
  "deck.plugins.list": ({ params, respond }) => {
    if (!assertValidParams(params, validateDeckPluginsListParams, "deck.plugins.list", respond)) {
      return;
    }

    try {
      const scope = (params.capability as InventoryCapability | undefined) ?? "channel";
      const report = buildPluginSnapshotReport({ config: loadConfig() });

      const plugins = report.plugins
        .filter((plugin) => (scope === "all" ? true : plugin.channelIds.length > 0))
        .map((plugin) => ({
          id: plugin.id,
          name: plugin.name,
          ...(plugin.version ? { version: plugin.version } : {}),
          origin: plugin.origin,
          status: plugin.status,
          enabled: plugin.enabled,
          ...(plugin.explicitlyEnabled !== undefined
            ? { explicitlyEnabled: plugin.explicitlyEnabled }
            : {}),
          ...(plugin.activated !== undefined ? { activated: plugin.activated } : {}),
          ...(plugin.imported !== undefined ? { imported: plugin.imported } : {}),
          ...(plugin.activationSource ? { activationSource: plugin.activationSource } : {}),
          ...(plugin.activationReason ? { activationReason: plugin.activationReason } : {}),
          configPath: `plugins.entries.${plugin.id}.config`,
          capabilityKinds: deriveCapabilityKinds(plugin),
          channelIds: [...plugin.channelIds],
          providerIds: [...plugin.providerIds],
          toolNames: [...plugin.toolNames],
          ...(plugin.setupWizardSpec ? { setupWizardSpec: plugin.setupWizardSpec } : {}),
          ...(plugin.locales ? { locales: plugin.locales } : {}),
          ...(plugin.deckActionCapabilities
            ? { deckActionCapabilities: plugin.deckActionCapabilities }
            : {}),
          diagnostics: report.diagnostics
            .filter((diag) => diag.pluginId === plugin.id)
            .map((diag) => ({
              level: diag.level,
              message: diag.message,
            })),
        }))
        .toSorted((a, b) => a.id.localeCompare(b.id));

      respond(true, { scope, plugins }, undefined);
    } catch (error) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.UNAVAILABLE,
          `Failed to build plugins inventory: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  },
};

export const deckPluginsMethodDefs: Record<string, MethodMetadata> = {
  "deck.plugins.list": {
    params: DeckPluginsListParamsSchema,
    result: DeckPluginsListResultSchema,
    scope: "operator.read",
  },
};
