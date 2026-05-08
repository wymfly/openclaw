import type { QueryClient } from "@tanstack/react-query";
import type {
  GatewayMethodMap,
  GatewayMethodName,
} from "../../../../contracts/generated/ts/gateway/protocol";
import type { DataFreshnessTier } from "../contracts/freshness";
import { getDataFreshnessPolicy } from "../contracts/freshness";
import type { DeckQueryScope } from "../contracts/query-keys";
import { normalizeDataFabricError } from "../errors/error-handler";
import {
  createBffQuerySource,
  type BffQuerySource,
  type DataFabricBffTransport,
} from "../transport/bff";
import {
  createGatewayRpcQuerySource,
  type DataFabricGatewayRpcTransport,
  type GatewayRpcQuerySource,
} from "../transport/gateway-rpc";

export type { DataFabricBffTransport } from "../transport/bff";
export type { DataFabricGatewayRpcTransport } from "../transport/gateway-rpc";

export type ModuleQueryOptions = {
  enabled?: boolean;
  scope?: DeckQueryScope;
};

export const mutationDefaults = {
  networkMode: "online" as const,
  retry: false as const,
};

export class DataFabricBaseHashRequiredError extends Error {
  readonly code: string;

  constructor(action: string) {
    super(`${action} requires a fresh config hash before saving`);
    this.name = "DataFabricBaseHashRequiredError";
    this.code = `${action}.baseHashRequired`;
  }
}

export function requireBaseHash(value: string | null | undefined, action: string) {
  const baseHash = value?.trim();
  if (!baseHash) {
    throw new DataFabricBaseHashRequiredError(action);
  }
  return baseHash;
}

export function enabledNonEmpty(value: string | null | undefined, enabled = true) {
  return enabled && Boolean(value?.trim());
}

export function freshnessDefaults(tier: DataFreshnessTier) {
  const { tier: _tier, ...defaults } = getDataFreshnessPolicy(tier);
  void _tier;
  return defaults;
}

export function bffSource<TData>(label: string, fn: () => Promise<TData>) {
  return createBffQuerySource<TData>(label, fn);
}

export function gatewayRpcSource<M extends GatewayMethodName>(
  method: M,
  fn: () => Promise<unknown>,
) {
  return createGatewayRpcQuerySource(method, () => fn() as Promise<GatewayMethodMap[M]["result"]>);
}

export function bffQueryOptions<TData>(
  bff: DataFabricBffTransport,
  source: BffQuerySource<TData>,
  queryKey: readonly unknown[],
  tier: DataFreshnessTier,
) {
  return {
    ...freshnessDefaults(tier),
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      try {
        return await bff(source, signal);
      } catch (error) {
        throw normalizeDataFabricError(error);
      }
    },
    queryKey,
  };
}

export function gatewayRpcQueryOptions<TData>(
  gatewayRpc: DataFabricGatewayRpcTransport,
  source: GatewayRpcQuerySource,
  queryKey: readonly unknown[],
  tier: DataFreshnessTier,
) {
  return {
    ...freshnessDefaults(tier),
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      try {
        return (await gatewayRpc(source, signal)) as TData;
      } catch (error) {
        throw normalizeDataFabricError(error);
      }
    },
    queryKey,
  };
}

export async function invalidateModule(
  queryClient: QueryClient,
  allKey: readonly unknown[],
  extraKeys: readonly (readonly unknown[])[] = [],
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: allKey }),
    ...extraKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  ]);
}
