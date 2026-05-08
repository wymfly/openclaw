import { useQuery } from "@tanstack/react-query";
import { fetchDeckConfig, lookupConfigPath } from "@/api";
import type { DeckGoConfigLookupResponse, DeckGoConfigSnapshotResponse } from "@/api-types";
import { useDataFabricTransports } from "../../client/scoped-query-provider";
import type { DeckQueryScope } from "../../contracts/query-keys";
import {
  bffQueryOptions,
  bffSource,
  type DataFabricBffTransport,
  type ModuleQueryOptions,
} from "../shared";
import { configKeys } from "./keys";

export function configSnapshotQueryOptions(bff: DataFabricBffTransport, scope?: DeckQueryScope) {
  return bffQueryOptions<DeckGoConfigSnapshotResponse>(
    bff,
    bffSource("GET /config", () => fetchDeckConfig()),
    configKeys.snapshot(scope),
    "config-authority",
  );
}

export function configLookupQueryOptions(
  bff: DataFabricBffTransport,
  path: string,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoConfigLookupResponse>(
    bff,
    bffSource("POST /config/schema-lookup", () => lookupConfigPath(path)),
    configKeys.lookup(path, scope),
    "lazy-detail",
  );
}

export function useConfigSnapshotQuery(options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...configSnapshotQueryOptions(bff, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useConfigLookupQuery(path: string, options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...configLookupQueryOptions(bff, path, options.scope),
    enabled: options.enabled ?? true,
  });
}
