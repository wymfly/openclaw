import { useQuery } from "@tanstack/react-query";
import { fetchPluginsWithCapability } from "@/api";
import type { DeckGoPluginCapability, DeckGoPluginsListResponse } from "@/api-types";
import { useDataFabricTransports } from "../../client/scoped-query-provider";
import type { DeckQueryScope } from "../../contracts/query-keys";
import {
  bffQueryOptions,
  bffSource,
  type DataFabricBffTransport,
  type ModuleQueryOptions,
} from "../shared";
import { pluginsKeys } from "./keys";

export function pluginsListQueryOptions(
  bff: DataFabricBffTransport,
  capability: DeckGoPluginCapability = "channel",
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoPluginsListResponse>(
    bff,
    bffSource("GET /deck/plugins", () => fetchPluginsWithCapability(capability)),
    pluginsKeys.list(capability, scope),
    "inventory",
  );
}

export function usePluginsListQuery(
  capability: DeckGoPluginCapability = "channel",
  options: ModuleQueryOptions = {},
) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...pluginsListQueryOptions(bff, capability, options.scope),
    enabled: options.enabled ?? true,
  });
}
