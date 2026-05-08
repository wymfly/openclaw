import { useQuery } from "@tanstack/react-query";
import { fetchChannels, fetchChannelThroughput } from "@/api";
import type { DeckGoChannelsStatusResponse, DeckGoChannelThroughputResponse } from "@/api-types";
import { useDataFabricTransports } from "../../client/scoped-query-provider";
import type { DeckQueryScope } from "../../contracts/query-keys";
import {
  bffQueryOptions,
  bffSource,
  enabledNonEmpty,
  type DataFabricBffTransport,
  type ModuleQueryOptions,
} from "../shared";
import { channelsKeys } from "./keys";

export function channelsListQueryOptions(bff: DataFabricBffTransport, scope?: DeckQueryScope) {
  return bffQueryOptions<DeckGoChannelsStatusResponse>(
    bff,
    bffSource("GET /channels", () => fetchChannels()),
    channelsKeys.list(scope),
    "config-authority",
  );
}

export function channelThroughputQueryOptions(
  bff: DataFabricBffTransport,
  channelId: string,
  window = "1h",
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoChannelThroughputResponse>(
    bff,
    bffSource("GET /channels/{channelId}/throughput", () =>
      fetchChannelThroughput(channelId, window),
    ),
    channelsKeys.throughput(channelId, window, scope),
    "live-workbench",
  );
}

export function useChannelsListQuery(options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...channelsListQueryOptions(bff, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useChannelThroughputQuery(
  channelId: string | null | undefined,
  window = "1h",
  options: ModuleQueryOptions = {},
) {
  const { bff } = useDataFabricTransports();
  const safeChannelId = channelId ?? "";
  return useQuery({
    ...channelThroughputQueryOptions(bff, safeChannelId, window, options.scope),
    enabled: enabledNonEmpty(channelId, options.enabled ?? true),
  });
}
