import { useQuery } from "@tanstack/react-query";
import { fetchCommandDiscovery } from "@/api";
import type { DeckCommandsDiscoverResult } from "../../../../../contracts/generated/ts/gateway/protocol";
import { useDataFabricTransports } from "../../client/scoped-query-provider";
import type { DeckQueryScope } from "../../contracts/query-keys";
import {
  bffQueryOptions,
  bffSource,
  type DataFabricBffTransport,
  type ModuleQueryOptions,
} from "../shared";
import { commandsKeys } from "./keys";

export function commandDiscoveryQueryOptions(
  bff: DataFabricBffTransport,
  agentId?: string | null,
  scope?: DeckQueryScope,
) {
  const safeAgentId = agentId?.trim() || undefined;
  return bffQueryOptions<DeckCommandsDiscoverResult>(
    bff,
    bffSource("POST /deck/commands/discover", () => fetchCommandDiscovery(safeAgentId)),
    commandsKeys.discovery(safeAgentId, scope),
    "inventory",
  );
}

export function useCommandDiscoveryQuery(
  agentId?: string | null,
  options: ModuleQueryOptions = {},
) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...commandDiscoveryQueryOptions(bff, agentId, options.scope),
    enabled: options.enabled ?? true,
  });
}
