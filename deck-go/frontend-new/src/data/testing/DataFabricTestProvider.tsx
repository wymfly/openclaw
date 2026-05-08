import type { QueryClient } from "@tanstack/react-query";
import { type PropsWithChildren, useMemo } from "react";
import { createDataFabricQueryClient } from "../client/query-client";
import { DataFabricProvider, type DataFabricTransports } from "../client/scoped-query-provider";
import { executeBffQuerySource } from "../transport/bff";
import { createGatewayRpcTransport } from "../transport/gateway-rpc";
import {
  createRecordingBffTransport,
  createRecordingGatewayRpcTransport,
  type DataFabricCallRecord,
} from "../transport/mock-transport";

export function DataFabricTestProvider({
  bff = executeBffQuerySource,
  calls,
  children,
  gatewayRpc = createGatewayRpcTransport(),
  queryClient,
}: PropsWithChildren<{
  bff?: DataFabricTransports["bff"];
  calls?: DataFabricCallRecord[];
  gatewayRpc?: DataFabricTransports["gatewayRpc"];
  queryClient?: QueryClient;
}>) {
  const records = useMemo(() => calls ?? [], [calls]);
  const client = useMemo(() => queryClient ?? createDataFabricQueryClient(), [queryClient]);
  const transports = useMemo<DataFabricTransports>(
    () => ({
      bff: createRecordingBffTransport(bff, records),
      gatewayRpc: createRecordingGatewayRpcTransport(gatewayRpc, records),
    }),
    [bff, gatewayRpc, records],
  );

  return (
    <DataFabricProvider queryClient={client} transports={transports}>
      {children}
    </DataFabricProvider>
  );
}
