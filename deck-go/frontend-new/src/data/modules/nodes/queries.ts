import { useQuery } from "@tanstack/react-query";
import { describeNode, fetchNodePairing, fetchNodes } from "@/api";
import type {
  DeckGoNodePairingResponse,
  DeckGoNodesResponse,
  DeckGoNodeSummary,
} from "@/api-types";
import { useDataFabricTransports } from "../../client/scoped-query-provider";
import type { DeckQueryScope } from "../../contracts/query-keys";
import {
  bffQueryOptions,
  bffSource,
  enabledNonEmpty,
  type DataFabricBffTransport,
  type ModuleQueryOptions,
} from "../shared";
import { nodesKeys } from "./keys";

export function nodesListQueryOptions(bff: DataFabricBffTransport, scope?: DeckQueryScope) {
  return bffQueryOptions<DeckGoNodesResponse>(
    bff,
    bffSource("GET /nodes", () => fetchNodes()),
    nodesKeys.list(scope),
    "inventory",
  );
}

export function nodePairingQueryOptions(bff: DataFabricBffTransport, scope?: DeckQueryScope) {
  return bffQueryOptions<DeckGoNodePairingResponse>(
    bff,
    bffSource("GET /nodes/pair", () => fetchNodePairing()),
    nodesKeys.pairing(scope),
    "live-workbench",
  );
}

export function nodeDetailQueryOptions(
  bff: DataFabricBffTransport,
  nodeId: string,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoNodeSummary>(
    bff,
    bffSource("POST /nodes#describe", () => describeNode(nodeId)),
    nodesKeys.detail(nodeId, scope),
    "lazy-detail",
  );
}

export function useNodesListQuery(options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...nodesListQueryOptions(bff, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useNodePairingQuery(options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...nodePairingQueryOptions(bff, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useNodeDetailQuery(
  nodeId: string | null | undefined,
  options: ModuleQueryOptions = {},
) {
  const { bff } = useDataFabricTransports();
  const safeNodeId = nodeId ?? "";
  return useQuery({
    ...nodeDetailQueryOptions(bff, safeNodeId, options.scope),
    enabled: enabledNonEmpty(nodeId, options.enabled ?? true),
  });
}
