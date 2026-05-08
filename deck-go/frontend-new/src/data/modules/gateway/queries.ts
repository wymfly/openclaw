import { useQuery } from "@tanstack/react-query";
import { fetchGatewayDescribe, fetchGatewayHealth, fetchGatewayStatus } from "@/api";
import type {
  DeckGoGatewayDescribeResponse,
  DeckGoGatewayHealthResponse,
  DeckGoGatewayStatusResponse,
} from "@/api-types";
import { useDataFabricTransports } from "../../client/scoped-query-provider";
import type { DeckQueryScope } from "../../contracts/query-keys";
import {
  bffQueryOptions,
  bffSource,
  type DataFabricBffTransport,
  type ModuleQueryOptions,
} from "../shared";
import { gatewayKeys } from "./keys";

export function gatewayHealthQueryOptions(bff: DataFabricBffTransport, scope?: DeckQueryScope) {
  return bffQueryOptions<DeckGoGatewayHealthResponse>(
    bff,
    bffSource("GET /gateway/health", () => fetchGatewayHealth()),
    gatewayKeys.health(scope),
    "runtime-liveness",
  );
}

export function gatewayStatusQueryOptions(bff: DataFabricBffTransport, scope?: DeckQueryScope) {
  return bffQueryOptions<DeckGoGatewayStatusResponse>(
    bff,
    bffSource("GET /gateway/status", () => fetchGatewayStatus()),
    gatewayKeys.status(scope),
    "runtime-liveness",
  );
}

export function gatewayDescribeQueryOptions(bff: DataFabricBffTransport, scope?: DeckQueryScope) {
  return bffQueryOptions<DeckGoGatewayDescribeResponse>(
    bff,
    bffSource("GET /gateway/describe", () => fetchGatewayDescribe()),
    gatewayKeys.describe(scope),
    "lazy-detail",
  );
}

export function useGatewayHealthQuery(options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...gatewayHealthQueryOptions(bff, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useGatewayStatusQuery(options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...gatewayStatusQueryOptions(bff, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useGatewayDescribeQuery(options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...gatewayDescribeQueryOptions(bff, options.scope),
    enabled: options.enabled ?? true,
  });
}
