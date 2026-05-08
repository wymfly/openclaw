import { useQuery } from "@tanstack/react-query";
import {
  fetchChatHistory,
  fetchCompactionCheckpoints,
  fetchSessionDetail,
  fetchSessionPreviews,
  fetchSessions,
  fetchSubagentLineage,
  fetchUsageSessionLogs,
  fetchUsageSessions,
} from "@/api";
import type {
  DeckGoChatHistoryResponse,
  DeckGoCompactionListResponse,
  DeckGoSessionDetailResponse,
  DeckGoSessionsListResponse,
  DeckGoSessionsPreviewResponse,
  DeckGoSubagentsLineageResponse,
  DeckGoUsageSessionLogsResponse,
  DeckGoUsageSessionsResponse,
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
import { sessionsKeys, type SessionDetailFilters, type SessionsListFilters } from "./keys";

export function sessionsListQueryOptions(
  bff: DataFabricBffTransport,
  filters: SessionsListFilters = {},
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoSessionsListResponse>(
    bff,
    bffSource("GET /sessions", () => fetchSessions(filters)),
    sessionsKeys.list(filters, scope),
    "live-workbench",
  );
}

export function sessionPreviewsQueryOptions(
  bff: DataFabricBffTransport,
  keys: readonly string[],
  scope?: DeckQueryScope,
) {
  const safeKeys = [...keys];
  return bffQueryOptions<DeckGoSessionsPreviewResponse>(
    bff,
    bffSource("POST /chat/sessions/preview", () => fetchSessionPreviews(safeKeys)),
    sessionsKeys.previews(safeKeys, scope),
    "lazy-detail",
  );
}

export function sessionDetailQueryOptions(
  bff: DataFabricBffTransport,
  filters: SessionDetailFilters,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoSessionDetailResponse>(
    bff,
    bffSource("GET /sessions/{sessionKey}", () => fetchSessionDetail(filters)),
    sessionsKeys.detailWithFilters(filters, scope),
    "lazy-detail",
  );
}

export function sessionHistoryQueryOptions(
  bff: DataFabricBffTransport,
  sessionKey: string,
  limit = 80,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoChatHistoryResponse>(
    bff,
    bffSource("GET /chat/history", () => fetchChatHistory({ limit, sessionKey })),
    sessionsKeys.history(sessionKey, limit, scope),
    "lazy-detail",
  );
}

export function sessionUsageQueryOptions(
  bff: DataFabricBffTransport,
  sessionKey: string,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoUsageSessionsResponse>(
    bff,
    bffSource("GET /usage/sessions", () =>
      fetchUsageSessions({ includeContextWeight: true, key: sessionKey, limit: 1 }),
    ),
    sessionsKeys.usage(sessionKey, scope),
    "lazy-detail",
  );
}

export function sessionUsageLogsQueryOptions(
  bff: DataFabricBffTransport,
  sessionKey: string,
  limit = 100,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoUsageSessionLogsResponse>(
    bff,
    bffSource("GET /usage/sessions/logs", () => fetchUsageSessionLogs({ key: sessionKey, limit })),
    sessionsKeys.usageLogs(sessionKey, limit, scope),
    "lazy-detail",
  );
}

export function sessionLineageQueryOptions(
  bff: DataFabricBffTransport,
  sessionKey: string,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoSubagentsLineageResponse>(
    bff,
    bffSource("POST /deck/subagents", () => fetchSubagentLineage({ sessionKey })),
    sessionsKeys.lineage(sessionKey, scope),
    "lazy-detail",
  );
}

export function compactionCheckpointsQueryOptions(
  bff: DataFabricBffTransport,
  sessionKey: string,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoCompactionListResponse>(
    bff,
    bffSource("POST /chat/compaction", () => fetchCompactionCheckpoints(sessionKey)),
    sessionsKeys.compactionCheckpoints(sessionKey, scope),
    "lazy-detail",
  );
}

export function useSessionsListQuery(
  filters: SessionsListFilters = {},
  options: ModuleQueryOptions = {},
) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...sessionsListQueryOptions(bff, filters, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useSessionPreviewsQuery(keys: readonly string[], options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...sessionPreviewsQueryOptions(bff, keys, options.scope),
    enabled: (options.enabled ?? true) && keys.length > 0,
  });
}

export function useSessionDetailQuery(
  filters: SessionDetailFilters | null | undefined,
  options: ModuleQueryOptions = {},
) {
  const { bff } = useDataFabricTransports();
  const safeFilters = filters ?? { sessionKey: "" };
  return useQuery({
    ...sessionDetailQueryOptions(bff, safeFilters, options.scope),
    enabled: enabledNonEmpty(filters?.sessionKey, options.enabled ?? true),
  });
}

export function useSessionHistoryQuery(
  sessionKey: string | null | undefined,
  limit = 80,
  options: ModuleQueryOptions = {},
) {
  const { bff } = useDataFabricTransports();
  const safeSessionKey = sessionKey ?? "";
  return useQuery({
    ...sessionHistoryQueryOptions(bff, safeSessionKey, limit, options.scope),
    enabled: enabledNonEmpty(sessionKey, options.enabled ?? true),
  });
}

export function useSessionUsageQuery(
  sessionKey: string | null | undefined,
  options: ModuleQueryOptions = {},
) {
  const { bff } = useDataFabricTransports();
  const safeSessionKey = sessionKey ?? "";
  return useQuery({
    ...sessionUsageQueryOptions(bff, safeSessionKey, options.scope),
    enabled: enabledNonEmpty(sessionKey, options.enabled ?? true),
  });
}

export function useSessionUsageLogsQuery(
  sessionKey: string | null | undefined,
  limit = 100,
  options: ModuleQueryOptions = {},
) {
  const { bff } = useDataFabricTransports();
  const safeSessionKey = sessionKey ?? "";
  return useQuery({
    ...sessionUsageLogsQueryOptions(bff, safeSessionKey, limit, options.scope),
    enabled: enabledNonEmpty(sessionKey, options.enabled ?? true),
  });
}

export function useSessionLineageQuery(
  sessionKey: string | null | undefined,
  options: ModuleQueryOptions = {},
) {
  const { bff } = useDataFabricTransports();
  const safeSessionKey = sessionKey ?? "";
  return useQuery({
    ...sessionLineageQueryOptions(bff, safeSessionKey, options.scope),
    enabled: enabledNonEmpty(sessionKey, options.enabled ?? true),
  });
}

export function useCompactionCheckpointsQuery(
  sessionKey: string | null | undefined,
  options: ModuleQueryOptions = {},
) {
  const { bff } = useDataFabricTransports();
  const safeSessionKey = sessionKey ?? "";
  return useQuery({
    ...compactionCheckpointsQueryOptions(bff, safeSessionKey, options.scope),
    enabled: enabledNonEmpty(sessionKey, options.enabled ?? true),
  });
}
