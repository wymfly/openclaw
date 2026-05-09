import { useQuery } from "@tanstack/react-query";
import {
  fetchModelUsageCost,
  fetchModelUsageProviders,
  fetchModelsConfig,
  fetchModelsConfigDetail,
  fetchRuntimeConfiguredModels,
  fetchRuntimeModelAuthOverview,
  fetchRuntimeModelCatalogProviders,
  lookupConfigPath,
} from "@/api";
import type {
  DeckGoConfigLookupResponse,
  DeckGoModelAuthOverviewResponse,
  DeckGoModelCatalogProvidersResponse,
  DeckGoModelsConfigDetailResponse,
  DeckGoModelsConfigResponse,
  DeckGoRuntimeConfiguredModelsResponse,
  DeckGoUsageCostResponse,
  DeckGoUsageProvidersResponse,
} from "@/api-types";
import { useDataFabricTransports } from "../../client/scoped-query-provider";
import type { DeckQueryScope } from "../../contracts/query-keys";
import {
  bffQueryOptions,
  bffSource,
  gatewayRpcQueryOptions,
  gatewayRpcSource,
  type DataFabricBffTransport,
  type DataFabricGatewayRpcTransport,
  type ModuleQueryOptions,
} from "../shared";
import { modelsKeys } from "./keys";

export function modelsConfigQueryOptions(bff: DataFabricBffTransport, scope?: DeckQueryScope) {
  return bffQueryOptions<DeckGoModelsConfigResponse>(
    bff,
    bffSource("GET /models/config", () => fetchModelsConfig()),
    modelsKeys.config(scope),
    "config-authority",
  );
}

export function modelsConfigDetailQueryOptions(
  bff: DataFabricBffTransport,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoModelsConfigDetailResponse>(
    bff,
    bffSource("GET /models/config/detail", () => fetchModelsConfigDetail()),
    modelsKeys.configDetail(scope),
    "config-authority",
  );
}

export function modelsConfiguredQueryOptions(
  gatewayRpc: DataFabricGatewayRpcTransport,
  scope?: DeckQueryScope,
) {
  return gatewayRpcQueryOptions<DeckGoRuntimeConfiguredModelsResponse>(
    gatewayRpc,
    gatewayRpcSource("models.configured", () => fetchRuntimeConfiguredModels()),
    modelsKeys.configured(scope),
    "inventory",
  );
}

export function modelAuthOverviewQueryOptions(
  gatewayRpc: DataFabricGatewayRpcTransport,
  scope?: DeckQueryScope,
) {
  return gatewayRpcQueryOptions<DeckGoModelAuthOverviewResponse>(
    gatewayRpc,
    gatewayRpcSource("deck.auth.overview", () => fetchRuntimeModelAuthOverview()),
    modelsKeys.authOverview(scope),
    "inventory",
  );
}

export function modelCatalogProvidersQueryOptions(
  gatewayRpc: DataFabricGatewayRpcTransport,
  scope?: DeckQueryScope,
) {
  return gatewayRpcQueryOptions<DeckGoModelCatalogProvidersResponse>(
    gatewayRpc,
    gatewayRpcSource("models.catalog.providers", () => fetchRuntimeModelCatalogProviders()),
    modelsKeys.catalogProviders(scope),
    "inventory",
  );
}

export function modelUsageCostQueryOptions(
  bff: DataFabricBffTransport,
  days?: number,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoUsageCostResponse>(
    bff,
    bffSource("GET /usage/cost", () => fetchModelUsageCost(days)),
    modelsKeys.usageCost(days, scope),
    "historical",
  );
}

export function modelUsageProvidersQueryOptions(
  bff: DataFabricBffTransport,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoUsageProvidersResponse>(
    bff,
    bffSource("GET /usage/providers", () => fetchModelUsageProviders()),
    modelsKeys.usageProviders(scope),
    "historical",
  );
}

export function modelConfigLookupQueryOptions(
  bff: DataFabricBffTransport,
  path: string,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoConfigLookupResponse>(
    bff,
    bffSource("POST /config/schema-lookup", () => lookupConfigPath(path)),
    modelsKeys.lookup(path, scope),
    "lazy-detail",
  );
}

export function useModelsConfigQuery(options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...modelsConfigQueryOptions(bff, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useModelsConfigDetailQuery(options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...modelsConfigDetailQueryOptions(bff, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useModelsConfiguredQuery(options: ModuleQueryOptions = {}) {
  const { gatewayRpc } = useDataFabricTransports();
  return useQuery({
    ...modelsConfiguredQueryOptions(gatewayRpc, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useModelAuthOverviewQuery(options: ModuleQueryOptions = {}) {
  const { gatewayRpc } = useDataFabricTransports();
  return useQuery({
    ...modelAuthOverviewQueryOptions(gatewayRpc, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useModelCatalogProvidersQuery(options: ModuleQueryOptions = {}) {
  const { gatewayRpc } = useDataFabricTransports();
  return useQuery({
    ...modelCatalogProvidersQueryOptions(gatewayRpc, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useModelUsageCostQuery(days?: number, options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...modelUsageCostQueryOptions(bff, days, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useModelUsageProvidersQuery(options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...modelUsageProvidersQueryOptions(bff, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useModelConfigLookupQuery(path: string, options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...modelConfigLookupQueryOptions(bff, path, options.scope),
    enabled: (options.enabled ?? true) && Boolean(path.trim()),
  });
}
