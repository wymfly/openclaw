import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { createContext, useContext, useMemo, useState, type PropsWithChildren } from "react";
import { executeBffQuerySource, type DataFabricBffTransport } from "../transport/bff";
import {
  createGatewayRpcTransport,
  type DataFabricGatewayRpcTransport,
} from "../transport/gateway-rpc";
import { createDataFabricQueryClient } from "./query-client";

export type DataFabricTransports = {
  bff: DataFabricBffTransport;
  gatewayRpc: DataFabricGatewayRpcTransport;
};

const defaultTransports: DataFabricTransports = {
  bff: executeBffQuerySource,
  gatewayRpc: createGatewayRpcTransport(),
};

const DataFabricTransportContext = createContext(defaultTransports);

export function useDataFabricTransports() {
  return useContext(DataFabricTransportContext);
}

export function DataFabricProvider({
  children,
  queryClient,
  transports,
}: PropsWithChildren<{
  queryClient?: QueryClient;
  transports?: Partial<DataFabricTransports>;
}>) {
  const [client] = useState(() => queryClient ?? createDataFabricQueryClient());
  const scopedTransports = useMemo<DataFabricTransports>(
    () => ({
      ...defaultTransports,
      ...transports,
    }),
    [transports],
  );

  return (
    <DataFabricTransportContext.Provider value={scopedTransports}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </DataFabricTransportContext.Provider>
  );
}
