import { useQuery } from "@tanstack/react-query";
import { fetchChatSnapshot } from "@/api";
import type { DeckGoChatSnapshotResponse } from "@/api-types";
import { useDataFabricTransports } from "../../client/scoped-query-provider";
import type { DeckQueryScope } from "../../contracts/query-keys";
import {
  bffQueryOptions,
  bffSource,
  enabledNonEmpty,
  type DataFabricBffTransport,
  type ModuleQueryOptions,
} from "../shared";
import { chatKeys, type ChatSnapshotFilters } from "./keys";

export function chatSnapshotQueryOptions(
  bff: DataFabricBffTransport,
  filters: ChatSnapshotFilters,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoChatSnapshotResponse>(
    bff,
    bffSource("GET /chat/snapshot", () => fetchChatSnapshot(filters)),
    chatKeys.snapshot(filters, scope),
    "stream-driven",
  );
}

export function useChatSnapshotQuery(
  filters: ChatSnapshotFilters | null | undefined,
  options: ModuleQueryOptions = {},
) {
  const { bff } = useDataFabricTransports();
  const safeFilters = filters ?? { sessionKey: "" };
  return useQuery({
    ...chatSnapshotQueryOptions(bff, safeFilters, options.scope),
    enabled: enabledNonEmpty(filters?.sessionKey, options.enabled ?? true),
  });
}
