import type {
  GatewayMethodMap,
  GatewayMethodName,
} from "../../../../contracts/generated/ts/gateway/protocol";
import {
  createDeckGatewayClient,
  type DeckGatewayClient,
  type DeckGatewayTransportOptions,
} from "../../lib/gateway-client";

export type GatewayRpcQuerySource<M extends GatewayMethodName = GatewayMethodName> = {
  kind: "gateway-rpc";
  method: M;
  request: (
    client: DeckGatewayClient,
    signal: AbortSignal,
  ) => Promise<GatewayMethodMap[M]["result"]>;
};

export type DataFabricGatewayRpcTransport = <M extends GatewayMethodName>(
  source: GatewayRpcQuerySource<M>,
  signal: AbortSignal,
) => Promise<GatewayMethodMap[M]["result"]>;

export function createGatewayRpcQuerySource<M extends GatewayMethodName>(
  method: M,
  request: (
    client: DeckGatewayClient,
    signal: AbortSignal,
  ) => Promise<GatewayMethodMap[M]["result"]>,
): GatewayRpcQuerySource<M> {
  return {
    kind: "gateway-rpc",
    method,
    request,
  };
}

export function createGatewayRpcTransport(
  options: DeckGatewayTransportOptions = {},
): DataFabricGatewayRpcTransport {
  const client = createDeckGatewayClient(options);
  return (source, signal) => {
    if (signal.aborted) {
      throw new DOMException("request aborted", "AbortError");
    }
    return source.request(client, signal);
  };
}
